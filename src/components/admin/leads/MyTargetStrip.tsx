import React, { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';
import { differenceInCalendarDays, endOfMonth, format, startOfMonth } from 'date-fns';
import { useScoreboardData } from '@/hooks/useScoreboardData';
import { useAgentScoresForMonth } from '@/hooks/useAgentScoresForMonth';
import { useViewAs } from '@/contexts/ViewAsContext';

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

/**
 * Read-only "my monthly target" strip for the New Leads page.
 *
 * Deliberately simple: no edit controls, no team figures, no navigation away.
 * Days are plain calendar days left in the month — working days are rota
 * dependent and only confuse the daily number.
 */
export const MyTargetStrip: React.FC = () => {
  const now = new Date();
  const month = startOfMonth(now);
  const { currentAdminUserId, agents: liveAgents, loading: liveLoading } = useScoreboardData();
  const { agents: monthAgents, loading: monthLoading } = useAgentScoresForMonth(month);
  const { effectiveAdminUserId } = useViewAs();

  // Impersonation ("viewing as Freddie") must show that agent's target, not the
  // manager's. Managers with no sales row of their own see the team total.
  const myId = effectiveAdminUserId || currentAdminUserId;

  const me = useMemo(() => {
    const mine = myId ? monthAgents.find(a => a.id === myId) : undefined;
    const live = myId ? liveAgents.find(a => a.id === myId) : undefined;

    if (mine || live) {
      return {
        scope: 'agent' as const,
        revenue: mine?.revenue ?? live?.revenue ?? 0,
        target: live?.revenueTarget ?? mine?.revenueTarget ?? null,
      };
    }

    // Not a sales agent (manager/admin) — show the whole team's progress.
    if (monthAgents.length || liveAgents.length) {
      const revenue = monthAgents.reduce((sum, a) => sum + (a.revenue || 0), 0);
      const target = (liveAgents.length ? liveAgents : monthAgents)
        .reduce((sum, a) => sum + (a.revenueTarget || 0), 0);
      return { scope: 'team' as const, revenue, target: target || null };
    }

    return null;
  }, [myId, monthAgents, liveAgents]);

  if (liveLoading || monthLoading) return null;
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

  // Expected pace by today: how far through the month we are.
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

        <Badge variant="outline" className={`ml-auto text-xs ${state.cls}`}>
          {state.label}
        </Badge>
      </div>
    </div>
  );
};

export default MyTargetStrip;
