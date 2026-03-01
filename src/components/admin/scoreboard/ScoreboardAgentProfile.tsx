import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Trophy, TrendingUp, Target, Flame, Star, BarChart3, Calendar, PoundSterling, XCircle, Car, ChevronDown, ChevronUp } from 'lucide-react';
import { AgentScore, TimePeriod } from '@/hooks/useScoreboardData';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format, startOfMonth, endOfMonth } from 'date-fns';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

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

interface CustomerDeal {
  id: string;
  name: string;
  registration_plate: string | null;
  final_amount: number;
  created_at: string;
  status: string;
}

export const ScoreboardAgentProfile: React.FC<Props> = ({ agent, period }) => {
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [customerDeals, setCustomerDeals] = useState<CustomerDeal[]>([]);
  const [regPlatesOpen, setRegPlatesOpen] = useState(false);

  useEffect(() => {
    if (!agent) return;

    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    const fetchDailyTrend = async () => {
      const startDate = subDays(new Date(), 13);
      const { data: customers } = await supabase
        .from('customers')
        .select('created_at, final_amount')
        .eq('is_deleted', false)
        .ilike('status', 'active')
        .eq('assigned_to', agent.id)
        .gte('created_at', startDate.toISOString());

      const dayMap = new Map<string, { count: number; revenue: number }>();
      for (let i = 0; i < 14; i++) {
        const d = subDays(new Date(), 13 - i);
        const key = format(d, 'yyyy-MM-dd');
        dayMap.set(key, { count: 0, revenue: 0 });
      }

      (customers || []).forEach(c => {
        const key = format(new Date(c.created_at), 'yyyy-MM-dd');
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

    // Fetch customer deals for this month (reg plates + details)
    const fetchCustomerDeals = async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, registration_plate, final_amount, created_at, status')
        .eq('is_deleted', false)
        .ilike('status', 'active')
        .eq('assigned_to', agent.id)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .order('created_at', { ascending: false });

      setCustomerDeals((data || []) as CustomerDeal[]);
    };


    fetchDailyTrend();
    fetchCustomerDeals();
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

  const monthlyTarget = agent.monthlyTarget || 0;
  const targetProgress = monthlyTarget > 0 ? Math.min((agent.salesCount / monthlyTarget) * 100, 100) : 0;
  const remaining = monthlyTarget > 0 ? Math.max(monthlyTarget - agent.salesCount, 0) : 0;

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

      {/* Stats Grid — 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Sales', value: agent.salesCount, icon: <Target className="h-4 w-4" />, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Revenue', value: `£${agent.revenue.toLocaleString()}`, icon: <PoundSterling className="h-4 w-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Avg Sale', value: `£${agent.avgOrderValue.toFixed(0)}`, icon: <BarChart3 className="h-4 w-4" />, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
          { label: 'Conversion', value: `${agent.conversionRate.toFixed(1)}%`, icon: <TrendingUp className="h-4 w-4" />, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
          { label: 'AOV', value: `£${agent.avgOrderValue.toFixed(0)}`, icon: <Star className="h-4 w-4" />, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Refunds', value: agent?.cancelledCount ?? 0, icon: <XCircle className="h-4 w-4" />, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
        ].map(s => (
          <Card key={s.label} className={`border ${s.bg}`}>
            <CardContent className="p-3 text-center">
              <div className={`flex items-center justify-center gap-1 mb-1 ${s.color}`}>{s.icon}<span className="text-xs">{s.label}</span></div>
              <div className="text-lg font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cancelled / Refunded Summary */}
      {(agent?.cancelledCount ?? 0) > 0 && (
        <Card className="border border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-700">
                  {agent.cancelledCount} refunded/cancelled {agent.cancelledCount === 1 ? 'warranty' : 'warranties'} (no commission paid)
                </p>
                <p className="text-xs text-red-500">Lost revenue: £{(agent.cancelledRevenue ?? 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Target Progress */}
      {period === 'month' && monthlyTarget > 0 && (
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                Monthly target
              </span>
              <span className="text-sm font-bold">{agent.salesCount} / {monthlyTarget}</span>
            </div>
            <Progress value={targetProgress} className="h-3" />
            <div className="mt-2 text-xs text-muted-foreground">
              {targetProgress >= 100 ? (
                <Badge className="bg-green-500 text-white">🎯 Target smashed!</Badge>
              ) : (
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-orange-500" />
                  {remaining} more to go — you've got this!
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {period === 'month' && monthlyTarget === 0 && (
        <Card className="border border-dashed">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            <Target className="h-5 w-5 mx-auto mb-1 opacity-40" />
            No monthly target set yet — ask your manager to set one
          </CardContent>
        </Card>
      )}

      {/* Customer Reg Plates — Collapsible */}
      <Collapsible open={regPlatesOpen} onOpenChange={setRegPlatesOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  My Customers &amp; Reg Plates ({customerDeals.length})
                </span>
                {regPlatesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {customerDeals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No deals this month yet.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y">
                  {customerDeals.map(deal => (
                    <div key={deal.id} className="flex items-center justify-between py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{deal.name}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(deal.created_at), 'dd MMM yyyy')}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {deal.registration_plate && (
                          <Badge variant="outline" className="font-mono text-xs bg-yellow-50 border-yellow-300 text-yellow-800">
                            {deal.registration_plate}
                          </Badge>
                        )}
                        <span className="font-semibold text-emerald-600">£{(deal.final_amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Sales Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Last 14 days sales
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
