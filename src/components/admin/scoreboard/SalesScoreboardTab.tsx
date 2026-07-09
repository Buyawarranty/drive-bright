import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trophy, User, Award, BarChart3, FileText, ChevronLeft, ChevronRight, GitCompare } from 'lucide-react';
import { useScoreboardData, TimePeriod } from '@/hooks/useScoreboardData';
import { ScoreboardKPICards } from './ScoreboardKPICards';
import { ScoreboardRankingTable } from './ScoreboardRankingTable';
// pass currentUserRole through
import { ScoreboardAwards } from './ScoreboardAwards';
import { ScoreboardAgentProfile } from './ScoreboardAgentProfile';
import { ScoreboardTargetManager } from './ScoreboardTargetManager';
import { CommissionTimesheetForm } from './CommissionTimesheetForm';
import { ScoreboardMonthCompare } from './ScoreboardMonthCompare';

import { DateRangeFilter } from '../DateRangeFilter';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, addMonths, subMonths, format, isSameMonth } from 'date-fns';

const QUICK_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: 'today', label: '📅 Today' },
  { value: 'week', label: '📆 This Week' },
  { value: 'month', label: '🗓️ This Month' },
  { value: 'all', label: '🏛️ All Time' },
];

export const SalesScoreboardTab: React.FC = () => {
  const { agents, loading, period, setPeriod, dateRange, setDateRange, refresh, currentAdminUserId, currentUserRole } = useScoreboardData();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [myDeals, setMyDeals] = useState<{ name: string; registration_plate: string | null; final_amount: number; created_at: string }[]>([]);
  const [activeTab, setActiveTab] = useState<string>('leaderboard');
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  useEffect(() => { if (!loading) setHasLoadedOnce(true); }, [loading]);

  // Teams (Team Red, Team Blue, …) — readable by every authenticated admin
  const [teams, setTeams] = useState<{ id: string; name: string; color: string; emoji: string | null; sort_order: number }[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ team_id: string; admin_user_id: string }[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | 'all'>('all');

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

  // Scoreboard visibility: managers + sales_lead can see all team scoreboards.
  // Sales agents are locked to their own team.
  const isManagement =
    currentUserRole === 'admin' ||
    currentUserRole === 'super_admin' ||
    currentUserRole === 'sales_manager' ||
    currentUserRole === 'performance_manager' ||
    currentUserRole === 'sales_lead';

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
    if (!isManagement && !myTeamId) {
      // Non-management with no team: only show themselves
      return agents.filter(a => a.id === currentAdminUserId);
    }
    const effectiveTeamId = isManagement ? selectedTeamId : (myTeamId ?? 'all');
    if (effectiveTeamId === 'all') return agents;
    const memberIds = new Set(teamMembers.filter(m => m.team_id === effectiveTeamId).map(m => m.admin_user_id));
    const filtered = agents.filter(a => memberIds.has(a.id));
    return filtered
      .slice()
      .sort((a, b) => b.revenue - a.revenue || b.salesCount - a.salesCount)
      .map((a, i) => ({ ...a, rank: i + 1 }));
  }, [agents, teamMembers, selectedTeamId, isManagement, myTeamId, currentAdminUserId]);

  const selectedAgent = selectedAgentId
    ? visibleAgents.find(a => a.id === selectedAgentId) || null
    : visibleAgents.find(a => a.id === currentAdminUserId) || visibleAgents[0] || null;

  const canManageTargets = currentUserRole === 'admin' || currentUserRole === 'super_admin' || currentUserRole === 'sales_lead';

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Sales Scoreboard
          </h1>
          <p className="text-muted-foreground mt-1">Track performance, compete, and celebrate wins 🎉</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Period Buttons + Month Navigator + Date Range Filter */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {QUICK_PERIODS.map(p => (
            <Button
              key={p.value}
              variant={period === p.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p.value)}
              className={period === p.value ? 'shadow-md' : ''}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {/* Month-by-month navigator */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => {
              const base = dateRange?.from ? startOfMonth(dateRange.from) : startOfMonth(new Date());
              const prev = subMonths(base, 1);
              setDateRange({ from: startOfMonth(prev), to: endOfMonth(prev) });
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center px-4 py-2 rounded-md border bg-card text-sm font-semibold">
            {dateRange?.from
              ? format(startOfMonth(dateRange.from), 'MMMM yyyy')
              : format(new Date(), 'MMMM yyyy')}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => {
              const base = dateRange?.from ? startOfMonth(dateRange.from) : startOfMonth(new Date());
              const next = addMonths(base, 1);
              setDateRange({ from: startOfMonth(next), to: endOfMonth(next) });
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {dateRange?.from && !isSameMonth(dateRange.from, new Date()) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const now = new Date();
                setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
              }}
            >
              Jump to this month
            </Button>
          )}
        </div>

        <DateRangeFilter
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* Team Filter — management sees all teams; sales agents see only their own team as a locked label */}
      {teams.length > 0 && isManagement && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Team:</span>
          <Button
            variant={selectedTeamId === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTeamId('all')}
          >
            🌐 All teams
          </Button>
          {teams.map(t => {
            const active = selectedTeamId === t.id;
            return (
              <Button
                key={t.id}
                variant={active ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTeamId(t.id)}
                style={
                  active
                    ? { backgroundColor: t.color, borderColor: t.color, color: '#fff' }
                    : { borderColor: t.color, color: t.color }
                }
              >
                {t.emoji ? `${t.emoji} ` : ''}{t.name}
              </Button>
            );
          })}
        </div>
      )}

      {teams.length > 0 && !isManagement && myTeamId && (() => {
        const myTeam = teams.find(t => t.id === myTeamId);
        if (!myTeam) return null;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Your team:</span>
            <span
              className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-sm font-semibold border"
              style={{ backgroundColor: myTeam.color, borderColor: myTeam.color, color: '#fff' }}
            >
              {myTeam.emoji ? `${myTeam.emoji} ` : ''}{myTeam.name}
            </span>
          </div>
        );
      })()}

      {/* KPI Cards */}
      <ScoreboardKPICards agents={visibleAgents} period={period} currentAdminUserId={currentAdminUserId} />



      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="leaderboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            My Stats
          </TabsTrigger>
          <TabsTrigger value="awards" className="gap-2">
            <Award className="h-4 w-4" />
            Awards
          </TabsTrigger>
          <TabsTrigger value="compare" className="gap-2">
            <GitCompare className="h-4 w-4" />
            Compare Months
          </TabsTrigger>
          <TabsTrigger value="commission" className="gap-2">
            <FileText className="h-4 w-4" />
            Commission
          </TabsTrigger>
          {canManageTargets && (
            <TabsTrigger value="targets" className="gap-2">
              🎯 Set Targets
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="leaderboard">
          <ScoreboardRankingTable
            agents={visibleAgents}
            currentAdminUserId={currentAdminUserId}
            period={period}
            currentUserRole={currentUserRole}
            onTargetSaved={refresh}
            teams={teams}
            teamMembers={teamMembers}
            groupByTeam={isManagement && selectedTeamId === 'all'}
          />
        </TabsContent>

        <TabsContent value="profile">
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
          <ScoreboardAgentProfile agent={selectedAgent} period={period} />
        </TabsContent>

        <TabsContent value="awards">
          <ScoreboardAwards agents={visibleAgents} currentAdminUserId={currentAdminUserId} />
        </TabsContent>

        <TabsContent value="compare">
          <ScoreboardMonthCompare />
        </TabsContent>

        <TabsContent value="commission">
          <CommissionTimesheetForm
            agent={agents.find(a => a.id === currentAdminUserId) || null}
            customerDeals={myDeals}
          />
        </TabsContent>

        {canManageTargets && (
          <TabsContent value="targets">
            <ScoreboardTargetManager agents={agents} onTargetSaved={refresh} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default SalesScoreboardTab;
