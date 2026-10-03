import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart,
} from 'recharts';
import { subDays, subMonths, startOfDay, startOfWeek, format } from 'date-fns';

type Period = '30' | '90' | '180' | '365';
type Grouping = 'day' | 'week' | 'month';

const periodLabels: Record<Period, string> = {
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  '180': 'Last 6 months',
  '365': 'Last 12 months',
};

const groupingLabels: Record<Grouping, string> = {
  day: 'Per day',
  week: 'Per week',
  month: 'Per month',
};

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

function periodStart(period: Period): Date {
  const now = new Date();
  if (period === '30') return startOfDay(subDays(now, 29));
  if (period === '90') return startOfDay(subDays(now, 89));
  if (period === '180') return startOfDay(subMonths(now, 6));
  return startOfDay(subMonths(now, 12));
}

function bucketKey(d: Date, grouping: Grouping): string {
  if (grouping === 'week') return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  if (grouping === 'month') return format(d, 'yyyy-MM');
  return format(d, 'yyyy-MM-dd');
}

function bucketLabel(key: string, grouping: Grouping): string {
  if (grouping === 'week') return `w/c ${format(new Date(key), 'd MMM')}`;
  if (grouping === 'month') return format(new Date(`${key}-01`), 'MMM yyyy');
  return format(new Date(key), 'EEE d MMM');
}

function isLost(status?: string | null) {
  const s = (status || '').toLowerCase();
  return s.includes('cancelled') || s.includes('refunded');
}

interface AgentSummary {
  id: string;
  name: string;
  daysWorked: number;
  leadsAssigned: number;
  sales: number;
  revenue: number;
}

/**
 * Staffing vs sales: how many agents were online each day/week/month
 * (from agent_daily_lead_stats) against the sales made in the same period,
 * so management can see whether more cover actually means more sales.
 */
export const StaffingVsSalesPanel: React.FC = () => {
  const [period, setPeriod] = useState<Period>('90');
  const [grouping, setGrouping] = useState<Grouping>('week');

  const fromIso = useMemo(() => periodStart(period).toISOString(), [period]);
  const fromDate = useMemo(() => format(periodStart(period), 'yyyy-MM-dd'), [period]);

  const { data: agents } = useQuery({
    queryKey: ['staffing-vs-sales-agents'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role')
        .in('role', ['sales', 'sales_lead']);
      if (error) throw error;
      return (data || []).map(u => ({
        id: u.id,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || (u.email || '').split('@')[0],
      }));
    },
  });

  // One row per agent per day they were working — distinct agents per day = staffing level.
  const { data: stats } = useQuery({
    queryKey: ['staffing-vs-sales-stats', fromDate],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await fetchAllRows<any>(() =>
        supabase
          .from('agent_daily_lead_stats')
          .select('agent_id, stat_date, leads_assigned, calls_logged')
          .gte('stat_date', fromDate)
          .order('stat_date', { ascending: false })
      );
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sales } = useQuery({
    queryKey: ['staffing-vs-sales-sales', fromIso],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await fetchAllRows<any>(() =>
        supabase
          .from('customers')
          .select('id, signup_date, final_amount, status, assigned_to, quote_sent_by, payment_confirmed_by, sale_credit_admin_user_id')
          .eq('is_deleted', false)
          .gte('signup_date', fromIso)
          .order('signup_date', { ascending: false })
      );
      if (error) throw error;
      return data || [];
    },
  });

  const loading = !agents || !stats || !sales;

  const { chartData, agentRows, totals } = useMemo(() => {
    const agentMap = new Map((agents || []).map(a => [a.id, a.name]));
    const creditOf = (c: any) =>
      c.sale_credit_admin_user_id || c.payment_confirmed_by || c.quote_sent_by || c.assigned_to || null;

    const buckets = new Map<string, {
      key: string; label: string; agentDays: number; agentsOnline: number; sales: number; revenue: number;
    }>();
    const seenAgents = new Map<string, Set<string>>();
    const ensure = (key: string) => {
      let b = buckets.get(key);
      if (!b) {
        b = { key, label: bucketLabel(key, grouping), agentDays: 0, agentsOnline: 0, sales: 0, revenue: 0 };
        buckets.set(key, b);
        seenAgents.set(key, new Set());
      }
      return b;
    };

    const perAgent = new Map<string, AgentSummary>();
    const agentDaysSeen = new Map<string, Set<string>>();
    const ensureAgent = (id: string) => {
      let r = perAgent.get(id);
      if (!r) {
        r = { id, name: agentMap.get(id) || 'Unknown', daysWorked: 0, leadsAssigned: 0, sales: 0, revenue: 0 };
        perAgent.set(id, r);
        agentDaysSeen.set(id, new Set());
      }
      return r;
    };

    (stats || []).forEach((s: any) => {
      if (!s.agent_id || !s.stat_date) return;
      const key = bucketKey(new Date(`${s.stat_date}T00:00:00`), grouping);
      const b = ensure(key);
      const seen = seenAgents.get(key)!;
      const dayAgentKey = `${s.stat_date}|${s.agent_id}`;
      if (!seen.has(dayAgentKey)) {
        seen.add(dayAgentKey);
        b.agentDays += 1;
      }
      if (agentMap.has(s.agent_id)) {
        const row = ensureAgent(s.agent_id);
        const days = agentDaysSeen.get(s.agent_id)!;
        if (!days.has(s.stat_date)) {
          days.add(s.stat_date);
          row.daysWorked += 1;
        }
        row.leadsAssigned += Number(s.leads_assigned) || 0;
      }
    });

    // Distinct agents online per bucket (day-level buckets only need the count above;
    // for week/month count unique agents across the bucket).
    seenAgents.forEach((set, key) => {
      const uniqueAgents = new Set(Array.from(set).map(k => k.split('|')[1]));
      const b = buckets.get(key)!;
      b.agentsOnline = uniqueAgents.size;
    });

    (sales || []).forEach(c => {
      if (isLost(c.status)) return;
      if (!c.signup_date) return;
      const credit = creditOf(c);
      if (credit && agentMap.has(credit)) {
        const row = ensureAgent(credit);
        row.sales += 1;
        row.revenue += Number(c.final_amount) || 0;
      }
      const b = ensure(bucketKey(new Date(c.signup_date), grouping));
      b.sales += 1;
      b.revenue += Number(c.final_amount) || 0;
    });

    const chartData = Array.from(buckets.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(b => ({
        ...b,
        revenue: Math.round(b.revenue),
        salesPerAgentDay: b.agentDays > 0 ? Math.round((b.sales / b.agentDays) * 100) / 100 : 0,
      }));

    // Does more staffing mean more sales? Compare heavier-staffed vs lighter-staffed buckets.
    const staffed = chartData.filter(d => d.agentDays > 0);
    const sorted = [...staffed].sort((a, b) => a.agentDays - b.agentDays);
    const half = Math.floor(sorted.length / 2);
    const light = sorted.slice(0, half);
    const heavy = sorted.slice(sorted.length - half);
    const avgOf = (arr: typeof chartData, f: (d: typeof chartData[number]) => number) =>
      arr.length ? arr.reduce((s, d) => s + f(d), 0) / arr.length : 0;
    const lightAgents = avgOf(light, d => d.agentDays);
    const heavyAgents = avgOf(heavy, d => d.agentDays);
    const lightSales = avgOf(light, d => d.sales);
    const heavySales = avgOf(heavy, d => d.sales);
    const lightPerAgent = avgOf(light, d => d.salesPerAgentDay);
    const heavyPerAgent = avgOf(heavy, d => d.salesPerAgentDay);

    // Pearson correlation between agent-days and sales.
    const n = staffed.length;
    const meanA = n ? staffed.reduce((s, d) => s + d.agentDays, 0) / n : 0;
    const meanS = n ? staffed.reduce((s, d) => s + d.sales, 0) / n : 0;
    let cov = 0, varA = 0, varS = 0;
    staffed.forEach(d => {
      cov += (d.agentDays - meanA) * (d.sales - meanS);
      varA += (d.agentDays - meanA) ** 2;
      varS += (d.sales - meanS) ** 2;
    });
    const correlation = varA > 0 && varS > 0 ? cov / Math.sqrt(varA * varS) : 0;

    const agentRows = Array.from(perAgent.values())
      .sort((a, b) => b.sales - a.sales || b.revenue - a.revenue);

    return {
      chartData,
      agentRows,
      totals: {
        agentDays: chartData.reduce((s, d) => s + d.agentDays, 0),
        sales: chartData.reduce((s, d) => s + d.sales, 0),
        revenue: chartData.reduce((s, d) => s + d.revenue, 0),
        correlation,
        lightAgents, heavyAgents, lightSales, heavySales, lightPerAgent, heavyPerAgent,
        comparedBuckets: half,
      },
    };
  }, [agents, stats, sales, grouping]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Staffing vs sales</CardTitle>
          <CardDescription className="mt-1">
            How many agents were online each {grouping === 'day' ? 'day' : grouping === 'week' ? 'week' : 'month'} against
            the warranties sold in the same period — so you can see whether more cover on the phones means more sales.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={grouping} onValueChange={(v) => setGrouping(v as Grouping)}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(groupingLabels) as Grouping[]).map(g => (
                <SelectItem key={g} value={g}>{groupingLabels[g]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(periodLabels) as Period[]).map(p => (
                <SelectItem key={p} value={p}>{periodLabels[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{totals.agentDays.toLocaleString('en-GB')} agent-days worked</Badge>
          <Badge variant="secondary">{totals.sales.toLocaleString('en-GB')} sales</Badge>
          <Badge variant="secondary">{money(totals.revenue)} revenue</Badge>
          <Badge variant="outline">
            {totals.agentDays > 0 ? (totals.sales / totals.agentDays).toFixed(2) : '0'} sales per agent-day
          </Badge>
        </div>

        {/* Does more staffing mean more sales? */}
        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Does having more agents on mean more sales?</span>
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
                      ? 'No — more staff, fewer sales'
                      : 'No real link'}
            </Badge>
            <Badge variant="outline">Correlation {totals.correlation.toFixed(2)}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            On the {totals.comparedBuckets} heaviest-staffed {grouping === 'day' ? 'days' : grouping === 'week' ? 'weeks' : 'months'} we
            averaged {totals.heavyAgents.toFixed(1)} agent-days and made {totals.heavySales.toFixed(1)} sales
            ({totals.heavyPerAgent.toFixed(2)} per agent-day). On the {totals.comparedBuckets} lightest it was{' '}
            {totals.lightAgents.toFixed(1)} agent-days and {totals.lightSales.toFixed(1)} sales
            ({totals.lightPerAgent.toFixed(2)} per agent-day).{' '}
            {totals.heavyPerAgent >= totals.lightPerAgent * 1.05
              ? 'Output per agent holds up when more agents are on — extra cover is adding sales, not diluting them.'
              : totals.lightPerAgent >= totals.heavyPerAgent * 1.05
                ? 'Each agent sells less when more agents are on — on well-staffed days leads may be spread too thin, or there are not enough leads to feed everyone.'
                : 'Sales per agent stay roughly the same whether staffing is light or heavy.'}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading staffing and sales…</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={330}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'agentDays') return [Number(value).toLocaleString('en-GB'), 'Agent-days worked'];
                    if (name === 'sales') return [Number(value).toLocaleString('en-GB'), 'Sales made'];
                    if (name === 'salesPerAgentDay') return [Number(value).toFixed(2), 'Sales per agent-day'];
                    return [value, name];
                  }}
                  labelStyle={{ fontWeight: 'bold' }}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Legend
                  formatter={(v) =>
                    v === 'agentDays' ? 'Agent-days worked'
                      : v === 'sales' ? 'Sales made'
                        : 'Sales per agent-day'}
                />
                <Bar yAxisId="left" dataKey="agentDays" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="salesPerAgentDay" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Agent</th>
                    <th className="py-2 pr-3 font-medium text-right">Days worked</th>
                    <th className="py-2 pr-3 font-medium text-right">Leads given</th>
                    <th className="py-2 pr-3 font-medium text-right">Sales</th>
                    <th className="py-2 pr-3 font-medium text-right">Sales per day worked</th>
                    <th className="py-2 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {agentRows.map(a => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{a.name}</td>
                      <td className="py-2 pr-3 text-right">{a.daysWorked.toLocaleString('en-GB')}</td>
                      <td className="py-2 pr-3 text-right">{a.leadsAssigned.toLocaleString('en-GB')}</td>
                      <td className="py-2 pr-3 text-right">{a.sales.toLocaleString('en-GB')}</td>
                      <td className="py-2 pr-3 text-right">
                        {a.daysWorked > 0 ? (a.sales / a.daysWorked).toFixed(2) : '—'}
                      </td>
                      <td className="py-2 text-right">{money(a.revenue)}</td>
                    </tr>
                  ))}
                  {agentRows.length === 0 && (
                    <tr><td colSpan={6} className="py-3 text-muted-foreground">No agent activity in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StaffingVsSalesPanel;
