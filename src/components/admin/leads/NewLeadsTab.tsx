import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLeads, Lead } from '@/hooks/useLeads';
import { LeadsTable } from './LeadsTable';
import { LeadsFilters } from './LeadsFilters';
import { SalespersonDashboard } from './SalespersonDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { ManualOrderEntry } from '../ManualOrderEntry';
import { MyRemindersPanel } from './MyRemindersPanel';
import { AdminNotificationBell, AdminNotification } from '@/components/admin/AdminNotificationBell';
import { Users, UserCircle, LayoutDashboard, Bell, BellOff, PanelRightClose, PanelRight, Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { useDataExport } from '@/hooks/useDataExport';

interface NewLeadsTabProps {
  notifications?: AdminNotification[];
  unreadCount?: number;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onNavigateToTab?: (tab: string) => void;
  userRole?: string | null;
}

export const NewLeadsTab: React.FC<NewLeadsTabProps> = ({
  notifications = [],
  unreadCount = 0,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToTab,
  userRole,
}) => {
  const { canExportTab, hasGranularPermission } = usePermissions();
  const { exportToCSV, exportToExcel } = useDataExport();
  
  // Only admin can delete leads
  const isAdmin = userRole === 'admin';
  
  // Granular permissions for sub-views (default: all-leads and my-dashboard, no team-view)
  const canSeeAllLeads = hasGranularPermission('new-leads', 'all-leads') !== false; // Default true if not set
  const canSeeMyDashboard = hasGranularPermission('new-leads', 'my-dashboard') !== false; // Default true if not set
  const canSeeTeamView = hasGranularPermission('new-leads', 'team-view'); // Default false - requires explicit permission
  const canExport = canExportTab('new-leads') || hasGranularPermission('new-leads', 'export');
  
  // Determine default view based on permissions
  const getDefaultView = () => {
    if (canSeeAllLeads) return 'leads';
    if (canSeeMyDashboard) return 'my-dashboard';
    if (canSeeTeamView) return 'team-dashboard';
    return 'leads';
  };
  
  const [activeView, setActiveView] = useState<'leads' | 'my-dashboard' | 'team-dashboard'>(getDefaultView());
  const [searchTerm, setSearchTerm] = useState('');
  const [remindersOpen, setRemindersOpen] = useState(true);
  const [showRemindersPanel, setShowRemindersPanel] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  const {
    leads,
    tags,
    salesUsers,
    loading,
    filter,
    setFilter,
    fetchLeads,
    updateLeadStatus,
    assignLead,
    autoAssignLead,
    updateLeadPriority,
    scheduleFollowUp,
    addTagToLead,
    removeTagFromLead,
    updateLeadNotes,
    markContactedAt,
    logActivity,
    migrateFromAbandonedCarts,
    deleteLeads
  } = useLeads();

  const filteredLeads = useMemo(() => {
    if (!searchTerm) return leads;
    
    const term = searchTerm.toLowerCase();
    return leads.filter(lead => 
      lead.email.toLowerCase().includes(term) ||
      (lead.first_name?.toLowerCase().includes(term)) ||
      (lead.last_name?.toLowerCase().includes(term)) ||
      (lead.phone?.toLowerCase().includes(term)) ||
      (lead.vehicle_reg?.toLowerCase().includes(term)) ||
      (lead.plan_interest?.toLowerCase().includes(term))
    );
  }, [leads, searchTerm]);

  const leadCounts = useMemo(() => ({
    all: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    follow_up: leads.filter(l => l.status === 'follow_up').length,
    paid: leads.filter(l => l.is_paid === true).length,
    lost: leads.filter(l => l.status === 'lost').length,
    high_priority: leads.filter(l => l.priority === 'high' || l.priority === 'urgent').length,
  }), [leads]);

  const handleSelectLead = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    }
  };
  const handleExport = (format: 'csv' | 'xlsx') => {
    // Export selected leads if any are selected, otherwise export all filtered leads
    const leadsToExport = selectedLeads.size > 0 
      ? filteredLeads.filter(lead => selectedLeads.has(lead.id))
      : filteredLeads;

    const exportData = leadsToExport.map(lead => ({
      'First Name': lead.first_name || '',
      'Last Name': lead.last_name || '',
      'Email': lead.email,
      'Phone': lead.phone || '',
      'Status': lead.status,
      'Priority': lead.priority,
      'Source': lead.lead_source,
      'Vehicle Reg': lead.vehicle_reg || '',
      'Vehicle': `${lead.vehicle_make || ''} ${lead.vehicle_model || ''} ${lead.vehicle_year || ''}`.trim(),
      'Plan Interest': lead.plan_interest || '',
      'Quote Amount': lead.quote_amount || '',
      'Assigned To': lead.assigned_user?.email || 'Unassigned',
      'Last Contacted': lead.last_contacted_at || '',
      'Created At': lead.created_at,
      'Notes': lead.notes || '',
    }));

    if (format === 'csv') {
      exportToCSV(exportData, { filename: 'leads', format: 'csv' });
    } else {
      exportToExcel(exportData, { filename: 'leads', format: 'xlsx' });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLeads.size === 0) return;
    
    await deleteLeads(Array.from(selectedLeads));
    setSelectedLeads(new Set());
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">New Leads</h1>
          <p className="text-muted-foreground">Manage and track your sales pipeline</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          {onMarkAsRead && onMarkAllAsRead && (
            <AdminNotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={onMarkAsRead}
              onMarkAllAsRead={onMarkAllAsRead}
              onNavigateToTab={onNavigateToTab}
            />
          )}
          
          {/* Toggle Reminders Panel Button */}
          <TooltipProvider>
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Button
                  variant={showRemindersPanel ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowRemindersPanel(!showRemindersPanel)}
                  className={cn(
                    "gap-2 transition-all duration-150",
                    showRemindersPanel 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-primary/10"
                  )}
                  aria-label={showRemindersPanel ? "Hide reminders panel" : "Show reminders panel"}
                >
                  {showRemindersPanel ? (
                    <>
                      <PanelRightClose className="h-4 w-4" />
                      <span className="hidden sm:inline">Hide Reminders</span>
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4" />
                      <span className="hidden sm:inline">Show Reminders</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {showRemindersPanel ? "Hide reminders panel" : "Show reminders panel"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Export Button - Permission Controlled */}
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    Export{selectedLeads.size > 0 ? ` (${selectedLeads.size})` : ''}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export {selectedLeads.size > 0 ? `${selectedLeads.size} selected` : 'all'} as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export {selectedLeads.size > 0 ? `${selectedLeads.size} selected` : 'all'} as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Delete Button - Admin Only, shows when leads selected */}
          {isAdmin && selectedLeads.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete ({selectedLeads.size})</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedLeads.size} lead{selectedLeads.size > 1 ? 's' : ''}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the selected lead{selectedLeads.size > 1 ? 's' : ''} and all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteSelected}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          {/* Add Manual Order Button */}
          <ManualOrderEntry />
          
          {/* View Toggle */}
          <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
            <TabsList>
              {canSeeAllLeads && (
                <TabsTrigger value="leads" className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  All Leads
                </TabsTrigger>
              )}
              {canSeeMyDashboard && (
                <TabsTrigger value="my-dashboard" className="flex items-center gap-2">
                  <UserCircle className="h-4 w-4" />
                  My Dashboard
                </TabsTrigger>
              )}
              {canSeeTeamView && (
                <TabsTrigger value="team-dashboard" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Team View
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content based on view */}
      {activeView === 'leads' && (
        <div className={cn(
          "grid grid-cols-1 gap-4 transition-all duration-200",
          showRemindersPanel ? "xl:grid-cols-[1fr_320px]" : "xl:grid-cols-1"
        )}>
          {/* Main Leads Section */}
          <div className="space-y-4 min-w-0">
            <LeadsFilters
              filter={filter}
              onFilterChange={setFilter}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onRefresh={fetchLeads}
              onMigrate={migrateFromAbandonedCarts}
              leadCounts={leadCounts}
            />
            
            <Card>
              <CardContent className="pt-6">
                <LeadsTable
                  leads={filteredLeads}
                  tags={tags}
                  salesUsers={salesUsers}
                  selectedLeads={selectedLeads}
                  onSelectLead={handleSelectLead}
                  onSelectAll={handleSelectAll}
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

          {/* My Reminders Sidebar - Conditionally rendered */}
          {showRemindersPanel && (
            <div className="space-y-4 animate-fade-in">
              {/* Collapsible on mobile/tablet */}
              <div className="xl:hidden">
                <Collapsible open={remindersOpen} onOpenChange={setRemindersOpen}>
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between mb-2 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        My Reminders
                      </div>
                      {remindersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="animate-accordion-down">
                    <MyRemindersPanel compact />
                  </CollapsibleContent>
                </Collapsible>
              </div>
              {/* Always visible on XL screens */}
              <div className="hidden xl:block">
                <MyRemindersPanel />
              </div>
            </div>
          )}
        </div>
      )}

      {activeView === 'my-dashboard' && <SalespersonDashboard />}
      {activeView === 'team-dashboard' && <ManagerDashboard />}
    </div>
  );
};
