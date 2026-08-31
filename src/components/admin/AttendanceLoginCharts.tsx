import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, ChevronDown, ChevronUp, LogIn, LogOut, Timer } from 'lucide-react';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export interface AttendanceEmployee {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface DayRow {
  admin_user_id: string;
  date: string;
  total_online_seconds: number;
  first_online_at: string | null;
  last_online_at: string | null;
  session_count: number;
}

interface Point {
  date: string;
  label: string;
  hours: number;
  firstIn: string;
  lastOut: string;
  sessions: number;
}

const RANGES = [7, 14, 30] as const;

const hoursFmt = (h: number) => {
  if (!h) return '—';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
};

export const AttendanceLoginCharts: React.FC<{ employees: AttendanceEmployee[] }> = ({ employees }) => {
  const [days, setDays] = useState<number>(14);
  const [rows, setRows] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const start = useMemo(() => subDays(new Date(), days - 1), [days]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('user_daily_online_time')
      .select('admin_user_id, date, total_online_seconds, first_online_at, last_online_at, session_count')
      .gte('date', format(start, 'yyyy-MM-dd'))
      .lte('date', format(new Date(), 'yyyy-MM-dd'));
    setRows((data || []) as DayRow[]);
    setLoading(false);
  }, [start]);

  useEffect(() => {
    load();
  }, [load]);

  const dayKeys = useMemo(
    () => eachDayOfInterval({ start, end: new Date() }).map((d) => format(d, 'yyyy-MM-dd')),
    [start]
  );

  const seriesByUser = useMemo(() => {
    const byUser = new Map<string, Map<string, DayRow>>();
    rows.forEach((r) => {
      if (!byUser.has(r.admin_user_id)) byUser.set(r.admin_user_id, new Map());
      byUser.get(r.admin_user_id)!.set(r.date, r);
    });
    const out = new Map<string, Point[]>();
    employees.forEach((e) => {
      const m = byUser.get(e.id);
      out.set(
        e.id,
        dayKeys.map((k) => {
          const r = m?.get(k);
          const sameDay = (iso: string | null) => (iso && iso.slice(0, 10) === k ? format(new Date(iso), 'HH:mm') : '—');
          return {
            date: k,
            label: format(new Date(`${k}T00:00:00`), 'EEE d'),
            hours: r ? Math.round(((r.total_online_seconds || 0) / 3600) * 100) / 100 : 0,
            firstIn: sameDay(r?.first_online_at ?? null),
            lastOut: sameDay(r?.last_online_at ?? null),
            sessions: r?.session_count || 0,
          };
        })
      );
    });
    return out;
  }, [rows, employees, dayKeys]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5" /> Login times and hours per employee
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Daily hours online, first login and last activity for each team member.
            </p>
          </div>
          <div className="flex items-center gap-1">
            {RANGES.map((r) => (
              <Button
                key={r}
                size="sm"
                variant={days === r ? 'default' : 'outline'}
                onClick={() => setDays(r)}
              >
                {r} days
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground py-6 text-center">Loading login history…</p>}
        {!loading && employees.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">No team members match this filter.</p>
        )}
        {!loading &&
          employees.map((e) => {
            const name = `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.email;
            const points = seriesByUser.get(e.id) || [];
            const totalHours = points.reduce((s, p) => s + p.hours, 0);
            const workedDays = points.filter((p) => p.hours > 0).length;
            const avg = workedDays ? totalHours / workedDays : 0;
            const today = points[points.length - 1];
            const isOpen = expanded[e.id] ?? true;

            return (
              <div key={e.id} className="border rounded-lg">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [e.id]: !isOpen }))}
                  className="w-full flex flex-wrap items-center justify-between gap-3 p-3 text-left hover:bg-muted/40 rounded-lg"
                >
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-muted-foreground">{e.email}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                      <Timer className="h-3 w-3" /> {hoursFmt(totalHours)} total
                    </Badge>
                    <Badge variant="outline">Avg {hoursFmt(avg)}/day</Badge>
                    <Badge variant="outline" className="gap-1">
                      <LogIn className="h-3 w-3" /> {today?.firstIn || '—'}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <LogOut className="h-3 w-3" /> {today?.lastOut || '—'}
                    </Badge>
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={points} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={days > 14 ? -45 : 0} height={days > 14 ? 46 : 20} textAnchor={days > 14 ? 'end' : 'middle'} />
                        <YAxis tick={{ fontSize: 11 }} unit="h" allowDecimals={false} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const p = payload[0].payload as Point;
                            return (
                              <div className="rounded-md border bg-background p-2 text-xs shadow-md">
                                <div className="font-medium">{format(new Date(`${p.date}T00:00:00`), 'EEE d MMM')}</div>
                                <div>Online: {hoursFmt(p.hours)}</div>
                                <div>First login: {p.firstIn}</div>
                                <div>Last activity: {p.lastOut}</div>
                                <div>Sessions: {p.sessions}</div>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="hours" radius={[3, 3, 0, 0]}>
                          {points.map((p) => (
                            <Cell
                              key={p.date}
                              fill={p.hours >= 6 ? 'hsl(142 71% 45%)' : p.hours > 0 ? 'hsl(38 92% 50%)' : 'hsl(215 20% 88%)'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="mt-2 overflow-x-auto">
                      <div className="flex gap-2 min-w-max">
                        {points.map((p) => (
                          <div key={p.date} className="text-[11px] border rounded px-2 py-1 min-w-[86px]">
                            <div className="font-medium">{p.label}</div>
                            <div className="text-muted-foreground">In {p.firstIn}</div>
                            <div className="text-muted-foreground">Out {p.lastOut}</div>
                            <div>{hoursFmt(p.hours)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
};

export default AttendanceLoginCharts;
