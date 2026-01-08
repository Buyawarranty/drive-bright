import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSalesStats, Badge as SalesBadge } from '@/hooks/useSalesStats';
import { useLeads, Lead } from '@/hooks/useLeads';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, Users, DollarSign, Target, 
  Clock, AlertTriangle, CheckCircle, Phone,
  Mail, Calendar, Award
} from 'lucide-react';
import { LeadsTable } from './LeadsTable';
import { format, isToday, isPast } from 'date-fns';

export const SalespersonDashboard: React.FC = () => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myLeads, setMyLeads] = useState<Lead[]>([]);
  
  const { 
    leads, 
    tags, 
    salesUsers, 
    loading,
    updateLeadStatus,
    assignLead,
    autoAssignLead,
    updateLeadPriority,
    scheduleFollowUp,
    addTagToLead,
    removeTagFromLead,
    updateLeadNotes,
    markContactedAt,
    logActivity
  } = useLeads();
  
  const { personalStats, userBadges, loading: statsLoading } = useSalesStats(currentUserId || undefined);

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

  useEffect(() => {
    if (currentUserId && leads.length > 0) {
      setMyLeads(leads.filter(l => l.assigned_to === currentUserId));
    }
  }, [currentUserId, leads]);

  const todayFollowUps = myLeads.filter(l => 
    l.next_action_date && isToday(new Date(l.next_action_date))
  );

  const overdueFollowUps = myLeads.filter(l =>
    l.next_action_date && 
    isPast(new Date(l.next_action_date)) && 
    l.follow_up_status === 'pending'
  );

  const hotLeads = myLeads.filter(l => 
    l.priority === 'high' || l.priority === 'urgent'
  );

  // Monthly target (example: £5000)
  const monthlyTarget = 5000;
  const targetProgress = personalStats 
    ? Math.min((personalStats.totalRevenue / monthlyTarget) * 100, 100) 
    : 0;

  if (loading || statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>My Leads</CardDescription>
            <CardTitle className="text-3xl">{myLeads.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 text-sm">
              <Badge variant="secondary" className="bg-blue-100">
                {myLeads.filter(l => l.status === 'new').length} new
              </Badge>
              <Badge variant="secondary" className="bg-yellow-100">
                {myLeads.filter(l => l.status === 'contacted').length} contacted
              </Badge>
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

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paid Deals</CardDescription>
            <CardTitle className="text-3xl">
              {myLeads.filter(l => l.is_paid).length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span>£{myLeads.filter(l => l.is_paid).reduce((sum, l) => sum + (l.payment_amount || 0), 0).toLocaleString()} revenue</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Follow-ups Today</CardDescription>
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
      </div>

      {/* Badges */}
      {userBadges.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-orange-500" />
              My Badges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {userBadges.map((badge) => (
                <Badge 
                  key={badge.id}
                  style={{ backgroundColor: badge.color }}
                  className="text-white px-3 py-1"
                >
                  {badge.icon} {badge.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hot Leads Section */}
      {hotLeads.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              🔥 Hot Leads ({hotLeads.length})
            </CardTitle>
            <CardDescription>High priority leads that need immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <LeadsTable
              leads={hotLeads}
              tags={tags}
              salesUsers={salesUsers}
              onUpdateStatus={updateLeadStatus}
              onAssign={assignLead}
              onAutoAssign={autoAssignLead}
              onUpdatePriority={updateLeadPriority}
              onScheduleFollowUp={scheduleFollowUp}
              onAddTag={addTagToLead}
              onRemoveTag={removeTagFromLead}
              onUpdateNotes={updateLeadNotes}
              onMarkContacted={markContactedAt}
              onLogActivity={logActivity}
            />
          </CardContent>
        </Card>
      )}

      {/* Today's Follow-ups */}
      {todayFollowUps.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Today's Follow-ups ({todayFollowUps.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayFollowUps.map((lead) => (
                <div 
                  key={lead.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <div className="font-medium">
                      {lead.first_name || lead.email.split('@')[0]} {lead.last_name || ''}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {lead.next_action_type === 'call' && <Phone className="h-3 w-3 inline mr-1" />}
                      {lead.next_action_type === 'email' && <Mail className="h-3 w-3 inline mr-1" />}
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

      {/* All My Leads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All My Leads</CardTitle>
          <CardDescription>Leads assigned to you</CardDescription>
        </CardHeader>
        <CardContent>
          <LeadsTable
            leads={myLeads}
            tags={tags}
            salesUsers={salesUsers}
            onUpdateStatus={updateLeadStatus}
            onAssign={assignLead}
            onAutoAssign={autoAssignLead}
            onUpdatePriority={updateLeadPriority}
            onScheduleFollowUp={scheduleFollowUp}
            onAddTag={addTagToLead}
            onRemoveTag={removeTagFromLead}
            onUpdateNotes={updateLeadNotes}
            onMarkContacted={markContactedAt}
            onLogActivity={logActivity}
          />
        </CardContent>
      </Card>
    </div>
  );
};
