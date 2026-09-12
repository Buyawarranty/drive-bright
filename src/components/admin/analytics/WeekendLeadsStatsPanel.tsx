import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { DateRange } from 'react-day-picker';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { DateRangeFilter } from '../DateRangeFilter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * Weekend leads stats.
 *
 * Answers: do leads that arrive on Saturday and Sunday convert as well as weekday
 * leads, and do they convert on the weekend itself or later in the week? That tells
 * us whether a full-time weekend agent is worth it or part-time cover is enough.
 *
 * Everything is measured in London time so Saturday/Sunday match the real rota.
 */

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
type DayKey = typeof DAY_ORDER[number];

const londonParts = (d: Date) => {
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short' }).format(d);
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
  return { day: day as DayKey, date };
};

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

interface Props {
  dateRange?: DateRange;
}

export const WeekendLeadsStatsPanel: React.FC<Props> = ({ dateRange: externalRange }) => {
  const [localRange, setLocalRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 89),
    to: new Date(),
  });
  const range = externalRange?.from ? externalRange : localRange;

  const from = startOfDay(range?.from || subDays(new Date(), 89));
  const to = endOfDay(range?.to || range?.from || new Date());

  const { data, isLoading } = useQuery({
    queryKey: ['weekend-leads-stats', from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_leads')
        .select('id, created_at, converted_at, status, assigned_to')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .limit(50000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const stats = useMemo(() => {
    const rows = (data || []).map((r: any) => {
      const created = new Date(r.created_at);
      const arrival = londonParts(created);
      const converted = r.converted_at ? new Date(r.converted_at) : null;
      const convDay = converted ? londonParts(converted) : null;
      return {
        arrivalDay: arrival.day,
        arrivalDate: arrival.date,
        isWeekend: arrival.day === 'Sat' || arrival.day === 'Sun',
        converted: (r.status || '') === 'converted' && !!converted,
        convDay: convDay?.day || null,
        convDate: convDate(convDay?.date),
        sameDay: convDay ? convDay.date === arrival.date : false,
        days: converted ? (converted.getTime() - created.getTime()) / 86400000 : null,
        assigned: !!r.assigned_to,
      };
    });

    function convDate(v?: string) { return v || null; }

    // Per arrival weekday
    const byDay = DAY_ORDER.map(day => {
      const dayRows = rows.filter(r => r.arrivalDay === day);
      const conv = dayRows.filter(r => r.converted);
      const dates = new Set(dayRows.map(r => r.arrivalDate));
      return {
        day,
        leads: dayRows.length,
        converted: conv.length,
        rate: pct(conv.length, dayRows.length),
        perDay: dates.size ? Math.round((dayRows.length / dates.size) * 10) / 10 : 0,
        weekend: day === 'Sat' || day === 'Sun',
      };
    });

    const weekend = rows.filter(r => r.isWeekend);
    const weekday = rows.filter(r => !r.isWeekend);
    const weekendConv = weekend.filter(r => r.converted);
    const weekdayConv = weekday.filter(r => r.converted);

    // Where do weekend leads actually convert?
    const whenMap = new Map<DayKey, number>();
    weekendConv.forEach(r => {
      if (r.convDay) whenMap.set(r.convDay, (whenMap.get(r.convDay) || 0) + 1);
    });
    const whenConverted = DAY_ORDER.map(day => ({
      day,
      count: whenMap.get(day) || 0,
      weekend: day === 'Sat' || day === 'Sun',
    }));

    const sameWeekendDay = weekendConv.filter(r => r.sameDay).length;
    const onWeekend = weekendConv.filter(r => r.convDay === 'Sat' || r.convDay === 'Sun').length;
    const laterWeekday = weekendConv.length - onWeekend;

    const avgDays = (list: typeof rows) => {
      const d = list.map(r => r.days!).filter(v => typeof v === 'number' && Number.isFinite(v) && v >= 0);
      return d.length ? Math.round((d.reduce((s, v) => s + v, 0) / d.length) * 10) / 10 : 0;
    };

    // Worked vs not worked weekend leads
    const weekendAssigned = weekend.filter(r => r.assigned);
    const weekendUnassigned = weekend.filter(r => !r.assigned);

    const weekendDates = new Set(weekend.map(r => r.arrivalDate));
    const weekdayDates = new Set(weekday.map(r => r.arrivalDate));

    return {
      byDay,
      whenConverted,
      weekend: {
        leads: weekend.length,
        converted: weekendConv.length,
        rate: pct(weekendConv.length, weekend.length),
        perDay: weekendDates.size ? Math.round((weekend.length / weekendDates.size) * 10) / 10 : 0,
        avgDays: avgDays(weekendConv),
      },
      weekday: {
        leads: weekday.length,
        converted: weekdayConv.length,
        rate: pct(weekdayConv.length, weekday.length),
        perDay: weekdayDates.size ? Math.round((weekday.length / weekdayDates.size) * 10) / 10 : 0,
        avgDays: avgDays(weekdayConv),
      },
      sameWeekendDay,
      onWeekend,
      laterWeekday,
      onWeekendPct: pct(onWeekend, weekendConv.length),
      sameDayPct: pct(sameWeekendDay, weekendConv.length),
      assignedRate: pct(weekendAssigned.filter(r => r.converted).length, weekendAssigned.length),
      unassignedRate: pct(weekendUnassigned.filter(r => r.converted).length, weekendUnassigned.length),
      assignedLeads: weekendAssigned.length,
      unassignedLeads: weekendUnassigned.length,
    };
  }, [data]);

  const verdict = useMemo(() => {
    const w = stats.weekend;
    const d = stats.weekday;
    if (!w.leads) return null;
    const gap = w.rate - d.rate;
    const share = pct(w.leads, w.leads + d.leads);
    if (stats.onWeekendPct >= 40 && gap >= -0.5) {
      return {
        tone: 'text-emerald-700',
        text: `Worth full-time weekend cover: ${stats.onWeekendPct}% of weekend leads are won on the weekend itself, and weekend leads convert at ${w.rate}% against ${d.rate}% on weekdays. Weekend is ${share}% of all leads.`,
      };
    }
    if (stats.onWeekendPct >= 20) {
      return {
        tone: 'text-amber-700',
        text: `Part-time weekend cover looks right: ${stats.onWeekendPct}% of weekend leads are won on the weekend, the rest close later in the week. Weekend leads convert at ${w.rate}% against ${d.rate}% on weekdays.`,
      };
    }
    return {
      tone: 'text-slate-700',
      text: `Most weekend leads still convert later in the week (only ${stats.onWeekendPct}% close on the weekend), so a short weekend shift to answer and book callbacks is enough. Weekend leads convert at ${w.rate}% against ${d.rate}% on weekdays.`,
    };
  }, [stats]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Weekend leads stats</CardTitle>
          <CardDescription className="mt-1">
            Do Saturday and Sunday leads convert as well as weekday leads, and are they won on the weekend
            or later in the week? Use this to decide between full-time, part-time or no weekend cover.
          </CardDescription>
        </div>
        {!externalRange?.from && (
          <DateRangeFilter dateRange={localRange} onDateRangeChange={setLocalRange} />
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading weekend lead stats…</div>
        ) : stats.weekend.leads === 0 ? (
          <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">
            No weekend leads in this period.
          </div>
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Weekend leads', value: stats.weekend.leads.toLocaleString('en-GB'), tone: 'text-slate-900' },
                { label: 'Weekend conversion', value: `${stats.weekend.rate}%`, tone: 'text-emerald-700' },
                { label: 'Weekday conversion', value: `${stats.weekday.rate}%`, tone: 'text-blue-700' },
                { label: 'Won on the weekend', value: `${stats.onWeekendPct}%`, tone: 'text-amber-700' },
                { label: 'Won same day', value: `${stats.sameDayPct}%`, tone: 'text-amber-700' },
                { label: 'Days to win (weekend)', value: `${stats.weekend.avgDays}`, tone: 'text-slate-900' },
              ].map(k => (
                <div key={k.label} className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className={`text-lg font-bold ${k.tone}`}>{k.value}</p>
                </div>
              ))}
            </div>

            {verdict && (
              <div className="rounded-lg border-2 border-dashed p-3">
                <p className="text-xs font-medium text-muted-foreground">Is weekend working worth it?</p>
                <p className={`mt-1 text-sm font-semibold ${verdict.tone}`}>{verdict.text}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{stats.weekend.perDay} weekend leads a day</Badge>
              <Badge variant="secondary">{stats.weekday.perDay} weekday leads a day</Badge>
              <Badge variant="outline">{stats.weekend.converted.toLocaleString('en-GB')} weekend leads won</Badge>
              <Badge variant="outline">{stats.laterWeekday.toLocaleString('en-GB')} won later in the week</Badge>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Conversion by the day the lead arrived (%) — Saturday and Sunday in amber
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.byDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: number, name: string) =>
                      name === 'rate'
                        ? [`${v}%`, 'Conversion']
                        : [Number(v).toLocaleString('en-GB'), name === 'leads' ? 'Leads in' : 'Won']
                    }
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }}
                  />
                  <Legend formatter={(v) => (v === 'rate' ? 'Conversion %' : v === 'leads' ? 'Leads in' : 'Won')} />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {stats.byDay.map(d => (
                      <Cell key={d.day} fill={d.weekend ? '#f59e0b' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Weekend leads — the day they were actually won
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.whenConverted}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: number) => [`${Number(v).toLocaleString('en-GB')} won`, 'Weekend leads']}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats.whenConverted.map(d => (
                      <Cell key={d.day} fill={d.weekend ? '#f59e0b' : '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day lead arrived</TableHead>
                    <TableHead className="text-right">Leads in</TableHead>
                    <TableHead className="text-right">Leads a day</TableHead>
                    <TableHead className="text-right">Won</TableHead>
                    <TableHead className="text-right">Conversion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.byDay.map(d => (
                    <TableRow key={d.day} className={d.weekend ? 'bg-amber-50' : undefined}>
                      <TableCell className="font-medium">{d.day}{d.weekend ? ' (weekend)' : ''}</TableCell>
                      <TableCell className="text-right">{d.leads.toLocaleString('en-GB')}</TableCell>
                      <TableCell className="text-right">{d.perDay}</TableCell>
                      <TableCell className="text-right">{d.converted.toLocaleString('en-GB')}</TableCell>
                      <TableCell className="text-right font-semibold">{d.rate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">Weekend leads given to an agent</p>
                <p className="text-lg font-bold text-emerald-700">{stats.assignedRate}% won</p>
                <p className="text-xs text-muted-foreground">{stats.assignedLeads.toLocaleString('en-GB')} leads</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">Weekend leads left with nobody</p>
                <p className="text-lg font-bold text-rose-700">{stats.unassignedRate}% won</p>
                <p className="text-xs text-muted-foreground">{stats.unassignedLeads.toLocaleString('en-GB')} leads</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
