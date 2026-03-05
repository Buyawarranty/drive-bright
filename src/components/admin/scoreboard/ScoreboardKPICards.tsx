import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy, PoundSterling, Target, TrendingUp, Flame, CheckCircle2, Clock } from 'lucide-react';
import { AgentScore, TimePeriod } from '@/hooks/useScoreboardData';

interface Props {
  agents: AgentScore[];
  period: TimePeriod;
  currentAdminUserId: string | null;
}

export const ScoreboardKPICards: React.FC<Props> = ({ agents, period, currentAdminUserId }) => {
  const totalRevenue = agents.reduce((s, a) => s + a.revenue, 0);
  const topAgent = agents[0];
  const myAgent = agents.find(a => a.id === currentAdminUserId);

  // My target progress (based on actual sales/deals closed)
  const myTarget = myAgent?.monthlyTarget || null;
  const mySales = myAgent?.salesCount || 0;
  const myRemaining = myTarget ? Math.max(myTarget - mySales, 0) : null;
  const myProgress = myTarget ? Math.min((mySales / myTarget) * 100, 100) : null;

  // My conversion rate: leads converted / leads assigned
  const myConversionRate = myAgent
    ? (myAgent.leadsAssigned > 0 ? (myAgent.leadsConverted / myAgent.leadsAssigned) * 100 : 0)
    : 0;

  return (
    <div className="space-y-3">
      {/* Target progress banner (month view, when target exists) */}
      {period === 'month' && myAgent && myTarget && (
        <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Your Monthly Sales Target</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{mySales}</span>
                      <span className="text-muted-foreground text-lg">/</span>
                      <span className="text-2xl font-bold text-muted-foreground">{myTarget}</span>
                      <span className="text-sm text-muted-foreground">deals closed</span>
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
                        {myRemaining} more to go
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

      {/* KPI Cards — focused on what matters */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {/* 1. Target (Goal) */}
        <Card className="border bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-blue-600">
              <Target className="h-5 w-5" />
              <span className="text-xs font-medium truncate">My Target</span>
            </div>
            <div className="text-xl font-bold">{myTarget ?? '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">leads to convert</div>
          </CardContent>
        </Card>

        {/* 2. Converted (Progress) */}
        <Card className="border bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-xs font-medium truncate">My Sales</span>
            </div>
            <div className="text-xl font-bold">{mySales}</div>
            <div className="text-xs text-muted-foreground mt-1">deals closed</div>
          </CardContent>
        </Card>

        {/* 3. Remaining (Gap) */}
        <Card className="border bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-orange-600">
              <Clock className="h-5 w-5" />
              <span className="text-xs font-medium truncate">Remaining</span>
            </div>
            <div className="text-xl font-bold">{myRemaining !== null ? myRemaining : '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {myRemaining !== null && myRemaining === 0 ? '🎉 All done!' : 'to hit target'}
            </div>
          </CardContent>
        </Card>

        {/* 4. Team Revenue */}
        <Card className="border bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-yellow-600">
              <PoundSterling className="h-5 w-5" />
              <span className="text-xs font-medium truncate">Team Revenue</span>
            </div>
            <div className="text-xl font-bold">£{totalRevenue.toLocaleString()}</div>
            {topAgent && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
                🏆 {topAgent.name} · £{topAgent.revenue.toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Conversion Rate */}
        <Card className="border bg-teal-50 border-teal-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-teal-600">
              <TrendingUp className="h-5 w-5" />
              <span className="text-xs font-medium truncate">My Conversion</span>
            </div>
            <div className="text-xl font-bold">{myConversionRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              {myAgent ? `${myAgent.leadsConverted} of ${myAgent.leadsAssigned} leads` : '—'}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
