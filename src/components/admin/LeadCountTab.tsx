import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateRange } from 'react-day-picker';
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DateRangeFilter } from './DateRangeFilter';
import { QuickWeekFilter } from './QuickWeekFilter';
import { QuickMonthFilter } from './QuickMonthFilter';

type Group = 'day' | 'week' | 'month';
type Row = { day: string; counts: Record<string, number>; is_locked: boolean };

const DEAD_KEYS = ['lost', 'wrong_number', 'bought_elsewhere', 'vehicle_sold', 'do_not_contact'];

export const LeadCountTab: React.FC = () => {
  const [range, setRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 29), to: new Date() });
  const [group, setGroup] = useState<Group>('day');
  const from = format(range?.from ?? subDays(new Date(), 29), 'yyyy-MM-dd');
  const to = format(range?.to ?? range?.from ?? new Date(), 'yyyy-MM-dd');

  const { data, isLoading, error } = useQuery({
    queryKey: ['lead-count-report', from, to],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_lead_count_report', { p_from: from, p_to: to });
      if (error) throw error;
      return (data || []) as Row[];
    },
    staleTime: 60_000,
  });

  const { rows, totals, unlockedDays } = useMemo(() => {
    const map = new Map<string, any>();
    const t = { all: 0, fake: 0, dead: 0, live: 0, google: 0, facebook: 0, organic: 0, other: 0 };
    let unlocked = 0;
    (data || []).forEach(r => {
      const c = r.counts || {};
      const n = (k: string) => Number(c[k] || 0);
      const all = n('all_leads'), fake = n('fake'), dead = DEAD_KEYS.reduce((s, k) => s + n(k), 0);
      const g = n('source_google'), f = n('source_facebook'), o = n('source_organic');
      const other = Math.max(0, all - g - f - o);
      const d = new Date(r.day + 'T12:00:00');
      const key = group === 'week' ? format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd') : group === 'month' ? format(startOfMonth(d), 'yyyy-MM') : r.day;
      const label = group === 'week' ? `w/c ${format(startOfWeek(d, { weekStartsOn: 1 }), 'd MMM')}` : group === 'month' ? format(d, 'MMM yyyy') : format(d, 'EEE d MMM');
      if (!map.has(key)) map.set(key, { key, label, all: 0, fake: 0, dead: 0, real: 0, google: 0, facebook: 0, organic: 0, other: 0, locked: true });
      const b = map.get(key);
      b.all += all; b.fake += fake; b.dead += dead; b.real += Math.max(0, all - fake - dead);
      b.google += g; b.facebook += f; b.organic += o; b.other += other;
      if (!r.is_locked) { b.locked = false; unlocked++; }
      t.all += all; t.fake += fake; t.dead += dead; t.google += g; t.facebook += f; t.organic += o; t.other += other;
    });
    t.live = Math.max(0, t.all - t.fake - t.dead);
    return { rows: Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key)), totals: t, unlockedDays: unlocked };
  }, [data, group]);

  const fmt = (n: number) => n.toLocaleString('en-GB');

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-2xl font-semibold">Lead count</h2>
        <p className="text-sm text-muted-foreground">
          Confirmed number of leads that came in each day. Past days use the locked overnight count, so they never change.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <DateRangeFilter dateRange={range} onDateRangeChange={setRange} />
          <QuickWeekFilter dateRange={range} onDateRangeChange={setRange} />
          <QuickMonthFilter dateRange={range} onDateRangeChange={setRange} />
          <div className="flex gap-1">
            {(['day', 'week', 'month'] as Group[]).map(g => (
              <Button key={g} size="sm" variant={group === g ? 'default' : 'outline'} onClick={() => setGroup(g)}>
                By {g}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card><CardContent className="pt-6 text-sm">You don't have access to the lead count, or it couldn't load.</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Leads received', totals.all], ['Real leads', totals.live], ['Fake leads', totals.fake], ['Dead leads', totals.dead],
              ['Google', totals.google], ['Facebook / Meta', totals.facebook], ['Organic', totals.organic], ['Other (phone etc.)', totals.other],
            ].map(([l, v]) => (
              <Card key={l as string}><CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="text-2xl font-bold">{fmt(v as number)}</p>
              </CardContent></Card>
            ))}
          </div>
          {unlockedDays > 0 && (
            <p className="text-xs text-muted-foreground">
              {unlockedDays} day(s) in this range (today, or before 23 Jul 2026) have no locked count yet, so they show the current figure.
            </p>
          )}

          <Card>
            <CardHeader><CardTitle>Received, fake and dead</CardTitle>
              <p className="text-2xl font-bold tabular-nums">
                {isLoading ? 'Loading…' : `${fmt(totals.all)} total leads received`}
              </p>
              <CardDescription>Dead = lost, wrong number, bought elsewhere, vehicle sold, do not contact.</CardDescription></CardHeader>
            <CardContent>
              {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={rows} margin={{ top: 28, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} domain={[0, 'auto']} padding={{ top: 20 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="real" name="Real leads" stackId="a" fill="hsl(var(--primary))" />
                    <Bar dataKey="dead" name="Dead leads" stackId="a" fill="hsl(var(--muted-foreground))" />
                    <Bar dataKey="fake" name="Fake leads" stackId="a" fill="hsl(var(--destructive))">
                      <LabelList dataKey="all" position="top" offset={8} formatter={value => fmt(Number(value))} fill="hsl(var(--foreground))" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>By source</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="google" name="Google" stackId="s" fill="#10b981" />
                  <Bar dataKey="facebook" name="Facebook / Meta" stackId="s" fill="#3b82f6" />
                  <Bar dataKey="organic" name="Organic" stackId="s" fill="#f59e0b" />
                  <Bar dataKey="other" name="Other" stackId="s" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="overflow-x-auto pt-6">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground">
                  {['Period', 'Received', 'Real', 'Fake', 'Dead', 'Google', 'Meta', 'Organic', 'Other', ''].map(h => <th key={h} className="py-2 pr-3">{h}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.key} className="border-t">
                      <td className="py-2 pr-3 font-medium">{r.label}</td>
                      {[r.all, r.real, r.fake, r.dead, r.google, r.facebook, r.organic, r.other].map((v, i) => <td key={i} className="py-2 pr-3">{fmt(v)}</td>)}
                      <td className="py-2">{r.locked ? <Badge variant="secondary">Locked</Badge> : <Badge variant="outline">Live</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default LeadCountTab;
