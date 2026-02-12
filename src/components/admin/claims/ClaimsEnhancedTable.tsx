import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Edit, Send, Paperclip, AlertTriangle, ArrowUp, ArrowDown, Minus, User, Mail, Phone, FileSpreadsheet } from 'lucide-react';
import { ClaimStatusDropdown } from './ClaimStatusDropdown';
import { ClaimInlineNote } from './ClaimInlineNote';
import { getReadinessState, readinessColor } from './ClaimsFilterBar';
import { cn } from '@/lib/utils';

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

const getSlaInfo = (createdAt: string, status: string) => {
  if (['paid', 'resolved', 'rejected'].includes(status)) return null;
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const hours = Math.floor(((Date.now() - new Date(createdAt).getTime()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  let bgColor = 'bg-green-600';
  if (days >= 7) bgColor = 'bg-red-600';
  else if (days >= 5) bgColor = 'bg-orange-500';
  else if (days >= 3) bgColor = 'bg-amber-500';
  
  return { days, hours, bgColor };
};

const priorityConfig: Record<string, { label: string; color: string; dot: string }> = {
  urgent: { label: 'High', color: 'text-red-700', dot: 'bg-red-500' },
  high: { label: 'High', color: 'text-orange-700', dot: 'bg-orange-500' },
  normal: { label: 'Medium', color: 'text-blue-700', dot: 'bg-blue-500' },
  low: { label: 'Low', color: 'text-slate-600', dot: 'bg-slate-400' },
};

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
            <TableHead className="w-16 text-center font-semibold text-xs uppercase tracking-wider">SLA</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Priority</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Customer</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Claim Details</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Readiness</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">Cost</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedClaims.map((claimGroup) => {
            const claim = claimGroup;
            const sla = getSlaInfo(claim.created_at, claim.status);
            const isGroupSelected = claimGroup.relatedClaims.every(c => selectedClaimIds.has(c.id));
            const totalPayment = claimGroup.relatedClaims.reduce((sum, c) => sum + (c.payment_amount || 0), 0);
            const readiness = getReadinessState(claim);
            const prio = priorityConfig[claim.priority || 'normal'] || priorityConfig.normal;

            return (
              <TableRow
                key={claim.id}
                className={cn(
                  'hover:bg-muted/40 transition-colors',
                  claimGroup.relatedClaimsCount > 1 && 'bg-blue-50/30'
                )}
              >
                {/* Checkbox */}
                <TableCell>
                  <Checkbox
                    checked={isGroupSelected}
                    onCheckedChange={(checked) => onSelectClaim(claimGroup, checked as boolean)}
                  />
                </TableCell>

                {/* SLA Countdown */}
                <TableCell className="text-center">
                  {sla ? (
                    <div className="flex flex-col items-center">
                      <div className={cn('text-white font-bold text-sm rounded-lg w-11 h-11 flex items-center justify-center', sla.bgColor)}>
                        {sla.days}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-0.5">{sla.hours}h</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Priority */}
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className={cn('h-2 w-2 rounded-full', prio.dot)} />
                      <span className={cn('text-xs font-semibold', prio.color)}>
                        {claim.priority === 'urgent' ? 'Urgent' : prio.label}
                      </span>
                    </div>
                    <Select
                      value={claim.priority || 'normal'}
                      onValueChange={(value) => onPriorityChange(claim.id, value)}
                    >
                      <SelectTrigger className="w-[80px] h-5 text-[10px] border-0 bg-transparent p-0 shadow-none text-muted-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>

                {/* Customer */}
                <TableCell>
                  <div className="space-y-0.5 min-w-[160px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm">{claim.name}</span>
                      {claimGroup.relatedClaimsCount > 1 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {claimGroup.relatedClaimsCount}×
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {claim.vehicle_registration && (
                        <span className="font-mono bg-muted px-1 rounded mr-1">{claim.vehicle_registration}</span>
                      )}
                    </div>
                    <a href={`mailto:${claim.email}`} className="text-xs text-blue-600 hover:underline truncate block max-w-[200px]">
                      {claim.email}
                    </a>
                  </div>
                </TableCell>

                {/* Claim Details */}
                <TableCell>
                  <div className="space-y-0.5 min-w-[140px]">
                    <span className="text-sm text-foreground block truncate max-w-[200px]" title={claim.claim_reason || '-'}>
                      {claim.claim_reason || '—'}
                    </span>
                    {claim.warranty_type && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {claim.warranty_type}
                      </Badge>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(claim.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </div>
                  </div>
                </TableCell>

                {/* Readiness */}
                <TableCell>
                  <Badge variant="outline" className={cn('text-[11px] font-medium border', readinessColor(readiness))}>
                    {readiness}
                  </Badge>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <ClaimStatusDropdown
                    claimId={claim.id}
                    currentTagId={claim.tag_id}
                    currentStatus={claim.status}
                    onUpdate={onStatusUpdate}
                  />
                </TableCell>

                {/* Cost */}
                <TableCell className="text-right">
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
                  {claim.file_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDownloadFile(claim.file_url!, claim.file_name!)}
                      className="h-5 p-0 text-[10px] text-blue-600 gap-0.5"
                    >
                      <Paperclip className="h-3 w-3" /> File
                    </Button>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    <ClaimInlineNote claimId={claim.id} />
                    <Button variant="ghost" size="sm" onClick={() => onViewClaim(claim)} className="h-7 w-7 p-0">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onEmailClaim(claim)} className="h-7 w-7 p-0">
                      <Send className="h-3.5 w-3.5 text-blue-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
