import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, ChevronDown, ChevronUp } from 'lucide-react';
import { differenceInCalendarDays, endOfMonth, format, startOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { buildSaleCreditResolver, fetchSalesCreditAgentIds } from '@/lib/saleCredit';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useSeesAllAgents } from '@/hooks/useSeesAllAgents';
import { getAgentColor } from '@/lib/agentColors';
import { targetCreditAmount } from '@/lib/payBetterSales';

const gbp = (n: number) => `£${Math.round(n || 0).toLocaleString('en-GB')}`;

interface Row {
  team_id: string;
  team_name: string;
  admin_user_id: string;
  agent_name: string;
  revenue: number;
  sales_count: number;
  pct_achieved: number | null;
  revenue_target: number | null;
  is_self: boolean;
}

/**
 * Read-only "my monthly target" strip for the New Leads page.
 *
 * Uses the SAME source as the Sales Scoreboard (`get_team_scoreboard`) so the
 * revenue and targets here can never drift from the scoreboard figures.
 * Managers additionally get an expandable per-agent breakdown.
 */
export const MyTargetStrip: React.FC = () => {
  const now = new Date();
  const month = startOfMonth(now);
  const { effectiveAdminUserId } = useViewAs();
  const { seesAll } = useSeesAllAgents();
  const [rows, setRows] = useState<Row[]>([]);
  const [fallbackRevenue, setFallbackRevenue] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc('get_team_scoreboard', {
      p_start: startOfMonth(month).toISOString(),
      p_end: endOfMonth(month).toISOString(),
    });
    const list = ((data || []) as unknown as Row[]);
    setRows(list);

    // Safety net: if the scoreboard reports zero revenue for everyone (which can
    // happen when the RPC month window misses same-day sales), recount straight
    // from customers using the same sale-credit rules so we never show a false £0.
    const total = list.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
    if (list.length > 0 && total === 0) {
      const ids = list.map(r => r.admin_user_id);
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const { data: sales } = await supabase
        .from('customers')
        .select('final_amount, purchase_source, payment_type, sale_credit_admin_user_id, payment_confirmed_by, quote_sent_by, assigned_to')
        .eq('is_deleted', false)
        .ilike('status', 'active')
        .gte('signup_date', start.toISOString())
        .lte('signup_date', end.toISOString())
        .limit(5000);
      const resolveCredit = buildSaleCreditResolver(await fetchSalesCreditAgentIds());
      const map: Record<string, number> = {};
      (sales || []).forEach((s: any) => {
        const aid = resolveCredit(s);
        if (!aid || !ids.includes(aid)) return;
        // PayBetter sales only credit the one-year equivalent towards target.
        map[aid] = (map[aid] || 0) + targetCreditAmount(s);
      });

      setFallbackRevenue(map);
    } else {
      setFallbackRevenue(null);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month.getFullYear(), month.getMonth()]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`my-target-strip-targets-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_targets' }, () => load())
      .subscribe();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const revenueOf = useCallback(
    (r: Row) => (fallbackRevenue ? (fallbackRevenue[r.admin_user_id] || 0) : Number(r.revenue) || 0),
    [fallbackRevenue],
  );


  const me = useMemo(() => {
    // When impersonating, show that agent. Otherwise the row flagged is_self.
    const mine = effectiveAdminUserId
      ? rows.find(r => r.admin_user_id === effectiveAdminUserId)
      : rows.find(r => r.is_self);

    if (mine) {
      return {
        scope: 'agent' as const,
        revenue: revenueOf(mine),
        target: mine.revenue_target != null ? Number(mine.revenue_target) : null,
      };
    }

    if (!seesAll) return null;

    if (rows.length) {
      const revenue = rows.reduce((s, r) => s + revenueOf(r), 0);
      const target = rows.reduce((s, r) => s + (Number(r.revenue_target) || 0), 0);
      return { scope: 'team' as const, revenue, target: target || null };
    }
    return null;
  }, [rows, effectiveAdminUserId, revenueOf, seesAll]);

  const breakdown = useMemo(
    () => [...rows].sort((a, b) => revenueOf(b) - revenueOf(a)),
    [rows, revenueOf],
  );


  if (loading) return null;
  if (!me) return null;

  const daysLeft = Math.max(0, differenceInCalendarDays(endOfMonth(now), now));
  const monthName = format(month, 'MMMM');
  const scopeLabel = me.scope === 'team' ? 'Team target' : 'My target';

  if (!me.target) {
    return (
      <div className="rounded-xl border bg-card px-4 py-2.5 flex items-center gap-2 text-sm">
        <Target className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold">{scopeLabel} · {monthName}</span>
        <span className="text-muted-foreground">
          {me.scope === 'team'
            ? 'No team targets set yet — set monthly targets on the Sales Scoreboard.'
            : 'No target set yet — ask your manager to set your monthly target.'}
        </span>
      </div>
    );
  }

  const target = me.target;
  const revenue = me.revenue;
  const pct = Math.min((revenue / target) * 100, 100);
  const remaining = Math.max(target - revenue, 0);
  const perDay = remaining > 0 && daysLeft > 0 ? Math.ceil(remaining / daysLeft) : 0;

  const totalDays = endOfMonth(now).getDate();
  const expectedPct = (now.getDate() / totalDays) * 100;
  const state =
    remaining === 0
      ? { label: 'Target hit', cls: 'bg-emerald-600 text-white border-0' }
      : pct >= expectedPct - 5
        ? { label: 'On track', cls: 'bg-sky-100 text-sky-800 border-sky-300' }
        : { label: 'Behind', cls: 'bg-amber-100 text-amber-900 border-amber-300' };

  return (
    <div className="rounded-xl border bg-card px-4 py-2.5">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-[150px]">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {scopeLabel} · {monthName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-lg font-bold leading-none">{gbp(revenue)}</span>
          <span className="text-sm text-muted-foreground">of {gbp(target)}</span>
          <span className="text-sm font-semibold">{pct.toFixed(0)}%</span>
        </div>

        <Progress value={pct} className="h-2 w-32" />

        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          {remaining > 0 ? (
            <>
              <span className="font-medium text-foreground">{gbp(remaining)} to go</span>
              <span>·</span>
              <span>
                {daysLeft} day{daysLeft === 1 ? '' : 's'} left in {monthName}
              </span>
              {perDay > 0 && (
                <>
                  <span>·</span>
                  <span>{gbp(perDay)} a day to hit target</span>
                </>
              )}
            </>
          ) : (
            <span className="font-medium text-emerald-700">
              Target hit — every extra sale is a bonus.
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {seesAll === true && breakdown.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setOpen(o => !o)}
            >
              {open ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
              {open ? 'Hide agent breakdown' : 'Agent breakdown'}
            </Button>
          )}
          <Badge variant="outline" className={`text-xs ${state.cls}`}>
            {state.label}
          </Badge>
        </div>
      </div>

      {seesAll === true && open && (
        <div className="mt-3 pt-3 border-t space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Each agent this month — same figures as the Sales Scoreboard
          </div>
          {breakdown.map(r => {
            const rev = revenueOf(r);
            const tgt = r.revenue_target != null ? Number(r.revenue_target) : null;
            const p = tgt ? Math.min((rev / tgt) * 100, 100) : 0;
            const colour = getAgentColor(r.agent_name, r.admin_user_id);
            return (
              <div key={r.admin_user_id} className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 min-w-[150px] font-medium">
                  <span className={`inline-block h-2 w-2 rounded-full ${colour || 'bg-muted-foreground'}`} />
                  {r.agent_name}
                </span>
                <span className="text-muted-foreground min-w-[70px]">{r.team_name}</span>
                <span className="font-semibold min-w-[70px]">{gbp(rev)}</span>
                <span className="text-muted-foreground min-w-[80px]">
                  of {tgt ? gbp(tgt) : '—'}
                </span>
                <Progress value={p} className="h-1.5 w-24" />
                <span className="min-w-[40px] text-right font-medium">{tgt ? `${p.toFixed(0)}%` : '—'}</span>
                <span className="text-muted-foreground">
                  {Number(r.sales_count) || 0} sale{(Number(r.sales_count) || 0) === 1 ? '' : 's'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyTargetStrip;
