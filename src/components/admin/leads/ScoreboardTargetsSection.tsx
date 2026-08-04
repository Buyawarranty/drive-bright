import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, Trophy, TrendingUp, PoundSterling, Sparkles, Flame } from 'lucide-react';
import { format, startOfMonth, endOfMonth, differenceInCalendarDays, isSameMonth } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useScoreboardData, AgentScore } from '@/hooks/useScoreboardData';
import { useAgentScoresForMonth } from '@/hooks/useAgentScoresForMonth';
import { QuickMonthFilter } from '@/components/admin/QuickMonthFilter';
import { ScoreboardTargetManager } from '@/components/admin/scoreboard/ScoreboardTargetManager';
import { AgentTargetHistory } from '@/components/admin/leads/AgentTargetHistory';


const MILESTONES: { threshold: number; label: string; tone: string }[] = [
  { threshold: 100, label: 'Target smashed!', tone: 'text-emerald-600' },
  { threshold: 90, label: 'Almost there — final push!', tone: 'text-amber-600' },
  { threshold: 75, label: 'On the home stretch', tone: 'text-orange-600' },
  { threshold: 50, label: 'Halfway hero', tone: 'text-rose-600' },
  { threshold: 25, label: 'Quarter of the way', tone: 'text-sky-600' },
  { threshold: 0, label: "Let's get started", tone: 'text-slate-600' },
];

const milestoneFor = (pct: number) =>
  MILESTONES.find(m => pct >= m.threshold) || MILESTONES[MILESTONES.length - 1];

interface AgentCardProps {
  agent: AgentScore;
  compact?: boolean;
  month?: Date;
  showHistory?: boolean;
}

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

const AgentTargetCard: React.FC<AgentCardProps> = ({ agent, compact, month, showHistory = true }) => {
  const viewMonth = month ?? new Date();
  const isCurrentMonth = isSameMonth(viewMonth, new Date());
  // The target is a £ revenue goal (default £35,000), not a deal count — both
  // sales_targets columns hold the same £ figure, so we drive everything off revenue.
  const target = agent.revenueTarget || 0;
  const revenue = agent.revenue || 0;
  const sales = agent.salesCount || 0;
  const remaining = target ? Math.max(target - revenue, 0) : 0;
  const pct = target ? Math.min((revenue / target) * 100, 100) : 0;
  const milestone = milestoneFor(pct);
  const daysLeft = isCurrentMonth
    ? Math.max(differenceInCalendarDays(endOfMonth(new Date()), new Date()), 0)
    : 0;
  // Average £/day still needed across the remaining days to land on target.
  const pace = remaining && daysLeft > 0 ? Math.ceil(remaining / daysLeft) : 0;

  return (
    <div className={`rounded-lg border bg-card p-4 ${compact ? '' : 'shadow-sm'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{agent.name}</p>
          <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
        </div>
        {target > 0 ? (
          <Badge variant="outline" className="shrink-0">
            {gbp(revenue)} / {gbp(target)}
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 text-muted-foreground">
            No target set
          </Badge>
        )}
      </div>

      {target > 0 ? (
        <>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-semibold flex items-center gap-1.5 ${milestone.tone}`}>
              {pct >= 100 ? <Trophy className="h-3.5 w-3.5" /> : <Flame className="h-3.5 w-3.5" />}
              {milestone.label}
            </span>
            <span className="text-xs font-bold">{pct.toFixed(0)}%</span>
          </div>
          <Progress value={pct} className="h-2.5" />

          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2">
              <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-medium">Revenue in</div>
              <div className="text-sm font-bold text-emerald-800">{gbp(revenue)}</div>
              <div className="text-[10px] text-emerald-600/80 mt-0.5">{sales} sale{sales === 1 ? '' : 's'}</div>
            </div>
            <div className="rounded-md bg-orange-50 border border-orange-200 p-2">
              <div className="text-[10px] uppercase tracking-wide text-orange-700 font-medium">Monthly target</div>
              <div className="text-sm font-bold text-orange-800">{gbp(target)}</div>
            </div>
            <div className="rounded-md bg-blue-50 border border-blue-200 p-2">
              <div className="text-[10px] uppercase tracking-wide text-blue-700 font-medium">£ to hit target</div>
              <div className="text-sm font-bold text-blue-800">{gbp(remaining)}</div>
            </div>
          </div>

          {remaining > 0 && daysLeft > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {daysLeft} day{daysLeft === 1 ? '' : 's'} left · average pace ~{gbp(pace)}/day to hit target
            </p>
          )}
          {remaining === 0 && (
            <p className="text-[11px] text-emerald-700 font-medium mt-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Target hit — every extra sale is a bonus!
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Ask a manager to set your monthly target from Lead Allocation → Scoreboard Targets.
        </p>
      )}

      {showHistory && <AgentTargetHistory agentId={agent.id} />}
    </div>
  );
};

interface Props {
  isManagement: boolean;
}

export const ScoreboardTargetsSection: React.FC<Props> = ({ isManagement }) => {
  const { effectiveRole } = useViewAs();
  const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
  const isCurrentMonth = isSameMonth(month, new Date());

  const { agents: liveAgents, loading: liveLoading, currentAdminUserId, refresh } = useScoreboardData();
  const { agents: monthAgents, loading: monthLoading } = useAgentScoresForMonth(month);
  const [monthTargets, setMonthTargets] = useState<Record<string, number>>({});
  const [targetsLoading, setTargetsLoading] = useState(false);

  // Targets that were in force during the selected (historical) month.
  useEffect(() => {
    if (isCurrentMonth) return;
    let cancelled = false;
    const run = async () => {
      setTargetsLoading(true);
      const { data } = await supabase
        .from('sales_targets')
        .select('admin_user_id, target_amount, start_date, end_date')
        .eq('target_period', 'monthly')
        .lte('start_date', endOfMonth(month).toISOString())
        .gte('end_date', startOfMonth(month).toISOString());
      if (cancelled) return;
      const map: Record<string, number> = {};
      (data || []).forEach((t: any) => {
        if (t.admin_user_id) map[t.admin_user_id] = t.target_amount;
      });
      setMonthTargets(map);
      setTargetsLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [month.getFullYear(), month.getMonth(), isCurrentMonth]);

  const agents = useMemo(
    () =>
      isCurrentMonth
        ? liveAgents
        : monthAgents.map(a => ({
            ...a,
            monthlyTarget: monthTargets[a.id] ?? null,
            // sales_targets stores the £ revenue target in both columns, so the
            // historical target_amount is the revenue goal for that month too.
            revenueTarget: a.revenueTarget ?? monthTargets[a.id] ?? null,
          })),
    [isCurrentMonth, liveAgents, monthAgents, monthTargets],
  );
  const loading = isCurrentMonth ? liveLoading : monthLoading || targetsLoading;

  const myAgent = useMemo(
    () => agents.find(a => a.id === currentAdminUserId) || null,
    [agents, currentAdminUserId],
  );

  // Milestone toast for the signed-in agent (once per milestone per month).
  useEffect(() => {
    if (!isCurrentMonth) return;
    if (!myAgent || !myAgent.revenueTarget) return;
    const pct = Math.min((myAgent.revenue / myAgent.revenueTarget) * 100, 100);
    const hit = [100, 90, 75, 50, 25].find(t => pct >= t);
    if (!hit) return;
    const key = `st-toast:${myAgent.id}:${format(startOfMonth(new Date()), 'yyyy-MM')}:${hit}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    const m = milestoneFor(pct);
    toast.success(m.label, {
      description:
        hit === 100
          ? `You've banked ${gbp(myAgent.revenue)} of your ${gbp(myAgent.revenueTarget)} target this month 🎉`
          : `${pct.toFixed(0)}% of your monthly revenue target — keep going!`,
    });
  }, [myAgent?.revenue, myAgent?.revenueTarget, myAgent?.id, isCurrentMonth]);

  const sortedAgents = useMemo(
    () =>
      [...agents]
        .filter(a => a.isActive !== false)
        .sort((a, b) => {
          const at = a.revenueTarget || 0;
          const bt = b.revenueTarget || 0;
          const ap = at ? a.revenue / at : -1;
          const bp = bt ? b.revenue / bt : -1;
          return bp - ap;
        }),
    [agents],
  );

  const monthNav = (
    <QuickMonthFilter
      dateRange={{ from: startOfMonth(month), to: endOfMonth(month) }}
      onDateRangeChange={r => r?.from && setMonth(startOfMonth(r.from))}
    />
  );

  // Agent-only view (sales, no manager permissions)
  if (!isManagement) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              My monthly target — {format(month, 'MMMM yyyy')}
            </CardTitle>
            {monthNav}
          </div>
          <p className="text-xs text-muted-foreground">
            Only you and your managers can see this. Managers set the goal from Lead Allocation.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading your target…</p>
          ) : !myAgent ? (
            <p className="text-sm text-muted-foreground">No data for {format(month, 'MMMM yyyy')}.</p>
          ) : (
            <AgentTargetCard agent={myAgent} month={month} showHistory={isCurrentMonth} />
          )}
        </CardContent>
      </Card>
    );
  }

  // Management view
  return (
    <div className="space-y-4">
      <div className="border-l-4 border-primary/60 pl-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" /> Scoreboard Targets
        </h2>
        <p className="text-xs text-muted-foreground">
          Set each agent's monthly deals target here. Each agent sees only their own progress and how much revenue is left to hit target.
        </p>
      </div>

      {/* Team progress grid — quick glance at where everyone stands */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PoundSterling className="h-4 w-4 text-primary" />
              Team progress — {format(month, 'MMMM yyyy')}
              {!isCurrentMonth && (
                <Badge variant="outline" className="text-[10px] uppercase">Past month</Badge>
              )}
            </CardTitle>
            {monthNav}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : sortedAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sales agents.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {sortedAgents.map(a => (
                <AgentTargetCard key={a.id} agent={a} compact month={month} showHistory={isCurrentMonth} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      {/* Target editor — writes to sales_targets */}
      <ScoreboardTargetManager agents={sortedAgents} onTargetSaved={refresh} />
    </div>
  );
};

export default ScoreboardTargetsSection;
