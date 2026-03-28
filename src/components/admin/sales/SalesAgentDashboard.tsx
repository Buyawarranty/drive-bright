import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLeads, Lead, LeadTag, AdminUser, LeadStatus } from '@/hooks/useLeads';
import { SalesAgentMyLeadsView } from './SalesAgentMyLeadsView';
import { LostLeadsSection } from '../leads/LostLeadsSection';
import SalesCustomerManagement from './SalesCustomerManagement';
import { SalesDashboardKPIs } from './SalesDashboardKPIs';
import { SalesBadges } from './SalesBadges';
import { 
  LayoutDashboard, Users, ShoppingBag, Bell,
  TrendingUp, Clock, AlertTriangle, Phone
} from 'lucide-react';
import { format, isToday, isPast, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useViewAs } from '@/contexts/ViewAsContext';

interface SalesAgentDashboardProps {
  onNavigateToTab?: (tab: string, leadData?: any) => void;
  // Optional overrides - if not provided, will fetch own data
  leads?: Lead[];
  tags?: LeadTag[];
  salesUsers?: AdminUser[];
  handlers?: any;
  hideAssignedColumn?: boolean;
}

export const SalesAgentDashboard: React.FC<SalesAgentDashboardProps> = ({
  onNavigateToTab,
  leads: propLeads,
  tags: propTags,
  salesUsers: propSalesUsers,
  handlers: propHandlers,
  hideAssignedColumn
}) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { effectiveAdminUserId } = useViewAs();

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
    fetchLeads,
  } = useLeads();

  // Use props if provided, fallback to fetched data
  // CRITICAL: Use ?? (not ?.length) so empty arrays from parent don't cause
  // a switch to fetchedLeads (which lacks the parent's optimistic updates)
  const leads = propLeads ?? fetchedLeads;
  const tags = propTags ?? fetchedTags;
  const salesUsers = propSalesUsers ?? fetchedSalesUsers;

  useEffect(() => {
    let cancelled = false;

    const getCurrentUser = async () => {
      if (effectiveAdminUserId) {
        if (!cancelled) {
          setCurrentUserId(effectiveAdminUserId);
        }

        const matchingUser = salesUsers.find(user => user.id === effectiveAdminUserId);
        if (matchingUser?.email) {
          if (!cancelled) {
            setCurrentUserEmail(matchingUser.email);
          }
          return;
        }

        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id, email')
          .eq('id', effectiveAdminUserId)
          .maybeSingle();

        if (!cancelled && adminUser) {
          setCurrentUserEmail(adminUser.email);
        }
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id, email')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!cancelled && adminUser) {
          setCurrentUserId(adminUser.id);
          setCurrentUserEmail(adminUser.email);
        }
      }
    };
    getCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [effectiveAdminUserId, salesUsers]);

  // Filter leads to only show those assigned to current user - CRITICAL SECURITY
  // Also exclude fake_lead status as they should only appear in the Fake tab
  const myLeads = useMemo(() => {
    if (!currentUserId) return [];
    return leads.filter(l => l.assigned_to === currentUserId && l.status !== 'fake_lead');
  }, [currentUserId, leads]);

  // Fetch REAL deal stats from customers table (source of truth)
  const { data: realDealStats } = useQuery({
    queryKey: ['agent-real-deals', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return { total: 0, revenue: 0, cancelled: 0, monthlyCount: 0, totalCount: 0 };
      
      // Get all customers assigned to this agent
      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, status, final_amount, created_at, is_deleted')
        .eq('assigned_to', currentUserId)
        .eq('is_deleted', false);
      
      if (error || !customers) return { total: 0, revenue: 0, cancelled: 0, monthlyCount: 0, totalCount: 0 };
      
      const now = new Date();
      const mStart = startOfMonth(now);
      const mEnd = endOfMonth(now);
      
      const activeCustomers = customers.filter(c => 
        !['cancelled', 'refunded'].includes((c.status || '').toLowerCase())
      );
      const cancelledCustomers = customers.filter(c => 
        ['cancelled', 'refunded'].includes((c.status || '').toLowerCase())
      );
      const monthlyCustomers = activeCustomers.filter(c =>
        isWithinInterval(new Date(c.created_at), { start: mStart, end: mEnd })
      );
      
      const revenue = activeCustomers.reduce((sum, c) => sum + (c.final_amount || 0), 0);
      
      return {
        total: activeCustomers.length,
        revenue,
        cancelled: cancelledCustomers.length,
        monthlyCount: monthlyCustomers.length,
        totalCount: activeCustomers.length,
      };
    },
    enabled: !!currentUserId,
    refetchInterval: 30000, // refresh every 30s
  });

  const paidDealsStats = realDealStats || { total: 0, revenue: 0, cancelled: 0, monthlyCount: 0, totalCount: 0 };

  // Monthly warranty count for badges (from real customer data)
  const monthlyWarrantyCount = paidDealsStats.monthlyCount || 0;

  // Total warranty count for badges (from real customer data)
  const totalWarrantyCount = paidDealsStats.totalCount || 0;

  const todayFollowUps = useMemo(() => 
    myLeads.filter(l => l.next_action_date && isToday(new Date(l.next_action_date))),
    [myLeads]
  );

  const overdueFollowUps = useMemo(() =>
    myLeads.filter(l =>
      l.next_action_date && 
      isPast(new Date(l.next_action_date)) && 
      !isToday(new Date(l.next_action_date)) &&
      l.follow_up_status === 'pending'
    ),
    [myLeads]
  );

  // My callbacks - filtered to only this agent's assigned callback leads
  const myCallbacks = useMemo(() =>
    myLeads.filter(l => l.is_callback === true && l.status !== 'converted' && l.status !== 'lost'),
    [myLeads]
  );

  // Create handlers object for the table
  const leadHandlers = useMemo(() => ({
    updateLeadStatus: propHandlers?.updateLeadStatus || updateLeadStatus,
    scheduleFollowUp: propHandlers?.scheduleFollowUp || scheduleFollowUp,
    updateLeadNotes: propHandlers?.updateLeadNotes || updateLeadNotes,
    markContactedAt: propHandlers?.markContactedAt || markContactedAt,
    logActivity: propHandlers?.logActivity || logActivity,
  }), [propHandlers, updateLeadStatus, scheduleFollowUp, updateLeadNotes, markContactedAt, logActivity]);

  if (loading || !currentUserId) {
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
          <p className="text-muted-foreground">
            Logged in as: <span className="font-medium text-foreground">{currentUserEmail || 'Loading...'}</span>
          </p>
        </div>
      </div>

      {/* Restricted Tab Navigation - No Export, No All Leads, No See Agents */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid border-2 border-border rounded-xl">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">My Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">All My Leads</span>
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

        {/* Dashboard Tab - New KPI Layout */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Main KPI Cards */}
          <SalesDashboardKPIs 
            leads={myLeads}
            currentUserEmail={currentUserEmail || ''}
            paidDeals={paidDealsStats}
          />

          {/* Badges Section */}
          <SalesBadges
            warrantyCount={totalWarrantyCount}
            monthlyWarrantyCount={monthlyWarrantyCount}
            trustpilotReviews={0} // TODO: Connect to actual Trustpilot review count
          />

          {/* My Callbacks */}
          {myCallbacks.length > 0 && (
            <Card className="border-teal-200 bg-teal-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-teal-700">
                  <Phone className="h-5 w-5" />
                  My Callbacks ({myCallbacks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {myCallbacks.slice(0, 5).map((lead) => (
                    <div 
                      key={lead.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border"
                    >
                      <div>
                        <div className="font-medium">
                          {lead.first_name || lead.email.split('@')[0]} {lead.last_name || ''}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {lead.phone || 'No phone'} • {lead.status}
                        </div>
                      </div>
                      <Badge className="bg-teal-100 text-teal-800 border-teal-300">Callback</Badge>
                    </div>
                  ))}
                  {myCallbacks.length > 5 && (
                    <Button 
                      variant="ghost" 
                      className="w-full text-sm"
                      onClick={() => setActiveTab('leads')}
                    >
                      View all {myCallbacks.length} callbacks →
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Today's Follow-ups */}
          {todayFollowUps.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <Clock className="h-5 w-5" />
                  Today's Follow-ups ({todayFollowUps.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {todayFollowUps.slice(0, 5).map((lead) => (
                    <div 
                      key={lead.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border"
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
                  {todayFollowUps.length > 5 && (
                    <Button 
                      variant="ghost" 
                      className="w-full text-sm"
                      onClick={() => setActiveTab('leads')}
                    >
                      View all {todayFollowUps.length} follow-ups →
                    </Button>
                  )}
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

        {/* My Leads Tab - Full UI matching admin All Leads view */}
        <TabsContent value="leads">
          <SalesAgentMyLeadsView
            leads={leads}
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
            onRefresh={fetchLeads}
            hideAssignedColumn={hideAssignedColumn}
          />

          {/* Recovery Queue for sales agents */}
          <Card className="overflow-hidden border-2 border-amber-400 bg-amber-50/20 mt-4">
            <CardContent className="p-0">
              <LostLeadsSection onRecovered={fetchLeads} inline salesUsers={salesUsers as any} userRole="sales" />
            </CardContent>
          </Card>
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
