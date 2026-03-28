import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useSalesStats, Badge as SalesBadge } from '@/hooks/useSalesStats';
import { Lead, LeadTag, LeadStatus, AdminUser } from '@/hooks/useLeads';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, Users, DollarSign, Target, 
  Clock, AlertTriangle, CheckCircle, Phone,
  Mail, Calendar, Award, Archive, Trophy
} from 'lucide-react';
import { LeadsTable } from './LeadsTable';
import { MyRemindersPanel } from './MyRemindersPanel';
import { format, isToday, isPast } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useViewAs } from '@/contexts/ViewAsContext';

interface LeadHandlers {
  updateLeadStatus: (leadId: string, status: LeadStatus) => Promise<void>;
  assignLead: (leadId: string, userId: string | null) => Promise<void>;
  autoAssignLead: (leadId: string) => Promise<void>;
  updateLeadPriority: (leadId: string, priority: string) => Promise<void>;
  scheduleFollowUp: (leadId: string, date: string, actionType: string) => Promise<void>;
  addTagToLead: (leadId: string, tagId: string) => Promise<void>;
  removeTagFromLead: (leadId: string, tagId: string) => Promise<void>;
  updateLeadNotes: (leadId: string, notes: string, replaceAll?: boolean) => Promise<void>;
  markContactedAt: (leadId: string) => Promise<void>;
  logActivity: (leadId: string, activityType: string, description: string) => Promise<void>;
  deleteLeads: (leadIds: string[]) => Promise<void>;
  updateCallCount: (leadId: string, increment: number) => Promise<void>;
}

interface SalespersonDashboardProps {
  leads: Lead[];
  tags: LeadTag[];
  salesUsers: AdminUser[];
  handlers: LeadHandlers;
}

export const SalespersonDashboard: React.FC<SalespersonDashboardProps> = ({
  leads,
  tags,
  salesUsers,
  handlers
}) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const { effectiveAdminUserId, isImpersonating } = useViewAs();
  
  const { personalStats, teamStats, userBadges, loading: statsLoading } = useSalesStats(currentUserId || undefined);

  useEffect(() => {
    // If impersonating, use the effective admin user ID directly
    if (isImpersonating && effectiveAdminUserId) {
      setCurrentUserId(effectiveAdminUserId);
      return;
    }
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (adminUser) {
          setCurrentUserId(adminUser.id);
        }
      }
    };
    getCurrentUser();
  }, [isImpersonating, effectiveAdminUserId]);

  // Memoize filtered leads to prevent recalculation
  // Exclude fake, lost, and hidden leads from the active salesperson workspace
  const myLeads = useMemo(() => {
    if (!currentUserId) return [];
    return leads.filter(
      l => l.assigned_to === currentUserId && l.status !== 'fake_lead' && l.status !== 'lost' && (l.status as string) !== 'archived'
    );
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

  const hotLeads = useMemo(() => 
    myLeads.filter(l => l.priority === 'high' || l.priority === 'urgent'),
    [myLeads]
  );

  // Monthly target (example: £5000)
  const monthlyTarget = 5000;
  const targetProgress = personalStats 
    ? Math.min((personalStats.totalRevenue / monthlyTarget) * 100, 100) 
    : 0;

  const handleSelectLead = useCallback((leadId: string) => {
    setSelectedLeads(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(leadId)) {
        newSelected.delete(leadId);
      } else {
        newSelected.add(leadId);
      }
      return newSelected;
    });
  }, []);

  const handleSelectAll = useCallback((leadsToSelect: Lead[]) => {
    setSelectedLeads(prev => {
      if (prev.size === leadsToSelect.length) {
        return new Set();
      } else {
        return new Set(leadsToSelect.map(l => l.id));
      }
    });
  }, []);

  // Archive leads instead of delete to preserve data
  const handleArchiveSelected = useCallback(async () => {
    if (selectedLeads.size === 0) return;
    for (const leadId of selectedLeads) {
      await handlers.updateLeadStatus(leadId, 'archived' as any);
    }
    setSelectedLeads(new Set());
  }, [selectedLeads, handlers]);

  // Get current user's rank
  const myRank = teamStats?.leaderboard.findIndex(p => p.userId === currentUserId) ?? -1;

  if (statsLoading) {
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
              {personalStats?.convertedLeads || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span>£{(personalStats?.totalRevenue || 0).toLocaleString()} revenue</span>
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
              selectedLeads={selectedLeads}
              onSelectLead={handleSelectLead}
              onSelectAll={() => handleSelectAll(hotLeads)}
              onUpdateStatus={handlers.updateLeadStatus}
              onAssign={handlers.assignLead}
              onAutoAssign={handlers.autoAssignLead}
              onUpdatePriority={handlers.updateLeadPriority}
              onScheduleFollowUp={handlers.scheduleFollowUp}
              onAddTag={handlers.addTagToLead}
              onRemoveTag={handlers.removeTagFromLead}
              onUpdateNotes={handlers.updateLeadNotes}
              onMarkContacted={handlers.markContactedAt}
              onLogActivity={handlers.logActivity}
              onUpdateCallCount={handlers.updateCallCount}
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

      {/* All My Leads with Delete */}
      <Card className="border-2 border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">All My Leads</CardTitle>
            <CardDescription>Leads assigned to you</CardDescription>
          </div>
          {selectedLeads.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50">
                  <Archive className="h-4 w-4" />
                  Archive ({selectedLeads.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive {selectedLeads.size} lead{selectedLeads.size > 1 ? 's' : ''}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will archive the selected lead{selectedLeads.size > 1 ? 's' : ''}. They will be hidden from the main view but can be restored later. No data will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleArchiveSelected}
                    className="bg-orange-600 text-white hover:bg-orange-700"
                  >
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardHeader>
        <CardContent>
          {myLeads.length > 0 ? (
            <LeadsTable
              leads={myLeads}
              tags={tags}
              salesUsers={salesUsers}
              selectedLeads={selectedLeads}
              onSelectLead={handleSelectLead}
              onSelectAll={() => handleSelectAll(myLeads)}
              onUpdateStatus={handlers.updateLeadStatus}
              onAssign={handlers.assignLead}
              onAutoAssign={handlers.autoAssignLead}
              onUpdatePriority={handlers.updateLeadPriority}
              onScheduleFollowUp={handlers.scheduleFollowUp}
              onAddTag={handlers.addTagToLead}
              onRemoveTag={handlers.removeTagFromLead}
              onUpdateNotes={handlers.updateLeadNotes}
              onMarkContacted={handlers.markContactedAt}
              onLogActivity={handlers.logActivity}
              onUpdateCallCount={handlers.updateCallCount}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No leads assigned to you yet</p>
              <p className="text-sm mt-1">Go to "All Leads" to assign leads to yourself</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scoreboard - Always show */}
      <Card className="border-2 border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-orange-500" />
            Team Scoreboard
            {myRank >= 0 && (
              <Badge variant="secondary" className="ml-2">
                Your Rank: #{myRank + 1}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Top performers by revenue this month</CardDescription>
        </CardHeader>
        <CardContent>
          {teamStats && teamStats.leaderboard.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border">
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamStats.leaderboard.slice(0, 10).map((person, index) => (
                  <TableRow 
                    key={person.userId}
                    className={person.userId === currentUserId ? 'bg-primary/10' : ''}
                  >
                    <TableCell>
                      {index === 0 && '🥇'}
                      {index === 1 && '🥈'}
                      {index === 2 && '🥉'}
                      {index > 2 && index + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {person.userName}
                      {person.userId === currentUserId && (
                        <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      £{person.totalRevenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{person.convertedLeads}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">No team data available yet</p>
          )}
        </CardContent>
      </Card>

      {/* My Reminders Panel */}
      <MyRemindersPanel />
    </div>
  );
};
