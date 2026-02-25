import React, { useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, TrendingUp, Target, Flame, Star, BarChart3, Calendar } from 'lucide-react';
import { AgentScore, TimePeriod } from '@/hooks/useScoreboardData';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, format } from 'date-fns';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  agent: AgentScore | null;
  period: TimePeriod;
}

interface DailySales {
  date: string;
  label: string;
  count: number;
  revenue: number;
}

export const ScoreboardAgentProfile: React.FC<Props> = ({ agent, period }) => {
  const [dailySales, setDailySales] = useState<DailySales[]>([]);

  useEffect(() => {
    if (!agent) return;
    const fetchDailyTrend = async () => {
      // Last 14 days of sales for this agent
      const startDate = subDays(new Date(), 13);
      const { data: customers } = await supabase
        .from('customers')
        .select('signup_date, final_amount')
        .eq('is_deleted', false)
        .eq('status', 'active')
        .eq('assigned_to', agent.id)
        .gte('signup_date', startDate.toISOString());

      const dayMap = new Map<string, { count: number; revenue: number }>();
      for (let i = 0; i < 14; i++) {
        const d = subDays(new Date(), 13 - i);
        const key = format(d, 'yyyy-MM-dd');
        dayMap.set(key, { count: 0, revenue: 0 });
      }

      (customers || []).forEach(c => {
        const key = format(new Date(c.signup_date), 'yyyy-MM-dd');
        const existing = dayMap.get(key);
        if (existing) {
          existing.count++;
          existing.revenue += c.final_amount || 0;
        }
      });

      const result: DailySales[] = Array.from(dayMap.entries()).map(([date, data]) => ({
        date,
        label: format(new Date(date), 'dd MMM'),
        ...data,
      }));

      setDailySales(result);
    };
    fetchDailyTrend();
  }, [agent]);

  if (!agent) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Select an agent or view your own stats on the leaderboard</p>
        </CardContent>
      </Card>
    );
  }

  const monthlyTarget = 40;
  const targetProgress = Math.min((agent.salesCount / monthlyTarget) * 100, 100);

  const chartConfig = {
    count: { label: 'Sales', color: 'hsl(var(--primary))' },
    revenue: { label: 'Revenue', color: 'hsl(142, 71%, 45%)' },
  };

  return (
    <div className="space-y-4">
      {/* Agent Header */}
      <Card className="border-t-4 border-t-primary">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${agent.rank === 1 ? 'bg-yellow-500 text-white' : agent.rank === 2 ? 'bg-gray-400 text-white' : agent.rank === 3 ? 'bg-orange-600 text-white' : 'bg-primary/10 text-primary'}`}>
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                {agent.name}
                {agent.rank <= 3 && <Trophy className="h-5 w-5 text-yellow-500" />}
              </h3>
              <p className="text-sm text-muted-foreground">{agent.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">Rank #{agent.rank}</Badge>
                <Badge variant="secondary" className="text-xs capitalize">{agent.role.replace('_', ' ')}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Sales', value: agent.salesCount, icon: <Target className="h-4 w-4" />, color: 'text-blue-600' },
          { label: 'Revenue', value: `£${agent.revenue.toLocaleString()}`, icon: <TrendingUp className="h-4 w-4" />, color: 'text-emerald-600' },
          { label: 'Conversion', value: `${agent.conversionRate.toFixed(1)}%`, icon: <BarChart3 className="h-4 w-4" />, color: 'text-purple-600' },
          { label: 'AOV', value: `£${agent.avgOrderValue.toFixed(0)}`, icon: <Star className="h-4 w-4" />, color: 'text-amber-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className={`flex items-center justify-center gap-1 mb-1 ${s.color}`}>{s.icon}<span className="text-xs">{s.label}</span></div>
              <div className="text-lg font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Target Progress */}
      {period === 'month' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                Monthly Target Progress
              </span>
              <span className="text-sm font-bold">{agent.salesCount}/{monthlyTarget}</span>
            </div>
            <Progress value={targetProgress} className="h-3" />
            {targetProgress >= 100 && (
              <Badge className="mt-2 bg-green-500 text-white">🎯 Target Reached!</Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sales Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Last 14 Days Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={dailySales}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};
