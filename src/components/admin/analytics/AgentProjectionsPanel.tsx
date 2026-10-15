import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { projectAgent } from './agentProjection';

interface Row {
  admin_user_id: string;
  agent_name: string;
  revenue: number;
  sales_count: number;
  full_month_target: number;
  revenue_target: number;
}

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

/** Per-agent current-month run-rate projection, using the same figures as the scoreboard. */
export const AgentProjectionsPanel: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const { data, error } = await supabase.rpc('get_team_scoreboard', { p_start: start.toISOString(), p_end: end.toISOString() });
      if (error) console.error('Agent projections load error', error);
      if (!cancelled) { setRows((data || []) as Row[]); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = now.getDate();

  const list = useMemo(() => rows
    .map(r => ({
      ...r,
      ...projectAgent(Number(r.revenue) || 0, Number(r.sales_count) || 0, day, daysInMonth,
        Number(r.full_month_target ?? r.revenue_target) || 0),
    }))
    .sort((a, b) => b.projectedRevenue - a.projectedRevenue), [rows, day, daysInMonth]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Projection per agent</CardTitle>
        <p className="text-sm text-muted-foreground">
          Where each agent will finish this month if they keep their current pace (day {day} of {daysInMonth}). Same sales and targets as the scoreboard.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !list.length ? (
          <p className="text-sm text-muted-foreground">No agent sales recorded this month yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Agent</th>
                <th className="py-2 pr-3 font-medium text-right">Sales so far</th>
                <th className="py-2 pr-3 font-medium text-right">Revenue so far</th>
                <th className="py-2 pr-3 font-medium text-right">Projected sales</th>
                <th className="py-2 pr-3 font-medium text-right">Projected revenue</th>
                <th className="py-2 pr-3 font-medium text-right">Target</th>
                <th className="py-2 font-medium text-right">Projected vs target</th>
              </tr>
            </thead>
            <tbody>
              {list.map(a => (
                <tr key={a.admin_user_id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{a.agent_name}</td>
                  <td className="py-2 pr-3 text-right">{a.sales_count}</td>
                  <td className="py-2 pr-3 text-right">{gbp(a.revenue)}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-primary">{a.projectedSales}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-primary">{gbp(a.projectedRevenue)}</td>
                  <td className="py-2 pr-3 text-right">{a.target ? gbp(a.target) : 'Not set'}</td>
                  <td className={`py-2 text-right font-semibold ${a.projectedPct === null ? 'text-muted-foreground' : a.projectedPct >= 100 ? 'text-green-600' : 'text-amber-600'}`}>
                    {a.projectedPct === null ? '—' : `${a.projectedPct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentProjectionsPanel;
