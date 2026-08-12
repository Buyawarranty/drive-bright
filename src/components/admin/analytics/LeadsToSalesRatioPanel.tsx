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
import { DateRangeFilter } from '../DateRangeFilter';

interface DayRow {
  key: string;
  day: string;
  leads: number;
  sales: number;
  revenue: number;
  spend: number;
}

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export const LeadsToSalesRatioPanel: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  const from = startOfDay(dateRange?.from || subDays(new Date(), 29));
  const to = endOfDay(dateRange?.to || dateRange?.from || new Date());
  const rangeKey = `${from.toISOString()}_${to.toISOString()}`;

  const { data, isLoading } = useQuery({
    queryKey: ['leads-to-sales-ratio', rangeKey],
    queryFn: async () => {
      const [leadsRes, salesRes, spendRes] = await Promise.all([
        supabase
          .from('sales_leads')
          .select('id, created_at')
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
      if (bucket) bucket.leads += 1;
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

    const withRatio = days.map(d => ({
      ...d,
      revenue: Math.round(d.revenue * 100) / 100,
      spend: Math.round(d.spend * 100) / 100,
      conversion: d.leads > 0 ? Math.round((d.sales / d.leads) * 1000) / 10 : 0,
    }));

    const leads = withRatio.reduce((s, d) => s + d.leads, 0);
    const sales = withRatio.reduce((s, d) => s + d.sales, 0);
    const revenue = withRatio.reduce((s, d) => s + d.revenue, 0);
    const spend = withRatio.reduce((s, d) => s + d.spend, 0);

    return {
      rows: withRatio,
      totals: {
        leads,
        sales,
        revenue,
        spend,
        conversion: leads > 0 ? (sales / leads) * 100 : 0,
        costPerLead: leads > 0 ? spend / leads : 0,
        costPerSale: sales > 0 ? spend / sales : 0,
        roas: spend > 0 ? revenue / spend : 0,
        aov: sales > 0 ? revenue / sales : 0,
        dayCount: withRatio.length,
      },
    };
  }, [data, rangeKey]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Leads to sales ratio</CardTitle>
          <CardDescription className="mt-1">
            Leads in, sales made, ad spend and the value of those sales for every day in the selected range.
            Ad spend is recorded monthly and spread evenly across the days of that month.
          </CardDescription>
        </div>
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{totals.leads.toLocaleString('en-GB')} leads</Badge>
          <Badge variant="secondary">{totals.sales.toLocaleString('en-GB')} sales</Badge>
          <Badge variant="secondary">Conversion {totals.conversion.toFixed(1)}%</Badge>
          <Badge variant="secondary">Sales value {money(totals.revenue)}</Badge>
          <Badge variant="secondary">Ad spend {money(totals.spend)}</Badge>
          <Badge variant="secondary">Cost per lead {money(totals.costPerLead)}</Badge>
          <Badge variant="secondary">Cost per sale {money(totals.costPerSale)}</Badge>
          <Badge variant={totals.roas >= 3 ? 'default' : 'outline'}>
            Return on spend {totals.roas.toFixed(2)}x
          </Badge>
          <Badge variant="outline">AOV {money(totals.aov)}</Badge>
          <Badge variant="outline">{totals.dayCount} days</Badge>
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
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'leads') return [Number(value).toLocaleString('en-GB'), 'Leads in'];
                    if (name === 'sales') return [Number(value).toLocaleString('en-GB'), 'Sales made'];
                    if (name === 'revenue') return [money(Number(value)), 'Sales value'];
                    if (name === 'spend') return [money(Number(value)), 'Ad spend'];
                    return [value, name];
                  }}
                  labelStyle={{ fontWeight: 'bold' }}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Legend
                  formatter={(value) =>
                    value === 'leads' ? 'Leads in'
                      : value === 'sales' ? 'Sales made'
                        : value === 'revenue' ? 'Sales value'
                          : value === 'spend' ? 'Ad spend' : value
                  }
                />
                <Bar yAxisId="left" dataKey="leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="spend" stroke="#ef4444" strokeWidth={2} dot={false} />
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
