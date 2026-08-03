import React, { useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trophy, User, BarChart3, ChevronLeft, ChevronRight, GitCompare, Zap, Target } from 'lucide-react';
import { SpeedToDialPanel } from './SpeedToDialPanel';
import { TeamTargetBoard } from './TeamTargetBoard';
import { useScoreboardData, TimePeriod } from '@/hooks/useScoreboardData';
import { ScoreboardRankingTable } from './ScoreboardRankingTable';
import { ScoreboardAgentProfile } from './ScoreboardAgentProfile';
import { ScoreboardTargetManager } from './ScoreboardTargetManager';
import { ScoreboardMonthCompare } from './ScoreboardMonthCompare';
import { ReassignSaleButton } from './ReassignSaleButton';


import { DateRangeFilter } from '../DateRangeFilter';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, addMonths, subMonths, format, isSameMonth } from 'date-fns';

const QUICK_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: '14days', label: 'Last 14 days' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];


export const SalesScoreboardTab: React.FC = () => {
  const { agents, loading, period, setPeriod, dateRange, setDateRange, refresh, currentAdminUserId, currentUserRole } = useScoreboardData();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [myDeals, setMyDeals] = useState<{ name: string; registration_plate: string | null; final_amount: number; created_at: string }[]>([]);
  const [openSections, setOpenSections] = useState<string[]>(['scoreboard']);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  useEffect(() => { if (!loading) setHasLoadedOnce(true); }, [loading]);

  // Teams (Team Red, Team Blue, …) — readable by every authenticated admin
  const [teams, setTeams] = useState<{ id: string; name: string; color: string; emoji: string | null; sort_order: number }[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ team_id: string; admin_user_id: string }[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | 'all'>('all');
  const FOCUS_KEY = 'scoreboard.focusOnlyMe';
  const [focusOnlyMe, setFocusOnlyMe] = useState<boolean>(() => {
    try { return localStorage.getItem(FOCUS_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(FOCUS_KEY, focusOnlyMe ? '1' : '0'); } catch {}
  }, [focusOnlyMe]);


  useEffect(() => {
    const loadTeams = async () => {
      const [{ data: t }, { data: m }] = await Promise.all([
        supabase.from('lead_teams').select('id, name, color, emoji, sort_order, is_active').eq('is_active', true).order('sort_order'),
        supabase.from('lead_team_members').select('team_id, admin_user_id'),
      ]);
      setTeams((t || []) as any);
      setTeamMembers((m || []) as any);
    };
    loadTeams();
  }, []);

  // Scoreboard visibility: management can see all team scoreboards.
  // Sales agents are locked to their own team.
  const isManagement =
    currentUserRole === 'admin' ||
    currentUserRole === 'super_admin' ||
    currentUserRole === 'sales_manager';

  // Default selection to the current user's team (if any) on first load.
  const didDefaultTeamRef = React.useRef(false);
  useEffect(() => {
    if (didDefaultTeamRef.current) return;
    if (!currentAdminUserId || teamMembers.length === 0) return;
    const mine = teamMembers.find(m => m.admin_user_id === currentAdminUserId);
    if (mine) setSelectedTeamId(mine.team_id);
    didDefaultTeamRef.current = true;
  }, [currentAdminUserId, teamMembers]);

  // Non-management users are LOCKED to their own team — enforce on every render
  const myTeamId = React.useMemo(
    () => teamMembers.find(m => m.admin_user_id === currentAdminUserId)?.team_id ?? null,
    [teamMembers, currentAdminUserId]
  );
  useEffect(() => {
    if (!isManagement && myTeamId && selectedTeamId !== myTeamId) {
      setSelectedTeamId(myTeamId);
    }
  }, [isManagement, myTeamId, selectedTeamId]);

  const visibleAgents = React.useMemo(() => {
    // Sales agents (non-management) are LOCKED to their own team only
    if (!isManagement) {
      const memberIds = new Set(
        teamMembers.filter(m => m.team_id === myTeamId).map(m => m.admin_user_id)
      );
      const mine = myTeamId
        ? agents.filter(a => memberIds.has(a.id))
        : agents.filter(a => a.id === currentAdminUserId);
      return mine
        .slice()
        .sort((a, b) => b.revenue - a.revenue || b.salesCount - a.salesCount)
        .map((a, i) => ({ ...a, rank: i + 1 }));
    }
    // Management "Only me" toggle
    if (focusOnlyMe && currentAdminUserId) {
      return agents
        .filter(a => a.id === currentAdminUserId)
        .map((a, i) => ({ ...a, rank: i + 1 }));
    }
    if (selectedTeamId === 'all') return agents;
    const memberIds = new Set(teamMembers.filter(m => m.team_id === selectedTeamId).map(m => m.admin_user_id));
    const filtered = agents.filter(a => memberIds.has(a.id));
    return filtered
      .slice()
      .sort((a, b) => b.salesCount - a.salesCount || b.revenue - a.revenue)
      .map((a, i) => ({ ...a, rank: i + 1 }));
  }, [agents, teamMembers, selectedTeamId, isManagement, currentAdminUserId, focusOnlyMe, myTeamId]);



  const selectedAgent = selectedAgentId
    ? visibleAgents.find(a => a.id === selectedAgentId) || null
    : visibleAgents.find(a => a.id === currentAdminUserId) || visibleAgents[0] || null;

  // "Set targets" is management-only (admin, super_admin, sales_manager).
  const canManageTargets = isManagement;


  // Fetch current user's deals for commission form
  useEffect(() => {
    const myAgent = agents.find(a => a.id === currentAdminUserId);
    if (!myAgent) return;
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    
    const fetchDeals = async () => {
      const { data } = await supabase
        .from('customers')
        .select('name, registration_plate, final_amount, created_at')
        .eq('is_deleted', false)
        .ilike('status', 'active')
        .eq('assigned_to', myAgent.id)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .order('created_at', { ascending: false });
      setMyDeals((data || []) as any);
    };
    fetchDeals();
  }, [agents, currentAdminUserId]);

  if (loading && !hasLoadedOnce) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2.5 tracking-tight">
            <Trophy className="h-7 w-7 text-yellow-500" />
            Sales scoreboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {dateRange?.from ? format(startOfMonth(dateRange.from), 'MMMM yyyy') : format(new Date(), 'MMMM yyyy')} · performance, targets and rankings
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isManagement && <ReassignSaleButton />}
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Toolbar: period, month navigator, date range, team filter */}
      <div className="rounded-xl border bg-card/60 p-3 md:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Period segmented control */}
          <div className="inline-flex rounded-lg border bg-background p-0.5">
            {QUICK_PERIODS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  period === p.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Month-by-month navigator */}
          <div className="inline-flex items-center rounded-lg border bg-background overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-none"
              aria-label="Previous month"
              onClick={() => {
                const base = dateRange?.from ? startOfMonth(dateRange.from) : startOfMonth(new Date());
                const prev = subMonths(base, 1);
                setDateRange({ from: startOfMonth(prev), to: endOfMonth(prev) });
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[130px] text-center px-2 text-xs font-semibold">
              {dateRange?.from
                ? format(startOfMonth(dateRange.from), 'MMMM yyyy')
                : format(new Date(), 'MMMM yyyy')}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-none"
              aria-label="Next month"
              onClick={() => {
                const base = dateRange?.from ? startOfMonth(dateRange.from) : startOfMonth(new Date());
                const next = addMonths(base, 1);
                setDateRange({ from: startOfMonth(next), to: endOfMonth(next) });
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {dateRange?.from && !isSameMonth(dateRange.from, new Date()) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                const now = new Date();
                setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
              }}
            >
              Jump to this month
            </Button>
          )}

          <div className="ml-auto">
            <DateRangeFilter
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          </div>
        </div>

        {/* Team filter — management sees teams + an "Only me" focus toggle; agents see their own team as a locked label */}
        {teams.length > 0 && isManagement && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">Team</span>
            <Button
              variant={focusOnlyMe ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setFocusOnlyMe(v => !v)}
              title="Hide other agents and teams — show only your own scoreboard row"
            >
              {focusOnlyMe ? 'Only me · on' : 'Only me'}
            </Button>
            <Button
              variant={!focusOnlyMe && selectedTeamId === 'all' ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              disabled={focusOnlyMe}
              onClick={() => setSelectedTeamId('all')}
            >
              All teams
            </Button>
            {teams.map(t => {
              const active = !focusOnlyMe && selectedTeamId === t.id;
              return (
                <Button
                  key={t.id}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  disabled={focusOnlyMe}
                  onClick={() => setSelectedTeamId(t.id)}
                  style={
                    active
                      ? { backgroundColor: t.color, borderColor: t.color, color: '#fff' }
                      : { borderColor: `${t.color}66` }
                  }
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: active ? '#fff' : t.color }}
                  />
                  {t.name}
                </Button>
              );
            })}
          </div>
        )}

        {teams.length > 0 && !isManagement && myTeamId && (() => {
          const myTeam = teams.find(t => t.id === myTeamId);
          if (!myTeam) return null;
          return (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">Your team</span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border"
                style={{ backgroundColor: myTeam.color, borderColor: myTeam.color, color: '#fff' }}
              >
                <span className="h-2 w-2 rounded-full bg-white/90" />
                {myTeam.name}
              </span>
            </div>
          );
        })()}
      </div>


      {/* Everything on one page — expand/collapse sections */}
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-3"
      >
        <AccordionItem value="scoreboard" className="border rounded-xl bg-card/60 px-4">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-500" /> Scoreboard</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <TeamTargetBoard monthDate={dateRange?.from ?? new Date()} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="leaderboard" className="border rounded-xl bg-card/60 px-4">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Leaderboard</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <ScoreboardRankingTable
              agents={visibleAgents}
              currentAdminUserId={currentAdminUserId}
              period={period}
              currentUserRole={currentUserRole}
              onTargetSaved={refresh}
              teams={teams}
              teamMembers={teamMembers}
              groupByTeam={isManagement && !focusOnlyMe && selectedTeamId === 'all'}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="profile" className="border rounded-xl bg-card/60 px-4">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2"><User className="h-4 w-4" /> My stats</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            {visibleAgents.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {visibleAgents.map(a => (
                  <Button
                    key={a.id}
                    variant={selectedAgent?.id === a.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedAgentId(a.id)}
                  >
                    {a.rank <= 3 && '🏅 '}
                    {a.name}
                  </Button>
                ))}
              </div>
            )}
            <ScoreboardAgentProfile agent={selectedAgent} period={period} currentUserRole={currentUserRole} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="compare" className="border rounded-xl bg-card/60 px-4">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2"><GitCompare className="h-4 w-4" /> Compare months</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <ScoreboardMonthCompare
              allowedAgentIds={
                isManagement && !focusOnlyMe && selectedTeamId === 'all'
                  ? null
                  : visibleAgents.map(a => a.id)
              }
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="speed" className="border rounded-xl bg-card/60 px-4">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2"><Zap className="h-4 w-4" /> Speed to dial</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <SpeedToDialPanel />
          </AccordionContent>
        </AccordionItem>

        {canManageTargets && (
          <AccordionItem value="targets" className="border rounded-xl bg-card/60 px-4">
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Target className="h-4 w-4" /> Set targets</span>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <ScoreboardTargetManager agents={agents} onTargetSaved={refresh} />
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
};


export default SalesScoreboardTab;
