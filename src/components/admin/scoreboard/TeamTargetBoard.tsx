import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Trophy, Lock, Sparkles, Car } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format, differenceInCalendarDays } from 'date-fns';
import { getAgentColor } from '@/lib/agentColors';
import { useIsManagement } from '@/hooks/useIsManagement';

interface Row {
  team_id: string;
  team_name: string;
  team_sort: number;
  admin_user_id: string;
  agent_name: string;
  revenue: number;
  sales_count: number;
  pct_achieved: number | null;
  revenue_target: number | null;
  full_month_target: number | null;
  working_days: number | null;
  full_month_days: number | null;
  team_revenue: number;
  team_pct: number | null;
  is_self: boolean;
}

const gbp = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n || 0);

const teamAccent = (name: string) => {
  const n = (name || '').toLowerCase();
  if (n.includes('red'))
    return { pill: 'bg-red-100 text-red-800 border-red-300', dot: 'bg-red-500', ring: 'border-l-red-500', car: 'text-red-500' };
  if (n.includes('blue'))
    return { pill: 'bg-blue-100 text-blue-800 border-blue-300', dot: 'bg-blue-500', ring: 'border-l-blue-500', car: 'text-blue-500' };
  if (n.includes('green'))
    return { pill: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500', ring: 'border-l-emerald-500', car: 'text-emerald-500' };
  return { pill: 'bg-muted text-foreground border-border', dot: 'bg-muted-foreground', ring: 'border-l-border', car: 'text-muted-foreground' };
};


/**
 * Progress bar colour — calm, single-hue scale.
 * Blue while working towards the target, green once it's hit. No red/amber alarm colours.
 */
const progressBarColor = (pct: number | null) => {
  const p = pct ?? 0;
  if (p >= 100) return '[&>div]:bg-emerald-500';
  return '[&>div]:bg-sky-500';
};


/** Motivational status tag driven purely by % of target achieved. */
const statusTag = (pct: number | null, salesCount: number) => {
  if (pct == null) return { label: 'No target set', cls: 'bg-muted text-muted-foreground border-border', msg: 'Ask your manager to set a target.' };
  if (pct >= 100) return { label: '🏆 Target hit', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', msg: 'Target smashed — everything from here is a bonus!' };
  if (pct >= 90) return { label: '🔥 So close', cls: 'bg-amber-100 text-amber-900 border-amber-300', msg: 'One more sale should do it!' };
  if (pct >= 75) return { label: '📈 On track', cls: 'bg-sky-100 text-sky-800 border-sky-300', msg: 'Great work! Keep it up.' };
  if (pct >= 50) return { label: '💪 Building', cls: 'bg-indigo-100 text-indigo-800 border-indigo-300', msg: 'Halfway there — keep the calls coming.' };
  if (pct >= 25) return { label: '🚀 Picking up', cls: 'bg-violet-100 text-violet-800 border-violet-300', msg: 'Momentum is building.' };
  if (salesCount > 0 || pct > 0) return { label: '🌱 Just starting', cls: 'bg-muted text-foreground border-border', msg: 'Off the mark — next one is closer.' };
  return { label: '⏸️ First sale to come', cls: 'bg-muted text-muted-foreground border-border', msg: 'Today is a great day for your first sale.' };
};

const initial = (name: string) => (name || '?').trim().charAt(0).toUpperCase();

/**
 * Team scoreboard with the agreed visibility rules:
 *  - Actual sales £: visible to everyone on the same team
 *  - Progress vs target: shown as a % only
 *  - Exact £ monthly target: only for the agent themselves (and management)
 *  - Team target progress: visible to all agents on the team
 */
export const TeamTargetBoard: React.FC<{ monthDate?: Date }> = ({ monthDate }) => {
  const { isManagement } = useIsManagement();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const month = monthDate ?? new Date();

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_team_scoreboard', {
      p_start: startOfMonth(month).toISOString(),
      p_end: endOfMonth(month).toISOString(),
    });
    if (error) setError(error.message);
    else {
      setError(null);
      setRows((data || []) as unknown as Row[]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month.getFullYear(), month.getMonth()]);

  useEffect(() => { load(); }, [load]);

  // Live-update when a manager changes a target, and on tab focus, so agents never
  // sit on a stale target figure.
  useEffect(() => {
    const channel = supabase
      .channel('team-target-board-targets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_targets' }, () => load())
      .subscribe();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);


  const teams = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sort: number; revenue: number; pct: number | null; members: Row[] }>();
    for (const r of rows) {
      const t = map.get(r.team_id) ?? {
        id: r.team_id, name: r.team_name, sort: r.team_sort ?? 0,
        revenue: Number(r.team_revenue) || 0, pct: r.team_pct, members: [],
      };
      t.members.push(r);
      map.set(r.team_id, t);
    }
    return Array.from(map.values()).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || a.sort - b.sort);
  }, [rows]);

  const ranking = useMemo(
    () => rows.slice().sort((a, b) => Number(b.revenue) - Number(a.revenue)),
    [rows]
  );

  const totals = useMemo(() => {
    const revenue = teams.reduce((s, t) => s + (t.revenue || 0), 0);
    const avgPerAgent = rows.length ? revenue / rows.length : 0;
    const pcts = teams.map(t => t.pct).filter((p): p is number => p != null);
    const pct = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
    return { revenue, avgPerAgent, pct };
  }, [teams, rows]);

  // Days still to come after today (3 Aug in a 31-day month = 28 days left).
  const daysLeft = Math.max(0, differenceInCalendarDays(endOfMonth(month), new Date()));

  const topPerformer = ranking[0];

  return (
    <div className="space-y-4">
      {/* Summary band */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Team progress — {format(month, 'MMMM yyyy')}
          </CardTitle>
          {isManagement && (
            <p className="text-xs text-muted-foreground">
              Everyone on your team sees each other's sales and progress as a percentage. The exact £ monthly target
              stays private to each agent and their manager. Targets are scaled down automatically for agents
              working fewer days this month.
            </p>
          )}

        </CardHeader>
        <CardContent className="space-y-5">
          {loading && <p className="text-sm text-muted-foreground">Loading team figures…</p>}
          {!loading && error && <p className="text-sm text-destructive">Could not load team figures: {error}</p>}
          {!loading && !error && teams.length === 0 && (
            <p className="text-sm text-muted-foreground">You're not on a sales team yet, so there's nothing to show.</p>
          )}

          {!loading && !error && teams.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Total sales this month</p>
                <p className="text-2xl font-bold tracking-tight">{gbp(totals.revenue)}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Average revenue per agent</p>
                <p className="text-2xl font-bold tracking-tight">{gbp(totals.avgPerAgent)}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Days left in month</p>
                <p className="text-2xl font-bold tracking-tight">{daysLeft}</p>
              </div>
            </div>
          )}

          {teams.map(team => {
            const accent = teamAccent(team.name);
            const teamPct = Math.min(team.pct ?? 0, 100);
            return (
              <div key={team.id} className={`rounded-xl border border-l-4 ${accent.ring} p-4 space-y-4 bg-card`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${accent.dot}`} />
                    <span className="font-semibold text-lg">{team.name}</span>
                    <Badge variant="outline" className={accent.pill}>
                      {team.pct != null ? `${team.pct}% of team target` : 'No team target set'}
                    </Badge>
                  </div>
                  <span className="text-sm font-semibold">{gbp(team.revenue)} <span className="font-normal text-muted-foreground">team sales</span></span>
                </div>
                {/* Quieter team bar with a little car showing how far the team has travelled. */}
                <div className="relative pt-3">
                  <Progress
                    value={teamPct}
                    className={`h-1.5 bg-muted ${progressBarColor(team.pct)}`}
                  />
                  <Car
                    className={`absolute top-0 h-4 w-4 -translate-x-1/2 ${accent.car}`}
                    style={{ left: `${teamPct}%` }}
                    aria-hidden
                  />
                </div>


                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {team.members
                    .slice()
                    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
                    .map(m => {
                      const firstName = (m.agent_name || '').split(' ')[0];
                      const avatarBg = getAgentColor(firstName, m.admin_user_id);
                      const pct = m.pct_achieved;
                      const tag = statusTag(pct, Number(m.sales_count) || 0);
                      const gap =
                        m.revenue_target != null
                          ? Math.max(0, Number(m.revenue_target) - Number(m.revenue))
                          : null;
                      return (
                        <div
                          key={m.admin_user_id}
                          className={`rounded-xl border p-4 space-y-3 transition-shadow hover:shadow-md ${m.is_self ? 'ring-2 ring-primary/40' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`h-10 w-10 rounded-full ${avatarBg} text-white flex items-center justify-center text-base font-bold flex-shrink-0`}>
                              {initial(firstName)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">
                                {m.agent_name}
                                {m.is_self && <Badge variant="secondary" className="ml-2 text-[10px]">You</Badge>}
                              </p>
                              <p className="text-xs text-muted-foreground">{gbp(Number(m.revenue) || 0)} revenue this month</p>
                            </div>
                          </div>

                          <div className="flex items-end justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {m.revenue_target != null ? 'To hit target' : 'Sales'}
                              </p>
                              <p className="text-xl font-bold tracking-tight">
                                {gbp(Number(m.revenue))}
                                {m.revenue_target != null && (
                                  <span className="text-sm font-normal text-muted-foreground"> / {gbp(Number(m.revenue_target))}</span>
                                )}
                              </p>
                            </div>
                            <span className="text-2xl font-bold tabular-nums">
                              {pct != null ? `${pct}%` : '—'}
                            </span>
                          </div>

                          <Progress value={Math.min(pct ?? 0, 100)} className={`h-2 ${progressBarColor(pct)}`} />

                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={tag.cls}>{tag.label}</Badge>
                            {gap != null && gap > 0 && (
                              <span className="text-xs text-muted-foreground">{gbp(gap)} to go</span>
                            )}
                            {m.revenue_target == null && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Lock className="h-3 w-3" /> target private
                              </span>
                            )}
                          </div>

                          {m.revenue_target != null &&
                            m.working_days != null &&
                            m.full_month_days != null &&
                            m.working_days < m.full_month_days && (
                              <p className="text-[11px] text-muted-foreground">
                                Pro-rata {m.working_days}/{m.full_month_days} days
                                {m.full_month_target != null && ` (full month ${gbp(Number(m.full_month_target))})`}
                              </p>
                            )}

                          <p className="text-xs text-muted-foreground italic">{tag.msg}</p>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {ranking.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              Ranking this month
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ranking.map((r, i) => {
              const firstName = (r.agent_name || '').split(' ')[0];
              return (
                <div key={r.admin_user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-sm font-semibold text-muted-foreground">#{i + 1}</span>
                    <span className={`h-7 w-7 rounded-full ${getAgentColor(firstName, r.admin_user_id)} text-white flex items-center justify-center text-xs font-bold`}>
                      {initial(firstName)}
                    </span>
                    <span className={`text-sm ${r.is_self ? 'font-semibold' : ''}`}>{r.agent_name}</span>
                    <Badge variant="outline" className={teamAccent(r.team_name).pill}>{r.team_name}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-semibold">{gbp(Number(r.revenue))}</span>
                    <Badge variant="outline" className={statusTag(r.pct_achieved, Number(r.sales_count) || 0).cls}>
                      {r.pct_achieved != null ? `${r.pct_achieved}%` : '—'}
                    </Badge>
                  </div>
                </div>
              );
            })}
            {topPerformer && (
              <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Top performer this month: <span className="font-semibold text-foreground">{topPerformer.agent_name}</span> with {gbp(Number(topPerformer.revenue))}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
