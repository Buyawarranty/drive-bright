import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy, PoundSterling, Target, TrendingUp, Flame, CheckCircle2, Clock, Rocket, Zap, Star, Inbox } from 'lucide-react';
import { AgentScore, TimePeriod } from '@/hooks/useScoreboardData';

interface Milestone {
  threshold: number;
  label: string;
  icon: React.ReactNode;
  tone: string;
}

const MILESTONES: Milestone[] = [
  { threshold: 100, label: 'Target smashed!', icon: <Trophy className="h-4 w-4" />, tone: 'text-green-600' },
  { threshold: 90,  label: 'Almost there — final push!', icon: <Star className="h-4 w-4 fill-current" />, tone: 'text-amber-600' },
  { threshold: 75,  label: 'On the home stretch', icon: <Zap className="h-4 w-4" />, tone: 'text-orange-600' },
  { threshold: 50,  label: 'Halfway hero', icon: <Flame className="h-4 w-4" />, tone: 'text-rose-600' },
  { threshold: 25,  label: 'Quarter way there', icon: <Rocket className="h-4 w-4" />, tone: 'text-sky-600' },
  { threshold: 0,   label: "Let's get started", icon: <Rocket className="h-4 w-4" />, tone: 'text-slate-600' },
];

const getMilestone = (pct: number): Milestone =>
  MILESTONES.find(m => pct >= m.threshold) || MILESTONES[MILESTONES.length - 1];

interface Props {
  agents: AgentScore[];
  period: TimePeriod;
  currentAdminUserId: string | null;
}

export const ScoreboardKPICards: React.FC<Props> = ({ agents, period, currentAdminUserId }) => {
  const totalRevenue = agents.reduce((s, a) => s + a.revenue, 0);
  const topAgent = agents[0];
  const myAgent = agents.find(a => a.id === currentAdminUserId);

  // My monthly revenue target (management-set, default £35,000) — own target only.
  const myRevenueTarget = myAgent?.revenueTarget || null;
  const myRevenue = myAgent?.revenue || 0;
  const myRevProgress = myRevenueTarget ? Math.min((myRevenue / myRevenueTarget) * 100, 100) : null;
  const myRevRemaining = myRevenueTarget ? Math.max(myRevenueTarget - myRevenue, 0) : null;
  const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

  // My conversion rate: leads converted / leads assigned
  const myConversionRate = myAgent
    ? (myAgent.leadsAssigned > 0 ? (myAgent.leadsConverted / myAgent.leadsAssigned) * 100 : 0)
    : 0;

  return (
    <div className="space-y-3">
      {/* Own monthly revenue target (month view only, never other agents') */}
      {period === 'month' && myAgent && myRevenueTarget && (
        <Card className="border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100/60">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-emerald-500/10">
                  <PoundSterling className="h-6 w-6 text-emerald-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Your monthly revenue target</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{gbp(myRevenue)}</span>
                    <span className="text-muted-foreground text-lg">/</span>
                    <span className="text-2xl font-bold text-muted-foreground">{gbp(myRevenueTarget)}</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 max-w-md">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold flex items-center gap-1.5 ${getMilestone(myRevProgress!).tone}`}>
                    {getMilestone(myRevProgress!).icon}
                    {getMilestone(myRevProgress!).label}
                    {myRevProgress! < 100 && (
                      <span className="text-muted-foreground font-normal">· {gbp(myRevRemaining!)} to go</span>
                    )}
                  </span>
                  <span className="text-xs font-bold">{myRevProgress!.toFixed(0)}%</span>
                </div>
                <Progress value={myRevProgress!} className="h-3" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}


      {/* KPI Cards — focused on what matters */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* 0. Leads Taken from New Leads */}
        <Card className="border bg-indigo-50 border-indigo-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-indigo-600">
              <Inbox className="h-5 w-5" />
              <span className="text-xs font-medium truncate">Leads Taken</span>
            </div>
            <div className="text-xl font-bold">{myAgent?.leadsAssigned ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">from New Leads</div>
          </CardContent>
        </Card>

        {/* 1. Revenue Target */}
        <Card className="border bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-blue-600">
              <Target className="h-5 w-5" />
              <span className="text-xs font-medium truncate">My Target</span>
            </div>
            <div className="text-xl font-bold">{myRevenueTarget ? gbp(myRevenueTarget) : '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">revenue goal</div>
          </CardContent>
        </Card>

        {/* 2. Revenue Earned (Progress) */}
        <Card className="border bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-xs font-medium truncate">My Revenue</span>
            </div>
            <div className="text-xl font-bold">{gbp(myRevenue)}</div>
            <div className="text-xs text-muted-foreground mt-1">{myAgent?.salesCount ?? 0} sales closed</div>
          </CardContent>
        </Card>

        {/* 3. Remaining (Gap to target) */}
        <Card className="border bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-orange-600">
              <Clock className="h-5 w-5" />
              <span className="text-xs font-medium truncate">Remaining</span>
            </div>
            <div className="text-xl font-bold">{myRevRemaining !== null ? gbp(myRevRemaining) : '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {myRevRemaining !== null && myRevRemaining === 0 ? '🎉 Target hit!' : 'to hit revenue target'}
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
