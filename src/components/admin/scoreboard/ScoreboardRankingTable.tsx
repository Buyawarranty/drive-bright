import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trophy, Medal, Crown, Star, Pencil, Save, Loader2 } from 'lucide-react';
import { AgentScore, TimePeriod } from '@/hooks/useScoreboardData';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface TeamInfo {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  sort_order: number;
}

interface TeamMember {
  team_id: string;
  admin_user_id: string;
}

interface Props {
  agents: AgentScore[];
  currentAdminUserId: string | null;
  period: TimePeriod;
  currentUserRole?: string | null;
  onTargetSaved?: () => void;
  teams?: TeamInfo[];
  teamMembers?: TeamMember[];
  groupByTeam?: boolean;
}

const PERIOD_LABELS: Record<TimePeriod, string> = {
  today: "Today's",
  week: "This Week's",
  month: "This Month's",
  all: 'All-Time',
  custom: 'Custom Period',
};

const getRankStyle = (rank: number) => {
  switch (rank) {
    case 1: return { bg: 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-400', icon: <Crown className="h-6 w-6 text-yellow-500 drop-shadow" />, label: 'bg-yellow-500 text-white', ring: 'ring-2 ring-yellow-400/50' };
    case 2: return { bg: 'bg-gradient-to-r from-gray-50 to-slate-100 border-gray-300', icon: <Medal className="h-5 w-5 text-gray-400" />, label: 'bg-gray-400 text-white', ring: '' };
    case 3: return { bg: 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-300', icon: <Medal className="h-5 w-5 text-orange-600" />, label: 'bg-orange-600 text-white', ring: '' };
    default: return { bg: 'border-border', icon: null, label: 'bg-muted text-muted-foreground', ring: '' };
  }
};




export const ScoreboardRankingTable: React.FC<Props> = ({ agents, currentAdminUserId, period, currentUserRole, onTargetSaved, teams = [], teamMembers = [], groupByTeam = false }) => {
  // Map admin_user_id -> team for tag rendering
  const teamById = React.useMemo(() => {
    const map = new Map<string, TeamInfo>();
    teams.forEach(t => map.set(t.id, t));
    return map;
  }, [teams]);
  const teamForAgent = React.useCallback((agentId: string): TeamInfo | null => {
    const m = teamMembers.find(tm => tm.admin_user_id === agentId);
    if (!m) return null;
    return teamById.get(m.team_id) || null;
  }, [teamMembers, teamById]);
  // Editing targets is management-only (admin, super_admin, sales_manager).
  const canEditTargets = currentUserRole === 'super_admin' || currentUserRole === 'admin' || currentUserRole === 'sales_manager';

  // Management = admin, super_admin, sales_manager ONLY (sales_lead is NOT management).
  const isManagement = currentUserRole === 'admin' || currentUserRole === 'super_admin' || currentUserRole === 'sales_manager';
  // A sales agent may only see their own end-of-month projection; management sees everyone's.
  const canSeeProjection = (agentId: string) => isManagement || agentId === currentAdminUserId;
  const prevFirstRef = useRef<string | null>(null);

  // Projection is only meaningful when viewing the current month.
  const showProjection = period === 'month';
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = Math.max(1, now.getDate());
  const projectionMultiplier = daysInMonth / dayOfMonth;
  const projectSales = (n: number) => Math.round(n * projectionMultiplier);
  const projectRevenue = (n: number) => Math.round(n * projectionMultiplier);


  useEffect(() => {
    if (agents.length > 0) {
      const firstId = agents[0].id;
      if (prevFirstRef.current && prevFirstRef.current !== firstId) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.3 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#7B68EE'],
        });
      }
      prevFirstRef.current = firstId;
    }
  }, [agents]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/30 border-b py-4">
        <CardTitle className="flex items-center gap-3 text-base md:text-lg flex-wrap font-semibold">
          <Trophy className="h-5 w-5 text-yellow-500" />
          {PERIOD_LABELS[period]} leaderboard
          <Badge variant="outline" className="text-[11px] font-medium border-emerald-500/60 text-emerald-700 bg-emerald-50">
            Conversion goal 10%
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {agents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No sales data for this period yet.</div>
        ) : (
          <div className="overflow-x-auto">
            {/* Column headers (desktop only) */}
            <div className="hidden md:flex items-center gap-4 px-4 md:px-6 py-2 border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-max">
              <div className="flex-shrink-0 w-12 text-center">Rank</div>
              <div className="w-[220px] flex-shrink-0">Agent</div>
              <div className="flex items-center gap-6">
                <div className="w-24 text-center">Sales</div>
                <div className="w-24 text-center">Revenue</div>
                <div className="w-32 text-center" title="Monthly revenue target and progress">Target</div>
                {showProjection && (
                  <div className="w-28 text-center" title="Projected end-of-month at current pace">Projected</div>
                )}
                <div className="w-24 text-center">Conv. / Goal</div>
                <div className="w-20 text-center">AOV</div>
                <div className="w-24 text-center" title="Average discount % across this agent's sales this period">Avg Disc.</div>
                {agents.some(a => a.cancelledCount > 0) && (
                  <div className="w-16 text-center">Refunds</div>
                )}
                {canEditTargets && <div className="w-20 text-center">Edit</div>}
              </div>

            </div>
          <div className="divide-y min-w-max">
            {(() => {
              // Build render list, optionally grouped by team
              type Row = { kind: 'header'; team: TeamInfo | null; count: number; totalSales: number; totalRevenue: number } | { kind: 'agent'; agent: AgentScore };
              const rows: Row[] = [];
              if (groupByTeam && teams.length > 0) {
                const buckets = new Map<string, AgentScore[]>();
                const noTeam: AgentScore[] = [];
                agents.forEach(a => {
                  const t = teamForAgent(a.id);
                  if (!t) { noTeam.push(a); return; }
                  if (!buckets.has(t.id)) buckets.set(t.id, []);
                  buckets.get(t.id)!.push(a);
                });
                const orderedTeams = [...teams].sort((a, b) => a.sort_order - b.sort_order);
                orderedTeams.forEach(t => {
                  const list = buckets.get(t.id);
                  if (!list || list.length === 0) return;
                  const totalSales = list.reduce((s, a) => s + a.salesCount, 0);
                  const totalRevenue = list.reduce((s, a) => s + a.revenue, 0);
                  // Header count reflects ACTIVE agents on the team, not scored rows
                  // (inactive agents linger in the list to preserve historical sales).
                  const activeCount = list.filter(a => a.isActive).length;
                  rows.push({ kind: 'header', team: t, count: activeCount, totalSales, totalRevenue });
                  list.forEach(agent => rows.push({ kind: 'agent', agent }));
                });
                if (noTeam.length > 0) {
                  const totalSales = noTeam.reduce((s, a) => s + a.salesCount, 0);
                  const totalRevenue = noTeam.reduce((s, a) => s + a.revenue, 0);
                  const activeCount = noTeam.filter(a => a.isActive).length;
                  rows.push({ kind: 'header', team: null, count: activeCount, totalSales, totalRevenue });
                  noTeam.forEach(agent => rows.push({ kind: 'agent', agent }));
                }
              } else {
                agents.forEach(agent => rows.push({ kind: 'agent', agent }));
              }
              return rows.map((row, idx) => {
                if (row.kind === 'header') {
                  const t = row.team;
                  return (
                    <div
                      key={`hdr-${t?.id ?? 'noteam'}-${idx}`}
                      className="flex items-center justify-between gap-3 px-4 md:px-6 py-2 border-b-2 min-w-max sticky left-0"
                      style={t ? { backgroundColor: `${t.color}18`, borderBottomColor: t.color } : { backgroundColor: 'hsl(var(--muted))' }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide"
                          style={t ? { backgroundColor: t.color, color: '#fff' } : {}}
                        >
                          {t ? `${t.emoji ? t.emoji + ' ' : ''}${t.name}` : 'No team'}
                        </span>
                        <span className="text-xs text-muted-foreground">{row.count} {row.count === 1 ? 'agent' : 'agents'}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground">Team sales: <strong className="text-foreground">{row.totalSales}</strong></span>
                        <span className="text-muted-foreground">Team revenue: <strong className="text-emerald-600">£{row.totalRevenue.toLocaleString()}</strong></span>
                      </div>
                    </div>
                  );
                }
                const agent = row.agent;
              const style = getRankStyle(agent.rank);
              const isMe = agent.id === currentAdminUserId;
              

              return (
                <div
                  key={agent.id}
                  className={`flex items-center gap-4 px-4 py-4 md:px-6 transition-all hover:bg-muted/30 min-w-max ${style.bg} ${style.ring} ${isMe ? 'bg-primary/5 border-l-4 border-l-primary' : ''} ${!agent.isActive ? 'opacity-60' : ''}`}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-12 text-center">
                    {style.icon ? (
                      <div className="flex items-center justify-center">{style.icon}</div>
                    ) : (
                      <span className="text-lg font-bold text-muted-foreground">#{agent.rank}</span>
                    )}
                  </div>

                  {/* Avatar & Name */}
                  <div className="w-[220px] flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm ${agent.rank === 1 ? 'bg-yellow-500 text-white' : agent.rank === 2 ? 'bg-gray-400 text-white' : agent.rank === 3 ? 'bg-orange-600 text-white' : 'bg-primary text-primary-foreground'}`}>
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm leading-tight flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{agent.name}</span>
                          {isMe && <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary text-primary">You</Badge>}
                          {agent.rank === 1 && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                          {!agent.isActive && <span className="text-[10px] font-medium text-muted-foreground uppercase">(inactive)</span>}
                        </div>
                        {(() => {
                          const t = teamForAgent(agent.id);
                          if (!t) return null;
                          return (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0 mt-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                              style={{ backgroundColor: t.color, color: '#fff' }}
                              title={t.name}
                            >
                              {t.emoji ? `${t.emoji} ` : ''}{t.name}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>


                  {/* Stats */}
                  <div className="hidden md:flex items-center gap-6 text-sm">
                    <div className="w-24 text-center">
                      <div className="font-bold text-lg tabular-nums">{agent.salesCount}</div>
                    </div>
                    <div className="w-24 text-center">
                      <div className="font-bold text-lg text-emerald-600 tabular-nums">£{agent.revenue.toLocaleString()}</div>
                    </div>
                    {/* Revenue target progress */}
                    <div className="w-32 text-center">
                      {(() => {
                        const tgt = agent.revenueTarget ?? 35000;
                        const pct = Math.min(100, Math.round((agent.revenue / tgt) * 100));
                        const remaining = Math.max(0, tgt - agent.revenue);
                        const tone = pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500';
                        return (
                          <div>
                            <div className="text-xs font-semibold tabular-nums">
                              £{agent.revenue.toLocaleString()}
                              <span className="text-muted-foreground font-normal"> / £{tgt.toLocaleString()}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted mt-1.5 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} />
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {remaining === 0 ? `Target met · ${pct}%` : `${pct}% · £${remaining.toLocaleString()} to go`}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    {showProjection && (
                      <div className="w-28 text-center" title={`At current pace across ${dayOfMonth} of ${daysInMonth} days`}>
                        {canSeeProjection(agent.id) ? (
                          <>
                            <div className="font-bold text-lg text-emerald-700 tabular-nums">{projectSales(agent.salesCount)}</div>
                            <div className="text-[11px] text-muted-foreground tabular-nums">£{projectRevenue(agent.revenue).toLocaleString()}</div>
                          </>
                        ) : (
                          <div className="text-[11px] text-muted-foreground italic">private</div>
                        )}
                      </div>
                    )}
                    <div className="w-24 text-center">
                      <div className="font-semibold tabular-nums">
                        <span className={agent.conversionRate >= 10 ? 'text-emerald-600' : 'text-foreground'}>{agent.conversionRate.toFixed(1)}%</span>
                        <span className="text-muted-foreground font-normal"> / 10%</span>
                      </div>
                    </div>
                    <div className="w-20 text-center">
                      <div className="font-semibold tabular-nums">£{agent.avgOrderValue.toFixed(0)}</div>
                    </div>
                    <div className="w-24 text-center">
                      <div className={`font-semibold tabular-nums ${agent.avgDiscountPct >= 15 ? 'text-red-600' : agent.avgDiscountPct >= 8 ? 'text-amber-600' : 'text-foreground'}`}>
                        {agent.avgDiscountPct > 0 ? `${agent.avgDiscountPct.toFixed(1)}%` : '—'}
                      </div>
                    </div>
                    {agents.some(a => a.cancelledCount > 0) && (
                      <div className="w-16 text-center">
                        <div className={`font-semibold tabular-nums ${agent.cancelledCount > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {agent.cancelledCount > 0 ? agent.cancelledCount : '—'}
                        </div>
                      </div>
                    )}
                  </div>


                  {/* Mobile stats */}
                  <div className="md:hidden text-right">
                    <div className="font-bold text-emerald-600">£{agent.revenue.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{agent.salesCount} sales{agent.cancelledCount > 0 ? ` · ${agent.cancelledCount} refunds` : ''}</div>
                  </div>

                  {canEditTargets && (
                    <EditTargetButton
                      agentId={agent.id}
                      currentRevenueTarget={agent.revenueTarget ?? 35000}
                      onSaved={onTargetSaved}
                    />
                  )}

                </div>
              );
            });
            })()}
          </div>
          </div>

        )}
      </CardContent>
    </Card>
  );
};

interface EditTargetButtonProps {
  agentId: string;
  currentRevenueTarget: number;
  onSaved?: () => void;
}

const EditTargetButton: React.FC<EditTargetButtonProps> = ({ agentId, currentRevenueTarget, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(currentRevenueTarget?.toString() ?? '35000');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(currentRevenueTarget?.toString() ?? '35000');
  }, [currentRevenueTarget, open]);

  const handleSave = async () => {
    const target = parseFloat(value);
    if (isNaN(target) || target < 0) {
      toast.error('Enter a valid revenue target');
      return;
    }

    setSaving(true);
    try {
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());
      const nowIso = new Date().toISOString();

      const { data: existing } = await supabase
        .from('sales_targets')
        .select('id')
        .eq('admin_user_id', agentId)
        .eq('target_period', 'monthly')
        .lte('start_date', nowIso)
        .gte('end_date', nowIso)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('sales_targets')
          .update({ revenue_target: target, target_amount: target, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sales_targets')
          .insert({
            admin_user_id: agentId,
            revenue_target: target,
            target_amount: target,
            target_period: 'monthly',
            start_date: monthStart.toISOString(),
            end_date: monthEnd.toISOString(),
          });
        if (error) throw error;
      }
      toast.success('Revenue target saved');
      setOpen(false);
      onSaved?.();
    } catch (e: any) {
      console.error('Save revenue target error', e);
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 gap-1"
          title="Edit monthly revenue target"
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">Edit</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold">Monthly revenue target</div>
            <div className="text-xs text-muted-foreground">Target amount (£) for this month. Default £35,000.</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">£</span>
            <Input
              type="number"
              min={0}
              step={500}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="35000"
              autoFocus
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full" size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Save</>}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
