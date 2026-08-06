import React, { useState, useCallback, memo, useMemo, useEffect } from 'react';
import { Lead, LeadStatus, LeadPriority, LeadTag, AdminUser } from '@/hooks/useLeads';
import { useLeadQuotes } from '@/hooks/useLeadQuotes';
import { useLeadNoteCounts } from '@/hooks/useLeadNoteCounts';
import { useCustomerActivity } from '@/hooks/useCustomerActivity';
import { useRepeatCustomers } from '@/hooks/useRepeatCustomers';
import { useAgentActivity } from '@/hooks/useAgentActivity';
import { useLeadResponseTime } from '@/hooks/useLeadResponseTime';
import {
  useOpenPoolReservation,
  useReservationCountdown,
} from '@/hooks/useOpenLeadPoolReservation';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LeadDetailsPanel } from './LeadDetailsPanel';
import { LeadTableRow } from './LeadTableRow';
import { useConfirmConverted } from './ConfirmConvertedDialog';

import { TableCell } from '@/components/ui/table';
import { LeadsMobileCards } from './LeadsMobileCards';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ColumnSortKey = 'activity' | 'lead_date' | 'date_added' | 'agent' | 'status';
type ColumnSortDir = 'desc' | 'asc';

// Status importance order: "new" is always first, then in order of how much
// attention the agent should give it. Anything not listed sorts last.
const STATUS_IMPORTANCE: Record<string, number> = {
  new: 0,
  urgent_callback: 1,
  follow_up: 2,
  contacted: 3,
  quote_sent: 4,
  negotiating: 5,
  converted: 6,
  not_interested: 7,
  lost: 8,
  fake_lead: 9,
};

interface LeadsTableProps {
  leads: Lead[];
  tags: LeadTag[];
  salesUsers: AdminUser[];
  /** Cross-team roster for the in-row assignee dropdown (managers see all teams). */
  assignableSalesUsers?: AdminUser[];
  selectedLeads: Set<string>;
  onSelectLead: (leadId: string) => void;
  onSelectAll: () => void;
  onUpdateStatus: (leadId: string, status: LeadStatus) => void;
  onAssign: (leadId: string, userId: string | null) => void;
  onAutoAssign: (leadId: string) => void;
  onUpdatePriority: (leadId: string, priority: LeadPriority) => void;
  onScheduleFollowUp: (leadId: string, actionType: string, actionDate: string) => void;
  onAddTag: (leadId: string, tagId: string) => void;
  onRemoveTag: (leadId: string, tagId: string) => void;
  onUpdateNotes: (leadId: string, notes: string, replaceAll?: boolean) => void | Promise<void>;
  onMarkContacted: (leadId: string) => void;
  onLogActivity: (leadId: string, type: string, description: string) => void;
  onUpdateCallCount: (leadId: string, increment: number) => void;
  onSendQuote?: (lead: Lead) => void;
  onRefresh?: () => void;
  hideAssignedColumn?: boolean;
  canAssignLeads?: boolean;
  canOverrideAssignmentLock?: boolean;
  showFbBadge?: boolean;
  showRecoveredBadge?: boolean;
  showSourceColumn?: boolean;
  isPaidLocked?: boolean;
  paidLeadAccessCheck?: (leadId: string) => { hasPending: boolean; hasApproved: boolean };
  onRequestPaidAccess?: (leadId: string, reason: string) => void;
  isLeadGenView?: boolean;
  userRole?: string | null;
  reminderTimesMap?: Record<string, string>;
  struggleAlertsMap?: Map<string, { signal_type: string; created_at: string }>;
  /** Hide "New" from the row status dropdown (Recontact / Renewals). */
  hideNewStatus?: boolean;
  /** Open Lead Pool: id of the reserved lead that should be pinned + highlighted. */
  pinnedLeadId?: string | null;
  reservedRemainingSec?: number;
  /** Recontact tab flag — suppresses the "status=new + >24h" SLA red tint. */
  recontactMode?: boolean;
  /** admin_users.id of the viewer — used with recontactMode. */
  currentAdminId?: string | null;
  /** Ids for leads the current viewer may look at but not modify (cross-team
   *  visibility for a sales_lead). Interactive controls will no-op and a
   *  "VIEW ONLY" badge will render on the row. */
  readOnlyLeadIds?: Set<string>;
  /** Default column to sort by on first render. Defaults to no explicit sort. */
  defaultSortKey?: ColumnSortKey;
}

export const LeadsTable: React.FC<LeadsTableProps> = memo(({
  leads,
  tags,
  salesUsers,
  assignableSalesUsers,
  selectedLeads,
  onSelectLead,
  onSelectAll,
  onUpdateStatus,
  onAssign,
  onAutoAssign,
  onUpdatePriority,
  onScheduleFollowUp,
  onAddTag,
  onRemoveTag,
  onUpdateNotes,
  onMarkContacted,
  onLogActivity,
  onUpdateCallCount,
  onSendQuote,
  onRefresh,
  hideAssignedColumn,
  canAssignLeads = true,
  canOverrideAssignmentLock = false,
  showFbBadge = false,
  showRecoveredBadge = false,
  showSourceColumn = false,
  isPaidLocked = false,
  paidLeadAccessCheck,
  onRequestPaidAccess,
  isLeadGenView = false,
  userRole,
  reminderTimesMap = {},
  struggleAlertsMap,
  hideNewStatus = false,
  pinnedLeadId = null,
  reservedRemainingSec = 0,
  recontactMode = false,
  currentAdminId = null,
  readOnlyLeadIds,
  defaultSortKey = null,
}) => {
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  // Auto-expand the row for the currently reserved Open Pool lead so the agent
  // sees the Quick Log outcome + timer without an extra click.
  const reservationForAutoExpand = useOpenPoolReservation();
  useEffect(() => {
    if (reservationForAutoExpand?.lead?.id) {
      setExpandedLead(reservationForAutoExpand.lead.id);
    }
  }, [reservationForAutoExpand?.lead?.id]);
  const [sortKey, setSortKey] = useState<ColumnSortKey | null>(defaultSortKey);
  const [sortDir, setSortDir] = useState<ColumnSortDir>('desc');
  const PAGE_SIZE = 200;
  const [page, setPage] = useState(1);

  // Open Lead Pool: if this agent has a reservation, treat that lead as pinned.
  // If it isn't already in the current page's leads, inject it as a virtual first row.
  const reservation = useOpenPoolReservation();
  const remainingSec = useReservationCountdown(reservation);
  const effectivePinnedLeadId = pinnedLeadId ?? reservation?.lead.id ?? null;
  const effectiveRemainingSec = pinnedLeadId ? reservedRemainingSec : remainingSec;

  const leadsWithReservation = useMemo<Lead[]>(() => {
    if (!reservation) return leads;
    if (leads.some((l) => l.id === reservation.lead.id)) return leads;
    return [reservation.lead, ...leads];
  }, [leads, reservation]);

  // Extract emails from leads for quote lookup
  const leadEmails = useMemo(() => leadsWithReservation.map(l => l.email), [leadsWithReservation]);
  const { quotesByEmail } = useLeadQuotes(leadEmails);
  const { activityByEmail } = useCustomerActivity(leadEmails);
  const { repeatByLeadId } = useRepeatCustomers(
    useMemo(
      () => leadsWithReservation.map(l => ({ id: l.id, email: l.email, vehicle_reg: l.vehicle_reg, created_at: l.created_at })),
      [leadsWithReservation]
    )
  );

  // Fetch note counts for all visible leads
  const leadIds = useMemo(() => leadsWithReservation.map(l => l.id), [leadsWithReservation]);
  const noteCounts = useLeadNoteCounts(leadIds);
  const { activityByLead } = useAgentActivity(leadIds);
  const { responseByLead } = useLeadResponseTime(
    useMemo(() => leadsWithReservation.map(l => ({ id: l.id, created_at: l.created_at })), [leadsWithReservation])
  );

  const agentNameById = useMemo(() => {
    const map = new Map<string, string>();
    [...(assignableSalesUsers || []), ...salesUsers].forEach(u => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || '';
      if (u.id) map.set(u.id, name.toLowerCase());
    });
    return map;
  }, [salesUsers, assignableSalesUsers]);

  const getSortValue = useCallback((lead: Lead, key: ColumnSortKey): number | string => {
    if (key === 'activity') {
      // Agent activity = human touches only (calls, notes, status changes bump last_contacted_at)
      const agentAt = activityByLead[lead.id]?.lastAt;
      const contacted = lead.last_contacted_at ? new Date(lead.last_contacted_at).getTime() : 0;
      const derived = agentAt ? new Date(agentAt).getTime() : 0;
      return Math.max(contacted, derived);
    }
    if (key === 'agent') {
      if (!lead.assigned_to) return '\uffff'; // unassigned always at end
      return agentNameById.get(lead.assigned_to) ?? '\uffff';
    }
    if (key === 'status') {
      const s = (lead.status || 'new').toLowerCase();
      return STATUS_IMPORTANCE[s] ?? 999;
    }
    if (key === 'date_added') {
      return lead.last_claimed_at ? new Date(lead.last_claimed_at).getTime() : 0;
    }
    // Always sort by original lead arrival time — not resubmission/allocation time
    return lead.created_at ? new Date(lead.created_at).getTime() : 0;
  }, [agentNameById, activityByLead]);

  const sortedLeads = useMemo(() => {
    const base = sortKey
      ? [...leadsWithReservation].sort((a, b) => {
          const av = getSortValue(a, sortKey);
          const bv = getSortValue(b, sortKey);
          let cmp: number;
          if (typeof av === 'string' || typeof bv === 'string') {
            cmp = String(av).localeCompare(String(bv));
          } else {
            cmp = (av as number) - (bv as number);
          }
          return sortDir === 'desc' ? -cmp : cmp;
        })
      : leadsWithReservation;
    // Pin the Open Lead Pool reservation as the first row.
    if (!effectivePinnedLeadId) return base;
    const idx = base.findIndex((l) => l.id === effectivePinnedLeadId);
    if (idx <= 0) return base;
    const copy = [...base];
    const [pinned] = copy.splice(idx, 1);
    return [pinned, ...copy];
  }, [leadsWithReservation, sortKey, sortDir, getSortValue, effectivePinnedLeadId]);

  // Pagination: 200 rows per page, keep it responsive on very large lead lists.
  const totalCount = sortedLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);
  // Reset to page 1 whenever the underlying dataset changes meaningfully.
  useEffect(() => { setPage(1); }, [leads.length, sortKey, sortDir]);
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, totalCount);
  const pagedLeads = useMemo(() => sortedLeads.slice(pageStart, pageEnd), [sortedLeads, pageStart, pageEnd]);

  const handleToggleSort = useCallback((key: ColumnSortKey) => {
    setSortKey(prev => {
      if (prev !== key) {
        // Text columns default to ascending (A→Z / New first); dates default to descending (newest first).
        setSortDir(key === 'agent' || key === 'status' ? 'asc' : 'desc');
        return key;
      }
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
      return key;
    });
  }, []);

  const SortIcon = ({ column }: { column: ColumnSortKey }) => {
    const active = sortKey === column;
    const Icon = active ? (sortDir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown;
    const label = column === 'activity' ? 'activity'
      : column === 'lead_date' ? 'lead date'
      : column === 'agent' ? 'agent name'
      : 'status';
    return (
      <button
        type="button"
        onClick={() => handleToggleSort(column)}
        className={`ml-1 inline-flex items-center justify-center rounded p-0.5 hover:bg-muted transition ${active ? 'text-primary' : 'text-muted-foreground/60'}`}
        aria-label={`Sort by ${label} ${active && sortDir === 'desc' ? 'ascending' : 'descending'}`}
      >
        <Icon className="h-3 w-3" />
      </button>
    );
  };

  // Memoized callbacks for row actions
  const handleToggleExpand = useCallback((leadId: string) => {
    setExpandedLead(prev => prev === leadId ? null : leadId);
  }, []);

  // "Converted" always asks the agent to confirm the payment first.
  const { guardStatusChange, convertedConfirmDialog } = useConfirmConverted(onUpdateStatus);

  return (
    <>
      {convertedConfirmDialog}

      {/* Mobile-only card view (managers spot-check on phones). Desktop is unchanged. */}
      <LeadsMobileCards
        className="md:hidden"
        leads={leads}
        quotesByEmail={quotesByEmail}
        onLogActivity={onLogActivity}
        onUpdateNotes={onUpdateNotes}
        onRefresh={onRefresh}
        onSendQuote={onSendQuote}
      />
      <div className="hidden md:block rounded-md border-2 border-border overflow-x-auto">
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-b-2 border-border">
              <TableHead className="w-[44px] py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">#</TableHead>
              {!isLeadGenView && (
              <TableHead className="w-[36px] py-2">
                {/* Checkbox moved to control bar */}
              </TableHead>
              )}
              {!hideAssignedColumn && !isLeadGenView && <TableHead className="sticky left-0 bg-muted/20 z-10 w-[110px] min-w-[110px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><span className="inline-flex items-center">Agent<SortIcon column="agent" /></span></TableHead>}
              {showSourceColumn && <TableHead className="w-[35px] text-center py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Src</TableHead>}
              {!isLeadGenView && <TableHead className="w-[95px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><span className="inline-flex items-center">Status<SortIcon column="status" /></span></TableHead>}
              {/* Send Quote column header removed — action still available in the row action buttons */}
              {!isLeadGenView && <TableHead className="w-[60px] text-center py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Calls</TableHead>}
              {!isLeadGenView && <TableHead className="w-[120px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>}
              <TableHead className="w-[110px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
              <TableHead className="w-[150px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Phone</TableHead>
              <TableHead className="w-[170px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
              {!isLeadGenView && <TableHead className="w-[85px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reg</TableHead>}
              {!isLeadGenView && <TableHead className="w-[80px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Payment</TableHead>}
              {!isLeadGenView && <TableHead className="w-[100px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Paid Date</TableHead>}
              {!isLeadGenView && <TableHead className="w-[110px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" title="Last time an agent actually touched this lead (call, note, status change). Excludes automated system writes."><span className="inline-flex items-center">Agent activity<SortIcon column="activity" /></span></TableHead>}
              {!isLeadGenView && <TableHead className="w-[100px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><span className="inline-flex items-center">Lead Date<SortIcon column="lead_date" /></span></TableHead>}
              {recontactMode && !isLeadGenView && <TableHead className="w-[100px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><span className="inline-flex items-center">Date Added<SortIcon column="date_added" /></span></TableHead>}
              {!isLeadGenView && <TableHead className="w-[140px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" title="Last time the customer themselves did something — asked for another quote, filled step 2, or logged into the portal.">Customer activity</TableHead>}
              {!isLeadGenView && <TableHead className="w-[110px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" title="Time from the lead arriving to the agent's first action on it (call logged, note written, status changed). Target is 120 seconds.">Time to contact</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedLeads.map((lead, i) => {
              const accessStatus = paidLeadAccessCheck?.(lead.id) || { hasPending: false, hasApproved: false };
              const rowNumber = pageStart + i + 1;
              const isReadOnly = !!readOnlyLeadIds?.has(lead.id);
              const noop = () => {};
              return (
              <React.Fragment key={lead.id}>
                <LeadTableRow
                  rowNumber={rowNumber}
                  lead={lead}
                  tags={tags}
                  salesUsers={salesUsers}
                  assignableSalesUsers={assignableSalesUsers}
                  isSelected={selectedLeads.has(lead.id)}
                  isExpanded={expandedLead === lead.id}
                  sentQuotes={quotesByEmail[lead.email?.toLowerCase()] || []}
                  onSelect={isReadOnly ? noop : () => onSelectLead(lead.id)}
                  onToggleExpand={() => handleToggleExpand(lead.id)}
                  onUpdateStatus={isReadOnly ? noop : (status) => guardStatusChange(lead.id, status)}
                  onAssign={isReadOnly ? noop : (userId) => onAssign(lead.id, userId)}
                  onAutoAssign={isReadOnly ? noop : () => onAutoAssign(lead.id)}
                  onUpdatePriority={isReadOnly ? noop : (priority) => onUpdatePriority(lead.id, priority)}
                  onScheduleFollowUp={isReadOnly ? noop : (type, date) => onScheduleFollowUp(lead.id, type, date)}
                  onAddTag={isReadOnly ? noop : (tagId) => onAddTag(lead.id, tagId)}
                  onRemoveTag={isReadOnly ? noop : (tagId) => onRemoveTag(lead.id, tagId)}
                  onLogActivity={isReadOnly ? noop : (type, desc) => onLogActivity(lead.id, type, desc)}
                  onUpdateCallCount={isReadOnly ? noop : (increment) => onUpdateCallCount(lead.id, increment)}
                  onSendQuote={isReadOnly ? undefined : (onSendQuote ? () => onSendQuote(lead) : undefined)}
                  hideAssignedColumn={hideAssignedColumn}
                  canAssignLeads={canAssignLeads && !isReadOnly}
                  canOverrideAssignmentLock={canOverrideAssignmentLock}
                   noteCount={noteCounts[lead.id] || 0}
                   agentActivity={activityByLead[lead.id]}
                   showFbBadge={showFbBadge}
                   showRecoveredBadge={showRecoveredBadge}
                     showSourceColumn={showSourceColumn}
                  isPaidLocked={isPaidLocked}
                  hasPendingAccessRequest={accessStatus.hasPending}
                  hasApprovedAccess={accessStatus.hasApproved}
                   onRequestAccess={onRequestPaidAccess ? (reason) => onRequestPaidAccess(lead.id, reason) : undefined}
                   isLeadGenView={isLeadGenView}
                   userRole={userRole}
                   reminderTime={reminderTimesMap[lead.id]}
                   struggleAlert={struggleAlertsMap?.get(lead.id) || null}
                   hideNewStatus={hideNewStatus}
                   isReserved={effectivePinnedLeadId === lead.id}
                   reservedRemainingSec={effectivePinnedLeadId === lead.id ? effectiveRemainingSec : 0}
                   recontactMode={recontactMode}
                   currentAdminId={currentAdminId}
                   readOnly={isReadOnly}
                   customerActivity={lead.email ? activityByEmail[lead.email.toLowerCase()] : undefined}
                   responseTime={responseByLead[lead.id]}
                   repeatCustomer={repeatByLeadId[lead.id]}
                 />


                
                {/* Expanded row with LeadDetailsPanel — also locked if paid and no access */}
                {expandedLead === lead.id && !(isPaidLocked && lead.is_paid && lead.lead_source === 'google_ad' && !accessStatus.hasApproved) && (
                  <TableRow>
                    <TableCell colSpan={20} className="p-0 bg-muted/20">
                      <LeadDetailsPanel
                        lead={lead}
                        onUpdateNotes={onUpdateNotes}
                        onLogActivity={onLogActivity}
                        onRefresh={onRefresh}
                        onNavigateToQuote={onSendQuote ? () => onSendQuote(lead) : undefined}
                        hasQuotesSent={(quotesByEmail[lead.email?.toLowerCase()] || []).length > 0}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
              );
            })}
            
            {leads.length === 0 && (
              <TableRow>
                <TableCell colSpan={20} className="text-center py-8 text-muted-foreground">
                  No leads found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TooltipProvider>
      {totalCount > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 border-t bg-muted/20 text-xs">
          <div className="text-muted-foreground">
            Showing <span className="font-semibold text-foreground tabular-nums">{pageStart + 1}</span>–
            <span className="font-semibold text-foreground tabular-nums">{pageEnd}</span> of{' '}
            <span className="font-semibold text-foreground tabular-nums">{totalCount}</span> leads
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(1)} disabled={page === 1} aria-label="First page">
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 tabular-nums">
              Page <span className="font-semibold text-foreground">{page}</span> / <span className="font-semibold text-foreground">{totalPages}</span>
            </span>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(totalPages)} disabled={page === totalPages} aria-label="Last page">
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
    </>
  );
});

LeadsTable.displayName = 'LeadsTable';
