import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, LineChart, Line, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine,
} from 'recharts';

type Month = {
  month: string; direct_sales: number; direct_revenue: number; step4_reached: number;
  avg_price_12: number | null; avg_price_24: number | null; avg_price_36: number | null;
  bumper_started: number; bumper_completed: number; card_failures: number;
  long_dwell: number; idle_timeout: number; multi_attempt: number; method_thrash: number;
};
type Combo = { month: string; combo: string; avg_price: number; n: number };

// Known price changes, drawn as markers on the charts.
const PRICE_CHANGES = [
  { month: '2026-07', label: '2/3yr +20%' },
  { month: '2026-09', label: '2/3yr +10%' },
];

const label = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
};
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(142 70% 40%)', 'hsl(35 90% 50%)', 'hsl(280 60% 55%)', 'hsl(190 70% 45%)'];

export function DirectSalesTab() {
  const [data, setData] = useState<{ monthly: Month[]; combos: Combo[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.rpc('get_direct_sales_analysis' as any, { _from: '2026-03-01' });
    if (error) setError(error.message); else setData(data as any);
    setLoading(false);
  };
  useEffect(() => {
    load();
    // Keep the figures fresh while the page is open.
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const monthly = useMemo(() => (data?.monthly ?? []).map((m) => ({
    ...m, name: label(m.month),
    conversion: pct(m.direct_sales, m.step4_reached),
    bumper_rate: pct(m.bumper_completed, m.bumper_started),
  })), [data]);

  const combos = useMemo(() => {
    const names = Array.from(new Set((data?.combos ?? []).map((c) => c.combo)));
    const rows = (data?.monthly ?? []).map((m) => {
      const row: Record<string, any> = { name: label(m.month) };
      (data?.combos ?? []).filter((c) => c.month === m.month).forEach((c) => { row[c.combo] = c.avg_price; });
      return row;
    });
    return { names, rows };
  }, [data]);

  // Average price per popular combo before vs after each price rise.
  const beforeAfter = useMemo(() => {
    const periods = [
      { key: 'before', test: (m: string) => m < '2026-07' },
      { key: 'jul', test: (m: string) => m >= '2026-07' && m < '2026-09' },
      { key: 'sep', test: (m: string) => m >= '2026-09' },
    ];
    return combos.names.map((name) => {
      const rows = (data?.combos ?? []).filter((c) => c.combo === name);
      const avg = (f: (m: string) => boolean) => {
        const r = rows.filter((c) => f(c.month));
        const n = r.reduce((a, c) => a + c.n, 0);
        return n ? Math.round(r.reduce((a, c) => a + c.avg_price * c.n, 0) / n) : null;
      };
      const [b, j, s9] = periods.map((p) => avg(p.test));
      return { name: name.replace(/months/, ' months'), b, j, s9 };
    });
  }, [data, combos.names]);

  const problems = useMemo(() => {
    const full = monthly.filter((m) => m.step4_reached > 0);
    if (full.length < 2) return [];
    const first = full[0];
    const last = full.length > 2 ? full[full.length - 2] : full[full.length - 1]; // last full month
    const out: string[] = [];
    if (last.conversion < first.conversion * 0.6)
      out.push(`Step 4 to payment fell from ${first.conversion}% in ${first.name} to ${last.conversion}% in ${last.name} — visitors still reach payment but far fewer pay.`);
    if (last.bumper_rate < first.bumper_rate * 0.6)
      out.push(`Bumper monthly finance completions fell from ${first.bumper_rate}% to ${last.bumper_rate}% of people who started an application.`);
    const stallFirst = first.long_dwell + first.idle_timeout, stallLast = last.long_dwell + last.idle_timeout;
    if (stallLast > stallFirst * 2 && stallLast > 10)
      out.push(`Customers stuck on the payment page (long waits or going idle) rose from ${stallFirst} to ${stallLast} a month.`);
    if (last.card_failures > first.card_failures * 2 && last.card_failures > 5)
      out.push(`Card payment failures rose from ${first.card_failures} to ${last.card_failures} a month.`);
    else out.push(`Card payment failures are low (${last.card_failures} in ${last.name}) — declines are not the main cause.`);
    (['avg_price_12', 'avg_price_24', 'avg_price_36'] as const).forEach((k, i) => {
      const a = first[k], b = last[k];
      if (a && b && b > a * 1.1) out.push(`Average ${[1, 2, 3][i]}-year price shown at Step 4 rose from £${a} to £${b} (+${Math.round((b / a - 1) * 100)}%).`);
    });
    return out;
  }, [monthly]);

  const markers = (key: 'name') => PRICE_CHANGES.map((p) => (
    <ReferenceLine key={p.month} x={label(p.month)} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: p.label, position: 'top', fontSize: 11 }} />
  ));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Direct sales</h2>
          <p className="text-sm text-muted-foreground">Sales customers complete themselves at Step 4, from March 2026. Cancelled and refunded sales are left out. Refreshes automatically every 5 minutes.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
      </div>

      {error && <Card><CardContent className="p-4 text-destructive">{error}</CardContent></Card>}
      {loading && !data && <p className="text-muted-foreground">Loading…</p>}

      {data && (
        <>
          <Card className="border-destructive">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-5 w-5 text-destructive" />Where things are going wrong</CardTitle></CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {problems.length ? problems.map((p) => <li key={p}>{p}</li>) : <li>No major change detected yet.</li>}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Direct sales vs people reaching Step 4</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer>
                <ComposedChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" /><YAxis yAxisId="l" /><YAxis yAxisId="r" orientation="right" unit="%" />
                  <Tooltip /><Legend />
                  <Bar yAxisId="l" dataKey="step4_reached" name="Reached Step 4" fill="hsl(var(--muted-foreground))" />
                  <Bar yAxisId="l" dataKey="direct_sales" name="Direct sales" fill="hsl(var(--primary))" />
                  <Line yAxisId="r" dataKey="conversion" name="Share who bought %" stroke="hsl(var(--destructive))" strokeWidth={2} />
                  {markers('name')}
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Average price shown at Step 4 (by cover length)</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis unit="£" /><Tooltip /><Legend />
                  <Line dataKey="avg_price_12" name="1 year" stroke={COLORS[0]} strokeWidth={2} connectNulls />
                  <Line dataKey="avg_price_24" name="2 years" stroke={COLORS[2]} strokeWidth={2} connectNulls />
                  <Line dataKey="avg_price_36" name="3 years" stroke={COLORS[3]} strokeWidth={2} connectNulls />
                  {markers('name')}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Average price for the most popular cover options</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer>
                <LineChart data={combos.rows}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis unit="£" /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                  {combos.names.map((n, i) => <Line key={n} dataKey={n} name={n.replace(/months/, ' months')} stroke={COLORS[i % COLORS.length]} connectNulls />)}
                  {markers('name')}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Price before vs after each price rise (most popular cover options)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground">
                  <th className="p-2">Cover option</th><th className="p-2">Mar–Jun</th><th className="p-2">After July rise</th><th className="p-2">After September rise</th><th className="p-2">Change</th>
                </tr></thead>
                <tbody>
                  {beforeAfter.map((r) => {
                    const last = r.s9 ?? r.j;
                    const ch = r.b && last ? Math.round((last / r.b - 1) * 100) : null;
                    return (
                      <tr key={r.name} className="border-t">
                        <td className="p-2">{r.name}</td>
                        <td className="p-2">{r.b != null ? `£${r.b}` : '–'}</td>
                        <td className="p-2">{r.j != null ? `£${r.j}` : '–'}</td>
                        <td className="p-2">{r.s9 != null ? `£${r.s9}` : '–'}</td>
                        <td className={`p-2 font-medium ${ch != null && ch > 0 ? 'text-destructive' : ''}`}>{ch != null ? `${ch > 0 ? '+' : ''}${ch}%` : '–'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Where people leave Step 4</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer>
                <ComposedChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis yAxisId="l" /><YAxis yAxisId="r" orientation="right" unit="%" /><Tooltip /><Legend />
                  <Bar yAxisId="l" stackId="s" dataKey="long_dwell" name="Stuck a long time" fill={COLORS[3]} />
                  <Bar yAxisId="l" stackId="s" dataKey="idle_timeout" name="Went idle" fill={COLORS[4]} />
                  <Bar yAxisId="l" stackId="s" dataKey="multi_attempt" name="Tried to pay several times" fill={COLORS[5]} />
                  <Bar yAxisId="l" stackId="s" dataKey="method_thrash" name="Kept switching payment method" fill={COLORS[1]} />
                  <Line yAxisId="r" dataKey="bumper_rate" name="Bumper applications completed %" stroke={COLORS[0]} strokeWidth={2} />
                  {markers('name')}
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Card payment failures at Step 4</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer>
                <ComposedChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip />
                  <Bar dataKey="card_failures" name="Card failures" fill="hsl(var(--destructive))" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Month by month</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground">
                  <th className="p-2">Month</th><th className="p-2">Direct sales</th><th className="p-2">Revenue</th><th className="p-2">Reached Step 4</th><th className="p-2">Bought</th><th className="p-2">Bumper started / done</th><th className="p-2">Stuck / idle</th><th className="p-2">Card failures</th>
                </tr></thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.month} className="border-t">
                      <td className="p-2">{m.name}</td><td className="p-2">{m.direct_sales}</td><td className="p-2">£{m.direct_revenue.toLocaleString('en-GB')}</td>
                      <td className="p-2">{m.step4_reached}</td><td className="p-2">{m.conversion}%</td>
                      <td className="p-2">{m.bumper_started} / {m.bumper_completed}</td><td className="p-2">{m.long_dwell} / {m.idle_timeout}</td><td className="p-2">{m.card_failures}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-3">Struggle signals (stuck/idle) only started being recorded in May 2026, so earlier months show zero. The current month is partial.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
