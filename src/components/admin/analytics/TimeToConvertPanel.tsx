import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DateRange } from 'react-day-picker';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { DateRangeFilter } from '../DateRangeFilter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * How long a lead takes to become a paying customer.
 * Measured from lead arrival (created_at) to the moment it was marked converted.
 */

const BUCKETS: { label: string; min: number; max: number; colour: string }[] = [
  { label: 'Same day', min: 0, max: 1, colour: '#10b981' },
  { label: '1 day', min: 1, max: 2, colour: '#22c55e' },
  { label: '2–3 days', min: 2, max: 4, colour: '#84cc16' },
  { label: '4–7 days', min: 4, max: 8, colour: '#f59e0b' },
  { label: '8–14 days', min: 8, max: 15, colour: '#fb923c' },
  { label: '15–30 days', min: 15, max: 31, colour: '#f97316' },
  { label: '31–60 days', min: 31, max: 61, colour: '#ef4444' },
  { label: '60+ days', min: 61, max: Infinity, colour: '#b91c1c' },
];

const fmtDays = (d: number) => {
  if (d < 1) {
    const hours = d * 24;
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
    return `${hours.toFixed(1)} hrs`;
  }
  return `${d.toFixed(1)} days`;
};

const SOURCE_LABEL: Record<string, string> = {
  website: 'Website',
  google_ad: 'Google Ads',
  social_ad: 'Facebook / Meta',
  bing_ad: 'Bing Ads',
  tiktok_ad: 'TikTok Ads',
  phone: 'Phone',
  email: 'Email',
  referral: 'Referral',
  partner: 'Partner',
  other: 'Other',
};

interface Props {
  dateRange?: DateRange;
}

export const TimeToConvertPanel: React.FC<Props> = ({ dateRange: externalRange }) => {
  const [localRange, setLocalRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 89),
    to: new Date(),
  });
  const range = externalRange?.from ? externalRange : localRange;

  const from = startOfDay(range?.from || subDays(new Date(), 89));
  const to = endOfDay(range?.to || range?.from || new Date());

  const { data, isLoading } = useQuery({
    queryKey: ['time-to-convert', from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_leads')
        .select('id, created_at, converted_at, lead_source')
        .eq('status', 'converted')
        .not('converted_at', 'is', null)
        .gte('converted_at', from.toISOString())
        .lte('converted_at', to.toISOString())
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const stats = useMemo(() => {
    const rows = (data || [])
      .map((r: any) => ({
        source: r.lead_source || 'other',
        days: (new Date(r.converted_at).getTime() - new Date(r.created_at).getTime()) / 86400000,
      }))
      .filter(r => r.days >= 0 && Number.isFinite(r.days));

    const days = rows.map(r => r.days).sort((a, b) => a - b);
    const n = days.length;
    const pct = (p: number) => (n ? days[Math.min(n - 1, Math.floor(p * n))] : 0);

    const buckets = BUCKETS.map(b => ({
      label: b.label,
      colour: b.colour,
      count: rows.filter(r => r.days >= b.min && r.days < b.max).length,
    }));

    const bySourceMap = new Map<string, number[]>();
    rows.forEach(r => {
      const arr = bySourceMap.get(r.source) || [];
      arr.push(r.days);
      bySourceMap.set(r.source, arr);
    });
    const bySource = Array.from(bySourceMap.entries())
      .map(([source, arr]) => {
        const sorted = [...arr].sort((a, b) => a - b);
        return {
          source: SOURCE_LABEL[source] || source,
          count: arr.length,
          avg: arr.reduce((s, v) => s + v, 0) / arr.length,
          median: sorted[Math.floor(sorted.length / 2)],
          max: sorted[sorted.length - 1],
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      n,
      avg: n ? days.reduce((s, v) => s + v, 0) / n : 0,
      median: pct(0.5),
      p90: pct(0.9),
      max: n ? days[n - 1] : 0,
      sameDayPct: n ? Math.round((rows.filter(r => r.days < 1).length / n) * 100) : 0,
      within7Pct: n ? Math.round((rows.filter(r => r.days < 8).length / n) * 100) : 0,
      buckets,
      bySource,
    };
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Time to convert — lead in to payment</CardTitle>
          <CardDescription className="mt-1">
            How many days pass between a lead arriving and that customer paying. Based on converted leads in the selected period.
          </CardDescription>
        </div>
        {!externalRange?.from && (
          <DateRangeFilter dateRange={localRange} onDateRangeChange={setLocalRange} />
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : stats.n === 0 ? (
          <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">
            No converted leads in this period.
          </div>
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Average', value: fmtDays(stats.avg), tone: 'text-emerald-700' },
                { label: 'Typical (median)', value: fmtDays(stats.median), tone: 'text-emerald-700' },
                { label: '9 in 10 within', value: fmtDays(stats.p90), tone: 'text-amber-700' },
                { label: 'Longest', value: fmtDays(stats.max), tone: 'text-rose-700' },
                { label: 'Paid same day', value: `${stats.sameDayPct}%`, tone: 'text-emerald-700' },
                { label: 'Paid within 7 days', value: `${stats.within7Pct}%`, tone: 'text-emerald-700' },
              ].map(k => (
                <div key={k.label} className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className={`text-lg font-bold ${k.tone}`}>{k.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{stats.n.toLocaleString('en-GB')} converted leads</Badge>
              <Badge variant="outline">Median is the honest &quot;normal&quot; — the average is pulled up by slow returners</Badge>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.buckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  formatter={(v: number) => [`${Number(v).toLocaleString('en-GB')} leads`, 'Converted']}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stats.buckets.map(b => (
                    <Cell key={b.label} fill={b.colour} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead source</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">Average</TableHead>
                    <TableHead className="text-right">Typical (median)</TableHead>
                    <TableHead className="text-right">Longest</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.bySource.map(r => (
                    <TableRow key={r.source}>
                      <TableCell className="font-medium">{r.source}</TableCell>
                      <TableCell className="text-right">{r.count.toLocaleString('en-GB')}</TableCell>
                      <TableCell className="text-right">{fmtDays(r.avg)}</TableCell>
                      <TableCell className="text-right">{fmtDays(r.median)}</TableCell>
                      <TableCell className="text-right">{fmtDays(r.max)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
