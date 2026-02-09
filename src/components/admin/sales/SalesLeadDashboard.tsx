import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useLeads } from '@/hooks/useLeads';
import { CustomersTab } from '@/components/admin/CustomersTab';
import { AgentOverviewPanel } from './AgentOverviewPanel';
import { SetTargetsPanel } from './SetTargetsPanel';
import { 
  LayoutDashboard, Users, ShoppingBag, Target, 
  TrendingUp, UserCheck, AlertTriangle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

interface SalesLeadDashboardProps {
  onNavigateToTab?: (tab: string, leadData?: any) => void;
}

export const SalesLeadDashboard: React.FC<SalesLeadDashboardProps> = ({
  onNavigateToTab,
}) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const {
    leads,
    tags,
    salesUsers,
    loading,
  } = useLeads();

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id, email')
          .eq('user_id', user.id)
          .maybeSingle();
        if (adminUser) {
          setCurrentUserId(adminUser.id);
        }
      }
    };
    getCurrentUser();
  }, []);

  // KPI calculations
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const totalLeads = leads.length;
    const unassignedLeads = leads.filter(l => !l.assigned_to).length;
    const paidLeads = leads.filter(l => l.is_paid === true);
    const monthlyPaid = paidLeads.filter(l => 
      isWithinInterval(new Date(l.updated_at), { start: monthStart, end: monthEnd })
    );
    const totalRevenue = paidLeads.reduce((sum, l) => 
      sum + (l.payment_amount || l.cart_value || l.quote_amount || 0), 0
    );
    const conversionRate = totalLeads > 0 ? ((paidLeads.length / totalLeads) * 100).toFixed(1) : '0';

    return { totalLeads, unassignedLeads, paidLeads: paidLeads.length, monthlyPaid: monthlyPaid.length, totalRevenue, conversionRate };
  }, [leads]);

  // Active agents count
  const activeAgentCount = useMemo(() => {
    return salesUsers?.filter(u => u.role !== 'admin').length || 0;
  }, [salesUsers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Sales Lead Dashboard</h1>
        <p className="text-muted-foreground">Manage your team, assign leads, and track performance</p>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.totalLeads}</p>
            <p className="text-xs text-muted-foreground">Total Leads</p>
          </CardContent>
        </Card>
        <Card className={stats.unassignedLeads > 0 ? 'border-orange-300 bg-orange-50/30' : ''}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.unassignedLeads}</p>
            <p className="text-xs text-muted-foreground">Unassigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.paidLeads}</p>
            <p className="text-xs text-muted-foreground">Total Sales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.monthlyPaid}</p>
            <p className="text-xs text-muted-foreground">This Month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">£{stats.totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.conversionRate}%</p>
            <p className="text-xs text-muted-foreground">Conversion</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Agent Overview</span>
          </TabsTrigger>
          <TabsTrigger value="targets" className="gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Set Targets</span>
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">All Customers</span>
          </TabsTrigger>
          <TabsTrigger value="kpis" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Team KPIs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AgentOverviewPanel leads={leads} salesUsers={salesUsers || []} />
        </TabsContent>

        <TabsContent value="targets">
          <SetTargetsPanel salesUsers={salesUsers || []} currentUserId={currentUserId} />
        </TabsContent>

        <TabsContent value="customers">
          <CustomersTab />
        </TabsContent>

        <TabsContent value="kpis">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Sales by Agent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(salesUsers || [])
                    .filter(u => u.role !== 'admin')
                    .map(agent => {
                      const agentLeads = leads.filter(l => l.assigned_to === agent.id);
                      const agentSales = agentLeads.filter(l => l.is_paid === true).length;
                      const agentConversion = agentLeads.length > 0 
                        ? ((agentSales / agentLeads.length) * 100).toFixed(0) 
                        : '0';
                      return (
                        <div key={agent.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{agent.first_name} {agent.last_name}</p>
                            <p className="text-xs text-muted-foreground">{agentLeads.length} leads assigned</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">{agentSales} sales</p>
                            <p className="text-xs text-muted-foreground">{agentConversion}% rate</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Team Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm">Active Agents</span>
                  <span className="font-bold">{activeAgentCount}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm">Avg. Leads per Agent</span>
                  <span className="font-bold">
                    {activeAgentCount > 0 ? Math.round(stats.totalLeads / activeAgentCount) : 0}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm">Team Conversion Rate</span>
                  <span className="font-bold">{stats.conversionRate}%</span>
                </div>
                <div className="flex justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <span className="text-sm">Total Revenue</span>
                  <span className="font-bold text-green-600">£{stats.totalRevenue.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
