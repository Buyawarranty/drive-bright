import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, TrendingUp, Target, Clock, AlertTriangle,
  Calendar, DollarSign, ShoppingCart, XCircle
} from 'lucide-react';
import { Lead } from '@/hooks/useLeads';
import { 
  format, startOfDay, endOfDay, startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth, isToday, isPast, isWithinInterval 
} from 'date-fns';

interface SalesDashboardKPIsProps {
  leads: Lead[];
  currentUserEmail: string;
  paidDeals: {
    total: number;
    revenue: number;
    cancelled: number;
    monthlyCount?: number;
  };
}

export const SalesDashboardKPIs: React.FC<SalesDashboardKPIsProps> = ({
  leads,
  currentUserEmail,
  paidDeals
}) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // My Leads breakdown
  const leadStats = useMemo(() => {
    const today = leads.filter(l => 
      isWithinInterval(new Date(l.created_at), { start: todayStart, end: todayEnd })
    );
    const thisWeek = leads.filter(l => 
      isWithinInterval(new Date(l.created_at), { start: weekStart, end: weekEnd })
    );
    const thisMonth = leads.filter(l => 
      isWithinInterval(new Date(l.created_at), { start: monthStart, end: monthEnd })
    );

    const newLeads = leads.filter(l => l.status === 'new');
    const contactedLeads = leads.filter(l => l.status === 'contacted');

    return {
      today: today.length,
      thisWeek: thisWeek.length,
      thisMonth: thisMonth.length,
      allTime: leads.length,
      new: newLeads.length,
      contacted: contactedLeads.length
    };
  }, [leads, todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd]);

  // Sales This Month - use real customer data from paidDeals
  const salesStats = useMemo(() => {
    const monthlyTarget = 40;
    const monthlyCount = paidDeals.monthlyCount || 0;
    const progress = Math.min((monthlyCount / monthlyTarget) * 100, 100);

    return {
      count: monthlyCount,
      target: monthlyTarget,
      progress
    };
  }, [paidDeals]);

  // Follow-ups Today
  const followUpStats = useMemo(() => {
    const todayFollowUps = leads.filter(l => 
      l.next_action_date && isToday(new Date(l.next_action_date))
    );
    const overdueFollowUps = leads.filter(l =>
      l.next_action_date && 
      isPast(new Date(l.next_action_date)) && 
      !isToday(new Date(l.next_action_date)) &&
      l.follow_up_status === 'pending'
    );

    return {
      dueToday: todayFollowUps.length,
      overdue: overdueFollowUps.length
    };
  }, [leads]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* 1. My Leads */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Users className="h-5 w-5 text-blue-500" />
            My Leads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-3xl font-bold">{leadStats.allTime}</div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-muted/50 rounded-md p-2">
              <div className="font-semibold text-foreground">{leadStats.today}</div>
              <div className="text-muted-foreground">Today</div>
            </div>
            <div className="bg-muted/50 rounded-md p-2">
              <div className="font-semibold text-foreground">{leadStats.thisWeek}</div>
              <div className="text-muted-foreground">Week</div>
            </div>
            <div className="bg-muted/50 rounded-md p-2">
              <div className="font-semibold text-foreground">{leadStats.thisMonth}</div>
              <div className="text-muted-foreground">Month</div>
            </div>
            <div className="bg-muted/50 rounded-md p-2">
              <div className="font-semibold text-foreground">{leadStats.allTime}</div>
              <div className="text-muted-foreground">All</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              {leadStats.new} New
            </Badge>
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              {leadStats.contacted} Contacted
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 2. Sales This Month */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Target className="h-5 w-5 text-green-500" />
            Sales This Month
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{salesStats.count}</span>
            <span className="text-muted-foreground">/ {salesStats.target} warranties</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly Target</span>
              <span className="font-medium">{salesStats.progress.toFixed(0)}%</span>
            </div>
            <Progress 
              value={salesStats.progress} 
              className="h-2.5" 
            />
          </div>
          {salesStats.progress >= 100 && (
            <Badge className="bg-green-500 text-white">🎯 Target Reached!</Badge>
          )}
          {salesStats.progress >= 175 && (
            <Badge className="bg-purple-500 text-white">📈 High Performer!</Badge>
          )}
        </CardContent>
      </Card>

      {/* 3. Paid Deals */}
      <Card className="border-l-4 border-l-emerald-500">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <ShoppingCart className="h-5 w-5 text-emerald-500" />
            Paid Deals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{paidDeals.total}</span>
            <span className="text-muted-foreground">deals</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span className="font-medium text-emerald-600">£{paidDeals.revenue.toLocaleString()}</span>
            <span className="text-muted-foreground">revenue</span>
          </div>
          {paidDeals.cancelled > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <XCircle className="h-4 w-4" />
              <span>{paidDeals.cancelled} cancelled/refunded</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Follow-ups Today */}
      <Card className={`border-l-4 ${followUpStats.overdue > 0 ? 'border-l-red-500 bg-red-50/30' : followUpStats.dueToday > 0 ? 'border-l-orange-500 bg-orange-50/30' : 'border-l-gray-300'}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Clock className={`h-5 w-5 ${followUpStats.overdue > 0 ? 'text-red-500' : 'text-orange-500'}`} />
            Follow-ups Today
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${followUpStats.dueToday > 0 ? 'text-orange-600' : ''}`}>
              {followUpStats.dueToday}
            </span>
            <span className="text-muted-foreground">due today</span>
          </div>
          {followUpStats.overdue > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-100 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">
                {followUpStats.overdue} overdue!
              </span>
            </div>
          )}
          {followUpStats.dueToday === 0 && followUpStats.overdue === 0 && (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              ✓ All caught up!
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
