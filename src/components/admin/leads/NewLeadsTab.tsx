import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { isToday, isPast } from 'date-fns';
import { useLeadAccessRequests } from '@/hooks/useLeadAccessRequests';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { PendingAccessRequestsPanel } from './PendingAccessRequestsPanel';
import { PaymentFailedLeadsPanel } from './PaymentFailedLeadsPanel';

import { toast } from 'sonner';
import { cn } from '@/lib/utils';
// Tabs import removed - using custom button toggle
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLeads, Lead } from '@/hooks/useLeads';
import { LeadsTable } from './LeadsTable';
import { LeadsFilters, AssignmentFilter, SortOption, SourceFilter } from './LeadsFilters';
import { useActiveCheckoutStruggles, buildStruggleByLeadId } from '@/hooks/useActiveCheckoutStruggles';
import { MissedCallAlertBar } from '@/components/admin/MissedCallAlertBar';
type LeadFilterType = import('@/hooks/useLeads').LeadStatus | 'all' | 'all_leads' | 'live' | 'high_priority' | 'fake' | 'lost' | 'quote_sent' | 'urgent_callback' | 'converted' | 'callbacks' | 'recovered' | 'reminders' | 'due_today' | 'checkout_struggle';
import { LeadsTableControlBar } from './LeadsTableControlBar';
import { LeadsTableFooter } from './LeadsTableFooter';
import { SalespersonDashboard } from './SalespersonDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { AgentsLeadsView } from './AgentsLeadsView';
import { SalesAgentDashboard } from '../sales/SalesAgentDashboard';
import { SalesExecutiveHeader } from './distribution';
import { AdminNotificationBell, AdminNotification } from '@/components/admin/AdminNotificationBell';
import { Users, UserCircle, LayoutDashboard, Download, FileSpreadsheet, Archive, UsersRound, Ban, XCircle, RotateCcw, ShieldCheck, MoreHorizontal } from 'lucide-react';
import { BulkReassignDialog } from './BulkReassignDialog';

import { QuoteDetailIssuesAlert } from './QuoteDetailIssuesAlert';
import { FakeLeadsAuditPanel } from './FakeLeadsAuditPanel';
import { TeamChangeNoticeDialog } from './TeamChangeNoticeDialog';
import { TeamFilterChips } from './TeamFilterChips';
import { useAgentTeams, TEAM_COLOR_CLASSES } from '@/hooks/useAgentTeams';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useDataExport } from '@/hooks/useDataExport';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { useEnhancedPresence } from '@/hooks/useEnhancedPresence';
import { useAdminConfig } from '@/hooks/useAdminConfig';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { EyeOff, Eye } from 'lucide-react';

import { getLeadFeedRangeBoundaries, getTodayLeadFeedSelectionDate, isDateInLeadFeedRange, shiftLeadFeedSelectionDate } from '@/lib/leadFeedDate';

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

  // Team filter (Red / Blue / Green) — only managers see the chips; default null = no filter.
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const { byAgent: agentTeamMap, allTeams } = useAgentTeams();
  // Sales leads are locked to their own team. They can't switch teams; the filter is forced.
  // Unassigned sales leads are not auto-placed into any team — they remain pending.
  const myTeam = useMemo(() => {
    if (!currentAdminId) return null;
    return agentTeamMap.get(currentAdminId) || null;
  }, [currentAdminId, agentTeamMap]);
  const isLockedToOwnTeam = (userRole === 'sales_lead' || userRole === 'sales') && !!myTeam;
  useEffect(() => {
    if (isLockedToOwnTeam && myTeam && teamFilter !== myTeam.id) {
      setTeamFilter(myTeam.id);
    }
  }, [isLockedToOwnTeam, myTeam, teamFilter]);

  
  
  // Delete permission - explicit granular permission ONLY (no role auto-grants delete)
  // Sales Lead, Admin, Super Admin should NOT have delete by default
  const canDelete = hasGranularPermission('new-leads', 'delete') === true;
  
  // Assign permission - only sales_lead, admin, super_admin can reassign leads to other agents
  const canAssignLeads = isAdmin || userRole === 'sales_lead';
  
  // Export permission - only super_admin and admin can export (sales_lead removed)
  const canExport = userRole === 'super_admin' || userRole === 'admin';
  
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
  const canSeeTeamView = hasTeamViewPerm === true || isAdminOrSuperAdmin; // Admins only; sales_lead must be explicitly granted
  
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
    // Default to All time so agents always see all leads.
    return { from: undefined, to: undefined };
  });
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('latest_submitted');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [reminderLeadIds, setReminderLeadIds] = useState<Set<string>>(new Set());
  const [reminderTimesMap, setReminderTimesMap] = useState<Record<string, string>>({});
  const [initialLoaderExpired, setInitialLoaderExpired] = useState(false);
  const [showFakeAudit, setShowFakeAudit] = useState(true);
  const [showRoutingDialog, setShowRoutingDialog] = useState(false);
  const canManageRouting =
    userRole === 'super_admin' ||
    userRole === 'admin' ||
    userRole === 'sales_manager';
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const reminderLeadIdsForFetch = useMemo(
    () => Array.from(reminderLeadIds).filter(id => !id.startsWith('customer_') && !id.startsWith('cart_') && !id.startsWith('claim_')),
    [reminderLeadIds]
  );
  
  // Source visibility rules
  // - Hide entirely from support@ users
  // - Super admin gets a personal "H" toggle (localStorage) to hide source from their own view
  const { user } = useAuth();
  const userEmail = (user?.email || '').toLowerCase();
  const isSupportUser = userEmail.startsWith('support@');
  const isSuperAdmin = userRole === 'super_admin';
  const [superAdminHideSource, setSuperAdminHideSource] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('newLeads.hideSource.superAdmin') === '1';
  });
  const toggleSuperAdminHideSource = () => {
    setSuperAdminHideSource((prev) => {
      const next = !prev;
      try { localStorage.setItem('newLeads.hideSource.superAdmin', next ? '1' : '0'); } catch {}
      return next;
    });
  };
  // Granular permission: tab_new-leads_see-source.
  // Defaults: super_admin, admin and lead_gen see source. Others don't.
  // Super admin can still locally hide via the H toggle.
  const seeSourceGranular = hasGranularPermission('new-leads', 'see-source');
  const isAdminRole = userRole === 'admin';
  const seeSourceDefault = isSuperAdmin || isAdminRole || isLeadGenUser;
  const seeSourceAllowed = seeSourceGranular === undefined ? seeSourceDefault : seeSourceGranular;
  const sourceVisible =
    !isSupportUser &&
    seeSourceAllowed &&
    !(isSuperAdmin && superAdminHideSource);
  const sourceHidden = !sourceVisible;
  const canSeeSourceFilter = sourceVisible;

  // Fetch active reminder lead IDs for the current admin user
  const fetchReminderLeadIds = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', userData.user.id)
        .maybeSingle();
      if (!adminUser?.id) return;
      const { data } = await (supabase
        .from('lead_reminders' as any)
        .select('lead_id, reminder_time')
        .eq('user_id', adminUser.id)
        .in('status', ['pending', 'snoozed']) as any);
      if (data) {
        setReminderLeadIds(new Set((data as any[]).map((r: any) => r.lead_id)));
        const timesMap: Record<string, string> = {};
        (data as any[]).forEach((r: any) => { timesMap[r.lead_id] = r.reminder_time; });
        setReminderTimesMap(timesMap);
      }
    } catch (err) {
      console.error('Error fetching reminder lead IDs:', err);
    }
  }, []);

  useEffect(() => {
    fetchReminderLeadIds();
    const interval = setInterval(fetchReminderLeadIds, 60000);
    const handleReminderChanged = () => {
      // Small delay to ensure DB write is committed before refetch
      setTimeout(() => fetchReminderLeadIds(), 300);
    };
    window.addEventListener('reminder-changed', handleReminderChanged);
    return () => {
      clearInterval(interval);
      window.removeEventListener('reminder-changed', handleReminderChanged);
    };
  }, [fetchReminderLeadIds]);

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
      // When user explicitly clears the date filter (All Time), pass through
      // undefined so the server returns the most recent leads up to LEADS_LIST_LIMIT.
      if (!dateRange.from && !dateRange.to) {
        return { from: undefined, to: undefined };
      }
      const boundaries = getLeadFeedRangeBoundaries(dateRange);
      return { from: boundaries.from, to: boundaries.to };
    }, [dateRange]),
    serverAgentFilter: agentFilter,
    serverSearchTerm: debouncedSearchTerm,
    serverCallbacksOnly: activeFilter === 'callbacks' && !debouncedSearchTerm.trim(),
    serverLeadIds: reminderLeadIdsForFetch,
  });

  useEffect(() => {
    if (!loading || leads.length > 0) {
      setInitialLoaderExpired(false);
      return;
    }

    const timeoutId = window.setTimeout(() => setInitialLoaderExpired(true), 25000);
    return () => window.clearTimeout(timeoutId);
  }, [loading, leads.length]);

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
    // Auto-switch sort when entering/leaving reminders view
    if (newFilter === 'reminders' || newFilter === 'due_today') {
      setSortOption('reminder_soonest');
    } else if (sortOption === 'reminder_soonest' || sortOption === 'reminder_latest') {
      setSortOption('latest_submitted');
    }
  }, [setFilter, sortOption]);

  const struggleByLeadIdRef = useRef<Map<string, unknown>>(new Map());

  const applyStatusFilter = useCallback((inputLeads: Lead[]) => {
    // Handle reminders filter before the switch since it's not a LeadStatus
    if ((filter as string) === 'reminders') {
      return inputLeads.filter(lead => reminderLeadIds.has(lead.id));
    }
    if ((filter as string) === 'due_today') {
      return inputLeads.filter(lead => {
        const rt = reminderTimesMap[lead.id];
        if (!rt) return false;
        const d = new Date(rt);
        return isToday(d) || isPast(d);
      });
    }
    if ((filter as string) === 'checkout_struggle') {
      return inputLeads.filter(lead => struggleByLeadIdRef.current.has(lead.id));
    }
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
        return inputLeads.filter(lead => !!lead.abandoned_cart_id && !lead.assigned_at && !lead.step_two_completed_at);
      case 'new':
        // Repeat customers (resubmissions) are not "new" — they've been seen before.
        return inputLeads.filter(lead => lead.status === 'new' && !((lead.resubmission_count || 0) > 0));
      case 'urgent_callback':
      case 'quote_sent':
      case 'contacted':
      case 'follow_up':
      case 'converted':
        return inputLeads.filter(lead => lead.status === filter);
      default:
        return inputLeads.filter(lead => lead.status === filter);
    }
  }, [filter, reminderLeadIds, reminderTimesMap]);

  const visibleLeads = useMemo(
    () => leads.filter(lead => (lead.status as string) !== 'archived'),
    [leads]
  );

  // Live checkout struggle alerts (last 24h) joined to visible leads by email/phone/reg
  const { struggles: activeStruggles } = useActiveCheckoutStruggles();
  const struggleByLeadId = useMemo(
    () => buildStruggleByLeadId(visibleLeads, activeStruggles),
    [visibleLeads, activeStruggles]
  );
  useEffect(() => {
    struggleByLeadIdRef.current = struggleByLeadId as Map<string, unknown>;
  }, [struggleByLeadId]);

  const statusFilteredLeads = useMemo(
    () => applyStatusFilter(visibleLeads),
    // Re-run when struggle map changes so the 'checkout_struggle' filter stays live
    [visibleLeads, applyStatusFilter, struggleByLeadId]
  );

  const getLeadSubmissionDate = useCallback(
    (lead: Lead) => new Date(lead.created_at),
    []
  );

  // For sorting: repeat customers should NOT bubble to the top of the list.
  // If the lead has ever been assigned or already has a worked status, the sales
  // team has already contacted them — keep them in their original position so the
  // resubmission doesn't confuse anyone. Any lead with a resubmission also stays put.
  const WORKED_STATUSES_NO_BUBBLE = ['lost', 'not_interested', 'contacted', 'follow_up', 'converted', 'fake_lead', 'callback', 'quoted'];
  const getLeadSortDate = useCallback(
    (lead: Lead) => {
      const alreadyTouched =
        !!lead.assigned_to ||
        WORKED_STATUSES_NO_BUBBLE.includes(lead.status as string) ||
        (lead.resubmission_count || 0) > 0; // repeat customer = keep original position
      if (alreadyTouched) {
        return new Date(lead.created_at);
      }
      return new Date(lead.last_resubmitted_at || lead.created_at);
    },
    []
  );

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

    // Apply date range filter — but skip it when actively searching or viewing reminders so callback leads stay findable
    const isReminderView = (filter as string) === 'reminders' || (filter as string) === 'due_today';
    if (!debouncedSearchTerm && !isReminderView && (dateRange.from || dateRange.to)) {
      result = result.filter(lead => isDateInLeadFeedRange(getLeadSubmissionDate(lead), dateRange));
    }

    // Apply search filter. If the active status/assignment view hides the match,
    // fall back to all loaded non-archived leads so saved callbacks remain findable.
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      const compactTerm = term.replace(/\s+/g, '');
      const digitsTerm = term.replace(/\D/g, '');
      const matchesSearch = (lead: Lead) =>
        lead.email.toLowerCase().includes(term) ||
        (lead.first_name?.toLowerCase().includes(term)) ||
        (lead.last_name?.toLowerCase().includes(term)) ||
        (`${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase().includes(term)) ||
        (lead.phone?.toLowerCase().includes(term)) ||
        (!!digitsTerm && (lead.phone?.replace(/\D/g, '').includes(digitsTerm))) ||
        (lead.vehicle_reg?.toLowerCase().includes(term)) ||
        (!!compactTerm && (lead.vehicle_reg?.toLowerCase().replace(/\s+/g, '').includes(compactTerm))) ||
        (lead.plan_interest?.toLowerCase().includes(term));

      const activeViewMatches = result.filter(matchesSearch);
      result = activeViewMatches.length > 0 ? activeViewMatches : visibleLeads.filter(matchesSearch);
    }

    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case 'reminder_soonest': {
          const aTime = reminderTimesMap[a.id] ? new Date(reminderTimesMap[a.id]).getTime() : Infinity;
          const bTime = reminderTimesMap[b.id] ? new Date(reminderTimesMap[b.id]).getTime() : Infinity;
          return aTime - bTime;
        }
        case 'reminder_latest': {
          const aTime = reminderTimesMap[a.id] ? new Date(reminderTimesMap[a.id]).getTime() : 0;
          const bTime = reminderTimesMap[b.id] ? new Date(reminderTimesMap[b.id]).getTime() : 0;
          return bTime - aTime;
        }
        case 'newest':
          return new Date(b.last_activity_date || getLeadSubmissionDate(b)).getTime() - new Date(a.last_activity_date || getLeadSubmissionDate(a)).getTime();
        case 'latest_submitted':
          return getLeadSortDate(b).getTime() - getLeadSortDate(a).getTime();
        case 'oldest':
          return new Date(a.last_activity_date || getLeadSubmissionDate(a)).getTime() - new Date(b.last_activity_date || getLeadSubmissionDate(b)).getTime();
        case 'contacted':
          if (a.status === 'contacted' && b.status !== 'contacted') return -1;
          if (a.status !== 'contacted' && b.status === 'contacted') return 1;
          return new Date(b.last_activity_date || getLeadSubmissionDate(b)).getTime() - new Date(a.last_activity_date || getLeadSubmissionDate(a)).getTime();
        case 'follow_up':
          if (a.status === 'follow_up' && b.status !== 'follow_up') return -1;
          if (a.status !== 'follow_up' && b.status === 'follow_up') return 1;
          return new Date(b.last_activity_date || getLeadSubmissionDate(b)).getTime() - new Date(a.last_activity_date || getLeadSubmissionDate(a)).getTime();
        case 'quote_sent':
          if (a.status === 'quote_sent' && b.status !== 'quote_sent') return -1;
          if (a.status !== 'quote_sent' && b.status === 'quote_sent') return 1;
          return new Date(b.last_activity_date || getLeadSubmissionDate(b)).getTime() - new Date(a.last_activity_date || getLeadSubmissionDate(a)).getTime();
        default:
          return new Date(b.last_activity_date || getLeadSubmissionDate(b)).getTime() - new Date(a.last_activity_date || getLeadSubmissionDate(a)).getTime();
      }
    });

    return result;
  }, [statusFilteredLeads, visibleLeads, debouncedSearchTerm, dateRange, assignmentFilter, agentFilter, sortOption, sourceFilter, reminderTimesMap, getLeadSubmissionDate, getLeadSortDate, filter]);
  const isRecoveredLead = useCallback((lead: Lead) => {
    // A lead is "recovered/unworked" only if it came from an abandoned cart,
    // was never assigned to any agent, and never completed step 2
    return !!lead.abandoned_cart_id && !lead.assigned_to && !lead.assigned_at && !lead.step_two_completed_at;
  }, []);

  const canSeeUnworked = userRole === 'super_admin';

  const freshLeads = useMemo(() => {
    // When viewing 'recovered' filter, show nothing in main table (all go to unworked section)
    if (filter === 'recovered') return [];
    // Super admin sees separate unworked section — exclude recovered from main list
    if (canSeeUnworked) return filteredLeads.filter(lead => !isRecoveredLead(lead));

    // All other roles: merge recovered leads into main list but deduplicate
    // Group by normalized email AND phone, keep the one with assignment/activity, discard duplicates
    const seenByEmail = new Map<string, number>();
    const seenByPhone = new Map<string, number>();
    const result: typeof filteredLeads = [];

    const normalizePhone = (phone: string | null | undefined) => {
      if (!phone) return null;
      const digits = phone.replace(/[^0-9]/g, '');
      return digits.length >= 10 ? digits.slice(-10) : null;
    };

    const hasActivity = (lead: typeof filteredLeads[0]) =>
      lead.assigned_to || lead.call_count > 0 || lead.notes;

    for (const lead of filteredLeads) {
      const emailKey = lead.email?.toLowerCase()?.trim() || null;
      const phoneKey = normalizePhone(lead.phone);

      const existingByEmail = emailKey ? seenByEmail.get(emailKey) : undefined;
      const existingByPhone = phoneKey ? seenByPhone.get(phoneKey) : undefined;
      const existingIdx = existingByEmail ?? existingByPhone;

      if (existingIdx === undefined) {
        const idx = result.length;
        if (emailKey) seenByEmail.set(emailKey, idx);
        if (phoneKey) seenByPhone.set(phoneKey, idx);
        result.push(lead);
      } else {
        const existing = result[existingIdx];
        if (!hasActivity(existing) && hasActivity(lead)) {
          result[existingIdx] = lead;
          if (emailKey) seenByEmail.set(emailKey, existingIdx);
          if (phoneKey) seenByPhone.set(phoneKey, existingIdx);
        }
      }
    }

    return result;
  }, [filteredLeads, isRecoveredLead, filter, canSeeUnworked]);

  const recoveredLeads = useMemo(() => {
    if (filter === 'recovered') return filteredLeads.filter(lead => isRecoveredLead(lead));
    return filteredLeads.filter(lead => isRecoveredLead(lead));
  }, [filteredLeads, isRecoveredLead, filter]);

  // Team membership is explicit only. Unassigned agents do not fall back to any team.
  const agentBelongsToTeam = useCallback((agentId: string | null | undefined, teamId: string) => {
    if (!agentId) return false;
    const explicit = agentTeamMap.get(agentId);
    return explicit?.id === teamId;
  }, [agentTeamMap]);

  // Apply optional team filter on top of freshLeads (no-op when teamFilter is null).
  const teamFilteredFreshLeads = useMemo(() => {
    if (!teamFilter) return freshLeads;
    return freshLeads.filter(l => agentBelongsToTeam(l.assigned_to, teamFilter));
  }, [freshLeads, teamFilter, agentBelongsToTeam]);

  // Scope sales agents to the selected team so Reassign, agent filter, and the Agents view
  // only act on that team. When no team is selected, behaviour is unchanged.
  const teamScopedSalesUsers = useMemo(() => {
    if (!teamFilter) return salesUsers;
    return salesUsers.filter(u => agentBelongsToTeam(u.id, teamFilter));
  }, [salesUsers, teamFilter, agentBelongsToTeam]);

  // Pagination for leads table (fresh only)
  const pagination = usePagination(teamFilteredFreshLeads, { initialPageSize: 50 });

  // Separate pagination for unworked leads
  const unworkedPagination = usePagination(recoveredLeads, { initialPageSize: 50 });

  const dateFilteredVisibleLeadsForFilters = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return visibleLeads;
    return visibleLeads.filter(lead => isDateInLeadFeedRange(getLeadSubmissionDate(lead), dateRange));
  }, [visibleLeads, dateRange, getLeadSubmissionDate]);

  const dateAndStatusFilteredLeads = useMemo(
    () => applyStatusFilter(dateFilteredVisibleLeadsForFilters),
    [dateFilteredVisibleLeadsForFilters, applyStatusFilter]
  );

  const leadCounts = useMemo(() => {
    // "All Leads" = absolute total of every lead created on that date — never changes once the day ends.
    const absoluteTotal = dateFilteredVisibleLeadsForFilters.length;
    // "Live" = active leads excluding lost, fake, and hidden — the working count agents care about.
    const liveCount = dateFilteredVisibleLeadsForFilters.filter(
      l => l.status !== 'lost' && l.status !== 'fake_lead' && (l.status as string) !== 'archived'
    ).length;

    return {
      all_leads: absoluteTotal,
      all: absoluteTotal,
      live: liveCount,
      total: absoluteTotal,
      new: dateFilteredVisibleLeadsForFilters.filter(l => l.status === 'new' && !((l.resubmission_count || 0) > 0)).length,
      contacted: dateFilteredVisibleLeadsForFilters.filter(l => l.status === 'contacted').length,
      follow_up: dateFilteredVisibleLeadsForFilters.filter(l => l.status === 'follow_up').length,
      quote_sent: dateFilteredVisibleLeadsForFilters.filter(l => l.status === 'quote_sent').length,
      urgent_callback: dateFilteredVisibleLeadsForFilters.filter(l => l.status === 'urgent_callback').length,
      callbacks: dateFilteredVisibleLeadsForFilters.filter(l => l.is_callback === true).length,
      paid: dateFilteredVisibleLeadsForFilters.filter(l => l.is_paid === true).length,
      lost: dateFilteredVisibleLeadsForFilters.filter(l => l.status === 'lost').length,
      converted: dateFilteredVisibleLeadsForFilters.filter(l => l.status === 'converted').length,
      high_priority: dateFilteredVisibleLeadsForFilters.filter(
        l =>
          (l.priority === 'high' || l.priority === 'urgent') &&
          l.status !== 'lost' &&
          l.status !== 'fake_lead' &&
          (l.status as string) !== 'archived'
      ).length,
      fake: dateFilteredVisibleLeadsForFilters.filter(l => l.status === 'fake_lead').length,
      reminders: visibleLeads.filter(l => reminderLeadIds.has(l.id)).length,
      due_today: visibleLeads.filter(l => {
        const rt = reminderTimesMap[l.id];
        if (!rt) return false;
        const d = new Date(rt);
        return isToday(d) || isPast(d);
      }).length,
      recovered: dateFilteredVisibleLeadsForFilters.filter(l => !!l.abandoned_cart_id && !l.assigned_at && !l.step_two_completed_at).length,
      checkout_struggle: visibleLeads.filter(l => struggleByLeadId.has(l.id)).length,
      source_google: dateFilteredVisibleLeadsForFilters.filter(l => l.lead_source === 'google_ad').length,
      source_facebook: dateFilteredVisibleLeadsForFilters.filter(l => l.lead_source === 'social_ad').length,
      source_organic: dateFilteredVisibleLeadsForFilters.filter(l => !l.lead_source || l.lead_source === 'website').length,
      source_google_live: dateFilteredVisibleLeadsForFilters.filter(l => l.lead_source === 'google_ad' && l.status !== 'lost' && l.status !== 'fake_lead').length,
      source_facebook_live: dateFilteredVisibleLeadsForFilters.filter(l => l.lead_source === 'social_ad' && l.status !== 'lost' && l.status !== 'fake_lead').length,
      source_organic_live: dateFilteredVisibleLeadsForFilters.filter(l => (!l.lead_source || l.lead_source === 'website') && l.status !== 'lost' && l.status !== 'fake_lead').length,
    };
  }, [dateFilteredVisibleLeadsForFilters, visibleLeads, reminderLeadIds, reminderTimesMap, struggleByLeadId]);

  // Assignment counts for the filter dropdown - respects date + active status filter.
  const assignmentCounts = useMemo(() => ({
    total: dateAndStatusFilteredLeads.length,
    awaiting_contact: dateAndStatusFilteredLeads.filter(l => !l.assigned_to).length,
    assigned: dateAndStatusFilteredLeads.filter(l => !!l.assigned_to).length,
  }), [dateAndStatusFilteredLeads]);

  // Agent lead counts show true assignment totals for the selected date range.
  // Do not tie these badges to the active status filter, otherwise round-robin
  // looks uneven when agents move leads to Lost/Fake/Converted at different speeds.
  const agentLeadCounts = useMemo(() => {
    const counts: Record<string, number> = { unassigned: 0 };
    dateFilteredVisibleLeadsForFilters.forEach(lead => {
      if (!lead.assigned_to) {
        counts.unassigned = (counts.unassigned || 0) + 1;
      } else {
        counts[lead.assigned_to] = (counts[lead.assigned_to] || 0) + 1;
      }
    });
    return counts;
  }, [dateFilteredVisibleLeadsForFilters]);

  const agentLiveLeadCounts = useMemo(() => {
    const counts: Record<string, number> = { unassigned: 0 };
    dateFilteredVisibleLeadsForFilters.forEach(lead => {
      if (lead.status === 'lost' || lead.status === 'fake_lead' || (lead.status as string) === 'archived') return;
      if (!lead.assigned_to) {
        counts.unassigned = (counts.unassigned || 0) + 1;
      } else {
        counts[lead.assigned_to] = (counts[lead.assigned_to] || 0) + 1;
      }
    });
    return counts;
  }, [dateFilteredVisibleLeadsForFilters]);

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
      if (prev.size === freshLeads.length) {
        return new Set();
      } else {
        return new Set(freshLeads.map(l => l.id));
      }
    });
  }, [freshLeads]);

  // Memoize tab change handler for instant switching
  const handleViewChange = useCallback((view: 'leads' | 'my-dashboard' | 'team-dashboard' | 'agents-view') => {
    setActiveView(view);
  }, []);

  const handleExport = useCallback((format: 'csv' | 'xlsx') => {
    const isFullExportAllowed = userRole === 'admin' || userRole === 'super_admin';
    const isSalesLeadExport = userRole === 'sales_lead';
    
    let baseLeads = selectedLeads.size > 0 
      ? filteredLeads.filter(lead => selectedLeads.has(lead.id))
      : filteredLeads;

    if (isSalesLeadExport) {
      // Sales lead can only export up to 2 months of data
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      baseLeads = baseLeads.filter(lead => new Date(lead.created_at) >= twoMonthsAgo);
    } else if (!isFullExportAllowed) {
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
      ...(sourceHidden ? {} : { 'Source': lead.lead_source }),
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
    for (const leadId of selectedLeads) {
      await updateLeadStatus(leadId, 'archived' as any);
    }
    setSelectedLeads(new Set());
  }, [selectedLeads, updateLeadStatus]);

  // Bulk mark selected leads as fake
  const handleBulkMarkFake = useCallback(async () => {
    if (selectedLeads.size === 0) return;
    const leadIds = Array.from(selectedLeads);
    const results = await Promise.allSettled(
      leadIds.map(leadId => updateLeadStatus(leadId, 'fake_lead' as any))
    );
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    if (successCount > 0) {
      toast.success(`Marked ${successCount} lead${successCount > 1 ? 's' : ''} as Fake 404`);
      setSelectedLeads(new Set());
    }
  }, [selectedLeads, updateLeadStatus]);

  // Bulk mark selected leads as lost
  const handleBulkMarkLost = useCallback(async () => {
    if (selectedLeads.size === 0) return;
    const leadIds = Array.from(selectedLeads);
    const results = await Promise.allSettled(
      leadIds.map(leadId => updateLeadStatus(leadId, 'lost' as any))
    );
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    if (successCount > 0) {
      toast.success(`Marked ${successCount} lead${successCount > 1 ? 's' : ''} as lost`);
      setSelectedLeads(new Set());
    }
  }, [selectedLeads, updateLeadStatus]);

  // Bulk restore selected leads back to new
  const handleBulkRestore = useCallback(async () => {
    if (selectedLeads.size === 0) return;
    const leadIds = Array.from(selectedLeads);
    const results = await Promise.allSettled(
      leadIds.map(leadId => updateLeadStatus(leadId, 'new' as any))
    );
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    if (successCount > 0) {
      toast.success(`Restored ${successCount} lead${successCount > 1 ? 's' : ''}`);
      setSelectedLeads(new Set());
    }
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

  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestoreAllLeads = useCallback(async () => {
    setIsRestoring(true);
    try {
      // Clear all filters to ensure full dataset loads
      setDateRange({ from: undefined, to: undefined });
      setSearchTerm('');
      setAssignmentFilter('all');
      setAgentFilter('all');
      setSourceFilter('all');
      handleFilterChange('live');
      setSortOption('latest_submitted');
      
      // Force a fresh fetch with no date boundaries
      await fetchLeads();
      toast.success(`All leads restored — ${leads.length} leads loaded`);
    } catch (error) {
      toast.error('Failed to restore leads. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  }, [fetchLeads, leads.length, handleFilterChange]);

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
      <MissedCallAlertBar userRole={userRole} />
      {/* Header — compact, action-dense, grouped card */}
      <div className="rounded-xl border border-border bg-card shadow-sm px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">Leads</h1>
            <Badge variant="secondary" className="text-[10px] font-mono tabular-nums h-5">{leads.length} total</Badge>
          </div>
          <div className="h-6 w-px bg-border" aria-hidden />
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                toast.loading('Refreshing leads...', { id: 'refresh-leads' });
                try {
                  await fetchLeads();
                  toast.success('Leads refreshed', { id: 'refresh-leads' });
                } catch (e: any) {
                  toast.error(`Refresh failed: ${e.message}`, { id: 'refresh-leads' });
                }
              }}
              disabled={loading}
              className="h-7 px-3 text-[11px] font-semibold gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
            >
              <RotateCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              {loading ? 'Refreshing...' : 'Refresh Page'}
            </Button>
            {userRole === 'super_admin' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    title="More actions"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem
                    onClick={handleRestoreAllLeads}
                    disabled={isRestoring}
                  >
                    <RotateCcw className={cn("h-4 w-4 mr-2", isRestoring && "animate-spin")} />
                    {isRestoring ? 'Restoring...' : 'Restore All Leads'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        toast.loading('Recovering missing lead data...', { id: 'recover-leads' });
                        const { data, error } = await supabase.rpc('recover_leads_from_step2', { p_lookback_hours: 48 });
                        if (error) throw error;
                        const result = data as any;
                        const parts = [];
                        if (result.updated_leads) parts.push(`${result.updated_leads} leads fixed`);
                        if (result.created_new) parts.push(`${result.created_new} new leads created`);
                        if (result.duplicates_merged) parts.push(`${result.duplicates_merged} duplicates merged`);
                        if (result.updated_carts) parts.push(`${result.updated_carts} carts updated`);
                        toast.success(
                          `Recovery complete: ${parts.length ? parts.join(', ') : 'no changes needed'}`,
                          { id: 'recover-leads', duration: 8000 }
                        );
                        fetchLeads();
                      } catch (err: any) {
                        toast.error(`Recovery failed: ${err.message}`, { id: 'recover-leads' });
                      }
                    }}
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Recover Missing Data
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {/* Team filter chips — inline in header to save a row. Managers only, leads view only. */}
          {activeView === 'leads' && (isAdminOrSuperAdmin || userRole === 'sales_lead') && allTeams.length > 0 && (
            <>
              <div className="h-6 w-px bg-border" aria-hidden />
              <div className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1 transition-colors",
                teamFilter
                  ? {
                      red: 'border-red-200 bg-red-50/60',
                      blue: 'border-blue-200 bg-blue-50/60',
                      green: 'border-emerald-200 bg-emerald-50/60',
                      slate: 'border-slate-200 bg-slate-50/60',
                    }[allTeams.find(t => t.id === teamFilter)?.color || 'slate']
                  : "border-border bg-muted/30"
              )}>
                {isLockedToOwnTeam && myTeam ? (
                  // Sales leads with a team see a locked badge — no switching.
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border',
                      TEAM_COLOR_CLASSES[myTeam.color].pill
                    )}
                    title="You can only view your own team's leads"
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', TEAM_COLOR_CLASSES[myTeam.color].dot)} />
                    {myTeam.name.replace(/^Formula\s+/i, '')}
                    <span className="ml-1 opacity-60 text-[9px] uppercase tracking-wider">Your team</span>
                  </span>
                ) : userRole === 'sales_lead' && !myTeam ? (
                  // Unassigned sales leads see a pending badge until a manager places them.
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border',
                      'bg-amber-100 text-amber-800 border-amber-300'
                    )}
                    title="Awaiting team allocation by a manager"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Pending
                    <span className="ml-1 opacity-60 text-[9px] uppercase tracking-wider">Awaiting team</span>
                  </span>
                ) : (
                  <TeamFilterChips value={teamFilter} onChange={setTeamFilter} />
                )}
                {isSuperAdmin && (
                  <Button
                    type="button"
                    variant={superAdminHideSource ? 'default' : 'outline'}
                    size="sm"
                    onClick={toggleSuperAdminHideSource}
                    title={superAdminHideSource ? 'Source hidden in your view — click to show' : 'Hide source in your view'}
                    className="h-6 px-1.5 text-[10px] font-semibold gap-1"
                  >
                    {superAdminHideSource ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    H
                  </Button>
                )}
              </div>
              {teamFilter && !isLockedToOwnTeam && (
                <span className={cn(
                  "text-[11px] font-medium",
                  TEAM_COLOR_CLASSES[allTeams.find(t => t.id === teamFilter)?.color || 'slate'].text
                )}>
                  Scoped to <span className="font-bold">{allTeams.find(t => t.id === teamFilter)?.name}</span>
                </span>
              )}
            </>
          )}
          {/* H button fallback when no teams exist (super admin only) */}
          {activeView === 'leads' && isSuperAdmin && allTeams.length === 0 && (
            <Button
              type="button"
              variant={superAdminHideSource ? 'default' : 'outline'}
              size="sm"
              onClick={toggleSuperAdminHideSource}
              title={superAdminHideSource ? 'Source hidden in your view — click to show' : 'Hide source in your view'}
              className="h-7 px-2 text-[11px] font-semibold gap-1.5"
            >
              {superAdminHideSource ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              H
            </Button>
          )}
        </div>

        
        <div className="flex items-center gap-2">
          {/* Notification Bell — sales roles only see lead-related notifications */}
          {onMarkAsRead && onMarkAllAsRead && (() => {
            const isAdminRole = userRole === 'admin' || userRole === 'super_admin';
            const filtered = isAdminRole
              ? notifications
              : notifications.filter(n => n.type !== 'claim' && n.type !== 'contact');
            const filteredUnread = filtered.filter(n => !n.is_read).length;
            return (
              <AdminNotificationBell
                notifications={filtered}
                unreadCount={filteredUnread}
                onMarkAsRead={onMarkAsRead}
                onMarkAllAsRead={onMarkAllAsRead}
                onNavigateToTab={onNavigateToTab}
              />
            );
          })()}
          
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

          {/* Bulk Reassign - Admin / Super Admin only (not Sales Lead) */}
          {isAdminOrSuperAdmin && (
            <BulkReassignDialog salesUsers={teamScopedSalesUsers} onComplete={fetchLeads} />
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
            {(userRole === 'sales_lead' || userRole === 'super_admin' || userRole === 'admin' || canSeeTeamView) && (
              <Button 
                variant={activeView === 'agents-view' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('agents-view')}
                className="h-7 px-2 sm:px-2.5 text-[11px] font-medium rounded-md gap-1.5 transition-none"
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
          {/* Team filter chips moved inline to the header above */}

          {/* Subtle "you're in" team badge for sales agents/leads */}
          {(userRole === 'sales' || userRole === 'sales_lead') && myTeam && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>You're in</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${TEAM_COLOR_CLASSES[myTeam.color].pill}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${TEAM_COLOR_CLASSES[myTeam.color].dot}`} />
                {myTeam.name}
              </span>
            </div>
          )}

          {/* Sales Executive Header removed - agents focus on leads only */}
          {/* Failed-payment / struggling-checkout claimable leads */}
          <PaymentFailedLeadsPanel userRole={userRole} />

          {/* Search & Filters — full width, search is hero */}
          <LeadsFilters
            filter={activeFilter}
            onFilterChange={handleFilterChange}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onRefresh={fetchLeads}
            onMigrate={migrateFromAbandonedCarts}
            onExport={handleExport}
            onManageRouting={() => onNavigateToTab?.('lead-teams')}
            canManageRouting={canManageRouting}
            leadCounts={leadCounts}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            assignmentFilter={assignmentFilter}
            onAssignmentFilterChange={setAssignmentFilter}
            assignmentCounts={assignmentCounts}
            sortOption={sortOption}
            onSortChange={setSortOption}
            salesUsers={teamScopedSalesUsers}
            agentFilter={agentFilter}
            onAgentFilterChange={setAgentFilter}
            agentLeadCounts={agentLeadCounts}
            agentLiveLeadCounts={agentLiveLeadCounts}
            sourceFilter={sourceFilter}
            onSourceFilterChange={canSeeSourceFilter ? setSourceFilter : undefined}
            showRecoveredPill={isAdminOrSuperAdmin || userRole === 'lead_gen'}
            userRole={userRole}
          />
          {currentAdminId && <TeamChangeNoticeDialog adminUserId={currentAdminId} />}

          {/* Fake Leads Audit Panel — gated by the 'fake-audit' permission (admin/super_admin always allowed) */}
          {activeFilter === 'fake' && showFakeAudit && (
            userRole === 'super_admin' || userRole === 'admin' || hasGranularPermission('new-leads', 'fake-audit') === true
          ) && (
            <FakeLeadsAuditPanel userRole={userRole} currentAdminId={currentAdminId} />
          )}
          <Card className="overflow-hidden border-2 border-border">
            <CardContent className="p-0">
                  {/* Sticky Control Bar */}
                  <LeadsTableControlBar
                    totalItems={pagination.totalItems}
                    pageSize={pagination.pageSize}
                    onPageSizeChange={pagination.setPageSize}
                    selectedCount={selectedLeads.size}
                    totalVisible={pagination.paginatedData.length}
                    allSelected={selectedLeads.size === freshLeads.length && freshLeads.length > 0}
                    onSelectAll={handleSelectAll}
                    salesUsers={canAssignLeads ? teamScopedSalesUsers : []}
                    onBulkAssign={canAssignLeads ? handleBulkAssign : undefined}
                    onBulkAutoAssign={canAssignLeads ? handleBulkAutoAssign : undefined}
                    onBulkMarkFake={handleBulkMarkFake}
                    onBulkMarkLost={handleBulkMarkLost}
                    onBulkRestore={userRole === 'super_admin' ? handleBulkRestore : undefined}
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
                    salesUsers={teamScopedSalesUsers}
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
                    showSourceColumn={!sourceHidden && (isAdminOrSuperAdmin || isLeadGenUser)}
                    isPaidLocked={isPaidLocked}
                    paidLeadAccessCheck={paidLeadAccessCheck}
                    onRequestPaidAccess={handleRequestPaidAccess}
                    isLeadGenView={false}
                    hideAssignedColumn={hideAssignedColumnForAgents}
                    userRole={userRole}
                    reminderTimesMap={reminderTimesMap}
                    struggleAlertsMap={struggleByLeadId}
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

          {/* Unworked Leads Section — only visible to super_admin */}
          {canSeeUnworked && recoveredLeads.length > 0 && (
            <Card className="overflow-hidden border-2 border-border mt-4">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border">
                  <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">Unworked Leads</h2>
                  <Badge variant="secondary" className="text-[10px] font-mono tabular-nums h-5">{recoveredLeads.length}</Badge>
                </div>

                <LeadsTable
                  leads={unworkedPagination.paginatedData}
                  tags={tags}
                  salesUsers={teamScopedSalesUsers}
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
                  showSourceColumn={!sourceHidden && (isAdminOrSuperAdmin || isLeadGenUser)}
                  isPaidLocked={isPaidLocked}
                  paidLeadAccessCheck={paidLeadAccessCheck}
                  onRequestPaidAccess={handleRequestPaidAccess}
                  isLeadGenView={false}
                  hideAssignedColumn={hideAssignedColumnForAgents}
                  userRole={userRole}
                  reminderTimesMap={reminderTimesMap}
                  struggleAlertsMap={struggleByLeadId}
                />

                <LeadsTableFooter
                  currentPage={unworkedPagination.currentPage}
                  totalPages={unworkedPagination.totalPages}
                  totalItems={unworkedPagination.totalItems}
                  startIndex={unworkedPagination.startIndex}
                  endIndex={unworkedPagination.endIndex}
                  onPageChange={unworkedPagination.goToPage}
                  canGoNext={unworkedPagination.canGoNext}
                  canGoPrev={unworkedPagination.canGoPrev}
                />
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* Lazy-mount views - only render when active to reduce memory/CPU for multi-user */}
      {activeView === 'my-dashboard' && (
        <SalespersonDashboard 
          leads={leads}
          tags={tags}
          salesUsers={teamScopedSalesUsers}
          handlers={leadHandlers}
        />
      )}
      
      {activeView === 'team-dashboard' && (
        <ManagerDashboard />
      )}
      
      {/* Agents View - Sales Lead, Admin, Super Admin & users with team-view permission */}
      {(userRole === 'sales_lead' || userRole === 'super_admin' || userRole === 'admin' || canSeeTeamView) && activeView === 'agents-view' && (
        <AgentsLeadsView 
          leads={leads}
          salesUsers={teamScopedSalesUsers}
          viewerRole={userRole}
        />
      )}
    </div>
  );
};
