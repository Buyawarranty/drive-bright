import React, { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
// Tabs import removed - using custom button toggle
import { Card, CardContent } from '@/components/ui/card';
import { useLeads, Lead } from '@/hooks/useLeads';
import { LeadsTable } from './LeadsTable';
import { LeadsFilters, AssignmentFilter, SortOption } from './LeadsFilters';
import { LeadsTableControlBar } from './LeadsTableControlBar';
import { LeadsTableFooter } from './LeadsTableFooter';
import { SalespersonDashboard } from './SalespersonDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { AgentsLeadsView } from './AgentsLeadsView';
import { SalesAgentDashboard } from '../sales/SalesAgentDashboard';
import { SalesExecutiveHeader } from './distribution';
import { AdminNotificationBell, AdminNotification } from '@/components/admin/AdminNotificationBell';
import { Users, UserCircle, LayoutDashboard, Download, FileSpreadsheet, Archive, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useDataExport } from '@/hooks/useDataExport';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { useEnhancedPresence } from '@/hooks/useEnhancedPresence';
import { useAdminConfig } from '@/hooks/useAdminConfig';

// Lead data for quote navigation
interface LeadForQuote {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  mileage: string | null;
  plan_interest: string | null;
}

interface NewLeadsTabProps {
  notifications?: AdminNotification[];
  unreadCount?: number;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onNavigateToTab?: (tab: string, leadData?: LeadForQuote) => void;
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
  
  // Role-based restrictions
  const isAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_lead';
  const isSalesAgent = userRole === 'sales';
  
  // Admin-controlled toggle: whether sales agents can see the "Assigned To" column
  const { value: showAssignmentsToAgents } = useAdminConfig('show_assignments_to_agents');
  const hideAssignedColumnForAgents = isSalesAgent && showAssignmentsToAgents === false;
  
  // Delete permission - explicit granular permission ONLY (no role auto-grants delete)
  // Sales Lead, Admin, Super Admin should NOT have delete by default
  const canDelete = hasGranularPermission('new-leads', 'delete') === true;
  
  // Assign permission - sales_lead/admin/super_admin ALWAYS can assign
  // Sales agents need explicit permission (defaults to denied for them)
  const canAssignLeads = isAdmin || hasGranularPermission('new-leads', 'assign') !== false;
  
  // Export permission - admins always can, others need explicit permission
  const canExport = isAdmin || canExportTab('new-leads') || hasGranularPermission('new-leads', 'export');
  
  // Granular permissions for sub-views
  // hasGranularPermission returns: true (granted), false (denied), undefined (not set)
  const hasAllLeadsPerm = hasGranularPermission('new-leads', 'all-leads');
  const hasTeamViewPerm = hasGranularPermission('new-leads', 'team-view');
  
  // Default behavior:
  // - all-leads: defaults to TRUE unless explicitly denied (false)
  // - my-dashboard: ALWAYS allowed (shows only user's own leads)
  // - team-view: must be explicitly granted OR sales_lead/admin role gets it automatically
  const canSeeAllLeads = hasAllLeadsPerm !== false; // true if undefined or true
  const canSeeMyDashboard = true; // Always allow - shows only user's own leads
  const canSeeTeamView = hasTeamViewPerm === true || isAdmin; // Sales leads & admins always get team view
  
  // Determine default view based on permissions
  const getDefaultView = () => {
    if (canSeeAllLeads) return 'leads';
    if (canSeeMyDashboard) return 'my-dashboard';
    if (canSeeTeamView) return 'team-dashboard';
    return 'leads';
  };
  
  const [activeView, setActiveView] = useState<'leads' | 'my-dashboard' | 'team-dashboard' | 'agents-view'>(getDefaultView());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('latest_submitted');

  // Lead distribution hook no longer needed here - AgentsLeadsView has its own instance

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
    deleteLeads,
    updateCallCount
  } = useLeads();

  // Debounce search term to avoid filtering on every keystroke
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredLeads = useMemo(() => {
    let result = leads;
    
    // Apply assignment filter
    if (assignmentFilter === 'awaiting_contact') {
      result = result.filter(lead => !lead.assigned_to);
    } else if (assignmentFilter === 'assigned') {
      result = result.filter(lead => !!lead.assigned_to);
    }
    // 'all' and 'total' show all leads (total is same as all, just labeled differently)
    
    // Apply agent filter
    if (agentFilter !== 'all') {
      if (agentFilter === 'unassigned') {
        result = result.filter(lead => !lead.assigned_to);
      } else {
        result = result.filter(lead => lead.assigned_to === agentFilter);
      }
    }
    
    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      result = result.filter(lead => {
        const leadDate = new Date(lead.created_at);
        
        // Compare using start of day for 'from' date
        if (dateRange.from) {
          const fromStart = new Date(dateRange.from);
          fromStart.setHours(0, 0, 0, 0);
          if (leadDate < fromStart) return false;
        }
        
        // Compare using end of day for 'to' date
        if (dateRange.to) {
          const toEnd = new Date(dateRange.to);
          toEnd.setHours(23, 59, 59, 999);
          if (leadDate > toEnd) return false;
        }
        
        return true;
      });
    }
    
    // Apply search filter
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      result = result.filter(lead => 
        lead.email.toLowerCase().includes(term) ||
        (lead.first_name?.toLowerCase().includes(term)) ||
        (lead.last_name?.toLowerCase().includes(term)) ||
        (lead.phone?.toLowerCase().includes(term)) ||
        (lead.vehicle_reg?.toLowerCase().includes(term)) ||
        (lead.plan_interest?.toLowerCase().includes(term))
      );
    }
    
    // Apply sorting
    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.last_activity_date || b.created_at).getTime() - new Date(a.last_activity_date || a.created_at).getTime();
        case 'latest_submitted':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.last_activity_date || a.created_at).getTime() - new Date(b.last_activity_date || b.created_at).getTime();
        case 'contacted':
          if (a.status === 'contacted' && b.status !== 'contacted') return -1;
          if (a.status !== 'contacted' && b.status === 'contacted') return 1;
          return new Date(b.last_activity_date || b.created_at).getTime() - new Date(a.last_activity_date || a.created_at).getTime();
        case 'follow_up':
          if (a.status === 'follow_up' && b.status !== 'follow_up') return -1;
          if (a.status !== 'follow_up' && b.status === 'follow_up') return 1;
          return new Date(b.last_activity_date || b.created_at).getTime() - new Date(a.last_activity_date || a.created_at).getTime();
        case 'quote_sent':
          if (a.status === 'quote_sent' && b.status !== 'quote_sent') return -1;
          if (a.status !== 'quote_sent' && b.status === 'quote_sent') return 1;
          return new Date(b.last_activity_date || b.created_at).getTime() - new Date(a.last_activity_date || a.created_at).getTime();
        default:
          return new Date(b.last_activity_date || b.created_at).getTime() - new Date(a.last_activity_date || a.created_at).getTime();
      }
    });
    
    return result;
  }, [leads, debouncedSearchTerm, dateRange, assignmentFilter, agentFilter, sortOption]);

  // Pagination for leads table
  const pagination = usePagination(filteredLeads, { initialPageSize: 50 });

  const leadCounts = useMemo(() => ({
    all: leads.filter(l => l.status !== 'lost' && l.status !== 'fake_lead').length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    follow_up: leads.filter(l => l.status === 'follow_up').length,
    quote_sent: leads.filter(l => l.status === 'quote_sent').length,
    urgent_callback: leads.filter(l => l.status === 'urgent_callback').length,
    paid: leads.filter(l => l.is_paid === true).length,
    lost: 0,
    converted: leads.filter(l => l.status === 'converted').length,
    high_priority: leads.filter(l => (l.priority === 'high' || l.priority === 'urgent') && l.status !== 'lost' && l.status !== 'fake_lead').length,
    fake: leads.filter(l => l.status === 'fake_lead').length,
  }), [leads]);

  // Assignment counts for the filter dropdown
  const assignmentCounts = useMemo(() => ({
    total: leads.length,
    awaiting_contact: leads.filter(l => !l.assigned_to).length,
    assigned: leads.filter(l => !!l.assigned_to).length,
  }), [leads]);

  // Agent lead counts - respects date range filter
  const agentLeadCounts = useMemo(() => {
    let dateFilteredLeads = leads;
    if (dateRange.from || dateRange.to) {
      dateFilteredLeads = leads.filter(lead => {
        const leadDate = new Date(lead.created_at);
        if (dateRange.from) {
          const fromStart = new Date(dateRange.from);
          fromStart.setHours(0, 0, 0, 0);
          if (leadDate < fromStart) return false;
        }
        if (dateRange.to) {
          const toEnd = new Date(dateRange.to);
          toEnd.setHours(23, 59, 59, 999);
          if (leadDate > toEnd) return false;
        }
        return true;
      });
    }
    const counts: Record<string, number> = { unassigned: 0 };
    dateFilteredLeads.forEach(lead => {
      if (!lead.assigned_to) {
        counts['unassigned'] = (counts['unassigned'] || 0) + 1;
      } else {
        counts[lead.assigned_to] = (counts[lead.assigned_to] || 0) + 1;
      }
    });
    return counts;
  }, [leads, dateRange]);

  // Memoize handlers to prevent re-renders
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

  const handleSelectAll = useCallback(() => {
    setSelectedLeads(prev => {
      if (prev.size === filteredLeads.length) {
        return new Set();
      } else {
        return new Set(filteredLeads.map(l => l.id));
      }
    });
  }, [filteredLeads]);

  // Memoize tab change handler for instant switching
  const handleViewChange = useCallback((view: 'leads' | 'my-dashboard' | 'team-dashboard' | 'agents-view') => {
    setActiveView(view);
  }, []);

  const handleExport = useCallback((format: 'csv' | 'xlsx') => {
    // Non-admin roles can only export the last 7 days of leads
    const isFullExportAllowed = userRole === 'admin' || userRole === 'super_admin';
    
    let baseLeads = selectedLeads.size > 0 
      ? filteredLeads.filter(lead => selectedLeads.has(lead.id))
      : filteredLeads;

    if (!isFullExportAllowed) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      baseLeads = baseLeads.filter(lead => new Date(lead.created_at) >= sevenDaysAgo);
    }

    const leadsToExport = baseLeads;

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
      'Assigned To': lead.assigned_user?.email || 'Awaiting Contact',
      'Last Contacted': lead.last_contacted_at || '',
      'Created At': lead.created_at,
      'Notes': lead.notes || '',
    }));

    if (format === 'csv') {
      exportToCSV(exportData, { filename: 'leads', format: 'csv' });
    } else {
      exportToExcel(exportData, { filename: 'leads', format: 'xlsx' });
    }
  }, [selectedLeads, filteredLeads, exportToCSV, exportToExcel]);

  // Archive leads (soft-archive by setting status to 'archived')
  const handleArchiveSelected = useCallback(async () => {
    if (selectedLeads.size === 0) return;
    
    // Update status to archived instead of deleting
    for (const leadId of selectedLeads) {
      await updateLeadStatus(leadId, 'archived' as any);
    }
    setSelectedLeads(new Set());
  }, [selectedLeads, updateLeadStatus]);

  // Bulk assign selected leads to a user - parallel for speed
  const handleBulkAssign = useCallback(async (userId: string | null) => {
    if (selectedLeads.size === 0) return;
    
    const leadIds = Array.from(selectedLeads);
    
    const results = await Promise.allSettled(
      leadIds.map(leadId => assignLead(leadId, userId))
    );
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    if (successCount > 0) {
      toast.success(`Assigned ${successCount} lead${successCount > 1 ? 's' : ''} successfully`);
      setSelectedLeads(new Set());
    }
  }, [selectedLeads, assignLead]);

  // Bulk auto-assign selected leads - sequential to respect round-robin order
  const handleBulkAutoAssign = useCallback(async () => {
    if (selectedLeads.size === 0) return;
    
    const leadIds = Array.from(selectedLeads);
    let successCount = 0;
    
    for (const leadId of leadIds) {
      try {
        await autoAssignLead(leadId);
        successCount++;
      } catch (error) {
        console.error(`Failed to auto-assign lead ${leadId}:`, error);
      }
    }
    
    if (successCount > 0) {
      toast.success(`Auto-assigned ${successCount} lead${successCount > 1 ? 's' : ''} successfully`);
      setSelectedLeads(new Set());
    }
  }, [selectedLeads, autoAssignLead]);

  // Memoize quote navigation handler
  const handleSendQuote = useCallback((lead: Lead) => {
    if (onNavigateToTab) {
      onNavigateToTab('get-quote', {
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
      });
    }
  }, [onNavigateToTab]);

  // Memoize shared lead handlers for dashboards
  const leadHandlers = useMemo(() => ({
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
    deleteLeads,
    updateCallCount,
  }), [
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
    deleteLeads,
    updateCallCount,
  ]);

  // Sales agents get a restricted view UNLESS they have the 'all-leads' permission
  // If all-leads is not explicitly denied, they see the full leads feed
  // This is placed after all hooks to comply with React's rules of hooks
  if (isSalesAgent && !canSeeAllLeads) {
    return (
      <SalesAgentDashboard
        leads={leads}
        tags={tags}
        salesUsers={salesUsers}
        handlers={leadHandlers}
        onNavigateToTab={onNavigateToTab}
        hideAssignedColumn={hideAssignedColumnForAgents}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

          {/* Archive Button - Shows when leads selected and user has delete permission */}
          {canDelete && selectedLeads.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50">
                  <Archive className="h-4 w-4" />
                  <span className="hidden sm:inline">Archive ({selectedLeads.size})</span>
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
          
          {/* View Toggle - Optimized with useCallback */}
          <div className="flex items-center border rounded-lg bg-muted/50 p-1">
            {canSeeAllLeads && (
              <Button 
                variant={activeView === 'leads' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('leads')}
                className="flex items-center gap-2 transition-none"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">All Leads</span>
              </Button>
            )}
            {canSeeMyDashboard && (
              <Button 
                variant={activeView === 'my-dashboard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('my-dashboard')}
                className="flex items-center gap-2 transition-none"
              >
                <UserCircle className="h-4 w-4" />
                <span className="hidden sm:inline">My Dashboard</span>
              </Button>
            )}
            {canSeeTeamView && (
              <Button 
                variant={activeView === 'team-dashboard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('team-dashboard')}
                className="flex items-center gap-2 transition-none"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Team View</span>
              </Button>
            )}
            {/* See Agents - Admin only */}
            {isAdmin && (
              <Button 
                variant={activeView === 'agents-view' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('agents-view')}
                className="flex items-center gap-2 transition-none"
              >
                <UsersRound className="h-4 w-4" />
                <span className="hidden sm:inline">See Agents</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content based on view - Using CSS visibility for instant switching */}
      <div className={activeView === 'leads' ? 'block' : 'hidden'}>
        <div className="space-y-4">
          {/* Sales Executive Header - Non-Admin with view permissions */}
          {!isAdmin && canSeeMyDashboard && (
            <SalesExecutiveHeader
              onLeadClaimed={() => fetchLeads()}
            />
          )}

          <LeadsFilters
            filter={filter}
            onFilterChange={setFilter}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onRefresh={fetchLeads}
            onMigrate={migrateFromAbandonedCarts}
            onExport={handleExport}
            leadCounts={leadCounts}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            assignmentFilter={assignmentFilter}
            onAssignmentFilterChange={setAssignmentFilter}
            assignmentCounts={assignmentCounts}
            sortOption={sortOption}
            onSortChange={setSortOption}
            salesUsers={salesUsers}
            agentFilter={agentFilter}
            onAgentFilterChange={setAgentFilter}
            agentLeadCounts={agentLeadCounts}
          />
          
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* Sticky Control Bar */}
              <LeadsTableControlBar
                totalItems={pagination.totalItems}
                pageSize={pagination.pageSize}
                onPageSizeChange={pagination.setPageSize}
                selectedCount={selectedLeads.size}
                totalVisible={pagination.paginatedData.length}
                allSelected={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                onSelectAll={handleSelectAll}
                salesUsers={canAssignLeads ? salesUsers : []}
                onBulkAssign={canAssignLeads ? handleBulkAssign : undefined}
                onBulkAutoAssign={canAssignLeads ? handleBulkAutoAssign : undefined}
              />
              
              <LeadsTable
                leads={pagination.paginatedData}
                tags={tags}
                salesUsers={salesUsers}
                canAssignLeads={canAssignLeads}
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
                onUpdateCallCount={updateCallCount}
                onRefresh={fetchLeads}
                onSendQuote={handleSendQuote}
              />
              
              {/* Lightweight Footer Pagination */}
              <LeadsTableFooter
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
                onPageChange={pagination.goToPage}
                canGoNext={pagination.canGoNext}
                canGoPrev={pagination.canGoPrev}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lazy-mount views - only render when active to reduce memory/CPU for multi-user */}
      {activeView === 'my-dashboard' && (
        <SalespersonDashboard 
          leads={leads}
          tags={tags}
          salesUsers={salesUsers}
          handlers={leadHandlers}
        />
      )}
      
      {activeView === 'team-dashboard' && (
        <ManagerDashboard />
      )}
      
      {/* Agents View - Admin only */}
      {isAdmin && activeView === 'agents-view' && (
        <AgentsLeadsView 
          leads={leads}
          salesUsers={salesUsers}
          viewerRole={userRole}
        />
      )}
    </div>
  );
};
