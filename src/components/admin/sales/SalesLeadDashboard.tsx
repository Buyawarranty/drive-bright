import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { CustomersTab } from '@/components/admin/CustomersTab';
import { SetTargetsPanel } from './SetTargetsPanel';
import { NewLeadsTab } from '@/components/admin/leads/NewLeadsTab';
import { LeadVersionHistory } from '@/components/admin/leads/LeadVersionHistory';
import { 
  Users, ShoppingBag, Target, 
  TrendingUp, UserCheck, ClipboardList, History
} from 'lucide-react';
import { LeadDroughtAlert } from './LeadDroughtAlert';

interface SalesLeadDashboardProps {
  onNavigateToTab?: (tab: string, leadData?: any) => void;
}

// Lightweight stats hook - avoids duplicating the heavy useLeads() fetch
const useDashboardStats = () => {
  const [stats, setStats] = useState({
    totalLeads: 0, unassignedLeads: 0, paidLeads: 0,
    monthlyPaid: 0, totalRevenue: 0, conversionRate: '0'
  });
  const [salesUsers, setSalesUsers] = useState<any[]>([]);
  const [agentStats, setAgentStats] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [leadsRes, cartsRes, usersRes, userRes] = await Promise.all([
        fetchAllRows(() => supabase.from('sales_leads').select('id, assigned_to, is_paid, payment_amount, cart_value, quote_amount, updated_at, status')),
        fetchAllRows(() => supabase.from('abandoned_carts').select('id, contacted_by, is_converted').eq('is_converted', false)),
        supabase.from('admin_users').select('id, user_id, first_name, last_name, email, is_active, role').eq('is_active', true).order('first_name'),
        supabase.auth.getUser()
      ]);

      const leads = leadsRes.data || [];
      const carts = cartsRes.data || [];
      const users = usersRes.data || [];

      // Current user
      if (userRes.data?.user) {
        const adminUser = users.find((u: any) => u.user_id === userRes.data.user!.id);
        if (adminUser) {
          setCurrentUserId(adminUser.id);
          setCurrentUserRole(adminUser.role);
        }
      }

      setSalesUsers(users);

      const totalLeads = leads.length + carts.length;
      const unassignedLeads = leads.filter((l: any) => !l.assigned_to).length + carts.filter((c: any) => !c.contacted_by).length;
      const paidLeads = leads.filter((l: any) => l.is_paid === true);
      const monthlyPaid = paidLeads.filter((l: any) => l.updated_at >= monthStart);
      const totalRevenue = paidLeads.reduce((sum: number, l: any) => sum + (l.payment_amount || l.cart_value || l.quote_amount || 0), 0);
      const conversionRate = totalLeads > 0 ? ((paidLeads.length / totalLeads) * 100).toFixed(1) : '0';

      setStats({ totalLeads, unassignedLeads, paidLeads: paidLeads.length, monthlyPaid: monthlyPaid.length, totalRevenue, conversionRate });

      // Agent stats for KPI tab
      const agents = users.filter((u: any) => u.role !== 'admin' && u.role !== 'super_admin');
      const agentData = agents.map((agent: any) => {
        const agentLeads = leads.filter((l: any) => l.assigned_to === agent.id);
        const agentSales = agentLeads.filter((l: any) => l.is_paid === true).length;
        const agentConversion = agentLeads.length > 0 ? ((agentSales / agentLeads.length) * 100).toFixed(0) : '0';
        return { ...agent, leadCount: agentLeads.length, salesCount: agentSales, conversionRate: agentConversion };
      });
      setAgentStats(agentData);
      setLoading(false);
    };

    fetchAll();
  }, []);

  const activeAgentCount = useMemo(() => salesUsers.filter((u: any) => u.role !== 'admin' && u.role !== 'super_admin').length, [salesUsers]);

  return { stats, salesUsers, agentStats, activeAgentCount, currentUserId, currentUserRole, loading };
};

export const SalesLeadDashboard: React.FC<SalesLeadDashboardProps> = ({ onNavigateToTab }) => {
  const [activeTab, setActiveTab] = useState('all-leads');
  const { stats, salesUsers, agentStats, activeAgentCount, currentUserId, currentUserRole, loading } = useDashboardStats();
  const canViewHistory = ['super_admin', 'admin', 'sales_lead'].includes(currentUserRole || '');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LeadDroughtAlert userRole={currentUserRole} />

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
        <TabsList className="flex flex-wrap h-auto gap-1 w-full lg:w-auto p-1">
          <TabsTrigger value="all-leads" className="gap-2 flex-1 lg:flex-none">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">All Leads</span>
          </TabsTrigger>
          <TabsTrigger value="targets" className="gap-2 flex-1 lg:flex-none">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Set Targets</span>
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2 flex-1 lg:flex-none">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">All Customers</span>
          </TabsTrigger>
          <TabsTrigger value="kpis" className="gap-2 flex-1 lg:flex-none">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Team KPIs</span>
          </TabsTrigger>
          {canViewHistory && (
            <TabsTrigger value="version-history" className="gap-2 flex-1 lg:flex-none">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Version History</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all-leads">
          <NewLeadsTab onNavigateToTab={onNavigateToTab} userRole="sales_lead" />
        </TabsContent>

        <TabsContent value="targets">
          <SetTargetsPanel salesUsers={salesUsers} currentUserId={currentUserId} />
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
                  {agentStats.map((agent: any) => (
                    <div key={agent.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{agent.first_name} {agent.last_name}</p>
                        <p className="text-xs text-muted-foreground">{agent.leadCount} leads assigned</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{agent.salesCount} sales</p>
                        <p className="text-xs text-muted-foreground">{agent.conversionRate}% rate</p>
                      </div>
                    </div>
                  ))}
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

        {canViewHistory && (
          <TabsContent value="version-history">
            <LeadVersionHistory />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
