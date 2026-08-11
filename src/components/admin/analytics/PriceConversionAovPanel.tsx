import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PoundSterling, TrendingUp, Info } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface Props {
  dateRange?: DateRange;
}

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
const EXCLUDED = ['cancelled', 'refunded'];
const WON_STATUSES = ['converted', 'upgraded'];

/** Price bands used for both the quoted-price conversion curve and sold AOV. */
const BANDS = [
  { key: '<350', min: 0, max: 349.999 },
  { key: '350–399', min: 350, max: 399.999 },
  { key: '400–449', min: 400, max: 449.999 },
  { key: '450–499', min: 450, max: 499.999 },
  { key: '500–599', min: 500, max: 599.999 },
  { key: '600–699', min: 600, max: 699.999 },
  { key: '700–799', min: 700, max: 799.999 },
  { key: '800+', min: 800, max: Infinity },
];

const bandOf = (amount: number) => BANDS.find(b => amount >= b.min && amount <= b.max)?.key ?? null;

type LeadRow = { quote_amount: number | null; status: string | null; quoted_term: string | null };
type SaleRow = { final_amount: number | null; status: string | null; signup_date: string | null; plan_type: string | null };

export const PriceConversionAovPanel: React.FC<Props> = ({ dateRange }) => {
  const [termFilter, setTermFilter] = useState<'all' | '12months' | '24months' | '36months'>('all');

  const from = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null;
  const to = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null;

  const { data, isLoading } = useQuery({
    queryKey: ['price-conversion-aov', from, to],
    queryFn: async () => {
      // Quoted leads — the conversion curve. Paged to clear the 1,000-row API cap.
      const leads: LeadRow[] = [];
      for (let page = 0; page < 30; page++) {
        let q = supabase
          .from('sales_leads')
          .select('quote_amount, status, quoted_term')
          .not('quote_amount', 'is', null)
          .gt('quote_amount', 0)
          .range(page * 1000, page * 1000 + 999);
        if (from) q = q.gte('created_at', `${from}T00:00:00`);
        if (to) q = q.lte('created_at', `${to}T23:59:59`);
        const { data: rows, error } = await q;
        if (error) throw error;
        leads.push(...((rows as LeadRow[]) || []));
        if (!rows || rows.length < 1000) break;
      }

      // Actual sales — average order value.
      const sales: SaleRow[] = [];
      for (let page = 0; page < 30; page++) {
        let q = supabase
          .from('customers')
          .select('final_amount, status, signup_date, plan_type')
          .not('final_amount', 'is', null)
          .gt('final_amount', 0)
          .range(page * 1000, page * 1000 + 999);
        if (from) q = q.gte('signup_date', `${from}T00:00:00`);
        if (to) q = q.lte('signup_date', `${to}T23:59:59`);
        const { data: rows, error } = await q;
        if (error) throw error;
        sales.push(...((rows as SaleRow[]) || []));
        if (!rows || rows.length < 1000) break;
      }

      // How complete is the new quoted-price capture?
      let coverageQ = supabase.from('sales_leads').select('id', { count: 'exact', head: true });
      if (from) coverageQ = coverageQ.gte('created_at', `${from}T00:00:00`);
      if (to) coverageQ = coverageQ.lte('created_at', `${to}T23:59:59`);
      const { count: totalLeads } = await coverageQ;

      return { leads, sales, totalLeads: totalLeads ?? 0 };
    },
  });

  const leads = useMemo(
    () =>
      (data?.leads || []).filter(l => termFilter === 'all' || (l.quoted_term || '') === termFilter),
    [data?.leads, termFilter],
  );

  const sales = useMemo(
    () => (data?.sales || []).filter(s => !EXCLUDED.includes((s.status || '').toLowerCase())),
    [data?.sales],
  );

  /** Conversion curve: for every quoted price band, how often we win and what it earns per quote. */
  const curve = useMemo(() => {
    const rows = BANDS.map(b => ({ band: b.key, quoted: 0, won: 0 }));
    leads.forEach(l => {
      const key = bandOf(Number(l.quote_amount));
      const row = rows.find(r => r.band === key);
      if (!row) return;
      row.quoted += 1;
      if (WON_STATUSES.includes((l.status || '').toLowerCase())) row.won += 1;
    });
    return rows.map(r => {
      const mid = BANDS.find(b => b.key === r.band)!;
      const midPrice = mid.max === Infinity ? 950 : (mid.min + mid.max) / 2;
      const convPct = r.quoted ? (r.won / r.quoted) * 100 : 0;
      return { ...r, midPrice, convPct, revenuePerQuote: (convPct / 100) * midPrice };
    });
  }, [leads]);

  const bestBand = useMemo(() => {
    const scored = curve.filter(r => r.quoted >= 20);
    if (!scored.length) return null;
    return scored.reduce((a, b) => (b.revenuePerQuote > a.revenuePerQuote ? b : a));
  }, [curve]);

  /** Sold-price distribution + AOV — works even before the quoted-price data matures. */
  const soldByBand = useMemo(() => {
    const rows = BANDS.map(b => ({ band: b.key, sales: 0, revenue: 0 }));
    sales.forEach(s => {
      const key = bandOf(Number(s.final_amount));
      const row = rows.find(r => r.band === key);
      if (!row) return;
      row.sales += 1;
      row.revenue += Number(s.final_amount) || 0;
    });
    return rows;
  }, [sales]);

  const totals = useMemo(() => {
    const revenue = sales.reduce((sum, s) => sum + (Number(s.final_amount) || 0), 0);
    return {
      orders: sales.length,
      revenue,
      aov: sales.length ? revenue / sales.length : 0,
      quotedLeads: leads.length,
    };
  }, [sales, leads]);

  const monthly = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number }>();
    sales.forEach(s => {
      if (!s.signup_date) return;
      const key = s.signup_date.slice(0, 7);
      const entry = map.get(key) || { orders: 0, revenue: 0 };
      entry.orders += 1;
      entry.revenue += Number(s.final_amount) || 0;
      map.set(key, entry);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, v]) => ({ month, ...v, aov: v.orders ? v.revenue / v.orders : 0 }));
  }, [sales]);

  const coveragePct = data?.totalLeads ? (leads.length / data.totalLeads) * 100 : 0;
  const maxRpq = Math.max(1, ...curve.map(r => r.revenuePerQuote));
  const maxSales = Math.max(1, ...soldByBand.map(r => r.sales));

  return (
    <div className="space-y-4">
      {coveragePct < 25 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Quoted-price capture is still filling up.</strong> Every price a customer is shown on
            the website pricing page, and every quote an agent emails, is now written back to the lead.
            Only <strong>{leads.length.toLocaleString('en-GB')}</strong> of{' '}
            {(data?.totalLeads || 0).toLocaleString('en-GB')} leads in this range carry a quoted price
            ({coveragePct.toFixed(1)}%), so the conversion curve below is indicative until roughly two
            weeks of traffic has been recorded. Average order value is measured from real sales and is
            reliable now.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Average order value', value: gbp(totals.aov), icon: PoundSterling },
          { label: 'Orders', value: totals.orders.toLocaleString('en-GB'), icon: TrendingUp },
          { label: 'Revenue', value: gbp(totals.revenue), icon: PoundSterling },
          { label: 'Leads with a quoted price', value: totals.quotedLeads.toLocaleString('en-GB'), icon: Info },
        ].map(card => (
          <Card key={card.label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Quoted price vs conversion — what earns most per quote</CardTitle>
              <CardDescription className="text-xs">
                Revenue per quote = conversion rate × mid-band price. The highest bar is the price point
                that makes the most money, not the cheapest or the dearest.
              </CardDescription>
            </div>
            <div className="flex gap-1">
              {(['all', '12months', '24months', '36months'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTermFilter(t)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
                    termFilter === t
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:bg-muted/70',
                  )}
                >
                  {t === 'all' ? 'All terms' : t.replace('months', ' months')}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Quoted price</th>
                    <th className="py-2 pr-3 text-right">Quotes</th>
                    <th className="py-2 pr-3 text-right">Won</th>
                    <th className="py-2 pr-3 text-right">Conversion</th>
                    <th className="py-2 pr-3 text-right">Revenue per quote</th>
                    <th className="py-2 w-1/3" />
                  </tr>
                </thead>
                <tbody>
                  {curve.map(r => (
                    <tr
                      key={r.band}
                      className={cn(
                        'border-b border-border/50',
                        bestBand?.band === r.band && 'bg-emerald-500/10',
                      )}
                    >
                      <td className="py-2 pr-3 font-medium text-foreground">
                        {r.band}
                        {bestBand?.band === r.band && (
                          <Badge className="ml-2 bg-emerald-600 text-white text-[10px]">Best</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">{r.quoted.toLocaleString('en-GB')}</td>
                      <td className="py-2 pr-3 text-right">{r.won.toLocaleString('en-GB')}</td>
                      <td className="py-2 pr-3 text-right">{r.quoted ? `${r.convPct.toFixed(1)}%` : '—'}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-foreground">
                        {r.quoted ? gbp(r.revenuePerQuote) : '—'}
                      </td>
                      <td className="py-2">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(r.revenuePerQuote / maxRpq) * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Bands with fewer than 20 quotes are excluded from the “Best” marker so a handful of deals
                cannot set pricing strategy.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Where sales actually land</CardTitle>
            <CardDescription className="text-xs">
              Sold-price distribution — excludes cancelled and refunded orders.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {soldByBand.map(r => (
              <div key={r.band} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">{r.band}</span>
                  <span className="text-muted-foreground">
                    {r.sales.toLocaleString('en-GB')} sales · {gbp(r.revenue)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-500"
                    style={{ width: `${(r.sales / maxSales) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Average order value by month</CardTitle>
            <CardDescription className="text-xs">
              Rising AOV with steady order volume means price increases are sticking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Month</th>
                  <th className="py-2 pr-3 text-right">Orders</th>
                  <th className="py-2 pr-3 text-right">AOV</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map(m => (
                  <tr key={m.month} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium text-foreground">{m.month}</td>
                    <td className="py-2 pr-3 text-right">{m.orders}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-foreground">{gbp(m.aov)}</td>
                    <td className="py-2 text-right text-muted-foreground">{gbp(m.revenue)}</td>
                  </tr>
                ))}
                {!monthly.length && (
                  <tr>
                    <td colSpan={4} className="py-3 text-xs text-muted-foreground">
                      No orders in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PriceConversionAovPanel;
