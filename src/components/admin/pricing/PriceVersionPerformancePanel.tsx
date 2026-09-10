import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, TrendingUp, Trophy } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PricingVersion } from '@/hooks/usePricingVersions';

/**
 * PRICE VERSION PERFORMANCE
 * -------------------------------------------------------------------------
 * For every price model in the log, what the money and the conversion did while
 * that model was live: checkouts started, sales taken, conversion rate, revenue,
 * AOV and revenue per day — plus graphs so the best-converting price logic is
 * obvious at a glance.
 *
 * Sales come from customers.signup_date (cancelled/refunded excluded, per the
 * revenue rule). Checkouts started come from abandoned_carts.created_at, which
 * covers both converted and abandoned baskets, so conversion = sales / checkouts.
 */

type Sale = { date: string; amount: number };
type CartRow = { date: string; converted: boolean };

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
const pct = (n: number) => `${(Math.round(n * 10) / 10).toFixed(1)}%`;

function averageGridPrice(v: PricingVersion): number | null {
  const m: any = v.admin_matrix;
  if (!m) return null;
  const values: number[] = [];
  for (const term of Object.values(m) as any[]) {
    if (!term || typeof term !== 'object') continue;
    for (const excess of Object.values(term) as any[]) {
      if (!excess || typeof excess !== 'object') continue;
      for (const cell of Object.values(excess) as any[]) {
        const n = Number(cell);
        if (Number.isFinite(n) && n > 0) values.push(n);
      }
    }
  }
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function pagedFetch<T>(
  run: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>,
  map: (row: any) => T | null,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 20; page++) {
    const from = page * 1000;
    const { data, error } = await Promise.resolve(run(from, from + 999));
    if (error) throw error;
    (data || []).forEach((row) => {
      const mapped = map(row);
      if (mapped) out.push(mapped);
    });
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default function PriceVersionPerformancePanel({ versions }: { versions: PricingVersion[] }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [carts, setCarts] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Only versions that actually went live can own a trading window.
  const timeline = useMemo(() => {
    const live = versions
      .filter((v) => v.published_at)
      .map((v) => ({ v, start: new Date(v.published_at as string) }))
      .filter((r) => Number.isFinite(r.start.getTime()))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    return live.map((row, i) => ({
      version: row.v,
      startKey: format(row.start, 'yyyy-MM-dd'),
      endKey: live[i + 1]
        ? format(live[i + 1].start, 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd'),
      isLive: i === live.length - 1,
    }));
  }, [versions]);

  const earliestISO = timeline.length ? new Date(`${timeline[0].startKey}T00:00:00Z`).toISOString() : null;

  useEffect(() => {
    if (!earliestISO) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [saleRows, cartRows] = await Promise.all([
          pagedFetch<Sale>(
            (from, to) =>
              supabase
                .from('customers')
                .select('id, final_amount, signup_date, status')
                .gte('signup_date', earliestISO)
                .order('signup_date', { ascending: true })
                .range(from, to),
            (c) => {
              const status = (c.status || '').toLowerCase();
              if (status.includes('cancelled') || status.includes('refunded')) return null;
              if (!c.signup_date) return null;
              return { date: format(new Date(c.signup_date), 'yyyy-MM-dd'), amount: Number(c.final_amount) || 0 };
            },
          ),
          pagedFetch<CartRow>(
            (from, to) =>
              supabase
                .from('abandoned_carts')
                .select('id, created_at, is_converted')
                .gte('created_at', earliestISO)
                .order('created_at', { ascending: true })
                .range(from, to),
            (c) =>
              c.created_at
                ? { date: format(new Date(c.created_at), 'yyyy-MM-dd'), converted: c.is_converted === true }
                : null,
          ),
        ]);
        if (cancelled) return;
        setSales(saleRows);
        setCarts(cartRows);
      } catch {
        // panel degrades to prices only
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [earliestISO]);

  const rows = useMemo(() => {
    return timeline
      .map((t) => {
        const windowSales = sales.filter((s) => s.date >= t.startKey && s.date <= t.endKey);
        const windowCarts = carts.filter((c) => c.date >= t.startKey && c.date <= t.endKey);
        const revenue = windowSales.reduce((s, r) => s + r.amount, 0);
        const orders = windowSales.length;
        const checkouts = windowCarts.length;
        const days = Math.max(
          1,
          Math.round(
            (new Date(t.endKey).getTime() - new Date(t.startKey).getTime()) / 86_400_000,
          ) + 1,
        );
        return {
          id: t.version.id,
          label: t.version.label || 'Untitled',
          isLive: t.isLive,
          startKey: t.startKey,
          endKey: t.endKey,
          days,
          avgGrid: averageGridPrice(t.version),
          revenue,
          orders,
          checkouts,
          conversion: checkouts ? (orders / checkouts) * 100 : 0,
          aov: orders ? revenue / orders : 0,
          perDay: revenue / days,
        };
      })
      .reverse();
  }, [timeline, sales, carts]);

  const shown = showAll ? rows : rows.slice(0, 8);

  // Best price logic = highest revenue per day with a meaningful sample.
  const best = useMemo(() => {
    const eligible = rows.filter((r) => r.orders >= 5);
    if (!eligible.length) return null;
    return eligible.reduce((a, b) => (b.perDay > a.perDay ? b : a));
  }, [rows]);

  const chartData = useMemo(
    () =>
      [...shown].reverse().map((r) => ({
        name: r.label.length > 18 ? `${r.label.slice(0, 17)}…` : r.label,
        conversion: Math.round(r.conversion * 10) / 10,
        aov: Math.round(r.aov),
        perDay: Math.round(r.perDay),
        avgGrid: r.avgGrid ? Math.round(r.avgGrid) : 0,
        isBest: best?.id === r.id,
      })),
    [shown, best],
  );

  // Daily revenue with a marker where each price model went live.
  const dailySeries = useMemo(() => {
    const map: Record<string, { date: string; revenue: number; orders: number }> = {};
    sales.forEach((s) => {
      const b = (map[s.date] ||= { date: s.date, revenue: 0, orders: 0 });
      b.revenue += s.amount;
      b.orders += 1;
    });
    return Object.values(map).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [sales]);

  /* ---------------------------------------------------------------------
   * SUSTAINED PERFORMANCE
   * Only price models that traded for a full run (7+ days by default) can
   * be judged fairly — a single strong day is noise, not a trend.
   * ------------------------------------------------------------------- */
  const sustained = useMemo(
    () => rows.filter((r) => r.days >= minDays && r.orders > 0),
    [rows, minDays],
  );

  const bestSustained = useMemo(() => {
    const eligible = sustained.filter((r) => r.orders >= 5);
    if (!eligible.length) return null;
    return eligible.reduce((a, b) => (b.conversion > a.conversion ? b : a));
  }, [sustained]);

  const sustainedChart = useMemo(
    () =>
      [...sustained].reverse().map((r) => ({
        name: r.label.length > 18 ? `${r.label.slice(0, 17)}…` : r.label,
        conversion: Math.round(r.conversion * 100) / 100,
        salesPerDay: Math.round((r.orders / r.days) * 100) / 100,
        days: r.days,
        isBest: bestSustained?.id === r.id,
      })),
    [sustained, bestSustained],
  );

  // Rolling 7-day conversion over the whole history, so a good week is visible
  // as a sustained lift rather than one spike.
  const rollingSeries = useMemo(() => {
    const byDay: Record<string, { orders: number; checkouts: number }> = {};
    sales.forEach((s) => {
      const b = (byDay[s.date] ||= { orders: 0, checkouts: 0 });
      b.orders += 1;
    });
    carts.forEach((c) => {
      const b = (byDay[c.date] ||= { orders: 0, checkouts: 0 });
      b.checkouts += 1;
    });
    const days = Object.keys(byDay).sort();
    const WINDOW = 7;
    return days.map((date, i) => {
      const slice = days.slice(Math.max(0, i - WINDOW + 1), i + 1);
      const orders = slice.reduce((s, d) => s + byDay[d].orders, 0);
      const checkouts = slice.reduce((s, d) => s + byDay[d].checkouts, 0);
      return {
        date,
        rollingConversion: checkouts ? Math.round((orders / checkouts) * 1000) / 10 : 0,
        rollingSalesPerDay: Math.round((orders / slice.length) * 100) / 100,
      };
    });
  }, [sales, carts]);

  if (!timeline.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> Price version performance
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No price model has been pushed live yet, so there is nothing to compare.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" /> Price version performance
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          How each price model traded while it was live: checkouts started, sales taken, conversion rate,
          revenue, AOV and revenue per day. Sales exclude cancelled and refunded orders. Conversion is
          sales divided by checkouts started in the same window.
        </p>
        {best && (
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-amber-600" />
            <span>
              Best performing so far: <strong>{best.label}</strong> — {money(best.perDay)}/day,{' '}
              {pct(best.conversion)} conversion, AOV {money(best.aov)}.
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold mb-1">Conversion rate by price model</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Bar dataKey="conversion" radius={[4, 4, 0, 0]}>
                    {chartData.map((d) => (
                      <Cell
                        key={d.name}
                        fill={d.isBest ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-1">Average grid price vs AOV and revenue per day</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => money(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="avgGrid" name="Avg grid price" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="aov" name="AOV" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="perDay" name="Revenue/day" fill="hsl(var(--accent-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold mb-1">Daily revenue, with each price change marked</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySeries} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any, n: any) => (n === 'revenue' ? money(Number(v)) : v)} />
                {timeline.map((t) => (
                  <ReferenceLine
                    key={t.version.id}
                    x={t.startKey}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="4 4"
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Price model</th>
                <th className="py-2 pr-3 font-medium">Live window</th>
                <th className="py-2 pr-3 font-medium text-right">Avg grid</th>
                <th className="py-2 pr-3 font-medium text-right">Checkouts</th>
                <th className="py-2 pr-3 font-medium text-right">Sales</th>
                <th className="py-2 pr-3 font-medium text-right">Conversion</th>
                <th className="py-2 pr-3 font-medium text-right">Revenue</th>
                <th className="py-2 pr-3 font-medium text-right">AOV</th>
                <th className="py-2 font-medium text-right">Revenue/day</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.label}</span>
                      {r.isLive && <Badge className="bg-emerald-600 text-[10px]">Live now</Badge>}
                      {best?.id === r.id && (
                        <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">
                          Best
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {format(new Date(r.startKey), 'd MMM')} – {format(new Date(r.endKey), 'd MMM yyyy')} · {r.days}d
                  </td>
                  <td className="py-2 pr-3 text-right">{r.avgGrid ? money(r.avgGrid) : '—'}</td>
                  <td className="py-2 pr-3 text-right">{r.checkouts.toLocaleString('en-GB')}</td>
                  <td className="py-2 pr-3 text-right">{r.orders.toLocaleString('en-GB')}</td>
                  <td className="py-2 pr-3 text-right font-semibold">
                    {r.checkouts ? pct(r.conversion) : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right">{money(r.revenue)}</td>
                  <td className="py-2 pr-3 text-right">{r.orders ? money(r.aov) : '—'}</td>
                  <td className="py-2 text-right font-semibold">{money(r.perDay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length > 8 && (
          <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show fewer' : `Show all ${rows.length} price models`}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Windows run from the moment a model was pushed live until the next model went live, so a model
          published mid-day shares that day with the previous one. Conversion needs at least 5 sales before
          a model is considered for “Best”.
        </p>
      </CardContent>
    </Card>
  );
}
