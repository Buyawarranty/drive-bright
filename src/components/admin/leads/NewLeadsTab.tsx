import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLeadAccessRequests } from '@/hooks/useLeadAccessRequests';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { PendingAccessRequestsPanel } from './PendingAccessRequestsPanel';
import { startOfMonth } from 'date-fns';
import { toast } from 'sonner';
// Tabs import removed - using custom button toggle
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLeads, Lead } from '@/hooks/useLeads';
import { LeadsTable } from './LeadsTable';
import { LeadsFilters, AssignmentFilter, SortOption, SourceFilter } from './LeadsFilters';
type LeadFilterType = import('@/hooks/useLeads').LeadStatus | 'all' | 'all_leads' | 'live' | 'high_priority' | 'fake' | 'lost' | 'quote_sent' | 'urgent_callback' | 'converted' | 'callbacks';
import { LeadsTableControlBar } from './LeadsTableControlBar';
import { LeadsTableFooter } from './LeadsTableFooter';
import { SalespersonDashboard } from './SalespersonDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { AgentsLeadsView } from './AgentsLeadsView';
import { SalesAgentDashboard } from '../sales/SalesAgentDashboard';
import { SalesExecutiveHeader } from './distribution';
import { AdminNotificationBell, AdminNotification } from '@/components/admin/AdminNotificationBell';
import { Users, UserCircle, LayoutDashboard, Download, FileSpreadsheet, Archive, UsersRound } from 'lucide-react';
import { BulkReassignDialog } from './BulkReassignDialog';

import { QuoteDetailIssuesAlert } from './QuoteDetailIssuesAlert';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useDataExport } from '@/hooks/useDataExport';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { useEnhancedPresence } from '@/hooks/useEnhancedPresence';
import { useAdminConfig } from '@/hooks/useAdminConfig';

import { getLeadFeedRangeBoundaries, getTodayLeadFeedSelectionDate, isDateInLeadFeedRange } from '@/lib/leadFeedDate';

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
  const isAdminOrSuperAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isDigitalAccess = userRole === 'super_admin' || userRole === 'admin' || hasGranularPermission('google-ads', 'view') === true;
  const isSalesAgent = userRole === 'sales';
  const isLeadGenUser = userRole === 'lead_gen';
  
  // Paid lead lock system — only admin/super_admin bypass the lock
  const isPaidLocked = !isAdminOrSuperAdmin;
  const currentAdminId = useCurrentAdminId();
  const { hasApprovedAccess, hasPendingRequest, requestAccess } = useLeadAccessRequests([], currentAdminId);
  
  const paidLeadAccessCheck = useCallback((leadId: string) => ({
    hasPending: hasPendingRequest(leadId),
    hasApproved: hasApprovedAccess(leadId),
  }), [hasPendingRequest, hasApprovedAccess]);
  
  const handleRequestPaidAccess = useCallback((leadId: string, reason: string) => {
    requestAccess.mutate({ leadId, reason });
  }, [requestAccess]);
  
  // Admin-controlled toggle: whether sales agents can see the "Assigned To" column
  const { value: showAssignmentsToAgents } = useAdminConfig('show_assignments_to_agents');
  const hideAssignedColumnForAgents = isSalesAgent && showAssignmentsToAgents === false;
  
  // Admin-controlled global toggle: force all agents to only see their own leads
  const { value: agentsOwnLeadsOnly } = useAdminConfig('agents_own_leads_only');
  
  
  // Delete permission - explicit granular permission ONLY (no role auto-grants delete)
  // Sales Lead, Admin, Super Admin should NOT have delete by default
  const canDelete = hasGranularPermission('new-leads', 'delete') === true;
  
  // Assign permission - ALL sales roles and admins can ALWAYS assign leads
  // This is a core sales function that must never be blocked by granular permissions
  const canAssignLeads = isAdmin || userRole === 'sales' || userRole === 'sales_lead' || hasGranularPermission('new-leads', 'assign') !== false;
  
  // Export permission - admins always can, others need explicit permission
  const canExport = isAdmin || canExportTab('new-leads') || hasGranularPermission('new-leads', 'export');
  
  // Granular permissions for sub-views
  // hasGranularPermission returns: true (granted), false (denied), undefined (not set)
  const hasAllLeadsPerm = hasGranularPermission('new-leads', 'all-leads');
  const hasTeamViewPerm = hasGranularPermission('new-leads', 'team-view');
  
  // Default behavior:
  // - Sales agents: default to OWN LEADS ONLY unless granted access
  // - Admins/sales_lead: always see all leads
  // - my-dashboard: ALWAYS allowed (shows only user's own leads)
  // - team-view: must be explicitly granted OR sales_lead/admin role gets it automatically
  // Global toggle 'agents_own_leads_only' = true means ALL agents can see all leads
  // Per-agent override: if agent has 'all-leads' permission, they can see all leads regardless
  const canSeeAllLeads = true; // All sales roles see the full leads feed; column restrictions handle role differences
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
  const [activeFilter, setActiveFilter] = useState<LeadFilterType>('live');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(() => {
    const today = getTodayLeadFeedSelectionDate();
    return { from: startOfMonth(today), to: today };
  });
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('latest_submitted');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  
  // Source filter visibility: admin, super_admin, and lead_gen only
  const canSeeSourceFilter = userRole === 'admin' || userRole === 'super_admin' || userRole === 'lead_gen';

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
  } = useLeads({
    serverDateFilter: useMemo(() => {
      if (!dateRange.from && !dateRange.to) return undefined;
      const boundaries = getLeadFeedRangeBoundaries(dateRange);
      return { from: boundaries.from, to: boundaries.to };
    }, [dateRange]),
  });

  // Set default filter on mount + silently import any orphaned carts into sales_leads
  useEffect(() => {
    setFilter('live');
    setActiveFilter('live');
    // Auto-import orphaned abandoned carts so they appear as regular leads
    migrateFromAbandonedCarts(true).catch(() => {});
  }, [setFilter, migrateFromAbandonedCarts]);

  // Handle filter change
  const handleFilterChange = useCallback((newFilter: LeadFilterType) => {
    setActiveFilter(newFilter);
    setFilter(newFilter as any);
  }, [setFilter]);

  const hasMountedDateRangeRef = React.useRef(false);

  // Refetch when date range changes after the initial mount.
  // The initial mount already loads with the current server-side date filter.
  useEffect(() => {
    if (!hasMountedDateRangeRef.current) {
      hasMountedDateRangeRef.current = true;
      return;
    }

    if (dateRange.from || dateRange.to) {
      fetchLeads();
    }
  }, [dateRange, fetchLeads]);

  // Debounce search term to avoid filtering on every keystroke
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const applyStatusFilter = useCallback((inputLeads: Lead[]) => {
    switch (filter) {
      case 'all':
      case 'all_leads':
        // Show ALL leads — absolute total that never fluctuates for past dates
        return inputLeads;
      case 'live':
        return inputLeads.filter(lead => lead.status !== 'lost' && lead.status !== 'fake_lead');
      case 'high_priority':
        return inputLeads.filter(lead => (lead.priority === 'high' || lead.priority === 'urgent') && lead.status !== 'lost' && lead.status !== 'fake_lead');
      case 'fake':
        return inputLeads.filter(lead => lead.status === 'fake_lead');
      case 'lost':
        return inputLeads.filter(lead => lead.status === 'lost');
      case 'callbacks':
        return inputLeads.filter(lead => lead.is_callback === true);
      case 'recovered':
        return inputLeads.filter(lead => !!lead.abandoned_cart_id);
      case 'urgent_callback':
      case 'quote_sent':
      case 'contacted':
      case 'follow_up':
      case 'new':
      case 'converted':
        return inputLeads.filter(lead => lead.status === filter);
      default:
        return inputLeads.filter(lead => lead.status === filter);
    }
  }, [filter]);

  const visibleLeads = useMemo(
    () => leads.filter(lead => (lead.status as string) !== 'archived'),
    [leads]
  );

  const statusFilteredLeads = useMemo(() => applyStatusFilter(visibleLeads), [visibleLeads, applyStatusFilter]);

  const filteredLeads = useMemo(() => {
    let result = statusFilteredLeads;

    // Apply assignment filter
    if (assignmentFilter === 'awaiting_contact') {
      result = result.filter(lead => !lead.assigned_to);
    } else if (assignmentFilter === 'assigned') {
      result = result.filter(lead => !!lead.assigned_to);
    }

    // Apply agent filter
    if (agentFilter !== 'all') {
      if (agentFilter === 'unassigned') {
        result = result.filter(lead => !lead.assigned_to);
      } else {
        result = result.filter(lead => lead.assigned_to === agentFilter);
      }
    }

    // Apply source filter
    if (sourceFilter !== 'all') {
      result = result.filter(lead => lead.lead_source === sourceFilter);
    }

    // Apply date range filter — but skip it when actively searching so leads are always findable
    if (!debouncedSearchTerm && (dateRange.from || dateRange.to)) {
      result = result.filter(lead => isDateInLeadFeedRange(new Date(lead.created_at), dateRange));
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
  }, [statusFilteredLeads, debouncedSearchTerm, dateRange, assignmentFilter, agentFilter, sortOption, sourceFilter]);

  // Pagination for leads table
  const pagination = usePagination(filteredLeads, { initialPageSize: 50 });

  const dateFilteredVisibleLeadsForFilters = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return visibleLeads;
    return visibleLeads.filter(lead => isDateInLeadFeedRange(new Date(lead.created_at), dateRange));
  }, [visibleLeads, dateRange]);

  // Date-filter the raw source-of-truth dataset for accurate counts.
  const dateFilteredLeadsForCounts = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return leads;
    return leads.filter(lead => isDateInLeadFeedRange(new Date(lead.created_at), dateRange));
  }, [leads, dateRange]);

  const dateAndStatusFilteredLeads = useMemo(
    () => applyStatusFilter(dateFilteredVisibleLeadsForFilters),
    [dateFilteredVisibleLeadsForFilters, applyStatusFilter]
  );

  const leadCounts = useMemo(() => {
    // "All Leads" = absolute total of every lead created on that date — never changes once the day ends.
    const absoluteTotal = dateFilteredLeadsForCounts.length;
    // "Live" = active leads excluding lost, fake, and hidden — the working count agents care about.
    const liveCount = dateFilteredLeadsForCounts.filter(
      l => l.status !== 'lost' && l.status !== 'fake_lead' && (l.status as string) !== 'archived'
    ).length;

    return {
      all_leads: absoluteTotal,
      all: absoluteTotal,
      live: liveCount,
      total: absoluteTotal,
      new: dateFilteredLeadsForCounts.filter(l => l.status === 'new').length,
      contacted: dateFilteredLeadsForCounts.filter(l => l.status === 'contacted').length,
      follow_up: dateFilteredLeadsForCounts.filter(l => l.status === 'follow_up').length,
      quote_sent: dateFilteredLeadsForCounts.filter(l => l.status === 'quote_sent').length,
      urgent_callback: dateFilteredLeadsForCounts.filter(l => l.status === 'urgent_callback').length,
      callbacks: dateFilteredLeadsForCounts.filter(l => l.is_callback === true).length,
      paid: dateFilteredLeadsForCounts.filter(l => l.is_paid === true).length,
      lost: dateFilteredLeadsForCounts.filter(l => l.status === 'lost').length,
      converted: dateFilteredLeadsForCounts.filter(l => l.status === 'converted').length,
      high_priority: dateFilteredLeadsForCounts.filter(
        l =>
          (l.priority === 'high' || l.priority === 'urgent') &&
          l.status !== 'lost' &&
          l.status !== 'fake_lead' &&
          (l.status as string) !== 'archived'
      ).length,
      fake: dateFilteredLeadsForCounts.filter(l => l.status === 'fake_lead').length,
      recovered: dateFilteredLeadsForCounts.filter(l => !!l.abandoned_cart_id).length,
      source_google: dateFilteredLeadsForCounts.filter(l => l.lead_source === 'google_ad').length,
      source_facebook: dateFilteredLeadsForCounts.filter(l => l.lead_source === 'social_ad').length,
      source_organic: dateFilteredLeadsForCounts.filter(l => !l.lead_source || l.lead_source === 'website').length,
    };
  }, [dateFilteredLeadsForCounts]);

  // Assignment counts for the filter dropdown - respects date + active status filter.
  const assignmentCounts = useMemo(() => ({
    total: dateAndStatusFilteredLeads.length,
    awaiting_contact: dateAndStatusFilteredLeads.filter(l => !l.assigned_to).length,
    assigned: dateAndStatusFilteredLeads.filter(l => !!l.assigned_to).length,
  }), [dateAndStatusFilteredLeads]);

  // Agent lead counts - respects date + active status filter.
  const agentLeadCounts = useMemo(() => {
    const counts: Record<string, number> = { unassigned: 0 };
    dateAndStatusFilteredLeads.forEach(lead => {
      if (!lead.assigned_to) {
        counts.unassigned = (counts.unassigned || 0) + 1;
      } else {
        counts[lead.assigned_to] = (counts[lead.assigned_to] || 0) + 1;
      }
    });
    return counts;
  }, [dateAndStatusFilteredLeads]);

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

  // Show loading spinner BEFORE role-based routing so sales agents don't see empty state
  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Sales agents now see the same full leads view as sales_lead/admin
  // Role-based column restrictions (CB, Source, etc.) are handled inline below

  return (
    <div className="space-y-4">
      {/* Header — compact, action-dense */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold tracking-tight">Leads</h1>
          <Badge variant="secondary" className="text-[10px] font-mono tabular-nums h-5">{leads.length} total</Badge>
        </div>
        
        <div className="flex items-center gap-2">
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
          
          {/* Export Button */}
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  Export{selectedLeads.size > 0 ? ` (${selectedLeads.size})` : ''}
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

          {/* Bulk Reassign - Admin/Super Admin/Sales Lead only */}
          {isAdmin && (
            <BulkReassignDialog salesUsers={salesUsers} onComplete={fetchLeads} />
          )}

          {/* Archive Button */}
          {canDelete && selectedLeads.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-orange-300 text-orange-700 hover:bg-orange-50">
                  <Archive className="h-3.5 w-3.5" />
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
          
          {/* View Toggle — pill-style, tight */}
          <div className="flex items-center bg-muted/50 border-2 border-border rounded-lg p-0.5">
            {canSeeAllLeads && (
              <Button 
                variant={activeView === 'leads' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('leads')}
                className="h-7 px-2.5 text-[11px] font-medium rounded-md gap-1.5 transition-none"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">All Leads</span>
              </Button>
            )}
            {canSeeMyDashboard && (
              <Button 
                variant={activeView === 'my-dashboard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('my-dashboard')}
                className="h-7 px-2.5 text-[11px] font-medium rounded-md gap-1.5 transition-none"
              >
                <UserCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">My Leads</span>
              </Button>
            )}
            {canSeeTeamView && (
              <Button 
                variant={activeView === 'team-dashboard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('team-dashboard')}
                className="h-7 px-2.5 text-[11px] font-medium rounded-md gap-1.5 transition-none"
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Team</span>
              </Button>
            )}
            {(userRole === 'sales_lead' || userRole === 'super_admin' || userRole === 'admin') && (
              <Button 
                variant={activeView === 'agents-view' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('agents-view')}
                className="h-7 px-2.5 text-[11px] font-medium rounded-md gap-1.5 transition-none"
              >
                <UsersRound className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Agents</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content based on view - Using CSS visibility for instant switching */}
      <div className={activeView === 'leads' ? 'block' : 'hidden'}>
        <div className="space-y-3">
          {/* Sales Executive Header - Non-Admin with view permissions */}
          {!isAdmin && canSeeMyDashboard && (
            <SalesExecutiveHeader
              onLeadClaimed={() => fetchLeads()}
            />
          )}

          {/* Search & Filters — full width, search is hero */}
          <LeadsFilters
            filter={activeFilter}
            onFilterChange={handleFilterChange}
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
            sourceFilter={sourceFilter}
            onSourceFilterChange={canSeeSourceFilter ? setSourceFilter : undefined}
            showRecoveredPill={isAdminOrSuperAdmin || userRole === 'lead_gen'}
          />
          

          <Card className="overflow-hidden border-2 border-border">
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
                  
                  {/* Admin: Show pending paid lead access requests */}
                  {isAdminOrSuperAdmin && currentAdminId && (
                    <PendingAccessRequestsPanel currentAdminUserId={currentAdminId} />
                  )}
                  
                  {/* Quote detail issues flagged by customers — admin only */}
                  {isDigitalAccess && (
                    <div className="px-4 pt-3">
                      <QuoteDetailIssuesAlert />
                    </div>
                  )}

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
                    showFbBadge={isDigitalAccess}
                    showRecoveredBadge={isAdminOrSuperAdmin}
                    showSourceColumn={isAdminOrSuperAdmin || isLeadGenUser}
                    isPaidLocked={isPaidLocked}
                    paidLeadAccessCheck={paidLeadAccessCheck}
                    onRequestPaidAccess={handleRequestPaidAccess}
                    isLeadGenView={isLeadGenUser}
                    hideAssignedColumn={hideAssignedColumnForAgents}
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
      
      {/* Agents View - Sales Lead, Admin & Super Admin only */}
      {(userRole === 'sales_lead' || userRole === 'super_admin' || userRole === 'admin') && activeView === 'agents-view' && (
        <AgentsLeadsView 
          leads={leads}
          salesUsers={salesUsers}
          viewerRole={userRole}
        />
      )}
    </div>
  );
};
