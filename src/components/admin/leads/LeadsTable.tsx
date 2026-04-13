import React, { useState, useCallback, memo, useMemo } from 'react';
import { Lead, LeadStatus, LeadPriority, LeadTag, AdminUser } from '@/hooks/useLeads';
import { useLeadQuotes } from '@/hooks/useLeadQuotes';
import { useLeadNoteCounts } from '@/hooks/useLeadNoteCounts';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LeadDetailsPanel } from './LeadDetailsPanel';
import { LeadTableRow } from './LeadTableRow';
import { TableCell } from '@/components/ui/table';

interface LeadsTableProps {
  leads: Lead[];
  tags: LeadTag[];
  salesUsers: AdminUser[];
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
  showFbBadge?: boolean;
  showRecoveredBadge?: boolean;
  showSourceColumn?: boolean;
  isPaidLocked?: boolean;
  paidLeadAccessCheck?: (leadId: string) => { hasPending: boolean; hasApproved: boolean };
  onRequestPaidAccess?: (leadId: string, reason: string) => void;
  isLeadGenView?: boolean;
  userRole?: string | null;
  reminderTimesMap?: Record<string, string>;
}

export const LeadsTable: React.FC<LeadsTableProps> = memo(({
  leads,
  tags,
  salesUsers,
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
  showFbBadge = false,
  showRecoveredBadge = false,
  showSourceColumn = false,
  isPaidLocked = false,
  paidLeadAccessCheck,
  onRequestPaidAccess,
  isLeadGenView = false,
  userRole,
  reminderTimesMap = {},
}) => {
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  // Extract emails from leads for quote lookup
  const leadEmails = useMemo(() => leads.map(l => l.email), [leads]);
  const { quotesByEmail } = useLeadQuotes(leadEmails);

  // Fetch note counts for all visible leads
  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);
  const noteCounts = useLeadNoteCounts(leadIds);

  // Memoized callbacks for row actions
  const handleToggleExpand = useCallback((leadId: string) => {
    setExpandedLead(prev => prev === leadId ? null : leadId);
  }, []);

  return (
    <div className="rounded-md border-2 border-border overflow-x-auto">
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-b-2 border-border">
              {!isLeadGenView && (
              <TableHead className="w-[36px] py-2">
                {/* Checkbox moved to control bar */}
              </TableHead>
              )}
              {!hideAssignedColumn && !isLeadGenView && <TableHead className="sticky left-0 bg-muted/20 z-10 w-[110px] min-w-[110px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agent</TableHead>}
              {showSourceColumn && <TableHead className="w-[35px] text-center py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Src</TableHead>}
              {!isLeadGenView && <TableHead className="w-[95px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>}
              {!isLeadGenView && <TableHead className="w-[40px] text-center py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">CB</TableHead>}
              {!isLeadGenView && <TableHead className="w-[60px] text-center py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Calls</TableHead>}
              {!isLeadGenView && <TableHead className="w-[120px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>}
              <TableHead className="w-[110px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
              <TableHead className="w-[150px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Phone</TableHead>
              <TableHead className="w-[170px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
              {!isLeadGenView && <TableHead className="w-[85px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reg</TableHead>}
              {!isLeadGenView && <TableHead className="w-[80px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Payment</TableHead>}
              {!isLeadGenView && <TableHead className="w-[100px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Paid Date</TableHead>}
              {!isLeadGenView && <TableHead className="w-[90px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Activity</TableHead>}
              {!isLeadGenView && <TableHead className="w-[100px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lead Date</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const accessStatus = paidLeadAccessCheck?.(lead.id) || { hasPending: false, hasApproved: false };
              return (
              <React.Fragment key={lead.id}>
                <LeadTableRow
                  lead={lead}
                  tags={tags}
                  salesUsers={salesUsers}
                  isSelected={selectedLeads.has(lead.id)}
                  isExpanded={expandedLead === lead.id}
                  sentQuotes={quotesByEmail[lead.email?.toLowerCase()] || []}
                  onSelect={() => onSelectLead(lead.id)}
                  onToggleExpand={() => handleToggleExpand(lead.id)}
                  onUpdateStatus={(status) => onUpdateStatus(lead.id, status)}
                  onAssign={(userId) => onAssign(lead.id, userId)}
                  onAutoAssign={() => onAutoAssign(lead.id)}
                  onUpdatePriority={(priority) => onUpdatePriority(lead.id, priority)}
                  onScheduleFollowUp={(type, date) => onScheduleFollowUp(lead.id, type, date)}
                  onAddTag={(tagId) => onAddTag(lead.id, tagId)}
                  onRemoveTag={(tagId) => onRemoveTag(lead.id, tagId)}
                  onLogActivity={(type, desc) => onLogActivity(lead.id, type, desc)}
                  onUpdateCallCount={(increment) => onUpdateCallCount(lead.id, increment)}
                  onSendQuote={onSendQuote ? () => onSendQuote(lead) : undefined}
                  hideAssignedColumn={hideAssignedColumn}
                  canAssignLeads={canAssignLeads}
                   noteCount={noteCounts[lead.id] || 0}
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
    </div>
  );
});

LeadsTable.displayName = 'LeadsTable';
