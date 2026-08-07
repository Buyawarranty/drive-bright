import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { isToday, isPast } from 'date-fns';
import { useLeadAccessRequests } from '@/hooks/useLeadAccessRequests';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { RepeatCustomerBanner } from './RepeatCustomerBanner';
import { PendingAccessRequestsPanel } from './PendingAccessRequestsPanel';
import { QuotesSentPanel } from '@/components/admin/QuotesSentPanel';
import { PaymentFailedLeadsPanel } from './PaymentFailedLeadsPanel';
import { DateRange } from 'react-day-picker';
import { UnifiedDateFilter, periodToRange, type PeriodKey, type DateScope } from '@/components/admin/UnifiedDateFilter';

import { toast } from 'sonner';
import { cn } from '@/lib/utils';
// Tabs import removed - using custom button toggle
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useLeads, Lead } from '@/hooks/useLeads';
import { LeadsTable } from './LeadsTable';
import { OpenLeadPoolBar } from './OpenLeadPoolBar';
import { OvernightQueueBanner } from './OvernightQueueBanner';
import { useOvernightQueue } from '@/hooks/useOvernightQueue';
import { CallbackBanner } from './CallbackBanner';
import { LeadsFilters, AssignmentFilter, SortOption, SourceFilter } from './LeadsFilters';
import { useActiveCheckoutStruggles, buildStruggleByLeadId } from '@/hooks/useActiveCheckoutStruggles';
import { MissedCallAlertBar } from '@/components/admin/MissedCallAlertBar';
import { LiveLeadTrackingPanel } from './LiveLeadTrackingPanel';
type LeadFilterType = import('@/hooks/useLeads').LeadStatus | 'all' | 'all_leads' | 'live' | 'high_priority' | 'fake' | 'lost' | 'quote_sent' | 'urgent_callback' | 'converted' | 'callbacks' | 'recovered' | 'reminders' | 'due_today' | 'checkout_struggle' | 'repeat_today' | 'not_spoken_to';
import { LeadsTableFooter } from './LeadsTableFooter';
import { SalespersonDashboard } from './SalespersonDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { AgentsLeadsView } from './AgentsLeadsView';
import { TeamsOverview } from './TeamsOverview';
import { SalesAgentDashboard } from '../sales/SalesAgentDashboard';
import { SalesExecutiveHeader } from './distribution';
import { LeadsPerAgentTab } from './LeadsPerAgentTab';
import { AdminNotificationBell, AdminNotification } from '@/components/admin/AdminNotificationBell';
import ClaimRecontactBatchButton from './ClaimRecontactBatchButton';
import UnsubscribeQuickLink from '@/components/admin/UnsubscribeQuickLink';
import { buildWatiRows } from '@/lib/watiExport';
import { LeadNotesExportDialog } from '@/components/admin/leads/LeadNotesExportDialog';

import { Users, UserCircle, LayoutDashboard, Download, FileSpreadsheet, Archive, UsersRound, Ban, XCircle, RotateCcw, ShieldCheck, MoreHorizontal, BarChart3, Network, ChevronDown, ChevronUp } from 'lucide-react';
import { BulkReassignDialog } from './BulkReassignDialog';
import { ManualAddLeadDialog } from './ManualAddLeadDialog';

import { QuoteDetailIssuesAlert } from './QuoteDetailIssuesAlert';
import { FakeLeadsAuditPanel } from './FakeLeadsAuditPanel';
import { TeamChangeNoticeDialog } from './TeamChangeNoticeDialog';
import { TeamFilterChips } from './TeamFilterChips';
import { TeamSourceBreakdown } from './TeamSourceBreakdown';
import { useGlobalTeamFilter } from '@/hooks/useGlobalTeamFilter';
import { useAgentTeams, TEAM_COLOR_CLASSES } from '@/hooks/useAgentTeams';
import { useSalesLeadTeamVisibility } from '@/hooks/useSalesLeadTeamVisibility';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useLeadRoutingPermission } from '@/hooks/useLeadRoutingPermission';
import { useDataExport } from '@/hooks/useDataExport';
import { LeadsFullExportMenu } from './LeadsFullExportMenu';

import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { useEnhancedPresence } from '@/hooks/useEnhancedPresence';
import { useAdminConfig } from '@/hooks/useAdminConfig';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useDailyLeadStatsSnapshot } from '@/hooks/useDailyLeadStatsSnapshot';
import { EyeOff, Eye, Wifi, Check, MessageCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { getLeadFeedRangeBoundaries, getSince6pmYesterdayRange, getTodayLeadFeedSelectionDate, isDateInLeadFeedRange, shiftLeadFeedSelectionDate } from '@/lib/leadFeedDate';

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

const AttendanceQuickLink: React.FC = () => {
  const [, setSearchParams] = useSearchParams();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setSearchParams({ tab: 'attendance' })}
      className="h-7 px-2 sm:px-2.5 text-[11px] font-medium rounded-md gap-1.5 transition-none text-green-700 hover:bg-green-50"
      title="See who is live in the CRM"
    >
      <Wifi className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Attendance</span>
    </Button>
  );
};


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
  const isAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_lead' || userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager';
  const isAdminOrSuperAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager';
  const isDigitalAccess = userRole === 'super_admin' || userRole === 'admin' || userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager' || hasGranularPermission('google-ads', 'view') === true;
  const isSalesAgent = userRole === 'sales';
  const isLeadGenUser = userRole === 'lead_gen';
  // Managers/leads can see other agents' rows; a plain agent only ever sees their own.
  const isManagerView = isAdmin || userRole === 'sales_manager';
  
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

  // Team filter (Red / Blue / Green). Shared globally with the sidebar switcher.
  const [teamFilter, setTeamFilter] = useGlobalTeamFilter();
  // Managers always land on "All teams" for New Leads — clear any persisted
  // team scope once per mount. They can still switch teams manually after.
  const mgrTeamResetRef = useRef(false);
  useEffect(() => {
    if (mgrTeamResetRef.current) return;
    const isMgr =
      userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager';
    if (isMgr && teamFilter) {
      setTeamFilter(null);
    }
    mgrTeamResetRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);
  const canSeeLeadsPerAgent = userRole === 'super_admin' || userRole === 'admin' || userRole === 'sales_manager' || userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager';
  const { byAgent: agentTeamMap, allTeams, workstreamsByAgent } = useAgentTeams();
  // Sales leads are locked to their own team. They can't switch teams; the filter is forced.
  // Unassigned sales leads are not auto-placed into any team — they remain pending.
  const myTeam = useMemo(() => {
    if (!currentAdminId) return null;
    return agentTeamMap.get(currentAdminId) || null;
  }, [currentAdminId, agentTeamMap]);
  // Management can grant a sales_lead access to view other teams' lead flows.
  // When at least one extra team is granted, we unlock the chip row for that
  // sales_lead (limited to own team + granted teams).
  const { teamIds: grantedExtraTeamIds } = useSalesLeadTeamVisibility(
    userRole === 'sales_lead' ? currentAdminId : null
  );
  const visibleTeamIdsForChips = useMemo(() => {
    const ids = new Set<string>();
    if (myTeam) ids.add(myTeam.id);
    grantedExtraTeamIds.forEach(id => ids.add(id));
    return Array.from(ids);
  }, [myTeam, grantedExtraTeamIds]);
  const hasMultiTeamAccess =
    userRole === 'sales_lead' && visibleTeamIdsForChips.length > 1;
  const isLockedToOwnTeam =
    ((userRole === 'sales_lead' && !hasMultiTeamAccess) || userRole === 'sales') && !!myTeam;
  // Enforce team constraints only when the constraint itself changes
  // (role, own team, or granted visibility). Do NOT include `teamFilter` in
  // deps — otherwise every management click on Red/Blue/Green would re-fire
  // this effect and snap the filter back, producing a visible flicker on the
  // sidebar switcher for admins who happen to share a hook update cycle.
  const teamFilterRef = useRef(teamFilter);
  useEffect(() => { teamFilterRef.current = teamFilter; }, [teamFilter]);
  useEffect(() => {
    const current = teamFilterRef.current;
    if (isLockedToOwnTeam && myTeam && current !== myTeam.id) {
      setTeamFilter(myTeam.id);
      return;
    }
    // If sales_lead has multi-team access but current filter is outside the allowed set, reset.
    if (
      hasMultiTeamAccess &&
      current &&
      !visibleTeamIdsForChips.includes(current)
    ) {
      setTeamFilter(myTeam?.id ?? null);
    }
  }, [isLockedToOwnTeam, myTeam, setTeamFilter, hasMultiTeamAccess, visibleTeamIdsForChips]);

  
  
  // Delete permission - explicit granular permission ONLY (no role auto-grants delete)
  // Sales Lead, Admin, Super Admin should NOT have delete by default
  const canDelete = hasGranularPermission('new-leads', 'delete') === true;
  
  // Assign permission — per-agent "Staff Lead Access" control (managers always
  // pass; sales/sales_lead only when their cap flag is on). See StaffLeadAccessPanel.
  const { canReassign: canAssignLeads } = useLeadRoutingPermission();
  
  // Export permission - admin, super_admin, performance_manager, sales_manager, lead_gen
  const canExport =
    userRole === 'super_admin' ||
    userRole === 'admin' ||
    userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager' ||
    userRole === 'sales_manager' ||
    userRole === 'lead_gen';
  
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
  
  const [activeView, setActiveView] = useState<'leads' | 'my-dashboard' | 'team-dashboard' | 'agents-view' | 'teams-overview' | 'leads-per-agent'>(getDefaultView());
  const [activeFilter, setActiveFilter] = useState<LeadFilterType>('live');
  // Multi-select support: extra pills the user has toggled on top of the
  // primary activeFilter. The table shows the union across activeFilter +
  // additionalFilters. Kept separate from activeFilter so the useLeads hook,
  // server callback optimisation, and every legacy `filter === ...` branch
  // continue to behave as before.
  const [additionalFilters, setAdditionalFilters] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [leadNotesExportOpen, setLeadNotesExportOpen] = useState(false);
  // Managers (admin / super_admin / sales_manager) default to "today" so the
  // New Leads view always opens on the current day. Everyone else keeps
  // "all time" so agents see their full queue.
  const isManagerRole =
    userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager';
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined; exact?: boolean }>(() => {
    if (isManagerRole) {
      const r = periodToRange('today');
      return { from: r?.from, to: r?.to };
    }
    return { from: undefined, to: undefined };
  });
  const [datePeriod, setDatePeriod] = useState<PeriodKey>(isManagerRole ? 'today' : 'all');
  // Manager-only: "Since 6pm yesterday" filter — pins from 18:00 London yesterday to now.
  const [since6pmActive, setSince6pmActive] = useState(false);
  // "Worked in this period" — matches the date window against last_contacted_at as
  // well as the submission date, so leads that came in weeks ago but were called
  // today (recontact / renewal work) stay visible instead of vanishing on "Today".
  const [includeWorkedInPeriod, setIncludeWorkedInPeriod] = useState(false);

  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('latest_submitted');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [reminderLeadIds, setReminderLeadIds] = useState<Set<string>>(new Set());
  const [reminderTimesMap, setReminderTimesMap] = useState<Record<string, string>>({});
  const [notSpokenTagId, setNotSpokenTagId] = useState<string | null>(null);
  const [notSpokenLeadIds, setNotSpokenLeadIds] = useState<Set<string>>(new Set());
  const [initialLoaderExpired, setInitialLoaderExpired] = useState(false);
  const [showFakeAudit, setShowFakeAudit] = useState(true);
  const [showRoutingDialog, setShowRoutingDialog] = useState(false);
  const canManageRouting =
    userRole === 'super_admin' ||
    userRole === 'admin' ||
    userRole === 'sales_manager' ||
    userRole === 'lead_gen';
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
    serverIncludeContactedInRange: includeWorkedInPeriod,
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

  // Handle filter change (single-select code path — used when the user picks
  // via legacy handlers like nav shortcuts). Clears additional pills.
  const handleFilterChange = useCallback((newFilter: LeadFilterType) => {
    setActiveFilter(newFilter);
    setFilter(newFilter as any);
    setAdditionalFilters(new Set());
    // Auto-switch sort when entering/leaving reminders view
    if (newFilter === 'reminders' || newFilter === 'due_today') {
      setSortOption('reminder_soonest');
    } else if (sortOption === 'reminder_soonest' || sortOption === 'reminder_latest') {
      setSortOption('latest_submitted');
    }
  }, [setFilter, sortOption]);

  // Multi-select toggle used by the pill strip. Keeps at least one pill
  // active — clicking the sole active pill is a no-op. Clicking any other
  // pill adds/removes it from the additionalFilters set. Clicking the
  // primary activeFilter while extras exist promotes an extra to primary
  // so the useLeads hook always has a valid representative filter.
  const handleTogglePill = useCallback((value: string) => {
    if (value === activeFilter) {
      if (additionalFilters.size === 0) return; // Must keep one pill active.
      const rest = new Set(additionalFilters);
      const [promoted] = rest;
      rest.delete(promoted);
      setActiveFilter(promoted as LeadFilterType);
      setFilter(promoted as any);
      setAdditionalFilters(rest);
      return;
    }
    setAdditionalFilters(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
    // Auto-switch sort when reminders/due_today enters the selection.
    if ((value === 'reminders' || value === 'due_today') && !additionalFilters.has(value)) {
      setSortOption('reminder_soonest');
    }
  }, [activeFilter, additionalFilters, setFilter]);

  const selectedFilters = useMemo(() => {
    const s = new Set<string>(additionalFilters);
    s.add(activeFilter);
    return s;
  }, [activeFilter, additionalFilters]);

  // Overnight ORR queue — leads created outside working hours (or on a closed
  // weekend/bank holiday) parked with `intake_class = 'overnight'`. Shared
  // across the row badge, the filter chip and the manager banner.
  const { data: overnightQueue } = useOvernightQueue();
  const overnightIds = overnightQueue?.ids ?? new Set<string>();

  const handleDateFilterChange = useCallback(({ period, customRange }: { scope: DateScope; period: PeriodKey; customRange: DateRange | undefined }) => {
    setSince6pmActive(false);
    setDatePeriod(period);
    if (period === 'all') {
      setDateRange({ from: undefined, to: undefined });
    } else if (period === 'custom') {
      setDateRange({ from: customRange?.from, to: customRange?.to });
    } else {
      const r = periodToRange(period);
      setDateRange({ from: r?.from, to: r?.to });
    }
  }, []);

  // Stable object for the date picker — a fresh object each render would make the
  // picker re-seed its draft mid-selection on every re-render of this busy tab.
  const unifiedCustomRange = useMemo<DateRange | undefined>(
    () => (dateRange?.from || dateRange?.to ? { from: dateRange.from, to: dateRange.to } : undefined),
    [dateRange?.from?.getTime(), dateRange?.to?.getTime()],
  );

  const activateSince6pmYesterday = useCallback(() => {
    const r = getSince6pmYesterdayRange();
    setDateRange({ from: r.from, to: r.to, exact: true });
    setDatePeriod('custom');
    setSince6pmActive(true);
  }, []);

  const struggleByLeadIdRef = useRef<Map<string, unknown>>(new Map());

  // "Back in this period": an older lead whose customer came back and completed
  // the form again (or was active) inside the selected date range. These rows are
  // deliberately anchored to their original created_at everywhere else, so without
  // this pill a day made up entirely of returning customers looks like "no leads".
  const isRepeatActivityInRange = useCallback((lead: Lead) => {
    const stamp = lead.last_resubmitted_at || lead.last_activity_date;
    if (!stamp) return false;
    const d = new Date(stamp);
    if (Number.isNaN(d.getTime())) return false;
    if (!dateRange.from && !dateRange.to) return true;
    return isDateInLeadFeedRange(d, dateRange);
  }, [dateRange]);

  // True when the lead was contacted inside the selected window AND is still owned
  // by the person whose view we're in. Used by the "Worked in this period" toggle so
  // older leads an agent actually called today don't disappear behind the created-date
  // window — but leads that have since been reassigned to someone else never come
  // back into the original agent's list.
  const wasContactedInRange = useCallback((lead: Lead) => {
    if (!includeWorkedInPeriod) return false;
    const stamp = (lead as { last_contacted_at?: string | null }).last_contacted_at;
    if (!stamp) return false;
    const owner = lead.assigned_to ?? null;
    // Never resurface unassigned leads through this toggle.
    if (!owner) return false;
    // Manager looking at one agent: only that agent's current leads.
    if (agentFilter && agentFilter !== 'all' && owner !== agentFilter) return false;
    // Agent's own view: only leads they still own (reassigned ones stay gone).
    if (!isManagerView && currentAdminId && owner !== currentAdminId) return false;
    const d = new Date(stamp);
    if (Number.isNaN(d.getTime())) return false;
    if (!dateRange.from && !dateRange.to) return true;
    return isDateInLeadFeedRange(d, dateRange);
  }, [includeWorkedInPeriod, dateRange, agentFilter, isManagerView, currentAdminId]);





  const applyStatusFilter = useCallback((inputLeads: Lead[]) => {
    // Per-pill predicate. Called for every active pill; a lead passes if it
    // matches ANY selected pill (union). Kept in sync with the original
    // switch statement above.
    const matchesPill = (lead: Lead, pill: string): boolean => {
      if (pill === 'reminders') return reminderLeadIds.has(lead.id);
      if (pill === 'due_today') {
        const rt = reminderTimesMap[lead.id];
        if (!rt) return false;
        const d = new Date(rt);
        return isToday(d) || isPast(d);
      }
      if (pill === 'checkout_struggle') return struggleByLeadIdRef.current.has(lead.id);
      if (pill === 'repeat_today') return isRepeatActivityInRange(lead);
      if (pill === 'not_spoken_to') return notSpokenLeadIds.has(lead.id);
      if (pill === 'overnight_queue') return overnightIds.has(lead.id);
      switch (pill) {
        case 'all':
        case 'all_leads':
          return true;
        case 'live':
          return lead.status !== 'lost' && lead.status !== 'fake_lead';
        case 'high_priority':
          return (lead.priority === 'high' || lead.priority === 'urgent') && lead.status !== 'lost' && lead.status !== 'fake_lead';
        case 'fake':
          return lead.status === 'fake_lead';
        case 'lost':
          return lead.status === 'lost';
        case 'callbacks':
          return lead.is_callback === true;
        case 'recovered':
          return !!lead.abandoned_cart_id && !lead.assigned_at && !lead.step_two_completed_at;
        case 'new':
          return lead.status === 'new' && !((lead.resubmission_count || 0) > 0);
        default:
          return (lead.status as string) === pill;
      }
    };
    // If any 'all/all_leads' pill is selected, short-circuit — no filter.
    if (selectedFilters.has('all') || selectedFilters.has('all_leads')) {
      return inputLeads;
    }
    return inputLeads.filter(lead => {
      for (const pill of selectedFilters) {
        if (matchesPill(lead, pill)) return true;
      }
      return false;
    });
  }, [selectedFilters, reminderLeadIds, reminderTimesMap, notSpokenLeadIds, overnightIds, isRepeatActivityInRange]);

  // Hard-exclude fake_lead, lost, and not_interested everywhere unless the user
  // is explicitly viewing that pill (or All Leads). Prior versions only filtered
  // these at pill predicates, so search fallbacks, team filters and workstream
  // views leaked them back into the table after they were marked. Lost / not
  // interested leads must NEVER resurface in New Leads regardless of team.
  const showAll = selectedFilters.has('all') || selectedFilters.has('all_leads');
  const showFakeLeads = showAll || selectedFilters.has('fake');
  const showLostLeads = showAll || selectedFilters.has('lost');
  const showNotInterested = showAll || selectedFilters.has('not_interested');
  const visibleLeads = useMemo(
    () => leads.filter(lead => {
      const s = lead.status as string;
      if (s === 'archived') return false;
      if (!showFakeLeads && s === 'fake_lead') return false;
      if (!showLostLeads && s === 'lost') return false;
      if (!showNotInterested && s === 'not_interested') return false;
      return true;
    }),
    [leads, showFakeLeads, showLostLeads, showNotInterested]
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

  // Load the "Not spoken to" tag id once so we can drive the pill filter/count.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase.from('lead_tags') as any)
        .select('id, name')
        .ilike('name', 'not spoken to')
        .limit(1)
        .maybeSingle();
      if (!cancelled && !error && data?.id) setNotSpokenTagId(data.id as string);
    })();
    return () => { cancelled = true; };
  }, []);

  // Whenever the visible leads change, pull the set of leads currently tagged
  // "Not spoken to" so the pill count and filter reflect live data.
  useEffect(() => {
    if (!notSpokenTagId || visibleLeads.length === 0) {
      setNotSpokenLeadIds(new Set());
      return;
    }
    let cancelled = false;
    const leadIds = visibleLeads.map(l => l.id);
    (async () => {
      const { data, error } = await (supabase.from('lead_tag_assignments') as any)
        .select('lead_id')
        .eq('tag_id', notSpokenTagId)
        .in('lead_id', leadIds);
      if (cancelled) return;
      if (error) { setNotSpokenLeadIds(new Set()); return; }
      const ids = new Set<string>((data || []).map((r: any) => r.lead_id as string));
      setNotSpokenLeadIds(ids);
    })();
    return () => { cancelled = true; };
  }, [notSpokenTagId, visibleLeads]);


  const statusFilteredLeads = useMemo(
    () => applyStatusFilter(visibleLeads),
    // Re-run when struggle map changes so the 'checkout_struggle' filter stays live
    [visibleLeads, applyStatusFilter, struggleByLeadId]
  );

  // Statuses that mean the sales team has already worked this lead — used
  // by BOTH the date filter and the sort so a customer's resubmission never
  // pulls an already-touched row back into "Today" or bumps it to the top.
  const WORKED_STATUSES_NO_BUBBLE = ['lost', 'not_interested', 'contacted', 'follow_up', 'converted', 'fake_lead', 'callback', 'quoted'];

  // Date used by the "Today / This week / …" range filter.
  // Mirror the sort rule below: a repeat / already-touched lead must NOT be
  // pulled into Today just because the customer resubmitted today — the sales
  // team has already handled it and the row should stay anchored to its
  // original created_at. Only brand-new, unassigned, never-resubmitted leads
  // use last_resubmitted_at.
  const getLeadSubmissionDate = useCallback(
    (lead: Lead) => {
      const alreadyTouched =
        !!lead.assigned_to ||
        WORKED_STATUSES_NO_BUBBLE.includes(lead.status as string) ||
        (lead.resubmission_count || 0) > 0;
      if (alreadyTouched) return new Date(lead.created_at);
      return new Date(lead.last_resubmitted_at || lead.created_at);
    },
    []
  );

  // For sorting: repeat customers should NOT bubble to the top of the list.
  // If the lead has ever been assigned or already has a worked status, the sales
  // team has already contacted them — keep them in their original position so the
  // resubmission doesn't confuse anyone. Any lead with a resubmission also stays put.
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

    // Apply date range filter — but skip it when actively searching, viewing reminders,
    // or viewing "Back in this period" (those rows are matched on their return activity,
    // not their original created_at) so callback and returning leads stay findable
    const isReminderView = (filter as string) === 'reminders' || (filter as string) === 'due_today';
    const isRepeatView = selectedFilters.has('repeat_today');
    if (!debouncedSearchTerm && !isReminderView && !isRepeatView && (dateRange.from || dateRange.to)) {
      result = result.filter(lead => isDateInLeadFeedRange(getLeadSubmissionDate(lead), dateRange) || wasContactedInRange(lead));
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
      if (activeViewMatches.length > 0) {
        result = activeViewMatches;
      } else {
        // Search fallback: bypass tab, workstream, assignment, source AND status
        // filters so a name/phone/email/reg search always surfaces the record —
        // including leads marked lost, not interested or fake. Those are hidden
        // from browsing views on purpose, but an agent typing a customer's name
        // must still be able to find them and see who owns them.
        result = leads.filter(lead => {
          const s = lead.status as string;
          if (s === 'archived') return false;
          return matchesSearch(lead);
        });
      }

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
  }, [statusFilteredLeads, visibleLeads, leads, debouncedSearchTerm, dateRange, assignmentFilter, agentFilter, sortOption, sourceFilter, reminderTimesMap, getLeadSubmissionDate, getLeadSortDate, filter, showFakeLeads, selectedFilters, wasContactedInRange]);
  const isRecoveredLead = useCallback((lead: Lead) => {
    // A lead is "recovered/unworked" only if it came from an abandoned cart,
    // was never assigned to any agent, and never completed step 2
    return !!lead.abandoned_cart_id && !lead.assigned_to && !lead.assigned_at && !lead.step_two_completed_at;
  }, []);

  const canSeeUnworked = userRole === 'super_admin' || userRole === 'admin' || userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager';

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

  // Managers (admin / super_admin / sales_manager / performance_manager) can reassign
  // a lead to ANY agent on ANY team without first switching the team chip.
  // Individual agents / sales_leads stay scoped to their own team.
  const isCrossTeamManager =
    userRole === 'admin' ||
    userRole === 'super_admin' ||
    userRole === 'sales_manager' ||
    userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager';
  const rowAssigneeRoster = isCrossTeamManager ? salesUsers : teamScopedSalesUsers;

  // Pagination for leads table (fresh only)
  const pagination = usePagination(teamFilteredFreshLeads, { initialPageSize: 50 });

  // Cross-team leads that a sales_lead may look at but not modify.
  // Sales agents ('sales' role) are already fetch-scoped to their team +
  // unassigned, so no read-only marking is needed for them.
  const crossTeamReadOnlyIds = useMemo(() => {
    if (userRole !== 'sales_lead' || !myTeam) return undefined;
    const ids = new Set<string>();
    for (const l of pagination.paginatedData as Lead[]) {
      if (!l.assigned_to) continue;
      const t = agentTeamMap.get(l.assigned_to);
      if (t && t.id !== myTeam.id) ids.add(l.id);
    }
    return ids;
  }, [userRole, myTeam, pagination.paginatedData, agentTeamMap]);

  // Separate pagination for unworked leads
  const unworkedPagination = usePagination(recoveredLeads, { initialPageSize: 50 });

  const sourceCountBaseLeads = useMemo(() => {
    let result = statusFilteredLeads;

    if (assignmentFilter === 'awaiting_contact') {
      result = result.filter(lead => !lead.assigned_to);
    } else if (assignmentFilter === 'assigned') {
      result = result.filter(lead => !!lead.assigned_to);
    }

    if (agentFilter !== 'all') {
      result = agentFilter === 'unassigned'
        ? result.filter(lead => !lead.assigned_to)
        : result.filter(lead => lead.assigned_to === agentFilter);
    }

    const isReminderView = (filter as string) === 'reminders' || (filter as string) === 'due_today';
    if (!debouncedSearchTerm && !isReminderView && (dateRange.from || dateRange.to)) {
      result = result.filter(lead => isDateInLeadFeedRange(getLeadSubmissionDate(lead), dateRange) || wasContactedInRange(lead));
    }

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

    if (filter !== 'recovered' && canSeeUnworked) {
      result = result.filter(lead => !isRecoveredLead(lead));
    }

    if (!canSeeUnworked) {
      const seenByEmail = new Map<string, number>();
      const seenByPhone = new Map<string, number>();
      const deduped: typeof result = [];
      const normalizePhone = (phone: string | null | undefined) => {
        if (!phone) return null;
        const digits = phone.replace(/[^0-9]/g, '');
        return digits.length >= 10 ? digits.slice(-10) : null;
      };
      const hasActivity = (lead: typeof result[0]) => lead.assigned_to || lead.call_count > 0 || lead.notes;

      for (const lead of result) {
        const emailKey = lead.email?.toLowerCase()?.trim() || null;
        const phoneKey = normalizePhone(lead.phone);
        const existingIdx = (emailKey ? seenByEmail.get(emailKey) : undefined) ?? (phoneKey ? seenByPhone.get(phoneKey) : undefined);
        if (existingIdx === undefined) {
          const idx = deduped.length;
          if (emailKey) seenByEmail.set(emailKey, idx);
          if (phoneKey) seenByPhone.set(phoneKey, idx);
          deduped.push(lead);
        } else if (!hasActivity(deduped[existingIdx]) && hasActivity(lead)) {
          deduped[existingIdx] = lead;
        }
      }
      result = deduped;
    }

    if (teamFilter) {
      result = result.filter(lead => agentBelongsToTeam(lead.assigned_to, teamFilter));
    }

    return result;
  }, [statusFilteredLeads, assignmentFilter, agentFilter, filter, debouncedSearchTerm, dateRange, getLeadSubmissionDate, visibleLeads, canSeeUnworked, isRecoveredLead, teamFilter, agentBelongsToTeam, wasContactedInRange]);

  const dateFilteredVisibleLeadsForFilters = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return visibleLeads;
    return visibleLeads.filter(lead => isDateInLeadFeedRange(getLeadSubmissionDate(lead), dateRange) || wasContactedInRange(lead));
  }, [visibleLeads, dateRange, getLeadSubmissionDate, wasContactedInRange]);

  // Counts must match the rows the viewer can actually see in the table, otherwise
  // the "Live Leads" pill claims 12 while an agent's list only lists 8. Mirror the
  // same scoping the visible list applies: assignment/agent filter, recovered-lead
  // handling, duplicate collapsing (non-manager roles) and the team chip.
  const countScopedLeads = useMemo(() => {
    let result = dateFilteredVisibleLeadsForFilters;

    if (assignmentFilter === 'awaiting_contact') {
      result = result.filter(lead => !lead.assigned_to);
    } else if (assignmentFilter === 'assigned') {
      result = result.filter(lead => !!lead.assigned_to);
    }

    if (agentFilter !== 'all') {
      result = agentFilter === 'unassigned'
        ? result.filter(lead => !lead.assigned_to)
        : result.filter(lead => lead.assigned_to === agentFilter);
    }

    if (canSeeUnworked) {
      // Managers get a dedicated unworked section, so those rows aren't in the main list.
      if (filter !== 'recovered') result = result.filter(lead => !isRecoveredLead(lead));
    } else {
      // Everyone else sees recovered leads merged in, but duplicates collapsed.
      const seenByEmail = new Map<string, number>();
      const seenByPhone = new Map<string, number>();
      const deduped: typeof result = [];
      const normalizePhone = (phone: string | null | undefined) => {
        if (!phone) return null;
        const digits = phone.replace(/[^0-9]/g, '');
        return digits.length >= 10 ? digits.slice(-10) : null;
      };
      const hasActivity = (lead: typeof result[0]) => lead.assigned_to || lead.call_count > 0 || lead.notes;

      for (const lead of result) {
        const emailKey = lead.email?.toLowerCase()?.trim() || null;
        const phoneKey = normalizePhone(lead.phone);
        const existingIdx = (emailKey ? seenByEmail.get(emailKey) : undefined) ?? (phoneKey ? seenByPhone.get(phoneKey) : undefined);
        if (existingIdx === undefined) {
          const idx = deduped.length;
          if (emailKey) seenByEmail.set(emailKey, idx);
          if (phoneKey) seenByPhone.set(phoneKey, idx);
          deduped.push(lead);
        } else if (!hasActivity(deduped[existingIdx]) && hasActivity(lead)) {
          deduped[existingIdx] = lead;
        }
      }
      result = deduped;
    }

    if (teamFilter) {
      result = result.filter(lead => agentBelongsToTeam(lead.assigned_to, teamFilter));
    }

    return result;
  }, [dateFilteredVisibleLeadsForFilters, assignmentFilter, agentFilter, canSeeUnworked, filter, isRecoveredLead, teamFilter, agentBelongsToTeam]);

  const dateAndStatusFilteredLeads = useMemo(
    () => applyStatusFilter(dateFilteredVisibleLeadsForFilters),
    [dateFilteredVisibleLeadsForFilters, applyStatusFilter]
  );

  // Locked historical snapshot for the selected day (null for today / multi-day ranges).
  const historicalSnapshot = useDailyLeadStatsSnapshot(dateRange);

  const leadCounts = useMemo(() => {
    // "All Leads" = absolute total of every lead created on that date — never changes once the day ends.
    const absoluteTotal = countScopedLeads.length;
    // "Live" = active leads excluding lost, fake, and hidden — the working count agents care about.
    const liveCount = countScopedLeads.filter(
      l => l.status !== 'lost' && l.status !== 'fake_lead' && (l.status as string) !== 'archived'
    ).length;

    const live = {
      all_leads: absoluteTotal,
      all: absoluteTotal,
      live: liveCount,
      total: absoluteTotal,
      new: countScopedLeads.filter(l => l.status === 'new' && !((l.resubmission_count || 0) > 0)).length,
      contacted: countScopedLeads.filter(l => l.status === 'contacted').length,
      follow_up: countScopedLeads.filter(l => l.status === 'follow_up').length,
      quote_sent: countScopedLeads.filter(l => l.status === 'quote_sent').length,
      urgent_callback: countScopedLeads.filter(l => l.status === 'urgent_callback').length,
      callbacks: countScopedLeads.filter(l => l.is_callback === true).length,
      paid: countScopedLeads.filter(l => l.is_paid === true).length,
      lost: countScopedLeads.filter(l => l.status === 'lost').length,
      converted: countScopedLeads.filter(l => l.status === 'converted').length,
      high_priority: countScopedLeads.filter(
        l =>
          (l.priority === 'high' || l.priority === 'urgent') &&
          l.status !== 'lost' &&
          l.status !== 'fake_lead' &&
          (l.status as string) !== 'archived'
      ).length,
      fake: countScopedLeads.filter(l => l.status === 'fake_lead').length,
      reminders: visibleLeads.filter(l => reminderLeadIds.has(l.id)).length,
      due_today: visibleLeads.filter(l => {
        const rt = reminderTimesMap[l.id];
        if (!rt) return false;
        const d = new Date(rt);
        return isToday(d) || isPast(d);
      }).length,
      recovered: countScopedLeads.filter(l => !!l.abandoned_cart_id && !l.assigned_at && !l.step_two_completed_at).length,
      checkout_struggle: visibleLeads.filter(l => struggleByLeadId.has(l.id)).length,
      repeat_today: visibleLeads.filter(l => isRepeatActivityInRange(l)).length,
      not_spoken_to: countScopedLeads.filter(l => notSpokenLeadIds.has(l.id)).length,
      overnight_queue: countScopedLeads.filter(l => overnightIds.has(l.id)).length,
      no_answer: countScopedLeads.filter(l => (l.status as string) === 'no_answer').length,
      left_voicemail: countScopedLeads.filter(l => (l.status as string) === 'left_voicemail').length,
      wrong_number: countScopedLeads.filter(l => (l.status as string) === 'wrong_number').length,
      callback_booked: countScopedLeads.filter(l => (l.status as string) === 'callback_booked').length,
      bought_elsewhere: countScopedLeads.filter(l => (l.status as string) === 'bought_elsewhere').length,
      vehicle_sold: countScopedLeads.filter(l => (l.status as string) === 'vehicle_sold').length,
      do_not_contact: countScopedLeads.filter(l => (l.status as string) === 'do_not_contact').length,
      source_total: sourceCountBaseLeads.length,
      source_google: sourceCountBaseLeads.filter(l => l.lead_source === 'google_ad').length,
      source_facebook: sourceCountBaseLeads.filter(l => l.lead_source === 'social_ad').length,
      source_bing: sourceCountBaseLeads.filter(l => (l.lead_source as string) === 'bing_ad').length,
      source_organic: sourceCountBaseLeads.filter(l => !l.lead_source || l.lead_source === 'website').length,
      source_google_live: sourceCountBaseLeads.filter(l => l.lead_source === 'google_ad' && l.status !== 'lost' && l.status !== 'fake_lead' && (l.status as string) !== 'archived').length,
      source_facebook_live: sourceCountBaseLeads.filter(l => l.lead_source === 'social_ad' && l.status !== 'lost' && l.status !== 'fake_lead' && (l.status as string) !== 'archived').length,
      source_bing_live: sourceCountBaseLeads.filter(l => (l.lead_source as string) === 'bing_ad' && l.status !== 'lost' && l.status !== 'fake_lead' && (l.status as string) !== 'archived').length,
      source_organic_live: sourceCountBaseLeads.filter(l => (!l.lead_source || l.lead_source === 'website') && l.status !== 'lost' && l.status !== 'fake_lead' && (l.status as string) !== 'archived').length,
    };

    // Past-day override: prefer the locked nightly snapshot for status-derived tiles.
    // Live-only tiles (reminders, due_today, checkout_struggle, overnight_queue) stay live.
    if (historicalSnapshot) {
      const LOCKED_KEYS: Array<keyof typeof live> = [
        'all_leads','all','live','total','new','contacted','follow_up','quote_sent',
        'urgent_callback','callbacks','paid','lost','converted','fake',
        'no_answer','left_voicemail','wrong_number','callback_booked',
        'bought_elsewhere','vehicle_sold','do_not_contact','recovered',
        'source_google','source_facebook','source_bing','source_organic',
      ];
      const merged: typeof live = { ...live };
      for (const k of LOCKED_KEYS) {
        const v = historicalSnapshot[k as string];
        if (typeof v === 'number') (merged as any)[k] = v;
      }
      if (typeof historicalSnapshot.all_leads === 'number') {
        merged.all = historicalSnapshot.all_leads;
        merged.total = historicalSnapshot.all_leads;
      }
      return merged;
    }

    return live;
  }, [countScopedLeads, visibleLeads, reminderLeadIds, reminderTimesMap, struggleByLeadId, sourceCountBaseLeads, notSpokenLeadIds, overnightIds, historicalSnapshot, isRepeatActivityInRange]);

  // Assignment counts for the filter dropdown - respects date + active status filter.
  const assignmentCounts = useMemo(() => ({
    total: dateAndStatusFilteredLeads.length,
    awaiting_contact: dateAndStatusFilteredLeads.filter(l => !l.assigned_to).length,
    assigned: dateAndStatusFilteredLeads.filter(l => !!l.assigned_to).length,
  }), [dateAndStatusFilteredLeads]);

  // Agent lead counts show true assignment totals for the selected date range.
  // These MUST be independent of the current agent filter (otherwise selecting
  // an agent scopes the main query and makes the badges shift for everyone else).
  // We run a lightweight parallel query keyed only on date range + team.
  const [agentCountRows, setAgentCountRows] = useState<Array<{ assigned_to: string | null; status: string | null }>>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let query = supabase.from('sales_leads').select('assigned_to, status, created_at, last_resubmitted_at');

      const fromDate = dateRange?.from ? getLeadFeedRangeBoundaries(dateRange).from : undefined;
      const toDate = dateRange?.to ? getLeadFeedRangeBoundaries(dateRange).to : undefined;
      if (fromDate || toDate) {
        const fromIso = fromDate?.toISOString();
        const toIso = toDate?.toISOString();
        const createdParts: string[] = [];
        const resubParts: string[] = [];
        if (fromIso) { createdParts.push(`created_at.gte.${fromIso}`); resubParts.push(`last_resubmitted_at.gte.${fromIso}`); }
        if (toIso) { createdParts.push(`created_at.lte.${toIso}`); resubParts.push(`last_resubmitted_at.lte.${toIso}`); }
        const createdGroup = createdParts.length > 1 ? `and(${createdParts.join(',')})` : createdParts[0];
        const resubGroup = resubParts.length > 1 ? `and(${resubParts.join(',')})` : resubParts[0];
        query = query.or(`${createdGroup},${resubGroup}`);
      }

      const { data, error } = await query.limit(10000);
      if (cancelled) return;
      if (error) {
        console.warn('[NewLeadsTab] agent count query failed', error);
        return;
      }
      setAgentCountRows((data || []) as any);
    };
    load();
    return () => { cancelled = true; };
  }, [dateRange?.from?.getTime(), dateRange?.to?.getTime(), leads.length]);

  const teamScopedAgentCountRows = useMemo(() => {
    if (!teamFilter) return agentCountRows;
    return agentCountRows.filter(r => agentBelongsToTeam(r.assigned_to, teamFilter));
  }, [agentCountRows, teamFilter, agentBelongsToTeam]);

  const agentLeadCounts = useMemo(() => {
    const counts: Record<string, number> = { unassigned: 0 };
    teamScopedAgentCountRows.forEach(row => {
      if (!row.assigned_to) {
        counts.unassigned = (counts.unassigned || 0) + 1;
      } else {
        counts[row.assigned_to] = (counts[row.assigned_to] || 0) + 1;
      }
    });
    return counts;
  }, [teamScopedAgentCountRows]);

  const agentLiveLeadCounts = useMemo(() => {
    const counts: Record<string, number> = { unassigned: 0 };
    teamScopedAgentCountRows.forEach(row => {
      if (row.status === 'lost' || row.status === 'fake_lead' || row.status === 'archived') return;
      if (!row.assigned_to) {
        counts.unassigned = (counts.unassigned || 0) + 1;
      } else {
        counts[row.assigned_to] = (counts[row.assigned_to] || 0) + 1;
      }
    });
    return counts;
  }, [teamScopedAgentCountRows]);

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
  const handleViewChange = useCallback((view: 'leads' | 'my-dashboard' | 'team-dashboard' | 'agents-view' | 'teams-overview' | 'leads-per-agent') => {
    setActiveView(view);
  }, []);

  const handleExport = useCallback((format: 'csv' | 'xlsx') => {
    const isFullExportAllowed =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager' ||
      userRole === 'sales_manager' ||
      userRole === 'lead_gen';
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

  // WATI (WhatsApp) export — management only. Produces WATI's bulk-contact CSV format.
  const handleWatiExport = useCallback(() => {
    const base = selectedLeads.size > 0
      ? filteredLeads.filter(lead => selectedLeads.has(lead.id))
      : filteredLeads;

    const rows = buildWatiRows(base as any, { includeSource: !sourceHidden });
    if (rows.length === 0) {
      toast.error('No leads with a valid mobile number to export');
      return;
    }
    exportToCSV(rows as any, { filename: 'wati-whatsapp-contacts', format: 'csv' });
    const skipped = base.length - rows.length;
    if (skipped > 0) {
      toast.info(`${skipped} lead${skipped === 1 ? '' : 's'} skipped — no valid mobile number or duplicate`);
    }
  }, [selectedLeads, filteredLeads, exportToCSV, sourceHidden]);

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

  // Bulk assign selected leads across SEVERAL agents — strict round-robin,
  // one lead each in order until the selection is used up.
  const handleBulkAssignMulti = useCallback(async (userIds: string[]) => {
    if (selectedLeads.size === 0 || userIds.length === 0) return;

    const leadIds = Array.from(selectedLeads);
    const perAgent = new Map<string, number>();
    const results = await Promise.allSettled(
      leadIds.map((leadId, i) => {
        const userId = userIds[i % userIds.length];
        perAgent.set(userId, (perAgent.get(userId) || 0) + 1);
        return assignLead(leadId, userId);
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    if (successCount > 0) {
      toast.success(
        `Shared ${successCount} lead${successCount > 1 ? 's' : ''} across ${userIds.length} agents`
      );
      setSelectedLeads(new Set());
    } else {
      toast.error('Could not reassign the selected leads');
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
      setDatePeriod('all');
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
  }, [fetchLeads, leads.length, handleFilterChange, setDatePeriod]);

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
      {/* MissedCallAlertBar now mounted globally in AdminDashboard so it shows on every tab */}
      <RepeatCustomerBanner
        leads={teamFilteredFreshLeads}
        currentAdminId={currentAdminId}
        isManager={isCrossTeamManager}
        agentNameById={(id) => {
          const u = salesUsers.find(su => su.id === id);
          if (!u) return undefined;
          return [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || undefined;
        }}
      />
      <QuotesSentPanel currentAdminId={currentAdminId} currentUserRole={userRole} />
      {/* Header — compact, action-dense, grouped card */}

      <div className="rounded-xl border border-border bg-card shadow-sm px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTeamFilter(null);
                handleViewChange('leads');
              }}
              title="Show all leads across every team"
              className="text-lg font-bold tracking-tight hover:text-primary transition-colors cursor-pointer"
            >
              Leads
            </button>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOption('latest_submitted')}
              title="Reset the list order so the newest lead appears at the top"
              className={cn(
                "h-7 px-3 text-[11px] font-semibold gap-1.5",
                sortOption === 'latest_submitted'
                  ? "border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
              )}
            >
              ↓ Newest first
            </Button>
            <UnsubscribeQuickLink />
            {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager') && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleWatiExport}
                title="Export the leads currently shown (or ticked) as a WATI bulk-contact CSV, ready to upload and WhatsApp"
                className="h-7 px-3 text-[11px] font-semibold gap-1.5 border-green-300 bg-green-50 text-green-800 hover:bg-green-100 hover:border-green-400"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Export for WATI (WhatsApp)
              </Button>
            )}
            {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLeadNotesExportOpen(true)}
                title="Export leads with calls attempted and full note history for a chosen date range"
                className="h-7 px-3 text-[11px] font-semibold gap-1.5 border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100 hover:border-purple-400"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Lead with notes
              </Button>
            )}
            <LeadNotesExportDialog
              open={leadNotesExportOpen}
              onOpenChange={setLeadNotesExportOpen}
              leads={(selectedLeads.size > 0 ? filteredLeads.filter(l => selectedLeads.has(l.id)) : filteredLeads) as any}
              sourceHidden={sourceHidden}
            />
            {(() => {
              const inReminders = activeFilter === 'reminders' || (activeFilter as string) === 'due_today';
              const isDefault = sortOption === 'latest_submitted' || (inReminders && sortOption === 'reminder_soonest');
              if (isDefault) return null;
              const labels: Record<string, string> = {
                newest: 'Newest activity',
                oldest: 'Oldest first',
                contacted: 'Contacted first',
                follow_up: 'Follow-up first',
                quote_sent: 'Quote Sent first',
                reminder_soonest: 'Reminder — Soonest',
                reminder_latest: 'Reminder — Latest',
              };
              return (
                <div
                  className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-amber-300 bg-amber-50 text-[11px] font-semibold text-amber-800"
                  title="Your list is not in the default newest-first order. Click X to reset."
                >
                  <span>Sorted by: {labels[sortOption] ?? sortOption}</span>
                  <button
                    type="button"
                    onClick={() => setSortOption(inReminders ? 'reminder_soonest' : 'latest_submitted')}
                    className="ml-0.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-white border border-amber-300 hover:bg-amber-100"
                    aria-label="Reset sort"
                  >
                    ×
                  </button>
                </div>
              );
            })()}
            {(userRole === 'super_admin' || userRole === 'admin' || userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager') && (
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
          {/* Team filter chips — inline in header to save a row.
              Admin / super_admin / sales_manager: full chips (All + every team).
              Sales / sales_lead: locked to their own team (single coloured badge, no switching). */}
          {activeView === 'leads' && (isAdminOrSuperAdmin || userRole === 'sales_manager' || userRole === 'sales_lead' || userRole === 'sales') && allTeams.length > 0 && (
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
                  // Sales agents / leads with a team see a locked badge — no switching.
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
                ) : (userRole === 'sales_lead' || userRole === 'sales') && !myTeam ? (
                  // Unassigned sales agents see a pending badge until a manager places them.
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
                  <TeamFilterChips
                    value={teamFilter}
                    onChange={setTeamFilter}
                    allowedTeamIds={hasMultiTeamAccess ? visibleTeamIdsForChips : undefined}
                  />
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
                  "inline-flex items-center gap-1 text-[11px] font-medium",
                  TEAM_COLOR_CLASSES[allTeams.find(t => t.id === teamFilter)?.color || 'slate'].text
                )}>
                  Scoped to <span className="font-bold">{allTeams.find(t => t.id === teamFilter)?.name}</span>
                  <button
                    type="button"
                    onClick={() => setTeamFilter(null)}
                    title="Clear team filter — show all teams"
                    className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-background border border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                  >
                    <XCircle className="h-3 w-3" />
                  </button>
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

        
        <div className="flex items-center gap-2 flex-wrap">
          {/* Manual Add Lead — available to EVERY user on the New Leads tab.
              Placed first so it never wraps off-screen on narrow widths. */}
          <ManualAddLeadDialog
            salesUsers={teamScopedSalesUsers}
            currentAdminId={currentAdminId}
            canAssignToOthers={canAssignLeads}
            onCreated={fetchLeads}
          />

          {/* Recontact-only: batch claim next 100 oldest unassigned leads */}
          <ClaimRecontactBatchButton onClaimed={fetchLeads} />



          {/* Notification Bell — sales roles only see lead-related notifications */}
          {onMarkAsRead && onMarkAllAsRead && (() => {
            const isAdminRole = userRole === 'admin' || userRole === 'super_admin' || userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager';
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

          {/* Allocate Agents — moved next to notifications */}
          {canManageRouting && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onNavigateToTab?.('lead-teams')}
              className="h-7 px-2.5 text-[11px] gap-1 rounded-md font-semibold shadow-sm"
              title="Assign agents to teams (Red / Blue / Green) and pick the queues they work — New Leads, Recontact, Renewals"
            >
              <Network className="h-3 w-3" /> Allocate Agents
            </Button>
          )}

          {/* Export — all columns, quick date presets, by month, custom range */}
          <LeadsFullExportMenu
            userRole={userRole}
            visibleLeads={filteredLeads}
            allowed={canExport}
            onSimpleExport={handleExport}
            selectedCount={selectedLeads.size}
          />

          {/* Bulk Reassign moved into Allocate Agents (Lead Teams) page */}


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
            {(userRole === 'sales_lead' || userRole === 'super_admin' || userRole === 'admin' || userRole === 'lead_gen' || userRole === 'accounts_manager' || userRole === 'sales_manager' || canSeeTeamView) && (
              <Button
                variant={activeView === 'teams-overview' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('teams-overview')}
                className="h-7 px-2 sm:px-2.5 text-[11px] font-medium rounded-md gap-1.5 transition-none"
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">By Team</span>
              </Button>
            )}
            {canSeeLeadsPerAgent && (
              <Button
                variant={activeView === 'leads-per-agent' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('leads-per-agent')}
                className="h-7 px-2 sm:px-2.5 text-[11px] font-medium rounded-md gap-1.5 transition-none"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Per Agent</span>
              </Button>
            )}
            {(userRole === 'super_admin' || userRole === 'admin' || userRole === 'sales_manager' || userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager' || userRole === 'sales_lead' || userRole === 'claims_manager') && (
              <AttendanceQuickLink />
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

          {/* Per-team source breakdown (last 24h) — management visibility into routing */}
          {(isAdminOrSuperAdmin || userRole === 'sales_manager') && allTeams.length > 0 && (
            <TeamSourceBreakdown teams={allTeams} agentTeamMap={agentTeamMap} />
          )}

          {/* Failed-payment / struggling-checkout claimable leads */}
          <PaymentFailedLeadsPanel userRole={userRole} />

          {/* Search & Filters — full width, search is hero */}
          <LeadsFilters
            filter={activeFilter}
            onFilterChange={handleFilterChange}
            selectedFilters={selectedFilters}
            onToggleFilter={handleTogglePill}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onRefresh={fetchLeads}
            onMigrate={migrateFromAbandonedCarts}
            onExport={handleExport}
            leadCounts={leadCounts}
            assignmentFilter={assignmentFilter}
            onAssignmentFilterChange={setAssignmentFilter}
            assignmentCounts={assignmentCounts}
            sortOption={sortOption}
            onSortChange={setSortOption}
            salesUsers={rowAssigneeRoster}
            agentFilter={agentFilter}
            onAgentFilterChange={setAgentFilter}
            agentLeadCounts={agentLeadCounts}
            agentLiveLeadCounts={agentLiveLeadCounts}
            sourceFilter={sourceFilter}
            onSourceFilterChange={canSeeSourceFilter ? setSourceFilter : undefined}
            showRecoveredPill={isAdminOrSuperAdmin || userRole === 'lead_gen'}
            userRole={userRole}
            // Pagination + selection controls merged into the filter bar
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageSizeChange={pagination.setPageSize}
            selectedCount={selectedLeads.size}
            totalVisible={pagination.paginatedData.length}
            allSelected={selectedLeads.size === freshLeads.length && freshLeads.length > 0}
            onSelectAll={handleSelectAll}
            onBulkAssign={canAssignLeads ? handleBulkAssign : undefined}
            onBulkAssignMulti={canAssignLeads ? handleBulkAssignMulti : undefined}
            onBulkAutoAssign={canAssignLeads ? handleBulkAutoAssign : undefined}
            onBulkMarkFake={handleBulkMarkFake}
            onBulkMarkLost={handleBulkMarkLost}
            onBulkRestore={(userRole === 'super_admin' || userRole === 'admin' || userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager') ? handleBulkRestore : undefined}
          />
          {currentAdminId && <TeamChangeNoticeDialog adminUserId={currentAdminId} />}

          {/* Fake Leads Audit Panel — gated by the 'fake-audit' permission (admin/super_admin always allowed) */}
          {activeFilter === 'fake' && showFakeAudit && (
            userRole === 'super_admin' || userRole === 'admin' || userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager' || hasGranularPermission('new-leads', 'fake-audit') === true
          ) && (
            <FakeLeadsAuditPanel userRole={userRole} currentAdminId={currentAdminId} />
          )}
          <Card className="overflow-hidden border-2 border-border">
            <CardContent className="p-0">
                  {/* Date filter — matches Customer Management dashboard */}
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-muted/20 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</span>
                    <UnifiedDateFilter
                      scope="signup"
                      period={datePeriod}
                      customRange={unifiedCustomRange}
                      availableScopes={['signup']}
                      onChange={handleDateFilterChange}
                    />
                    {isManagerRole && (
                      <button
                        type="button"
                        onClick={activateSince6pmYesterday}
                        title="Show every lead that came in from 6pm yesterday until now — the overnight + pre-shift intake. Use this before 9am to distribute the backlog evenly across the team."
                        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-semibold transition-colors ${
                          since6pmActive
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-foreground border-input hover:bg-muted'
                        }`}
                      >
                        Since 6pm yesterday
                        {since6pmActive && <span className="text-[10px] opacity-80">· manager view</span>}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIncludeWorkedInPeriod(v => !v)}
                      title="Also show older leads that were contacted inside this date window. Turn this on when you called recontact or renewal customers today — their leads came in weeks ago, so the created-date filter hides them."
                      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-semibold transition-colors ${
                        includeWorkedInPeriod
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-background text-foreground border-input hover:bg-muted'
                      }`}
                    >
                      {includeWorkedInPeriod && <Check className="h-3.5 w-3.5" />}
                      Include leads I worked in this period
                    </button>
                  </div>

                  
                  
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

                  {/* Callback requests banner — any agent can see and call */}
                  <div className="px-4 pt-3">
                    <CallbackBanner leads={pagination.paginatedData} />
                  </div>

                  {/* Open Lead Pool control sits directly above the leads table columns. */}
                  <div className="px-4 pt-3">
                    <OpenLeadPoolBar showWhenOff={false} />
                  </div>

                  {/* Overnight ORR queue — parked leads waiting for next 09:00 release */}
                  <div className="px-4 pt-3">
                    <OvernightQueueBanner />
                  </div>


                  <LeadsTable
                    leads={pagination.paginatedData}
                    tags={tags}
                    salesUsers={teamScopedSalesUsers}
                    assignableSalesUsers={rowAssigneeRoster}
                    canAssignLeads={canAssignLeads}
                    canOverrideAssignmentLock={canAssignLeads}
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
                    currentAdminId={currentAdminId}
                    readOnlyLeadIds={crossTeamReadOnlyIds}
                    defaultSortKey="lead_date"
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

          {/* Unworked Leads section removed — the Open Pool ("Take next lead") is the
              single serialised entry point so agents can't cherry-pick and every lead
              carries the pool's assignment deadline. */}


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
      
      {(userRole === 'sales_lead' || userRole === 'super_admin' || userRole === 'admin' || userRole === 'lead_gen' || userRole === 'accounts_manager' || userRole === 'sales_manager' || canSeeTeamView) && activeView === 'teams-overview' && (
        <TeamsOverview
          leads={leads}
          salesUsers={teamScopedSalesUsers}
        />
      )}


      {/* Agents View removed - Lead Split tab retired; use Allocate Agents page */}


      {/* Leads per Agent — daily locked activity stats for management and sales managers */}
      {canSeeLeadsPerAgent && activeView === 'leads-per-agent' && (
        <LeadsPerAgentTab userRole={userRole} currentUserId={currentAdminId} />
      )}

      <LiveLeadTrackingPanel userRole={userRole} />
    </div>

  );
};
