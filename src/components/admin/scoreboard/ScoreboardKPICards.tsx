import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy, PoundSterling, Target, TrendingUp, Users, Zap, Flame } from 'lucide-react';
import { AgentScore, TimePeriod } from '@/hooks/useScoreboardData';

interface Props {
  agents: AgentScore[];
  period: TimePeriod;
  currentAdminUserId: string | null;
}

const PERIOD_LABELS: Record<TimePeriod, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
};

export const ScoreboardKPICards: React.FC<Props> = ({ agents, period, currentAdminUserId }) => {
  const totalSales = agents.reduce((s, a) => s + a.salesCount, 0);
  const totalRevenue = agents.reduce((s, a) => s + a.revenue, 0);
  const topAgent = agents[0];
  const myAgent = agents.find(a => a.id === currentAdminUserId);
  const avgConversion = agents.length > 0
    ? agents.reduce((s, a) => s + a.conversionRate, 0) / agents.length
    : 0;

  // My target progress
  const myTarget = myAgent?.monthlyTarget || null;
  const myProgress = myTarget ? Math.min((myAgent!.salesCount / myTarget) * 100, 100) : null;
  const remaining = myTarget ? Math.max(myTarget - (myAgent?.salesCount || 0), 0) : null;

  return (
    <div className="space-y-3">
      {/* Target progress banner for the agent (month view only) */}
      {period === 'month' && myAgent && myTarget && (
        <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Your monthly target</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{myAgent.salesCount}</span>
                    <span className="text-muted-foreground text-lg">/</span>
                    <span className="text-2xl font-bold text-muted-foreground">{myTarget}</span>
                    <span className="text-sm text-muted-foreground">deals</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 max-w-md">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">
                    {myProgress! >= 100 ? (
                      <span className="text-green-600 flex items-center gap-1">🎯 Target smashed!</span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Flame className="h-3 w-3 text-orange-500" />
                        {remaining} more to go
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-bold">{myProgress!.toFixed(0)}%</span>
                </div>
                <Progress value={myProgress!} className="h-3" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card className="border bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-blue-600">
              <Target className="h-5 w-5" />
              <span className="text-xs font-medium truncate">Total Sales ({PERIOD_LABELS[period]})</span>
            </div>
            <div className="text-xl font-bold">{totalSales}</div>
          </CardContent>
        </Card>

        <Card className="border bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-emerald-600">
              <PoundSterling className="h-5 w-5" />
              <span className="text-xs font-medium truncate">Team Revenue</span>
            </div>
            <div className="text-xl font-bold">£{totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-yellow-600">
              <Trophy className="h-5 w-5" />
              <span className="text-xs font-medium truncate">Top Performer</span>
            </div>
            <div className="text-xl font-bold truncate">{topAgent?.name || '—'}</div>
            {topAgent && <div className="text-xs text-muted-foreground mt-1 truncate">£{topAgent.revenue.toLocaleString()} · {topAgent.salesCount} sales</div>}
          </CardContent>
        </Card>

        <Card className="border bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-purple-600">
              <Zap className="h-5 w-5" />
              <span className="text-xs font-medium truncate">My Rank</span>
            </div>
            <div className="text-xl font-bold">{myAgent ? `#${myAgent.rank}` : '—'}</div>
            {myAgent && <div className="text-xs text-muted-foreground mt-1 truncate">{myAgent.salesCount} sales · £{myAgent.revenue.toLocaleString()}</div>}
          </CardContent>
        </Card>

        <Card className="border bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-orange-600">
              <Users className="h-5 w-5" />
              <span className="text-xs font-medium truncate">Active Agents</span>
            </div>
            <div className="text-xl font-bold">{agents.filter(a => a.salesCount > 0).length}</div>
            <div className="text-xs text-muted-foreground mt-1">of {agents.length} total</div>
          </CardContent>
        </Card>

        <Card className="border bg-teal-50 border-teal-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-teal-600">
              <TrendingUp className="h-5 w-5" />
              <span className="text-xs font-medium truncate">Avg Conversion</span>
            </div>
            <div className="text-xl font-bold">{avgConversion.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
