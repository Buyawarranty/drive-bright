import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface AgentRef {
  id: string;
  name: string;
}

interface Props {
  /** Any date inside the month being viewed. */
  monthDate: Date;
  /** Agents the current viewer is allowed to see (already role/team scoped). */
  agents: AgentRef[];
  currentAdminUserId: string | null;
  /** Management can flip between agents and an all-agents view. */
  isManagement: boolean;
}

interface SaleRow {
  agentId: string;
  day: string; // yyyy-MM-dd
  amount: number;
  cancelled: boolean;
}

const attributionOf = (c: any) =>
  c.sale_credit_admin_user_id || c.payment_confirmed_by || c.quote_sent_by || c.assigned_to;

const money = (n: number) => `£${Math.round(n).toLocaleString()}`;

/**
 * Daily sales chart for the Sales scoreboard. Each agent can see their own
 * day-by-day deals, revenue and AOV for the selected month; managers can also
 * flip to "All agents" for the whole team picture. Revenue is net of
 * cancelled/refunded orders and keyed off signup_date, matching the rest of
 * the scoreboard.
 */
export const DailySalesChartPanel: React.FC<Props> = ({
  monthDate,
  agents,
  currentAdminUserId,
  isManagement,
}) => {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | 'all'>(() =>
    isManagement ? 'all' : currentAdminUserId || 'all'
  );

  const start = useMemo(() => startOfMonth(monthDate), [monthDate]);
  const end = useMemo(() => endOfMonth(monthDate), [monthDate]);
  const agentIds = useMemo(() => agents.map(a => a.id), [agents]);

  useEffect(() => {
    if (!isManagement && currentAdminUserId) setSelectedAgentId(currentAdminUserId);
  }, [isManagement, currentAdminUserId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (agentIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const idList = agentIds.join(',');
        const attributionFilter = `sale_credit_admin_user_id.in.(${idList}),and(sale_credit_admin_user_id.is.null,payment_confirmed_by.in.(${idList})),and(sale_credit_admin_user_id.is.null,payment_confirmed_by.is.null,quote_sent_by.in.(${idList})),and(sale_credit_admin_user_id.is.null,payment_confirmed_by.is.null,quote_sent_by.is.null,assigned_to.in.(${idList}))`;

        const baseSelect =
          'id, assigned_to, payment_confirmed_by, quote_sent_by, sale_credit_admin_user_id, final_amount, signup_date, status';

        const [{ data: active }, { data: unwound }] = await Promise.all([
          supabase
            .from('customers')
            .select(baseSelect)
            .eq('is_deleted', false)
            .ilike('status', 'active')
            .or(attributionFilter)
            .gte('signup_date', start.toISOString())
            .lte('signup_date', end.toISOString()),
          supabase
            .from('customers')
            .select(baseSelect)
            .eq('is_deleted', false)
            .or('status.ilike.cancelled,status.ilike.refunded')
            .or(attributionFilter)
            .gte('signup_date', start.toISOString())
            .lte('signup_date', end.toISOString()),
        ]);

        const mapped: SaleRow[] = [];
        const push = (list: any[] | null, isCancelled: boolean) => {
          (list || []).forEach(c => {
            const agentId = attributionOf(c);
            if (!agentId || !agentIds.includes(agentId) || !c.signup_date) return;
            mapped.push({
              agentId,
              day: format(new Date(c.signup_date), 'yyyy-MM-dd'),
              amount: Number(c.final_amount) || 0,
              cancelled: isCancelled,
            });
          });
        };
        push(active, false);
        push(unwound, true);

        if (!cancelled) setRows(mapped);
      } catch (e) {
        console.error('[DailySalesChartPanel] failed to load daily sales', e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [agentIds.join(','), start.toISOString(), end.toISOString()]);

  const scopedRows = useMemo(
    () => (selectedAgentId === 'all' ? rows : rows.filter(r => r.agentId === selectedAgentId)),
    [rows, selectedAgentId]
  );

  const chartData = useMemo(() => {
    const days: { key: string; label: string; deals: number; revenue: number; aov: number }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      days.push({
        key: format(cursor, 'yyyy-MM-dd'),
        label: format(cursor, 'd MMM'),
        deals: 0,
        revenue: 0,
        aov: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    const byKey = new Map(days.map(d => [d.key, d]));
    scopedRows.forEach(r => {
      const d = byKey.get(r.day);
      if (!d) return;
      if (r.cancelled) {
        d.revenue -= r.amount;
      } else {
        d.deals += 1;
        d.revenue += r.amount;
      }
    });
    days.forEach(d => {
      d.aov = d.deals > 0 ? Math.round(d.revenue / d.deals) : 0;
    });
    return days;
  }, [scopedRows, start, end]);

  const totals = useMemo(() => {
    const deals = chartData.reduce((s, d) => s + d.deals, 0);
    const revenue = chartData.reduce((s, d) => s + d.revenue, 0);
    const bestDay = chartData.reduce(
      (best, d) => (d.deals > (best?.deals ?? 0) ? d : best),
      null as (typeof chartData)[number] | null
    );
    const activeDays = chartData.filter(d => d.deals > 0).length;
    return {
      deals,
      revenue,
      aov: deals > 0 ? revenue / deals : 0,
      bestDay,
      perDay: activeDays > 0 ? deals / activeDays : 0,
    };
  }, [chartData]);

  const perAgent = useMemo(() => {
    return agents
      .map(a => {
        const own = rows.filter(r => r.agentId === a.id);
        const deals = own.filter(r => !r.cancelled).length;
        const revenue = own.reduce((s, r) => s + (r.cancelled ? -r.amount : r.amount), 0);
        const daysSelling = new Set(own.filter(r => !r.cancelled).map(r => r.day)).size;
        return {
          ...a,
          deals,
          revenue,
          aov: deals > 0 ? revenue / deals : 0,
          perDay: daysSelling > 0 ? deals / daysSelling : 0,
        };
      })
      .sort((a, b) => b.deals - a.deals || b.revenue - a.revenue);
  }, [agents, rows]);

  const selectedName =
    selectedAgentId === 'all'
      ? 'All agents'
      : agents.find(a => a.id === selectedAgentId)?.name || 'Agent';

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Day-by-day deals, revenue and AOV for {format(monthDate, 'MMMM yyyy')}. Revenue is net of
        cancelled and refunded orders.
      </div>

      {(isManagement || agents.length > 1) && (
        <div className="flex flex-wrap gap-2">
          {isManagement && (
            <Button
              variant={selectedAgentId === 'all' ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedAgentId('all')}
            >
              All agents
            </Button>
          )}
          {agents.map(a => (
            <Button
              key={a.id}
              variant={selectedAgentId === a.id ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedAgentId(a.id)}
            >
              {a.name}
              {a.id === currentAdminUserId ? ' (you)' : ''}
            </Button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{selectedName} · daily sales</CardTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
            <span>
              <strong className="text-foreground">{totals.deals}</strong>{' '}
              {totals.deals === 1 ? 'deal' : 'deals'}
            </span>
            <span>
              Revenue <strong className="text-emerald-600">{money(totals.revenue)}</strong>
            </span>
            <span>
              AOV <strong className="text-foreground">{money(totals.aov)}</strong>
            </span>
            <span>
              Avg per selling day{' '}
              <strong className="text-foreground">{totals.perDay.toFixed(1)}</strong>
            </span>
            {totals.bestDay && totals.bestDay.deals > 0 && (
              <span>
                Best day{' '}
                <strong className="text-foreground">
                  {totals.bestDay.label} ({totals.bestDay.deals})
                </strong>
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
              Loading daily sales…
            </div>
          ) : totals.deals === 0 ? (
            <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
              No sales recorded for this month yet.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                    minTickGap={12}
                  />
                  <YAxis yAxisId="deals" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis
                    yAxisId="aov"
                    orientation="right"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => `£${v}`}
                  />
                  <Tooltip
                    formatter={(value: any, name: string) =>
                      name === 'Deals' ? value : money(Number(value))
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    yAxisId="deals"
                    dataKey="deals"
                    name="Deals"
                    fill="hsl(var(--primary))"
                    radius={[3, 3, 0, 0]}
                  />
                  <Line
                    yAxisId="aov"
                    type="monotone"
                    dataKey="aov"
                    name="AOV"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {isManagement && perAgent.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Month to date by agent</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2">Agent</th>
                    <th className="text-right font-semibold px-4 py-2">Deals</th>
                    <th className="text-right font-semibold px-4 py-2">Revenue</th>
                    <th className="text-right font-semibold px-4 py-2">AOV</th>
                    <th className="text-right font-semibold px-4 py-2">Per selling day</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {perAgent.map(a => (
                    <tr
                      key={a.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setSelectedAgentId(a.id)}
                    >
                      <td className="px-4 py-2 font-medium">{a.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{a.deals}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-emerald-600 font-semibold">
                        {money(a.revenue)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(a.aov)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{a.perDay.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DailySalesChartPanel;
