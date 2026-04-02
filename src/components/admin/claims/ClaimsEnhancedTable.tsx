import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, Edit, Send, Paperclip, FileSpreadsheet, StickyNote } from 'lucide-react';
import { ClaimStatusDropdown } from './ClaimStatusDropdown';
import { ClaimNotesPanel } from './ClaimNotesPanel';
import { cn } from '@/lib/utils';
import { useClaimQuickNotes } from '@/hooks/useClaimQuickNotes';

interface ClaimSubmission {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  status: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  vehicle_registration?: string;
  warranty_type?: string;
  payment_amount?: number;
  claim_reason?: string;
  internal_notes?: string;
  approved_at?: string;
  rejected_at?: string;
  paid_at?: string;
  rejection_reason?: string;
  date_of_incident?: string;
  mileage_at_claim?: number;
  tag_id?: string;
  priority?: string;
  follow_up_date?: string;
  last_contacted_at?: string;
}

type GroupedClaim = ClaimSubmission & {
  relatedClaimsCount: number;
  relatedClaims: ClaimSubmission[];
};

interface ClaimsEnhancedTableProps {
  groupedClaims: GroupedClaim[];
  filteredClaimsCount: number;
  selectedClaimIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectClaim: (claimGroup: { relatedClaims: ClaimSubmission[] }, checked: boolean) => void;
  onViewClaim: (claim: ClaimSubmission) => void;
  onEditAmount: (claim: ClaimSubmission) => void;
  onEmailClaim: (claim: ClaimSubmission) => void;
  onPriorityChange: (claimId: string, priority: string) => void;
  onStatusUpdate: () => void;
  onDownloadFile: (fileUrl: string, fileName: string) => void;
  loading: boolean;
}

export const ClaimsEnhancedTable: React.FC<ClaimsEnhancedTableProps> = ({
  groupedClaims,
  filteredClaimsCount,
  selectedClaimIds,
  onSelectAll,
  onSelectClaim,
  onViewClaim,
  onEditAmount,
  onEmailClaim,
  onPriorityChange,
  onStatusUpdate,
  onDownloadFile,
  loading,
}) => {
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  if (groupedClaims.length === 0) {
    return (
      <div className="text-center py-12">
        <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No claims found</h3>
        <p className="text-muted-foreground text-sm">No claims match your current filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-10">
              <Checkbox
                checked={groupedClaims.length > 0 && selectedClaimIds.size === filteredClaimsCount}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Claim Date</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Reg #</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Customer Name</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Email</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Phone #</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Issue</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Customer Message</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Notes</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Status</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider whitespace-nowrap text-right">Amount</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedClaims.map((claimGroup) => {
            const claim = claimGroup;
            const isGroupSelected = claimGroup.relatedClaims.every(c => selectedClaimIds.has(c.id));
            const totalPayment = claimGroup.relatedClaims.reduce((sum, c) => sum + (c.payment_amount || 0), 0);

            return (
              <React.Fragment key={claim.id}>
                <TableRow
                  className={cn(
                    'hover:bg-muted/40 transition-colors',
                    claimGroup.relatedClaimsCount > 1 && 'bg-blue-50/30'
                  )}
                >
                  {/* Checkbox */}
                  <TableCell className="py-2">
                    <Checkbox
                      checked={isGroupSelected}
                      onCheckedChange={(checked) => onSelectClaim(claimGroup, checked as boolean)}
                    />
                  </TableCell>

                  {/* Claim Date */}
                  <TableCell className="py-2 whitespace-nowrap text-sm">
                    {new Date(claim.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </TableCell>

                  {/* Reg # */}
                  <TableCell className="py-2">
                    {claim.vehicle_registration ? (
                      <span className="font-mono font-semibold text-sm bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded">
                        {claim.vehicle_registration.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Customer Name */}
                  <TableCell className="py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm">{claim.name}</span>
                      {claimGroup.relatedClaimsCount > 1 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {claimGroup.relatedClaimsCount}×
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Email */}
                  <TableCell className="py-2">
                    <a href={`mailto:${claim.email}`} className="text-sm text-blue-600 hover:underline truncate block max-w-[200px]">
                      {claim.email}
                    </a>
                  </TableCell>

                  {/* Phone # */}
                  <TableCell className="py-2">
                    {claim.phone ? (
                      <a href={`tel:${claim.phone}`} className="text-sm text-foreground hover:text-blue-600 whitespace-nowrap">
                        {claim.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Issue */}
                  <TableCell className="py-2">
                    <span className="text-sm text-foreground block truncate max-w-[180px]" title={claim.claim_reason || ''}>
                      {claim.claim_reason || '—'}
                    </span>
                  </TableCell>

                  {/* Customer Message */}
                  <TableCell className="py-2">
                    {claim.message ? (
                      <span className="text-xs text-muted-foreground block truncate max-w-[180px]" title={claim.message}>
                        {claim.message}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  <TableCell className="py-2">
                    <ClaimNotesBadge
                      claimId={claim.id}
                      isExpanded={expandedNoteId === claim.id}
                      onToggle={() => setExpandedNoteId(expandedNoteId === claim.id ? null : claim.id)}
                    />
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-2">
                    <ClaimStatusDropdown
                      claimId={claim.id}
                      currentTagId={claim.tag_id}
                      currentStatus={claim.status}
                      onUpdate={onStatusUpdate}
                    />
                  </TableCell>

                  {/* Amount */}
                  <TableCell className="py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {totalPayment > 0 ? (
                        <span className="font-semibold text-sm text-green-700">
                          £{totalPayment.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditAmount(claim)}
                        className="h-5 w-5 p-0"
                      >
                        <Edit className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-2">
                    <div className="flex items-center gap-0.5">
                      {claim.file_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDownloadFile(claim.file_url!, claim.file_name!)}
                          className="h-7 w-7 p-0"
                          title="Download file"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-blue-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => onViewClaim(claim)} className="h-7 w-7 p-0" title="View claim">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onEmailClaim(claim)} className="h-7 w-7 p-0" title="Send email">
                        <Send className="h-3.5 w-3.5 text-blue-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {/* Expandable notes sub-row */}
                {expandedNoteId === claim.id && (
                  <TableRow className="bg-muted/20">
                    <TableCell colSpan={12} className="p-0">
                      <div className="p-4">
                        <ClaimNotesPanel claimId={claim.id} compact />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

// Small helper to show note count badge (fetches count per claim)
const ClaimNotesBadge: React.FC<{ claimId: string; isExpanded: boolean; onToggle: () => void }> = ({ claimId, isExpanded, onToggle }) => {
  const { notes } = useClaimQuickNotes(claimId);
  const hasNotes = notes.length > 0;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('h-7 w-7 p-0 relative', hasNotes && 'text-amber-600', isExpanded && 'bg-muted')}
      title={hasNotes ? `${notes.length} note(s) – click to expand` : 'Add note'}
      onClick={onToggle}
    >
      <StickyNote className="h-3.5 w-3.5" />
      {hasNotes && (
        <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-amber-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
          {notes.length}
        </span>
      )}
    </Button>
  );
};
