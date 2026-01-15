import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLeads, Lead, LeadTag, AdminUser, LeadStatus } from '@/hooks/useLeads';
import { useSalesStats } from '@/hooks/useSalesStats';
import { SalesAgentLeadsTable } from './SalesAgentLeadsTable';
import SalesCustomerManagement from './SalesCustomerManagement';
import { 
  LayoutDashboard, Users, ShoppingBag, Bell,
  TrendingUp, Clock, AlertTriangle, Target, DollarSign
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { format, isToday, isPast } from 'date-fns';

interface SalesAgentDashboardProps {
  onNavigateToTab?: (tab: string, leadData?: any) => void;
  // Optional overrides - if not provided, will fetch own data
  leads?: Lead[];
  tags?: LeadTag[];
  salesUsers?: AdminUser[];
  handlers?: any;
}

export const SalesAgentDashboard: React.FC<SalesAgentDashboardProps> = ({
  onNavigateToTab,
  leads: propLeads,
  tags: propTags,
  salesUsers: propSalesUsers,
  handlers: propHandlers
}) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Use own data fetching for sales agents
  const {
    leads: fetchedLeads,
    tags: fetchedTags,
    salesUsers: fetchedSalesUsers,
    loading,
    updateLeadStatus,
    scheduleFollowUp,
    updateLeadNotes,
    markContactedAt,
    logActivity,
  } = useLeads();

  // Use fetched data or props
  const leads = propLeads?.length ? propLeads : fetchedLeads;
  const tags = propTags?.length ? propTags : fetchedTags;

  const { personalStats, loading: statsLoading } = useSalesStats(currentUserId || undefined);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (adminUser) {
          setCurrentUserId(adminUser.id);
        }
      }
    };
    getCurrentUser();
  }, []);

  // Filter leads to only show those assigned to current user - CRITICAL SECURITY
  const myLeads = useMemo(() => {
    if (!currentUserId) return [];
    return leads.filter(l => l.assigned_to === currentUserId);
  }, [currentUserId, leads]);

  const todayFollowUps = useMemo(() => 
    myLeads.filter(l => l.next_action_date && isToday(new Date(l.next_action_date))),
    [myLeads]
  );

  const overdueFollowUps = useMemo(() =>
    myLeads.filter(l =>
      l.next_action_date && 
      isPast(new Date(l.next_action_date)) && 
      l.follow_up_status === 'pending'
    ),
    [myLeads]
  );

  const paidLeads = useMemo(() => 
    myLeads.filter(l => l.is_paid),
    [myLeads]
  );

  const monthlyTarget = 5000;
  const targetProgress = personalStats 
    ? Math.min((personalStats.totalRevenue / monthlyTarget) * 100, 100) 
    : 0;

  // Create handlers object for the table
  const leadHandlers = useMemo(() => ({
    updateLeadStatus: propHandlers?.updateLeadStatus || updateLeadStatus,
    scheduleFollowUp: propHandlers?.scheduleFollowUp || scheduleFollowUp,
    updateLeadNotes: propHandlers?.updateLeadNotes || updateLeadNotes,
    markContactedAt: propHandlers?.markContactedAt || markContactedAt,
    logActivity: propHandlers?.logActivity || logActivity,
  }), [propHandlers, updateLeadStatus, scheduleFollowUp, updateLeadNotes, markContactedAt, logActivity]);

  if (loading || statsLoading || !currentUserId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Sales Safe */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Dashboard</h1>
          <p className="text-muted-foreground">Your sales performance and assigned work</p>
        </div>
      </div>

      {/* Restricted Tab Navigation - No Export, No All Leads, No See Agents */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">My Leads</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">My Orders</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 relative">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
            {unreadNotifications > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {unreadNotifications}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Leads Due Today</CardDescription>
                <CardTitle className="text-3xl">{todayFollowUps.length}</CardTitle>
              </CardHeader>
              <CardContent>
                {overdueFollowUps.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{overdueFollowUps.length} overdue</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>New Leads Assigned</CardDescription>
                <CardTitle className="text-3xl">
                  {myLeads.filter(l => l.status === 'new').length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="bg-blue-100">
                  {myLeads.length} total assigned
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Completed Sales</CardDescription>
                <CardTitle className="text-3xl">{paidLeads.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  <span>This week</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Revenue This Month</CardDescription>
                <CardTitle className="text-3xl">
                  £{personalStats?.totalRevenue.toLocaleString() || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Target: £{monthlyTarget.toLocaleString()}</span>
                    <span>{targetProgress.toFixed(0)}%</span>
                  </div>
                  <Progress value={targetProgress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Today's Follow-ups */}
          {todayFollowUps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Today's Follow-ups ({todayFollowUps.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {todayFollowUps.slice(0, 5).map((lead) => (
                    <div 
                      key={lead.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <div className="font-medium">
                          {lead.first_name || lead.email.split('@')[0]} {lead.last_name || ''}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {lead.next_action_type} at {lead.next_action_date && format(new Date(lead.next_action_date), 'HH:mm')}
                        </div>
                      </div>
                      <Badge variant="outline">{lead.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Overdue Follow-ups Warning */}
          {overdueFollowUps.length > 0 && (
            <Card className="border-red-200 bg-red-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Overdue Follow-ups ({overdueFollowUps.length})
                </CardTitle>
                <CardDescription>These leads need immediate attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overdueFollowUps.slice(0, 5).map((lead) => (
                    <div 
                      key={lead.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200"
                    >
                      <div>
                        <div className="font-medium">
                          {lead.first_name || lead.email.split('@')[0]} {lead.last_name || ''}
                        </div>
                        <div className="text-sm text-red-600">
                          Due: {lead.next_action_date && format(new Date(lead.next_action_date), 'MMM d')}
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => leadHandlers.markContactedAt(lead.id)}
                      >
                        Mark Contacted
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* My Leads Tab - Restricted View */}
        <TabsContent value="leads">
          <SalesAgentLeadsTable
            leads={myLeads}
            tags={tags}
            currentUserId={currentUserId}
            handlers={leadHandlers}
            onSendQuote={(lead) => onNavigateToTab?.('get-quote', {
              id: lead.id,
              first_name: lead.first_name,
              last_name: lead.last_name,
              email: lead.email,
              phone: lead.phone,
              vehicle_reg: lead.vehicle_reg,
              vehicle_make: lead.vehicle_make,
              vehicle_model: lead.vehicle_model,
              vehicle_year: lead.vehicle_year,
              mileage: lead.mileage,
              plan_interest: lead.plan_interest,
            })}
          />
        </TabsContent>

        {/* My Orders Tab */}
        <TabsContent value="orders">
          <SalesCustomerManagement currentUserId={currentUserId} />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Updates about your leads and orders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No new notifications</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
