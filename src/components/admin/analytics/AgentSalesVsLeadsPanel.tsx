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

interface AgentRow {
  id: string;
  name: string;
  sales: number;
  revenue: number;
  leads: number;
}

export const AgentSalesVsLeadsPanel: React.FC = () => {
  const [period, setPeriod] = useState<Period>('90');
  const [grouping, setGrouping] = useState<Grouping>('week');
  const [agentId, setAgentId] = useState<string>('all');

  const fromIso = useMemo(() => periodStart(period).toISOString(), [period]);

  const { data: agents } = useQuery({
    queryKey: ['agent-sales-vs-leads-agents'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active')
        .in('role', ['sales', 'sales_lead'])
        .eq('is_active', true)
        .is('archived_at', null);
      if (error) throw error;
      return (data || []).map(u => ({
        id: u.id,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || (u.email || '').split('@')[0],
      }));
    },
  });

  const { data: sales } = useQuery({
    queryKey: ['agent-sales-vs-leads-sales', fromIso],
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

  const { data: leads } = useQuery({
    queryKey: ['agent-sales-vs-leads-leads', fromIso],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await fetchAllRows<any>(() =>
        supabase
          .from('sales_leads')
          .select('id, created_at, assigned_to')
          .gte('created_at', fromIso)
          .order('created_at', { ascending: false })
      );
      if (error) throw error;
      return data || [];
    },
  });

  const loading = !agents || !sales || !leads;

  const { chartData, agentRows, totals } = useMemo(() => {
    const agentMap = new Map((agents || []).map(a => [a.id, a.name]));
    const creditOf = (c: any) =>
      c.sale_credit_admin_user_id || c.payment_confirmed_by || c.quote_sent_by || c.assigned_to || null;

    const buckets = new Map<string, { key: string; label: string; sales: number; revenue: number; leads: number }>();
    const ensure = (key: string) => {
      let b = buckets.get(key);
      if (!b) {
        b = { key, label: bucketLabel(key, grouping), sales: 0, revenue: 0, leads: 0 };
        buckets.set(key, b);
      }
      return b;
    };

    const perAgent = new Map<string, AgentRow>();
    const ensureAgent = (id: string) => {
      let r = perAgent.get(id);
      if (!r) {
        r = { id, name: agentMap.get(id) || 'Unknown', sales: 0, revenue: 0, leads: 0 };
        perAgent.set(id, r);
      }
      return r;
    };

    (sales || []).forEach(c => {
      if (isLost(c.status)) return;
      if (!c.signup_date) return;
      const credit = creditOf(c);
      if (!credit || !agentMap.has(credit)) return;
      const row = ensureAgent(credit);
      row.sales += 1;
      row.revenue += Number(c.final_amount) || 0;
      if (agentId !== 'all' && credit !== agentId) return;
      const b = ensure(bucketKey(new Date(c.signup_date), grouping));
      b.sales += 1;
      b.revenue += Number(c.final_amount) || 0;
    });

    (leads || []).forEach(l => {
      const owner = l.assigned_to;
      if (!owner || !agentMap.has(owner)) return;
      ensureAgent(owner).leads += 1;
      if (agentId !== 'all' && owner !== agentId) return;
      ensure(bucketKey(new Date(l.created_at), grouping)).leads += 1;
    });

    const chartData = Array.from(buckets.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(b => ({
        ...b,
        revenue: Math.round(b.revenue),
        conversion: b.leads > 0 ? Math.round((b.sales / b.leads) * 1000) / 10 : 0,
      }));

    const agentRows = Array.from(perAgent.values()).sort((a, b) => b.sales - a.sales || b.revenue - a.revenue);

    const visible = agentId === 'all' ? agentRows : agentRows.filter(a => a.id === agentId);
    const tSales = visible.reduce((s, a) => s + a.sales, 0);
    const tLeads = visible.reduce((s, a) => s + a.leads, 0);
    const tRevenue = visible.reduce((s, a) => s + a.revenue, 0);

    return {
      chartData,
      agentRows,
      totals: {
        sales: tSales,
        leads: tLeads,
        revenue: tRevenue,
        conversion: tLeads > 0 ? (tSales / tLeads) * 100 : 0,
        aov: tSales > 0 ? tRevenue / tSales : 0,
      },
    };
  }, [agents, sales, leads, grouping, agentId]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Agent sales vs leads</CardTitle>
          <CardDescription className="mt-1">
            Warranties sold per day, week or month for each agent against the number of leads they were given.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {(agents || []).map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={grouping} onValueChange={(v) => setGrouping(v as Grouping)}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
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
          <Badge variant="secondary">{totals.sales.toLocaleString('en-GB')} deals</Badge>
          <Badge variant="secondary">{totals.leads.toLocaleString('en-GB')} leads</Badge>
          <Badge variant="secondary">Conversion {totals.conversion.toFixed(1)}%</Badge>
          <Badge variant="secondary">Revenue {money(totals.revenue)}</Badge>
          <Badge variant="outline">AOV {money(totals.aov)}</Badge>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading agent sales and leads…</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={330}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'sales') return [Number(value).toLocaleString('en-GB'), 'Warranties sold'];
                    if (name === 'leads') return [Number(value).toLocaleString('en-GB'), 'Leads received'];
                    if (name === 'conversion') return [`${value}%`, 'Conversion'];
                    return [value, name];
                  }}
                  labelStyle={{ fontWeight: 'bold' }}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Legend formatter={(v) => v === 'sales' ? 'Warranties sold' : v === 'leads' ? 'Leads received' : 'Conversion %'} />
                <Bar yAxisId="left" dataKey="leads" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="conversion" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Agent</th>
                    <th className="py-2 pr-3 font-medium text-right">Leads</th>
                    <th className="py-2 pr-3 font-medium text-right">Deals</th>
                    <th className="py-2 pr-3 font-medium text-right">Conversion</th>
                    <th className="py-2 pr-3 font-medium text-right">Revenue</th>
                    <th className="py-2 font-medium text-right">AOV</th>
                  </tr>
                </thead>
                <tbody>
                  {agentRows.map(a => {
                    const conv = a.leads > 0 ? (a.sales / a.leads) * 100 : 0;
                    return (
                      <tr
                        key={a.id}
                        className={`border-b last:border-0 ${agentId === a.id ? 'bg-muted/50' : ''}`}
                      >
                        <td className="py-2 pr-3 font-medium">{a.name}</td>
                        <td className="py-2 pr-3 text-right">{a.leads.toLocaleString('en-GB')}</td>
                        <td className="py-2 pr-3 text-right">{a.sales.toLocaleString('en-GB')}</td>
                        <td className="py-2 pr-3 text-right">{conv.toFixed(1)}%</td>
                        <td className="py-2 pr-3 text-right">{money(a.revenue)}</td>
                        <td className="py-2 text-right">{money(a.sales > 0 ? a.revenue / a.sales : 0)}</td>
                      </tr>
                    );
                  })}
                  {agentRows.length === 0 && (
                    <tr><td colSpan={6} className="py-3 text-muted-foreground">No agent sales or leads in this period.</td></tr>
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
