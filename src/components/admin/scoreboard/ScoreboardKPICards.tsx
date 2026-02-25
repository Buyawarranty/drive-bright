import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, DollarSign, Target, TrendingUp, Users, Zap } from 'lucide-react';
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

  const kpis = [
    {
      label: `Total Sales (${PERIOD_LABELS[period]})`,
      value: totalSales.toString(),
      icon: <Target className="h-5 w-5" />,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200',
    },
    {
      label: `Team Revenue`,
      value: `£${totalRevenue.toLocaleString()}`,
      icon: <DollarSign className="h-5 w-5" />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
    },
    {
      label: 'Top Performer',
      value: topAgent?.name || '—',
      sub: topAgent ? `£${topAgent.revenue.toLocaleString()} · ${topAgent.salesCount} sales` : '',
      icon: <Trophy className="h-5 w-5" />,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50 border-yellow-200',
    },
    {
      label: 'My Rank',
      value: myAgent ? `#${myAgent.rank}` : '—',
      sub: myAgent ? `${myAgent.salesCount} sales · £${myAgent.revenue.toLocaleString()}` : '',
      icon: <Zap className="h-5 w-5" />,
      color: 'text-purple-600',
      bg: 'bg-purple-50 border-purple-200',
    },
    {
      label: 'Active Agents',
      value: agents.filter(a => a.salesCount > 0).length.toString(),
      sub: `of ${agents.length} total`,
      icon: <Users className="h-5 w-5" />,
      color: 'text-orange-600',
      bg: 'bg-orange-50 border-orange-200',
    },
    {
      label: 'Avg Conversion',
      value: `${avgConversion.toFixed(1)}%`,
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'text-teal-600',
      bg: 'bg-teal-50 border-teal-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className={`border ${kpi.bg}`}>
          <CardContent className="p-4">
            <div className={`flex items-center gap-2 mb-2 ${kpi.color}`}>
              {kpi.icon}
              <span className="text-xs font-medium truncate">{kpi.label}</span>
            </div>
            <div className="text-xl font-bold truncate">{kpi.value}</div>
            {kpi.sub && <div className="text-xs text-muted-foreground mt-1 truncate">{kpi.sub}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
