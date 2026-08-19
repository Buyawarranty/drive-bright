import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart,
} from 'recharts';
import { subDays, subMonths, startOfDay, startOfWeek, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';

type Period = '30' | '90' | '180' | '365' | 'all';
type Grouping = 'weekday' | 'weekly' | 'monthly' | 'yearly';

const periodLabels: Record<Period, string> = {
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  '180': 'Last 6 months',
  '365': 'Last 12 months',
  all: 'All time',
};

const groupingLabels: Record<Grouping, string> = {
  weekday: 'Day of week',
  weekly: 'By week',
  monthly: 'By month',
  yearly: 'By year',
};

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const LOST_STATUSES = ['cancelled', 'refunded'];

function isRevenueLost(status?: string | null) {
  const s = (status || '').toLowerCase();
  return LOST_STATUSES.some(l => s.includes(l));
}

function matchesSource(customer: any, sourceFilter: string) {
  if (sourceFilter === 'all') return true;
  const source = customer.purchase_source?.toLowerCase() || '';
  const isManual = customer.is_manual_entry === true;
  const warrantyNum = customer.warranty_reference_number || '';
  if (sourceFilter === 'website') {
    const isBawS = warrantyNum.startsWith('BAW-S-');
    return !isBawS && !isManual && (
      source === 'website' || source === 'stripe' || source === 'bumper' ||
      source === 'bumper_portal' || source === 'google_ads' || source === 'facebook_ads' || source === ''
    );
  }
  if (sourceFilter === 'staff_purchase') return warrantyNum.startsWith('BAW-S-');
  if (sourceFilter === 'sales_team') {
    return isManual || source === 'quote_link' || source === 'external' || source === 'admin_external';
  }
  return true;
}

function periodStart(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case '30': return startOfDay(subDays(now, 29));
    case '90': return startOfDay(subDays(now, 89));
    case '180': return startOfDay(subMonths(now, 6));
    case '365': return startOfDay(subMonths(now, 12));
    case 'all': return null;
  }
}

function bucketKey(d: Date, grouping: Grouping): string {
  if (grouping === 'weekly') return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  if (grouping === 'monthly') return format(d, 'yyyy-MM');
  if (grouping === 'yearly') return format(d, 'yyyy');
  return String((d.getDay() + 6) % 7);
}

function bucketLabel(key: string, grouping: Grouping): string {
  if (grouping === 'weekly') return `w/c ${format(new Date(key), 'd MMM')}`;
  if (grouping === 'monthly') return format(new Date(`${key}-01`), 'MMM yyyy');
  if (grouping === 'yearly') return key;
  return DAY_SHORT[Number(key)] ?? key;
}

const money = (n: number) => `£${Math.round(n).toLocaleString()}`;

interface Props {
  customers: any[];
  sourceFilter: string;
}

export const SalesByWeekdayPanel: React.FC<Props> = ({ customers, sourceFilter }) => {
  const [period, setPeriod] = useState<Period>('180');
  const [grouping, setGrouping] = useState<Grouping>('weekday');

  const fromIso = useMemo(() => {
    const from = periodStart(period);
    return from ? from.toISOString() : null;
  }, [period]);

  // Leads that came in, so we can show leads → sales conversion per day of week.
  const { data: leadRows } = useQuery({
    queryKey: ['sales-by-weekday-leads', fromIso],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await fetchAllRows<{ created_at: string; status: string | null }>(() => {
        let q = supabase.from('sales_leads').select('created_at, status').order('created_at', { ascending: false });
        if (fromIso) q = q.gte('created_at', fromIso);
        return q;
      });
      if (error) throw error;
      return data || [];
    },
  });

  const { rows, totals } = useMemo(() => {
    const from = periodStart(period);
    const map = new Map<string, { key: string; label: string; sales: number; revenue: number; leads: number; convertedLeads: number }>();

    const ensure = (key: string) => {
      let row = map.get(key);
      if (!row) {
        row = { key, label: bucketLabel(key, grouping), sales: 0, revenue: 0, leads: 0, convertedLeads: 0 };
        map.set(key, row);
      }
      return row;
    };

    if (grouping === 'weekday') {
      DAY_LABELS.forEach((_, i) => ensure(String(i)));
    }

    customers.forEach(customer => {
      if (isRevenueLost(customer.status)) return;
      if (!matchesSource(customer, sourceFilter)) return;
      if (!customer.signup_date) return;
      const d = new Date(customer.signup_date);
      if (Number.isNaN(d.getTime())) return;
      if (from && d < from) return;
      const row = ensure(bucketKey(d, grouping));
      row.sales += 1;
      row.revenue += Number(customer.final_amount) || 0;
    });

    (leadRows || []).forEach(lead => {
      if (!lead.created_at) return;
      const d = new Date(lead.created_at);
      if (Number.isNaN(d.getTime())) return;
      if (from && d < from) return;
      const row = ensure(bucketKey(d, grouping));
      row.leads += 1;
      if ((lead.status || '').toLowerCase() === 'converted') row.convertedLeads += 1;
    });

    const list = Array.from(map.values())
      .sort((a, b) => (grouping === 'weekday' ? Number(a.key) - Number(b.key) : a.key.localeCompare(b.key)))
      .map(r => ({
        ...r,
        revenue: Math.round(r.revenue),
        aov: r.sales > 0 ? Math.round(r.revenue / r.sales) : 0,
        conversion: r.leads > 0 ? Math.round((r.convertedLeads / r.leads) * 1000) / 10 : 0,
      }));

    const totalSales = list.reduce((s, r) => s + r.sales, 0);
    const totalRevenue = list.reduce((s, r) => s + r.revenue, 0);
    const totalLeads = list.reduce((s, r) => s + r.leads, 0);
    const bestSales = list.reduce((best, r) => (r.sales > (best?.sales ?? -1) ? r : best), list[0]);
    const bestRevenue = list.reduce((best, r) => (r.revenue > (best?.revenue ?? -1) ? r : best), list[0]);
    const bestConversion = list.reduce(
      (best, r) => (r.leads >= 20 && r.conversion > (best?.conversion ?? -1) ? r : best),
      undefined as (typeof list)[number] | undefined,
    );
    const worstSales = list.reduce((worst, r) => (r.sales < (worst?.sales ?? Infinity) ? r : worst), list[0]);

    return {
      rows: list,
      totals: {
        totalSales,
        totalRevenue,
        totalLeads,
        bestSales,
        bestRevenue,
        bestConversion,
        worstSales,
      },
    };
  }, [customers, sourceFilter, period, grouping, leadRows]);

  return (
    <Card className="border-2 border-indigo-500/30">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-base">Best selling days — warranties sold vs leads in</CardTitle>
            <CardDescription>
              Which day of the week sells the most warranties, and how the same view looks weekly, monthly and yearly.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={grouping} onValueChange={v => setGrouping(v as Grouping)}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(groupingLabels) as Grouping[]).map(g => (
                  <SelectItem key={g} value={g}>{groupingLabels[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={v => setPeriod(v as Period)}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(periodLabels) as Period[]).map(p => (
                  <SelectItem key={p} value={p}>{periodLabels[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{totals.totalSales} warranties sold</Badge>
          <Badge variant="secondary">{money(totals.totalRevenue)} revenue</Badge>
          <Badge variant="secondary">{totals.totalLeads} leads in</Badge>
          {totals.bestSales && (
            <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300">
              Best {grouping === 'weekday' ? 'day' : 'period'}: {totals.bestSales.label} · {totals.bestSales.sales} sales
            </Badge>
          )}
          {totals.bestRevenue && (
            <Badge className="bg-sky-100 text-sky-900 border border-sky-300">
              Top revenue: {totals.bestRevenue.label} · {money(totals.bestRevenue.revenue)}
            </Badge>
          )}
          {totals.bestConversion && (
            <Badge className="bg-amber-100 text-amber-900 border border-amber-300">
              Best lead conversion: {totals.bestConversion.label} · {totals.bestConversion.conversion}%
            </Badge>
          )}
          {grouping === 'weekday' && totals.worstSales && (
            <Badge variant="outline">Quietest: {totals.worstSales.label} · {totals.worstSales.sales} sales</Badge>
          )}
        </div>

        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={rows.length > 10 ? -35 : 0} textAnchor={rows.length > 10 ? 'end' : 'middle'} height={rows.length > 10 ? 60 : 30} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: any, name: any) => {
                  if (name === 'Revenue') return [money(Number(value)), name];
                  if (name === 'Conversion %') return [`${value}%`, name];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="sales" name="Warranties sold" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="leads" name="Leads in" fill="hsl(var(--muted-foreground))" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--chart-2, 200 80% 45%))" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">{grouping === 'weekday' ? 'Day' : 'Period'}</th>
                <th className="py-2 pr-3 text-right">Warranties sold</th>
                <th className="py-2 pr-3 text-right">Revenue</th>
                <th className="py-2 pr-3 text-right">AOV</th>
                <th className="py-2 pr-3 text-right">Leads in</th>
                <th className="py-2 pr-3 text-right">Leads converted</th>
                <th className="py-2 pr-3 text-right">Conversion</th>
                <th className="py-2 pr-3 text-right">Share of sales</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">
                    {grouping === 'weekday' ? DAY_LABELS[Number(r.key)] : r.label}
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold">{r.sales}</td>
                  <td className="py-2 pr-3 text-right">{money(r.revenue)}</td>
                  <td className="py-2 pr-3 text-right">{r.sales ? money(r.aov) : '—'}</td>
                  <td className="py-2 pr-3 text-right">{r.leads}</td>
                  <td className="py-2 pr-3 text-right">{r.convertedLeads}</td>
                  <td className="py-2 pr-3 text-right">{r.leads ? `${r.conversion}%` : '—'}</td>
                  <td className="py-2 pr-3 text-right">
                    {totals.totalSales ? `${Math.round((r.sales / totals.totalSales) * 1000) / 10}%` : '—'}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No sales in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Lead arrival day → conversion (independent of the grouping above) */}
        <div className="pt-2 border-t space-y-3">
          <div>
            <h4 className="text-sm font-semibold">Which day a lead arrives on converts best</h4>
            <p className="text-xs text-muted-foreground">
              Grouped by the day the lead came in — regardless of which day it eventually converted on.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {arrivalTotals.best && (
              <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300">
                Best arrival day: {arrivalTotals.best.day} · {arrivalTotals.best.conversion}%
              </Badge>
            )}
            {arrivalTotals.worst && (
              <Badge variant="outline">Weakest: {arrivalTotals.worst.day} · {arrivalTotals.worst.conversion}%</Badge>
            )}
            <Badge variant="secondary">
              Overall {arrivalTotals.leads} leads → {arrivalTotals.converted} converted ({arrivalTotals.rate}%)
            </Badge>
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={arrivalRows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={0} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(value: any, name: any) => (name === 'Conversion %' ? [`${value}%`, name] : [value, name])} />
                <Legend />
                <Bar yAxisId="left" dataKey="leads" name="Leads in" fill="hsl(var(--muted-foreground))" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="converted" name="Converted" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="conversion" name="Conversion %" stroke="hsl(var(--chart-2, 200 80% 45%))" strokeWidth={2} dot />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Lead arrived on</th>
                  <th className="py-2 pr-3 text-right">Leads in</th>
                  <th className="py-2 pr-3 text-right">Converted</th>
                  <th className="py-2 pr-3 text-right">Conversion rate</th>
                  <th className="py-2 pr-3 text-right">Share of leads</th>
                </tr>
              </thead>
              <tbody>
                {arrivalRows.map(r => (
                  <tr key={r.day} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{r.day}</td>
                    <td className="py-2 pr-3 text-right">{r.leads}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{r.converted}</td>
                    <td className="py-2 pr-3 text-right">{r.leads ? `${r.conversion}%` : '—'}</td>
                    <td className="py-2 pr-3 text-right">
                      {arrivalTotals.leads ? `${Math.round((r.leads / arrivalTotals.leads) * 1000) / 10}%` : '—'}
                    </td>
                  </tr>
                ))}
                {arrivalTotals.leads === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No leads in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
