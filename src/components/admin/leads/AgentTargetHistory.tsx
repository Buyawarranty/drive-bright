import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { useAgentScoresForMonth } from '@/hooks/useAgentScoresForMonth';

interface Props {
  agentId: string;
}

interface MonthRow {
  month: Date;
  target: number | null;
  sales: number;
}

const MonthPill: React.FC<{ row: MonthRow }> = ({ row }) => {
  const { target, sales, month } = row;
  const label = format(month, 'MMM yyyy');
  if (!target) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <MinusCircle className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0">
          <div className="text-xs font-medium">{label}</div>
          <div className="text-[11px] text-muted-foreground">No target set</div>
        </div>
      </div>
    );
  }
  const met = sales >= target;
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
        met ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
      }`}
    >
      {met ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <XCircle className="h-4 w-4 text-rose-600" />
      )}
      <div className="min-w-0">
        <div className="text-xs font-medium">{label}</div>
        <div className={`text-[11px] font-semibold ${met ? 'text-emerald-700' : 'text-rose-700'}`}>
          {met ? 'Target met' : 'Not met'} · {sales}/{target}
        </div>
      </div>
    </div>
  );
};

// Fetches one month's sales count for a single agent, matching useAgentScoresForMonth attribution.
const useAgentSalesForMonth = (agentId: string, month: Date) => {
  const { agents, loading } = useAgentScoresForMonth(month);
  const sales = agents.find(a => a.id === agentId)?.salesCount ?? 0;
  return { sales, loading };
};

export const AgentTargetHistory: React.FC<Props> = ({ agentId }) => {
  const now = new Date();
  const m1 = startOfMonth(subMonths(now, 1));
  const m2 = startOfMonth(subMonths(now, 2));
  const m3 = startOfMonth(subMonths(now, 3));

  const [targets, setTargets] = useState<Record<string, number>>({});
  const [loadingTargets, setLoadingTargets] = useState(true);

  const s1 = useAgentSalesForMonth(agentId, m1);
  const s2 = useAgentSalesForMonth(agentId, m2);
  const s3 = useAgentSalesForMonth(agentId, m3);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingTargets(true);
      const { data } = await supabase
        .from('sales_targets')
        .select('target_amount, start_date, end_date')
        .eq('admin_user_id', agentId)
        .eq('target_period', 'monthly')
        .gte('start_date', startOfMonth(m3).toISOString())
        .lte('end_date', endOfMonth(m1).toISOString());
      if (cancelled) return;
      const map: Record<string, number> = {};
      (data || []).forEach(t => {
        const key = format(startOfMonth(new Date(t.start_date)), 'yyyy-MM');
        map[key] = t.target_amount;
      });
      setTargets(map);
      setLoadingTargets(false);
    };
    run();
    return () => { cancelled = true; };
  }, [agentId]);

  const rows: MonthRow[] = [m3, m2, m1].map((month, i) => {
    const sales = [s3, s2, s1][i].sales;
    const key = format(month, 'yyyy-MM');
    return { month, target: targets[key] ?? null, sales };
  });

  const anyTarget = rows.some(r => r.target != null);
  const loading = loadingTargets || s1.loading || s2.loading || s3.loading;

  return (
    <div className="mt-3 pt-3 border-t">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
        Last 3 months
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading history…</div>
      ) : !anyTarget ? (
        <div className="text-xs text-muted-foreground">
          No targets have been set for the previous 3 months yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {rows.map(r => (
            <MonthPill key={r.month.toISOString()} row={r} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentTargetHistory;
