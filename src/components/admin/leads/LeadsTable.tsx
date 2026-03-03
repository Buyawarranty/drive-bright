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
    <div className="rounded-md border overflow-x-auto">
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[40px]">
                {/* Checkbox moved to control bar */}
              </TableHead>
              {!hideAssignedColumn && <TableHead className="sticky left-0 bg-muted/30 z-10 w-[120px] min-w-[120px]">Assigned To</TableHead>}
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[70px] text-center">Calls</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
              <TableHead className="w-[120px]">Name</TableHead>
              <TableHead className="w-[160px]">Phone</TableHead>
              <TableHead className="w-[180px]">Email</TableHead>
              <TableHead className="w-[90px]">Quote Sent</TableHead>
              <TableHead className="w-[90px]">Reg Plate</TableHead>
              <TableHead className="w-[100px]">Price</TableHead>
              <TableHead className="w-[90px]">Payment</TableHead>
              <TableHead className="w-[90px]">Urgency</TableHead>
              <TableHead className="w-[100px]">Next Action</TableHead>
              <TableHead className="w-[120px]">Plan</TableHead>
              <TableHead className="w-[60px]">Step</TableHead>
              <TableHead className="w-[70px] text-right">Mileage</TableHead>
              <TableHead className="w-[140px]">Tags</TableHead>
              <TableHead className="w-[100px]">Last Activity</TableHead>
              <TableHead className="w-[100px]">Date Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
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
                />
                
                {/* Expanded row with LeadDetailsPanel */}
                {expandedLead === lead.id && (
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
            ))}
            
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
