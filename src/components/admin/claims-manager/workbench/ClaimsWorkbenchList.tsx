import React, { useState, useEffect, useRef } from 'react';
import { Ban, ChevronDown, ChevronRight, Phone, FileText, Mail, ThumbsUp, ThumbsDown, MessageSquare, Paperclip, Sparkles } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ClaimAmountEditDialog } from '@/components/admin/claims/ClaimAmountEditDialog';
import { ClaimStatusEmailPreviewDialog, type PendingClaimStatusChange } from '@/components/admin/claims/ClaimStatusEmailPreviewDialog';
import { ClaimEmailDialog } from '@/components/admin/claims/ClaimEmailDialog';
import { ClaimNotesPanel } from '@/components/admin/claims/ClaimNotesPanel';
import { useClaimQuickNotes } from '@/hooks/useClaimQuickNotes';

// Simplified admin status options for the row dropdown. Each maps to a DB
// `claims_submissions.status` value.
const SIMPLE_STATUSES = [
  { value: 'in_review',           label: 'In Review',           tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'awaiting_info',       label: 'Evidence Needed',     tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'approved',            label: 'Approved',            tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'payment_pending',     label: 'Payment Pending',     tone: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'parts_order',         label: 'Parts Order',         tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'declined',            label: 'Declined',            tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'appealed',            label: 'Appeal',              tone: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'cancelled',           label: 'Cancellation',        tone: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  { value: 'refund',              label: 'Refund',              tone: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'complaint_submitted', label: 'Complaint Submitted', tone: 'bg-red-50 text-red-700 border-red-200' },
] as const;

const STATUS_META = Object.fromEntries(SIMPLE_STATUSES.map((s) => [s.value, s])) as Record<string, typeof SIMPLE_STATUSES[number]>;

const deriveSimpleStatus = (c: Claim): string => {
  const raw = (c.rawStatus || '').toLowerCase().trim();
  if (STATUS_META[raw]) return raw;
  if (raw === 'appeal') return 'appealed';
  if (raw === 'awaiting_information' || raw === 'evidence_needed' || raw === 'evidence') return 'awaiting_info';
  if (raw === 'under_review' || raw === 'review') return 'in_review';
  if (raw === 'rejected') return 'declined';
  if (raw === 'canceled') return 'cancelled';
  if (raw === 'complaint') return 'complaint_submitted';
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

const DEFAULT_CLAIM_AGENT = 'Sammie';

// Column order: checkbox | STATUS | actions | priority | SLA | customer | vehicle | on-risk | since-claim | miles | claimed | paid | diff | issue | review | assignee
const COLS =
  'grid grid-cols-[24px_160px_210px_14px_76px_minmax(200px,1.3fr)_minmax(180px,1fr)_84px_84px_96px_104px_104px_104px_minmax(220px,1.5fr)_140px_160px] gap-4 min-w-[1950px]';

const DaysPill: React.FC<{ days: number | null | undefined; label: string }> = ({ days, label }) => {
  if (days == null) {
    return <span className="text-[11px] text-muted-foreground/70" title={label}>—</span>;
  }
  const tone =
    days >= 60 ? 'bg-rose-50 text-rose-700 border-rose-200'
    : days >= 30 ? 'bg-amber-50 text-amber-800 border-amber-200'
    : 'bg-slate-50 text-slate-700 border-slate-200';
  return (
    <span
      className={cn('inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-semibold border tabular-nums', tone)}
      title={label}
    >
      {days}d
    </span>
  );
};

const EditableAmount: React.FC<{
  value: number | null | undefined;
  onSave: (next: number | null) => Promise<void> | void;
  className?: string;
  placeholder?: string;
  ariaLabel: string;
}> = ({ value, onSave, className, placeholder = '—', ariaLabel }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value != null ? String(value) : '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (!editing) setDraft(value != null ? String(value) : ''); }, [value, editing]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = async () => {
    const trimmed = draft.trim();
    const parsed = trimmed === '' ? null : Number(trimmed.replace(/[^0-9.\-]/g, ''));
    const next = parsed == null || Number.isNaN(parsed) ? null : parsed;
    const current = value ?? null;
    if (next === current) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(next); } finally { setSaving(false); setEditing(false); }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        step="0.01"
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); setDraft(value != null ? String(value) : ''); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={ariaLabel}
        className={cn(
          'w-full h-7 px-1.5 text-right font-mono text-xs rounded border border-primary/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30',
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      aria-label={ariaLabel}
      className={cn(
        'w-full h-7 px-1.5 text-right font-mono text-xs rounded border border-transparent hover:border-border hover:bg-muted/40 transition',
        value == null && 'text-muted-foreground/70',
        className,
      )}
    >
      {value == null ? placeholder : `£${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
    </button>
  );
};

// Popover for the review buttons — captures the action/comment that the agent
// took in response to the customer's review, saved as a timestamped note.
const ReviewNotePopover: React.FC<{
  claimId: string;
  sentiment: 'positive' | 'negative';
  currentSentiment: 'positive' | 'negative' | null | undefined;
  onSetSentiment: (v: 'positive' | 'negative' | null) => Promise<void> | void;
  children: React.ReactNode;
}> = ({ claimId, sentiment, currentSentiment, onSetSentiment, children }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const { addNote } = useClaimQuickNotes(claimId);
  const isActive = currentSentiment === sentiment;
  const label = sentiment === 'positive' ? 'Positive review' : 'Negative review';

  const save = async () => {
    setSaving(true);
    try {
      // Toggle sentiment on/off
      await onSetSentiment(isActive ? null : sentiment);
      const trimmed = text.trim();
      if (trimmed && !isActive) {
        const prefix = sentiment === 'positive' ? '[Review 👍]' : '[Review 👎]';
        await addNote(`${prefix} ${trimmed}`);
      }
      setText('');
      setOpen(false);
    } finally { setSaving(false); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-foreground">
            {isActive ? `Clear "${label.toLowerCase()}"?` : `${label} — what's the action?`}
          </div>
          {!isActive && (
            <>
              <Textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What did the customer say and what are we doing about it? (saved as timed note)"
                rows={4}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Comment is optional but recommended.</p>
            </>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>
              {isActive ? 'Clear' : 'Save review'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

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
  const [emailClaim, setEmailClaim] = useState<Claim | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => setExpandedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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

  const updateAmount = async (
    claimId: string,
    field: 'claimed_amount' | 'paid_amount',
    value: number | null,
  ) => {
    const patch: Record<string, unknown> = {
      [field]: value,
      updated_at: new Date().toISOString(),
    };
    if (field === 'claimed_amount') patch.payment_amount = value;
    const { error } = await supabase
      .from('claims_submissions')
      .update(patch)
      .eq('id', claimId);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Saved', description: field === 'paid_amount' ? 'Paid amount updated.' : 'Claimed amount updated.' });
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
          <span>Status</span>
          <span>Actions</span>
          <span />
          <span>SLA</span>
          <span>Customer</span>
          <span>Vehicle</span>
          <span className="text-center" title="Days since warranty purchase">On risk</span>
          <span className="text-center" title="Days since claim submission">Since claim</span>
          <span className="text-right" title="Miles driven since warranty purchase">Miles driven</span>
          <span className="text-right">Claimed</span>
          <span className="text-right">Paid</span>
          <span className="text-right">Difference</span>
          <span>Issue</span>
          <span>Review</span>
          <span>Assignee</span>
        </div>
        <div className="divide-y divide-border">
        {claims.map((c) => {
          const stage = deriveStage(c);
          const sla = computeSla(c);
          const isSelected = selectedId === c.id;
          const isExpanded = expandedIds.has(c.id);
          const isUnassigned = c.assignee === 'unassigned';
          const isChecked = selectedIds.has(c.id);
          const displayAssignee = isUnassigned ? DEFAULT_CLAIM_AGENT : c.assignee;
          const currentStatusValue = deriveSimpleStatus(c);
          const currentStatusMeta = STATUS_META[currentStatusValue];

          return (
            <React.Fragment key={c.id}>
            <div
              className={cn(
                COLS,
                'group px-4 py-3 items-center text-sm hover:bg-muted/40 transition-colors',
                isSelected && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
                isChecked && 'bg-primary/[0.03]',
                isExpanded && 'bg-orange-50/40',
              )}
            >
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggleOne(c.id)}
                  aria-label={`Select claim ${c.id}`}
                />
              </div>

              {/* Status: 2nd column */}
              <div onClick={(e) => e.stopPropagation()}>
                <Select
                  value={currentStatusValue}
                  onValueChange={(v) => { if (v !== currentStatusValue) changeStatus(c, v); }}
                  disabled={stageBusyId === c.id}
                >
                  <SelectTrigger
                    className={cn(
                      'h-7 w-full min-w-[140px] text-xs font-medium border',
                      currentStatusMeta?.tone ?? 'bg-slate-100 text-slate-700 border-slate-200',
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
              </div>

              {/* Actions: expand chevron + phone + document + email + bell */}
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(c.id)}
                      className={cn(
                        'h-8 w-8 inline-flex items-center justify-center rounded-md border-2 transition-all',
                        isExpanded
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'border-orange-400 text-orange-500 hover:bg-orange-50',
                      )}
                      aria-label={isExpanded ? 'Collapse notes' : 'Expand notes'}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4" strokeWidth={3} />
                        : <ChevronRight className="h-4 w-4" strokeWidth={3} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">{isExpanded ? 'Hide notes' : 'Show timed notes'}</TooltipContent>
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

                {(() => {
                  const atts = c.attachments ?? [];
                  const count = atts.length;
                  const hasNewEvidence = atts.some(
                    (a) => a.addedAs === 'evidence' && a.addedAt &&
                      Date.now() - new Date(a.addedAt).getTime() < 1000 * 60 * 60 * 24 * 7,
                  );
                  const label = count === 0
                    ? 'No attachments'
                    : `${count} attachment${count === 1 ? '' : 's'}${hasNewEvidence ? ' — new evidence' : ''}`;
                  return (
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onSelect(c)}
                          className={cn(
                            'h-7 min-w-7 px-1.5 inline-flex items-center gap-1 rounded-md relative transition-colors',
                            count === 0
                              ? 'text-slate-400 hover:bg-slate-100'
                              : hasNewEvidence
                                ? 'text-orange-700 bg-orange-100 hover:bg-orange-200 ring-1 ring-orange-300'
                                : 'text-blue-700 bg-blue-50 hover:bg-blue-100',
                          )}
                          aria-label={label}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {count > 0 && (
                            <span className="text-[11px] font-semibold leading-none">{count}</span>
                          )}
                          {hasNewEvidence && (
                            <Sparkles className="h-2.5 w-2.5 absolute -top-0.5 -right-0.5 text-orange-600" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
                    </Tooltip>
                  );
                })()}

                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setEmailClaim(c)}
                      className={cn(
                        'h-7 w-7 inline-flex items-center justify-center rounded-md text-blue-600 hover:bg-blue-50',
                      )}
                      aria-label="Compose email from template"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Email templates</TooltipContent>
                </Tooltip>

                <div onClick={(e) => e.stopPropagation()} className="inline-flex">
                  <RemindMePopover leadId={`claim_${c.id}`} compact />
                </div>
              </div>

              <span className={cn('h-2 w-2 rounded-full', priorityDot[c.priority])} title={`${c.priority} priority`} />

              <span className={cn('inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-semibold border', slaToneCls[sla.tone])}>
                {sla.label}
              </span>

              <div className="min-w-0 flex items-center gap-2 cursor-pointer" onClick={() => toggleExpanded(c.id)}>
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
                            Claim #{n} from this customer (matched by {via}).
                          </TooltipContent>
                        </Tooltip>
                      );
                    })()}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">BAW-{c.reg}</div>
                </div>
              </div>

              <div className="min-w-0 flex items-center gap-1.5 flex-wrap cursor-pointer" onClick={() => toggleExpanded(c.id)}>
                <NumberPlate reg={c.reg} />
                <MileageChip purchase={c.purchaseMileage} current={c.claimMileage} />
                {c.hasCancellation && (
                  <span title="Policy cancelled" className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-red-100 text-red-700 border border-red-200">
                    <Ban className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center cursor-pointer" onClick={() => toggleExpanded(c.id)}>
                <DaysPill days={c.daysOnRisk ?? null} label="Days since warranty purchase" />
              </div>
              <div className="flex items-center justify-center cursor-pointer" onClick={() => toggleExpanded(c.id)}>
                <DaysPill days={c.ageInDays} label="Days since claim submission" />
              </div>
              <div className="text-right font-mono text-xs tabular-nums cursor-pointer" onClick={() => toggleExpanded(c.id)}>
                {(() => {
                  const p = c.purchaseMileage;
                  const cur = c.claimMileage;
                  if (p == null || cur == null) return <span className="text-muted-foreground/70">—</span>;
                  const driven = cur - p;
                  const tone = driven < 0 ? 'text-rose-700' : driven >= 20000 ? 'text-amber-700 font-semibold' : 'text-foreground';
                  return (
                    <span className={tone} title={`From ${p.toLocaleString()} → ${cur.toLocaleString()} miles`}>
                      {driven < 0 ? '-' : ''}{Math.abs(driven).toLocaleString()}
                    </span>
                  );
                })()}
              </div>

              {(() => {
                const claimed = c.claimedAmount ?? null;
                const paid = c.paidAmount ?? null;
                const diff = claimed != null && paid != null ? claimed - paid : null;
                const diffTone =
                  diff == null ? 'text-muted-foreground/70'
                  : diff > 0 ? 'text-amber-700'
                  : diff < 0 ? 'text-rose-700'
                  : 'text-emerald-700';
                return (
                  <>
                    <div className="flex items-center justify-end">
                      <EditableAmount
                        value={claimed}
                        ariaLabel="Edit claimed amount"
                        onSave={(next) => updateAmount(c.id, 'claimed_amount', next)}
                        className={claimed != null && claimed >= 1500 ? 'text-red-600 font-semibold' : ''}
                      />
                    </div>
                    <div className="flex items-center justify-end">
                      <EditableAmount
                        value={paid}
                        ariaLabel="Edit paid amount"
                        onSave={(next) => updateAmount(c.id, 'paid_amount', next)}
                      />
                    </div>
                    <div className={cn('text-right font-mono text-xs px-1.5', diffTone)} title="Claimed − Paid">
                      {diff == null
                        ? '—'
                        : `${diff < 0 ? '-' : ''}£${Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                    </div>
                  </>
                );
              })()}

              <div className="truncate text-xs text-foreground/80 cursor-pointer" title={c.issue} onClick={() => toggleExpanded(c.id)}>
                {c.issue}
              </div>

              {/* Review: positive / negative with comment popover */}
              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                <ReviewNotePopover
                  claimId={c.id}
                  sentiment="positive"
                  currentSentiment={c.reviewSentiment}
                  onSetSentiment={(v) => setReview(c.id, v)}
                >
                  <button
                    type="button"
                    className={cn(
                      'h-7 w-7 inline-flex items-center justify-center rounded-md border transition',
                      c.reviewSentiment === 'positive'
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                        : 'bg-card border-border text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600',
                    )}
                    aria-label="Positive review — leave a comment"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                </ReviewNotePopover>
                <ReviewNotePopover
                  claimId={c.id}
                  sentiment="negative"
                  currentSentiment={c.reviewSentiment}
                  onSetSentiment={(v) => setReview(c.id, v)}
                >
                  <button
                    type="button"
                    className={cn(
                      'h-7 w-7 inline-flex items-center justify-center rounded-md border transition',
                      c.reviewSentiment === 'negative'
                        ? 'bg-rose-100 border-rose-300 text-rose-700'
                        : 'bg-card border-border text-muted-foreground hover:bg-rose-50 hover:text-rose-600',
                    )}
                    aria-label="Negative review — leave a comment"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                </ReviewNotePopover>
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

            {/* Inline expanded panel: timed notes for this claim */}
            {isExpanded && (
              <div className="bg-orange-50/30 border-l-4 border-orange-400 px-4 py-4" onClick={(e) => e.stopPropagation()}>
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2 text-xs font-semibold text-orange-800 mb-2">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Timed notes — {c.customerName} · BAW-{c.reg}
                  </div>
                  <ClaimNotesPanel claimId={c.id} />
                </div>
              </div>
            )}
            </React.Fragment>
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
      {emailClaim && (
        <ClaimEmailDialog
          claim={{
            id: emailClaim.id,
            name: emailClaim.customerName,
            vehicle_registration: emailClaim.reg,
            claim_reason: emailClaim.issue,
            warranty_type: emailClaim.tier,
            payment_amount: emailClaim.claimedAmount ?? emailClaim.amount,
            created_at: new Date(Date.now() - (emailClaim.ageInDays || 0) * 86400000).toISOString(),
            email: emailClaim.email,
          }}
          open={!!emailClaim}
          onOpenChange={(o) => { if (!o) setEmailClaim(null); }}
          onEmailSent={() => { setEmailClaim(null); onUpdated(); }}
        />
      )}
      <ClaimStatusEmailPreviewDialog
        pending={pendingChange}
        onClose={() => setPendingChange(null)}
      />
    </div>
  );
};
