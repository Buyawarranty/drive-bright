import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trophy, User, Award, BarChart3 } from 'lucide-react';
import { useScoreboardData, TimePeriod } from '@/hooks/useScoreboardData';
import { ScoreboardKPICards } from './ScoreboardKPICards';
import { ScoreboardRankingTable } from './ScoreboardRankingTable';
import { ScoreboardAwards } from './ScoreboardAwards';
import { ScoreboardAgentProfile } from './ScoreboardAgentProfile';

const PERIODS: { value: TimePeriod; label: string }[] = [
  { value: 'today', label: '📅 Today' },
  { value: 'week', label: '📆 This Week' },
  { value: 'month', label: '🗓️ This Month' },
  { value: 'all', label: '🏛️ All Time' },
];

export const SalesScoreboardTab: React.FC = () => {
  const { agents, loading, period, setPeriod, refresh, currentAdminUserId } = useScoreboardData();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const selectedAgent = selectedAgentId
    ? agents.find(a => a.id === selectedAgentId) || null
    : agents.find(a => a.id === currentAdminUserId) || null;

  if (loading) {
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

      {/* Period Selector */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map(p => (
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

      {/* KPI Cards */}
      <ScoreboardKPICards agents={agents} period={period} currentAdminUserId={currentAdminUserId} />

      {/* Main Content */}
      <Tabs defaultValue="leaderboard" className="space-y-4">
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
        </TabsList>

        <TabsContent value="leaderboard">
          <ScoreboardRankingTable agents={agents} currentAdminUserId={currentAdminUserId} period={period} />
        </TabsContent>

        <TabsContent value="profile">
          {/* Agent selector for admins */}
          {agents.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {agents.map(a => (
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
          <ScoreboardAwards agents={agents} currentAdminUserId={currentAdminUserId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalesScoreboardTab;
