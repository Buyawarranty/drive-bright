import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart,
} from 'recharts';
import { DateRange } from 'react-day-picker';
import {
  format, subDays, startOfDay, endOfDay, eachDayOfInterval, getDaysInMonth, startOfMonth,
} from 'date-fns';
import { Input } from '@/components/ui/input';
import { DateRangeFilter } from '../DateRangeFilter';

interface DayRow {
  key: string;
  day: string;
  leads: number;
  sales: number;
  revenue: number;
  spend: number;
  googleLeads: number;
  metaLeads: number;
  bingLeads: number;
  tiktokLeads: number;
  googleCost: number;
  metaCost: number;
  bingCost: number;
  tiktokCost: number;
  paidCost: number;
}

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

const DEFAULT_LEAD_COST = 21;

// Paid channels we charge lead cost against (organic/website/phone leads are free).
const CHANNEL_BY_SOURCE: Record<string, 'google' | 'meta' | 'bing' | 'tiktok'> = {
  google_ad: 'google',
  social_ad: 'meta',
  bing_ad: 'bing',
  tiktok_ad: 'tiktok',
};


export const LeadsToSalesRatioPanel: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  // Average cost of buying a lead — £21 by default, editable if the media buy changes.
  const [leadCost, setLeadCost] = useState<number>(DEFAULT_LEAD_COST);


  const from = startOfDay(dateRange?.from || subDays(new Date(), 29));
  const to = endOfDay(dateRange?.to || dateRange?.from || new Date());
  const rangeKey = `${from.toISOString()}_${to.toISOString()}`;

  const { data, isLoading } = useQuery({
    queryKey: ['leads-to-sales-ratio', rangeKey],
    queryFn: async () => {
      const [leadsRes, salesRes, spendRes] = await Promise.all([
        supabase
          .from('sales_leads')
          .select('id, created_at, lead_source')
          .gte('created_at', from.toISOString())
          .lte('created_at', to.toISOString())
          .limit(20000),
        supabase
          .from('customers')
          .select('id, final_amount, signup_date, status')
          .eq('is_deleted', false)
          .gte('signup_date', from.toISOString())
          .lte('signup_date', to.toISOString())
          .limit(20000),
        supabase
          .from('marketing_spend')
          .select('month_start, amount')
          .gte('month_start', format(startOfMonth(from), 'yyyy-MM-dd'))
          .lte('month_start', format(startOfMonth(to), 'yyyy-MM-dd')),
      ]);
      if (leadsRes.error) throw leadsRes.error;
      if (salesRes.error) throw salesRes.error;
      if (spendRes.error) throw spendRes.error;
      return {
        leads: leadsRes.data || [],
        sales: salesRes.data || [],
        spend: spendRes.data || [],
      };
    },
  });

  const { rows, totals } = useMemo(() => {
    const days: DayRow[] = eachDayOfInterval({ start: from, end: to }).map(d => ({
      key: format(d, 'yyyy-MM-dd'),
      day: format(d, 'd MMM'),
      leads: 0,
      sales: 0,
      revenue: 0,
      spend: 0,
      googleLeads: 0,
      metaLeads: 0,
      bingLeads: 0,
      tiktokLeads: 0,
      googleCost: 0,
      metaCost: 0,
      bingCost: 0,
      tiktokCost: 0,
      paidCost: 0,
    }));
    const map = new Map(days.map(d => [d.key, d]));

    // Monthly ad spend, spread evenly across the days of that month in view.
    const spendByMonth = new Map<string, number>();
    (data?.spend || []).forEach((s: any) => {
      spendByMonth.set(String(s.month_start).slice(0, 7), Number(s.amount) || 0);
    });
    days.forEach(d => {
      const monthKey = d.key.slice(0, 7);
      const monthly = spendByMonth.get(monthKey) || 0;
      const daysInMonth = getDaysInMonth(new Date(`${monthKey}-01T00:00:00`));
      d.spend = daysInMonth > 0 ? monthly / daysInMonth : 0;
    });

    (data?.leads || []).forEach((l: any) => {
      const bucket = map.get(format(new Date(l.created_at), 'yyyy-MM-dd'));
      if (!bucket) return;
      bucket.leads += 1;
      const channel = CHANNEL_BY_SOURCE[String(l.lead_source || '')];
      if (channel === 'google') bucket.googleLeads += 1;
      else if (channel === 'meta') bucket.metaLeads += 1;
      else if (channel === 'bing') bucket.bingLeads += 1;
      else if (channel === 'tiktok') bucket.tiktokLeads += 1;
    });

    (data?.sales || []).forEach((c: any) => {
      const status = (c.status || '').toLowerCase();
      if (status.includes('cancelled') || status.includes('refunded')) return;
      if (!c.signup_date) return;
      const bucket = map.get(format(new Date(c.signup_date), 'yyyy-MM-dd'));
      if (!bucket) return;
      bucket.sales += 1;
      bucket.revenue += Number(c.final_amount) || 0;
    });

    const withRatio = days.map(d => {
      const googleCost = d.googleLeads * leadCost;
      const metaCost = d.metaLeads * leadCost;
      const bingCost = d.bingLeads * leadCost;
      const tiktokCost = d.tiktokLeads * leadCost;
      return {
        ...d,
        revenue: Math.round(d.revenue * 100) / 100,
        spend: Math.round(d.spend * 100) / 100,
        googleCost,
        metaCost,
        bingCost,
        tiktokCost,
        paidCost: googleCost + metaCost + bingCost + tiktokCost,
        conversion: d.leads > 0 ? Math.round((d.sales / d.leads) * 1000) / 10 : 0,
      };
    });


    const leads = withRatio.reduce((s, d) => s + d.leads, 0);
    const sales = withRatio.reduce((s, d) => s + d.sales, 0);
    const revenue = withRatio.reduce((s, d) => s + d.revenue, 0);
    const spend = withRatio.reduce((s, d) => s + d.spend, 0);

    // Does more leads actually mean more sales? Pearson correlation across the days in view,
    // plus a busy-days vs quiet-days conversion split so the answer is readable without stats.
    const active = withRatio.filter(d => d.leads > 0);
    const n = active.length;
    const meanL = n ? active.reduce((s, d) => s + d.leads, 0) / n : 0;
    const meanS = n ? active.reduce((s, d) => s + d.sales, 0) / n : 0;
    let cov = 0, varL = 0, varS = 0;
    active.forEach(d => {
      cov += (d.leads - meanL) * (d.sales - meanS);
      varL += (d.leads - meanL) ** 2;
      varS += (d.sales - meanS) ** 2;
    });
    const correlation = varL > 0 && varS > 0 ? cov / Math.sqrt(varL * varS) : 0;

    const sortedByLeads = [...active].sort((a, b) => a.leads - b.leads);
    const half = Math.floor(sortedByLeads.length / 2);
    const quiet = sortedByLeads.slice(0, half);
    const busy = sortedByLeads.slice(sortedByLeads.length - half);
    const convOf = (arr: typeof withRatio) => {
      const l = arr.reduce((s, d) => s + d.leads, 0);
      const sl = arr.reduce((s, d) => s + d.sales, 0);
      return l > 0 ? (sl / l) * 100 : 0;
    };
    const quietConv = convOf(quiet);
    const busyConv = convOf(busy);
    const quietLeadsAvg = quiet.length ? quiet.reduce((s, d) => s + d.leads, 0) / quiet.length : 0;
    const busyLeadsAvg = busy.length ? busy.reduce((s, d) => s + d.leads, 0) / busy.length : 0;
    const quietSalesAvg = quiet.length ? quiet.reduce((s, d) => s + d.sales, 0) / quiet.length : 0;
    const busySalesAvg = busy.length ? busy.reduce((s, d) => s + d.sales, 0) / busy.length : 0;

    return {
      rows: withRatio,
      totals: {
        leads,
        sales,
        revenue,
        spend,
        googleCost: withRatio.reduce((s, d) => s + d.googleCost, 0),
        metaCost: withRatio.reduce((s, d) => s + d.metaCost, 0),
        bingCost: withRatio.reduce((s, d) => s + d.bingCost, 0),
        tiktokCost: withRatio.reduce((s, d) => s + d.tiktokCost, 0),
        paidCost: withRatio.reduce((s, d) => s + d.paidCost, 0),
        googleLeads: withRatio.reduce((s, d) => s + d.googleLeads, 0),
        metaLeads: withRatio.reduce((s, d) => s + d.metaLeads, 0),
        bingLeads: withRatio.reduce((s, d) => s + d.bingLeads, 0),
        tiktokLeads: withRatio.reduce((s, d) => s + d.tiktokLeads, 0),

        conversion: leads > 0 ? (sales / leads) * 100 : 0,
        avgDailyConversion: n
          ? active.reduce((s, d) => s + d.conversion, 0) / n
          : 0,
        costPerLead: leads > 0 ? spend / leads : 0,
        costPerSale: sales > 0 ? spend / sales : 0,
        roas: spend > 0 ? revenue / spend : 0,
        aov: sales > 0 ? revenue / sales : 0,
        dayCount: withRatio.length,
        leadCostTotal: leads * leadCost,
        leadCostPerSale: sales > 0 ? (leads * leadCost) / sales : 0,

        correlation,
        quietConv,
        busyConv,
        quietLeadsAvg,
        busyLeadsAvg,
        quietSalesAvg,
        busySalesAvg,
        comparedDays: half,
      },
    };
  }, [data, rangeKey, leadCost]);


  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Leads to sales ratio</CardTitle>
          <CardDescription className="mt-1">
            Leads in, sales made, ad spend and the value of those sales for every day in the selected range.
            Ad spend is recorded monthly and spread evenly across the days of that month. Channel cost per day is
            that day's Google, Meta, Bing and TikTok leads charged at £{leadCost} a lead.
          </CardDescription>

        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Average lead cost £
            <Input
              type="number"
              min={0}
              step={1}
              value={leadCost}
              onChange={(e) => setLeadCost(Math.max(0, Number(e.target.value) || 0))}
              className="h-8 w-20"
            />
          </label>
          <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{totals.leads.toLocaleString('en-GB')} leads</Badge>
          <Badge variant="secondary">{totals.sales.toLocaleString('en-GB')} sales</Badge>
          <Badge variant="secondary">Lead to sale {totals.conversion.toFixed(1)}%</Badge>
          <Badge variant="secondary">Average day {totals.avgDailyConversion.toFixed(1)}%</Badge>
          <Badge variant="secondary">Sales value {money(totals.revenue)}</Badge>
          <Badge variant="secondary">Ad spend {money(totals.spend)}</Badge>
          <Badge variant="secondary">Lead cost @ £{leadCost} {money(totals.leadCostTotal)}</Badge>
          <Badge variant="secondary">Cost per lead {money(totals.costPerLead)}</Badge>
          <Badge variant="secondary">Cost per sale {money(totals.costPerSale)}</Badge>
          <Badge variant={totals.leadCostPerSale > 0 && totals.aov > totals.leadCostPerSale ? 'default' : 'outline'}>
            Lead cost per sale {money(totals.leadCostPerSale)}
          </Badge>
          <Badge variant={totals.roas >= 3 ? 'default' : 'outline'}>
            Return on spend {totals.roas.toFixed(2)}x
          </Badge>
          <Badge variant="outline">AOV {money(totals.aov)}</Badge>
          <Badge variant="outline">{totals.dayCount} days</Badge>
        </div>

        {/* Paid channel lead cost at £{leadCost} a lead */}
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-blue-600 text-white hover:bg-blue-600">
            Google {money(totals.googleCost)} · {totals.googleLeads} leads
          </Badge>
          <Badge className="bg-indigo-600 text-white hover:bg-indigo-600">
            Meta {money(totals.metaCost)} · {totals.metaLeads} leads
          </Badge>
          <Badge className="bg-teal-600 text-white hover:bg-teal-600">
            Bing {money(totals.bingCost)} · {totals.bingLeads} leads
          </Badge>
          <Badge className="bg-zinc-900 text-white hover:bg-zinc-900">
            TikTok {money(totals.tiktokCost)} · {totals.tiktokLeads} leads
          </Badge>
          <Badge variant="secondary">All paid channels {money(totals.paidCost)}</Badge>
        </div>



        {/* Does more leads mean more sales? */}
        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Do more leads mean more sales?</span>
            <Badge
              variant={totals.correlation >= 0.5 ? 'default' : totals.correlation >= 0.2 ? 'secondary' : 'outline'}
            >
              {totals.correlation >= 0.7
                ? 'Yes — strong link'
                : totals.correlation >= 0.4
                  ? 'Yes — clear link'
                  : totals.correlation >= 0.2
                    ? 'Somewhat'
                    : totals.correlation <= -0.2
                      ? 'No — more leads, fewer sales'
                      : 'No real link'}
            </Badge>
            <Badge variant="outline">Correlation {totals.correlation.toFixed(2)}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            On the {totals.comparedDays} busiest days we took an average of {totals.busyLeadsAvg.toFixed(1)} leads a
            day and made {totals.busySalesAvg.toFixed(1)} sales a day ({totals.busyConv.toFixed(1)}% lead to sale).
            On the {totals.comparedDays} quietest days it was {totals.quietLeadsAvg.toFixed(1)} leads and{' '}
            {totals.quietSalesAvg.toFixed(1)} sales a day ({totals.quietConv.toFixed(1)}%).{' '}
            {totals.busyConv >= totals.quietConv + 1
              ? 'Busy days also convert better, so volume is worth buying.'
              : totals.quietConv >= totals.busyConv + 1
                ? 'Quiet days convert better — on busy days leads are being left uncalled, so capacity is the limit, not lead volume.'
                : 'Conversion holds steady whatever the volume, so extra leads scale sales roughly in line.'}
          </p>
        </div>


        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${Number(v).toLocaleString('en-GB')}`} />
                <YAxis yAxisId="pct" hide domain={[0, 'dataMax']} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'leads') return [Number(value).toLocaleString('en-GB'), 'Leads in'];
                    if (name === 'sales') return [Number(value).toLocaleString('en-GB'), 'Sales made'];
                    if (name === 'conversion') return [`${Number(value).toFixed(1)}%`, 'Lead to sale'];
                    if (name === 'revenue') return [money(Number(value)), 'Sales value'];
                    if (name === 'spend') return [money(Number(value)), 'Ad spend'];
                    if (name === 'googleCost') return [money(Number(value)), 'Google cost'];
                    if (name === 'metaCost') return [money(Number(value)), 'Meta cost'];
                    if (name === 'bingCost') return [money(Number(value)), 'Bing cost'];
                    if (name === 'tiktokCost') return [money(Number(value)), 'TikTok cost'];
                    if (name === 'paidCost') return [money(Number(value)), `All channels @ £${leadCost}/lead`];
                    return [value, name];
                  }}
                  labelStyle={{ fontWeight: 'bold' }}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Legend
                  formatter={(value) =>
                    value === 'leads' ? 'Leads in'
                      : value === 'sales' ? 'Sales made'
                        : value === 'conversion' ? 'Lead to sale %'
                          : value === 'revenue' ? 'Sales value'
                            : value === 'spend' ? 'Ad spend'
                              : value === 'googleCost' ? 'Google cost'
                                : value === 'metaCost' ? 'Meta cost'
                                  : value === 'bingCost' ? 'Bing cost'
                                    : value === 'tiktokCost' ? 'TikTok cost'
                                      : value === 'paidCost' ? `All channels @ £${leadCost}/lead` : value
                  }
                />
                <Bar yAxisId="left" dataKey="leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Line yAxisId="pct" type="monotone" dataKey="conversion" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="spend" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="paidCost" stroke="#111827" strokeWidth={2.5} strokeDasharray="6 3" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="googleCost" stroke="#2563eb" strokeWidth={1.5} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="metaCost" stroke="#4f46e5" strokeWidth={1.5} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="bingCost" stroke="#0d9488" strokeWidth={1.5} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="tiktokCost" stroke="#a855f7" strokeWidth={1.5} dot={false} />

              </ComposedChart>
            </ResponsiveContainer>

            <div className="max-h-80 overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Conversion</TableHead>
                    <TableHead className="text-right">Ad spend</TableHead>
                    <TableHead className="text-right">Google</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                    <TableHead className="text-right">Bing</TableHead>
                    <TableHead className="text-right">TikTok</TableHead>
                    <TableHead className="text-right">All channels</TableHead>
                    <TableHead className="text-right">Sales value</TableHead>
                    <TableHead className="text-right">Return on spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{r.day}</TableCell>
                      <TableCell className="text-right">{r.leads}</TableCell>
                      <TableCell className="text-right">{r.sales}</TableCell>
                      <TableCell className="text-right">{r.conversion.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{money(r.spend)}</TableCell>
                      <TableCell className="text-right">{money(r.googleCost)}</TableCell>
                      <TableCell className="text-right">{money(r.metaCost)}</TableCell>
                      <TableCell className="text-right">{money(r.bingCost)}</TableCell>
                      <TableCell className="text-right">{money(r.tiktokCost)}</TableCell>
                      <TableCell className="text-right font-medium">{money(r.paidCost)}</TableCell>
                      <TableCell className="text-right">{money(r.revenue)}</TableCell>
                      <TableCell className="text-right">
                        {r.spend > 0 ? `${(r.revenue / r.spend).toFixed(2)}x` : '—'}
                      </TableCell>
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

export default LeadsToSalesRatioPanel;
