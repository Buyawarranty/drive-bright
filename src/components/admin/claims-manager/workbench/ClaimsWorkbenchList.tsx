import React, { useState, useEffect, useRef } from 'react';
import { Ban, ChevronDown, Phone, FileText, Mail, PoundSterling, ThumbsUp, ThumbsDown } from 'lucide-react';
import { RemindMePopover } from '@/components/admin/leads/RemindMePopover';
import type { Claim } from '@/types/claim';
import { cn } from '@/lib/utils';
import { deriveStage, STAGE_META } from './statusMap';
import { computeSla, slaToneCls } from './sla';
import { MileageChip } from './MileageChip';
import { AssignMenu } from './AssignMenu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClaimAmountEditDialog } from '@/components/admin/claims/ClaimAmountEditDialog';
import { ClaimStatusEmailPreviewDialog, type PendingClaimStatusChange } from '@/components/admin/claims/ClaimStatusEmailPreviewDialog';

// Simplified admin status options for the row dropdown. Each maps to a DB
// `claims_submissions.status` value.
const SIMPLE_STATUSES = [
  { value: 'in_review',           label: 'In Review',           tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'awaiting_info',       label: 'Evidence Needed',     tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'approved',            label: 'Approved',            tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'declined',            label: 'Declined',            tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'appealed',            label: 'Appeal',              tone: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'cancelled',           label: 'Cancellation',        tone: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  { value: 'refund',              label: 'Refund',              tone: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'complaint_submitted', label: 'Complaint Submitted', tone: 'bg-red-50 text-red-700 border-red-200' },
] as const;

const STATUS_META = Object.fromEntries(SIMPLE_STATUSES.map((s) => [s.value, s])) as Record<string, typeof SIMPLE_STATUSES[number]>;

// Map a claim's current DB status onto one of the simplified options above.
const deriveSimpleStatus = (c: Claim): string => {
  const raw = (c.rawStatus || '').toLowerCase().trim();
  if (STATUS_META[raw]) return raw;
  if (raw === 'appeal') return 'appealed';
  if (raw === 'awaiting_information' || raw === 'evidence_needed' || raw === 'evidence') return 'awaiting_info';
  if (raw === 'under_review' || raw === 'review') return 'in_review';
  if (raw === 'rejected') return 'declined';
  if (raw === 'canceled') return 'cancelled';
  if (raw === 'complaint') return 'complaint_submitted';
  // fall back to derived stage
  const s = deriveStage(c);
  if (s === 'evidence_needed') return 'awaiting_info';
  if (s === 'in_review' || s === 'triage' || s === 'evidence_received' || s === 'awaiting_authorisation') return 'in_review';
  if (s === 'approved_awaiting_invoice' || s === 'invoice_received' || s === 'payment_pending') return 'approved';
  if (s === 'declined') return 'declined';
  if (s === 'appealed') return 'appealed';
  if (s === 'cancelled') return 'cancelled';
  return 'in_review';
};

interface Props {
  claims: Claim[];
  selectedId?: string | null;
  onSelect: (c: Claim) => void;
  selectedIds: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onUpdated: () => void | Promise<void>;
  assigneeIdByName?: Record<string, string>;
}

const priorityDot: Record<Claim['priority'], string> = {
  critical: 'bg-red-500',
  high: 'bg-amber-500',
  normal: 'bg-blue-500',
  low: 'bg-gray-300',
};

const NumberPlate: React.FC<{ reg: string }> = ({ reg }) => (
  <span className="inline-block px-1.5 py-0.5 rounded bg-yellow-300 border border-slate-800 text-slate-900 font-mono font-bold text-[10px] tracking-wider whitespace-nowrap">
    {reg}
  </span>
);

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

// Default claim handler shown when a claim has no assignee.
// Display-only: the DB value remains null until a user picks via AssignMenu.
const DEFAULT_CLAIM_AGENT = 'Sammie';

// Soft pastel pill tone derived from the existing stage cls.
// Maps stage key -> soft bg/text combo (matches the "New" pill in screenshot).
const SOFT_STATUS_TONE: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700',
  evidence: 'bg-amber-50 text-amber-700',
  review: 'bg-violet-50 text-violet-700',
  approved: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
  overdue: 'bg-red-50 text-red-700',
  closed: 'bg-slate-100 text-slate-600',
};

// Fixed widths so headers and cells always align and never overlap.
// The whole table scrolls horizontally on narrow viewports instead of squishing.
const COLS =
  'grid grid-cols-[24px_190px_14px_76px_minmax(200px,1.3fr)_minmax(180px,1fr)_96px_minmax(220px,1.5fr)_170px_128px_160px] gap-4 min-w-[1420px]';

export const ClaimsWorkbenchList: React.FC<Props> = ({
  claims,
  selectedId,
  onSelect,
  selectedIds,
  onToggleOne,
  onToggleAll,
  onUpdated,
}) => {
  const { toast } = useToast();
  const [amountEditClaim, setAmountEditClaim] = useState<Claim | null>(null);
  const [stageBusyId, setStageBusyId] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingClaimStatusChange | null>(null);

  const changeStatus = (c: Claim, newStatus: string) => {
    const meta = STATUS_META[newStatus];
    if (!meta) return;
    setPendingChange({
      claimId: c.id,
      status: newStatus,
      label: meta.label,
      onSent: async () => {
        setStageBusyId(c.id);
        const { error } = await supabase
          .from('claims_submissions')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', c.id);
        setStageBusyId(null);
        if (error) {
          toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
          return;
        }
        toast({ title: 'Status updated', description: `Moved to ${meta.label}.` });
        await onUpdated();
      },
    });
  };

  const setReview = async (claimId: string, value: 'positive' | 'negative' | null) => {
    const { error } = await supabase
      .from('claims_submissions')
      .update({ review_sentiment: value, updated_at: new Date().toISOString() })
      .eq('id', claimId);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Review flag saved' });
    await onUpdated();
  };

  const assignClaim = async (claimId: string, userId: string | null) => {
    const { error } = await supabase
      .from('claims_submissions')
      .update({ assigned_to: userId, updated_at: new Date().toISOString() })
      .eq('id', claimId);
    if (error) {
      toast({ title: 'Assignment failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: userId ? 'Assigned' : 'Unassigned', description: 'Claim updated.' });
    await onUpdated();
  };

  if (claims.length === 0) {
    return (
      <div className="flex-1 bg-card border border-border rounded-lg flex items-center justify-center text-sm text-muted-foreground py-16">
        No claims match this queue.
      </div>
    );
  }

  const allSelected = claims.length > 0 && claims.every((c) => selectedIds.has(c.id));
  const someSelected = !allSelected && claims.some((c) => selectedIds.has(c.id));

  return (
    <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <div className={cn(COLS, 'px-4 py-3 border-b border-border bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground items-center')}>
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={(v) => onToggleAll(v === true)}
            aria-label="Select all"
          />
          <span>Actions</span>
          <span />
          <span>SLA</span>
          <span>Customer</span>
          <span>Vehicle</span>
          <span className="text-right">Amount</span>
          <span>Issue</span>
          <span>Status</span>
          <span>Review</span>
          <span>Assignee</span>
        </div>
        <div className="divide-y divide-border">
        {claims.map((c) => {
          const stage = deriveStage(c);
          const meta = STAGE_META[stage];
          const sla = computeSla(c);
          const isSelected = selectedId === c.id;
          const isUnassigned = c.assignee === 'unassigned';
          const isChecked = selectedIds.has(c.id);
          const softTone = SOFT_STATUS_TONE[stage] ?? 'bg-slate-100 text-slate-700';
          const displayAssignee = isUnassigned ? DEFAULT_CLAIM_AGENT : c.assignee;
          return (
            <div
              key={c.id}
              className={cn(
                COLS,
                'group px-4 py-3 items-center text-sm hover:bg-muted/40 transition-colors',
                isSelected && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
                isChecked && 'bg-primary/[0.03]',
              )}
            >
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggleOne(c.id)}
                  aria-label={`Select claim ${c.id}`}
                />
              </div>

              {/* Actions: chevron + phone + document + mail + bell */}
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSelect(c)}
                      className={cn(
                        'h-8 w-8 inline-flex items-center justify-center rounded-md border-2 transition-all',
                        isSelected
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'border-orange-400 text-orange-500 hover:bg-orange-50',
                      )}
                      aria-label="Open claim"
                    >
                      <ChevronDown className={cn('h-4 w-4 transition-transform', isSelected && 'rotate-180')} strokeWidth={3} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">{isSelected ? 'Close' : 'Open claim'}</TooltipContent>
                </Tooltip>

                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <a
                      href={c.phone ? `tel:${c.phone}` : undefined}
                      className={cn(
                        'h-7 w-7 inline-flex items-center justify-center rounded-md text-green-600 hover:bg-green-50',
                        !c.phone && 'opacity-40 pointer-events-none',
                      )}
                      aria-label="Call customer"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">{c.phone || 'No phone'}</TooltipContent>
                </Tooltip>

                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSelect(c)}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
                      aria-label="Open documents"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Documents</TooltipContent>
                </Tooltip>

                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <a
                      href={c.email ? `mailto:${c.email}` : undefined}
                      className={cn(
                        'h-7 w-7 inline-flex items-center justify-center rounded-md text-blue-600 hover:bg-blue-50',
                        !c.email && 'opacity-40 pointer-events-none',
                      )}
                      aria-label="Email customer"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">{c.email || 'No email'}</TooltipContent>
                </Tooltip>

                <div onClick={(e) => e.stopPropagation()} className="inline-flex">
                  <RemindMePopover leadId={`claim_${c.id}`} compact />
                </div>
              </div>

              <span className={cn('h-2 w-2 rounded-full', priorityDot[c.priority])} title={`${c.priority} priority`} />

              <span className={cn('inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-semibold border', slaToneCls[sla.tone])}>
                {sla.label}
              </span>

              <div className="min-w-0 flex items-center gap-2 cursor-pointer" onClick={() => onSelect(c)}>
                <div className="h-7 w-7 shrink-0 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-semibold">
                  {initials(c.customerName)}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate flex items-center gap-1.5">
                    <span className="truncate">{c.customerName}</span>
                    {c.customerClaimIndex && c.customerClaimTotal && c.customerClaimTotal > 1 && (() => {
                      const n = c.customerClaimIndex;
                      const suf = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th','st','nd','rd','th','th','th','th','th','th'][n % 10];
                      const isRepeat = n >= 2;
                      const via = c.customerClaimMatchedBy === 'both' ? 'email + phone' : c.customerClaimMatchedBy === 'email' ? 'email' : 'phone';
                      return (
                        <Tooltip delayDuration={100}>
                          <TooltipTrigger asChild>
                            <span
                              className={cn(
                                'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap shrink-0',
                                isRepeat
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300',
                              )}
                            >
                              {n}{suf} of {c.customerClaimTotal}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[220px]">
                            Claim #{n} from this customer (matched by {via}). Open the row for details.
                          </TooltipContent>
                        </Tooltip>
                      );
                    })()}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">BAW-{c.reg}</div>
                </div>
              </div>

              <div className="min-w-0 flex items-center gap-1.5 flex-wrap cursor-pointer" onClick={() => onSelect(c)}>
                <NumberPlate reg={c.reg} />
                <MileageChip purchase={c.purchaseMileage} current={c.claimMileage} />
                {c.hasCancellation && (
                  <span title="Policy cancelled" className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-red-100 text-red-700 border border-red-200">
                    <Ban className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>

              <div
                className={cn('text-right font-mono text-xs flex items-center justify-end gap-1', c.amount >= 1500 ? 'text-red-600 font-semibold' : 'text-foreground')}
              >
                <span className="cursor-pointer" onClick={() => onSelect(c)}>£{c.amount.toLocaleString()}</span>
                {(stage === 'approved_awaiting_invoice' || stage === 'invoice_received' || stage === 'payment_pending') && (
                  <Tooltip delayDuration={100}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAmountEditClaim(c); }}
                        className="h-5 w-5 inline-flex items-center justify-center rounded text-emerald-600 hover:bg-emerald-50 border border-emerald-200"
                        aria-label="Set paid amount"
                      >
                        <PoundSterling className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Set paid amount</TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="truncate text-xs text-foreground/80 cursor-pointer" title={c.issue} onClick={() => onSelect(c)}>
                {c.issue}
              </div>

              {/* Status: simple dropdown, matches New Leads pattern */}
              <div onClick={(e) => e.stopPropagation()}>
                {(() => {
                  const currentValue = deriveSimpleStatus(c);
                  const currentMeta = STATUS_META[currentValue];
                  return (
                    <Select
                      value={currentValue}
                      onValueChange={(v) => { if (v !== currentValue) changeStatus(c, v); }}
                      disabled={stageBusyId === c.id}
                    >
                      <SelectTrigger
                        className={cn(
                          'h-7 w-full min-w-[140px] text-xs font-medium border',
                          currentMeta?.tone ?? 'bg-slate-100 text-slate-700 border-slate-200',
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIMPLE_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>

              {/* Review: positive / negative / none */}
              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setReview(c.id, c.reviewSentiment === 'positive' ? null : 'positive')}
                      className={cn(
                        'h-7 w-7 inline-flex items-center justify-center rounded-md border transition',
                        c.reviewSentiment === 'positive'
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                          : 'bg-card border-border text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600',
                      )}
                      aria-label="Mark as positive review"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Positive review</TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setReview(c.id, c.reviewSentiment === 'negative' ? null : 'negative')}
                      className={cn(
                        'h-7 w-7 inline-flex items-center justify-center rounded-md border transition',
                        c.reviewSentiment === 'negative'
                          ? 'bg-rose-100 border-rose-300 text-rose-700'
                          : 'bg-card border-border text-muted-foreground hover:bg-rose-50 hover:text-rose-600',
                      )}
                      aria-label="Mark as negative review"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Negative review</TooltipContent>
                </Tooltip>
                {c.reviewSentiment && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap',
                      c.reviewSentiment === 'positive'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200',
                    )}
                  >
                    {c.reviewSentiment === 'positive' ? 'Positive' : 'Negative'}
                  </span>
                )}
              </div>

              <div className="text-[11px] truncate" onClick={(e) => e.stopPropagation()}>
                <AssignMenu
                  onAssign={(uid) => assignClaim(c.id, uid)}
                  trigger={
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border w-full text-[11px] font-medium hover:bg-muted/40 transition',
                        isUnassigned
                          ? 'border-dashed border-slate-300 text-muted-foreground'
                          : 'border-border text-foreground',
                      )}
                      title={isUnassigned ? `Default: ${DEFAULT_CLAIM_AGENT} (click to change)` : 'Click to reassign'}
                    >
                      <span className="h-4 w-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[8px] font-semibold shrink-0">
                        {initials(displayAssignee)}
                      </span>
                      <span className="truncate flex-1 text-left">{displayAssignee}</span>
                      <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
                    </button>
                  }
                />
              </div>
            </div>
          );
        })}
        </div>
      </div>
      {amountEditClaim && (
        <ClaimAmountEditDialog
          open={!!amountEditClaim}
          onOpenChange={(o) => { if (!o) setAmountEditClaim(null); }}
          claim={{
            id: amountEditClaim.id,
            name: amountEditClaim.customerName,
            vehicle_registration: amountEditClaim.reg,
            status: amountEditClaim.rawStatus || amountEditClaim.status,
            payment_amount: amountEditClaim.amount,
          }}
          onUpdate={() => { setAmountEditClaim(null); onUpdated(); }}
        />
      )}
      <ClaimStatusEmailPreviewDialog
        pending={pendingChange}
        onClose={() => setPendingChange(null)}
      />
    </div>
  );
};
