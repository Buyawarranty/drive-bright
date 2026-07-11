import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, Phone, Mail, Gauge, Ban, ChevronRight, AlertCircle } from 'lucide-react';
import type { Claim } from '@/types/claim';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ClaimStatusEmailPreviewDialog, type PendingClaimStatusChange } from '@/components/admin/claims/ClaimStatusEmailPreviewDialog';
import { useClaimQuickNotes } from '@/hooks/useClaimQuickNotes';
import { MileageChip } from './MileageChip';
import { computeSla, slaToneCls } from './sla';
import { formatDaysOnRisk } from './formatters';


// Simplified admin status options for the row dropdown.
export const SIMPLE_STATUSES = [
  { value: 'in_review',           label: 'In Review',           tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'awaiting_info',       label: 'Evidence Needed',     tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'approved',            label: 'Claim approved',      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'partially_approved',  label: 'Partially approved',  tone: 'bg-lime-50 text-lime-800 border-lime-200' },
  { value: 'declined',            label: 'Claim rejected',      tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'payment_pending',     label: 'Payment Pending',     tone: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'parts_order',         label: 'Parts Order',         tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'appealed',            label: 'Appeal',              tone: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'cancelled',           label: 'Cancellation',        tone: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  { value: 'refund',              label: 'Refund',              tone: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'complaint_submitted', label: 'Complaint Submitted', tone: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'not_a_customer',      label: 'Not a customer',      tone: 'bg-[hsl(351,83%,55%)] text-white border-[hsl(351,83%,45%)]' },
] as const;

export type SimpleStatus = typeof SIMPLE_STATUSES[number]['value'];

const STATUS_META = Object.fromEntries(SIMPLE_STATUSES.map((s) => [s.value, s])) as Record<string, typeof SIMPLE_STATUSES[number]>;

// Statuses where an approved/paid amount is expected next to the dropdown.
export const APPROVAL_STATUSES: SimpleStatus[] = ['approved', 'partially_approved', 'declined'];

export const deriveSimpleStatus = (c: Claim): SimpleStatus => {
  const raw = (c.rawStatus || '').toLowerCase().trim();
  if (STATUS_META[raw]) return raw as SimpleStatus;
  if (raw === 'appeal') return 'appealed';
  if (raw === 'awaiting_information' || raw === 'evidence_needed' || raw === 'evidence') return 'awaiting_info';
  if (raw === 'under_review' || raw === 'review') return 'in_review';
  if (raw === 'rejected' || raw === 'claim_rejected') return 'declined';
  if (raw === 'claim_approved') return 'approved';
  if (raw === 'partial' || raw === 'partial_approved' || raw === 'partial_approval') return 'partially_approved';
  if (raw === 'canceled') return 'cancelled';
  if (raw === 'complaint') return 'complaint_submitted';
  if (raw === 'not_customer' || raw === 'no_policy' || raw === 'not a customer') return 'not_a_customer';
  return 'in_review';
};

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
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

const NumberPlate: React.FC<{ reg: string }> = ({ reg }) => (
  <span className="inline-block px-1.5 py-0.5 rounded bg-yellow-300 border border-slate-800 text-slate-900 font-mono font-bold text-[11px] tracking-wider whitespace-nowrap">
    {reg}
  </span>
);

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

const formatSubmittedAt = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${date}, ${time}`;
  } catch {
    return iso;
  }
};

// Columns: checkbox | SUBMITTED | ACTIONS | SLA | STATUS | CUSTOMER | VEHICLE | DAYS ON RISK | MILES SINCE ACTIVE | CLAIMED | PAID | SAVING/LOSS | NOTES
const COLS =
  'grid grid-cols-[24px_132px_170px_120px_minmax(150px,0.7fr)_minmax(220px,1.3fr)_minmax(180px,1fr)_110px_130px_100px_100px_120px_minmax(200px,1.4fr)] gap-3 min-w-[1900px]';

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
    const parsed = trimmed === '' ? null : Number(trimmed.replace(/[^0-9.-]/g, ''));
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

const ReviewNotePopover: React.FC<{
  claimId: string;
  sentiment: 'positive' | 'negative';
  currentSentiment: 'positive' | 'negative' | null | undefined;
  existingComment?: string | null;
  onSetSentiment: (v: 'positive' | 'negative' | null) => Promise<void> | void;
  onCommentSaved?: () => void;
  children: React.ReactNode;
}> = ({ claimId, sentiment, currentSentiment, existingComment, onSetSentiment, onCommentSaved, children }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const { addNote } = useClaimQuickNotes(claimId);
  const isActive = currentSentiment === sentiment;
  const label = sentiment === 'positive' ? 'Positive review' : 'Negative review';

  const save = async () => {
    setSaving(true);
    try {
      await onSetSentiment(isActive ? null : sentiment);
      const trimmed = text.trim();
      if (trimmed && !isActive) {
        const prefix = sentiment === 'positive' ? '[Review 👍]' : '[Review 👎]';
        await addNote(`${prefix} ${trimmed}`);
        onCommentSaved?.();
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
          {isActive && existingComment && (
            <div className="text-[11px] text-foreground/80 bg-muted/40 border border-border rounded p-2 whitespace-pre-wrap">
              {existingComment}
            </div>
          )}
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
  const [stageBusyId, setStageBusyId] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingClaimStatusChange | null>(null);
  const [reviewComments, setReviewComments] = useState<Record<string, { positive?: string; negative?: string }>>({});

  const fetchReviewComments = useCallback(async () => {
    const ids = claims.map((c) => c.id);
    if (ids.length === 0) { setReviewComments({}); return; }
    const { data } = await supabase
      .from('claim_quick_notes')
      .select('claim_id, note_text, created_at')
      .in('claim_id', ids)
      .or('note_text.ilike.[Review %')
      .order('created_at', { ascending: false });
    const map: Record<string, { positive?: string; negative?: string }> = {};
    (data || []).forEach((n: any) => {
      const text: string = n.note_text || '';
      const sentiment: 'positive' | 'negative' | null =
        text.startsWith('[Review 👍]') ? 'positive'
        : text.startsWith('[Review 👎]') ? 'negative'
        : null;
      if (!sentiment) return;
      map[n.claim_id] = map[n.claim_id] || {};
      // Keep the newest (first encountered thanks to desc order)
      if (!map[n.claim_id][sentiment]) {
        map[n.claim_id][sentiment] = text.replace(/^\[Review [^\]]+\]\s*/, '');
      }
    });
    setReviewComments(map);
  }, [claims]);

  useEffect(() => { fetchReviewComments(); }, [fetchReviewComments]);

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
    toast({ title: 'Saved', description: field === 'paid_amount' ? 'Approved amount updated.' : 'Claimed amount updated.' });
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
          <span>Submitted</span>
          <span>Actions</span>
          <span>SLA</span>
          <span>Status</span>
          <span>Customer</span>
          <span>Vehicle</span>
          <span>Days On Risk</span>
          <span className="text-right">Miles driven</span>
          <span className="text-right">Customer claim</span>
          <span className="text-right">We paid</span>
          <span className="text-right">Saving/Loss</span>
          <span>Notes</span>
        </div>
        <div className="divide-y divide-border">
          {claims.map((c) => {
            const isSelected = selectedId === c.id;
            const isChecked = selectedIds.has(c.id);
            const currentStatusValue = deriveSimpleStatus(c);
            const currentStatusMeta = STATUS_META[currentStatusValue];
            const claimed = c.claimedAmount ?? null;
            const paid = c.paidAmount ?? null;
            // Saving/Loss: paid - claimed. Positive = we paid more (loss); negative = saving.
            // Convention requested: relabel "Difference" to "Saving/Loss". Show saving when paid < claimed.
            const savingLoss = claimed != null && paid != null ? paid - claimed : null;
            const slTone =
              savingLoss == null ? 'text-muted-foreground/70'
              : savingLoss < 0 ? 'text-emerald-700'
              : savingLoss > 0 ? 'text-rose-700'
              : 'text-slate-600';
            const sla = computeSla(c);
            const policyNo = c.reg && c.reg !== '—' ? `BAW-${c.reg.replace(/\s+/g, '')}` : null;
            const total = c.customerClaimTotal ?? 1;
            const index = c.customerClaimIndex ?? 1;
            const showRepeatBadge = total > 1;
            const onRiskTone = c.daysOnRisk != null && c.daysOnRisk <= 30
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-slate-100 text-slate-700 border-slate-200';

            return (
              <div
                key={c.id}
                onClick={() => onSelect(c)}
                className={cn(
                  COLS,
                  'group px-4 py-3 items-center text-sm hover:bg-muted/40 transition-colors cursor-pointer',
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

                {/* Submitted */}
                <div className="text-[11px] text-foreground tabular-nums leading-tight" title={c.submittedAt ? new Date(c.submittedAt).toLocaleString('en-GB') : ''}>
                  {formatSubmittedAt(c.submittedAt)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onSelect(c)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-orange-500 text-white hover:bg-orange-600"
                    aria-label="Open claim"
                    title="Open claim"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {c.phone ? (
                    <a
                      href={`tel:${c.phone}`}
                      title={c.phone}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border text-green-600 hover:bg-green-50"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  {c.email ? (
                    <a
                      href={`mailto:${c.email}`}
                      onClick={(e) => { e.stopPropagation(); onSelect(c); }}
                      title={`Email ${c.email}`}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border text-slate-600 hover:bg-slate-50"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  <ReviewNotePopover
                    claimId={c.id}
                    sentiment="positive"
                    currentSentiment={c.reviewSentiment}
                    existingComment={reviewComments[c.id]?.positive || null}
                    onSetSentiment={(v) => setReview(c.id, v)}
                    onCommentSaved={fetchReviewComments}
                  >
                    <button
                      type="button"
                      title={c.reviewSentiment === 'positive' && reviewComments[c.id]?.positive
                        ? reviewComments[c.id]!.positive!
                        : 'Positive review'}
                      className={cn(
                        'h-7 w-7 inline-flex items-center justify-center rounded-md border transition',
                        c.reviewSentiment === 'positive'
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                          : 'bg-card border-border text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600',
                      )}
                      aria-label="Positive review"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                  </ReviewNotePopover>
                  <ReviewNotePopover
                    claimId={c.id}
                    sentiment="negative"
                    currentSentiment={c.reviewSentiment}
                    existingComment={reviewComments[c.id]?.negative || null}
                    onSetSentiment={(v) => setReview(c.id, v)}
                    onCommentSaved={fetchReviewComments}
                  >
                    <button
                      type="button"
                      title={c.reviewSentiment === 'negative' && reviewComments[c.id]?.negative
                        ? reviewComments[c.id]!.negative!
                        : 'Negative review'}
                      className={cn(
                        'h-7 w-7 inline-flex items-center justify-center rounded-md border transition',
                        c.reviewSentiment === 'negative'
                          ? 'bg-rose-100 border-rose-300 text-rose-700'
                          : 'bg-card border-border text-muted-foreground hover:bg-rose-50 hover:text-rose-600',
                      )}
                      aria-label="Negative review"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </ReviewNotePopover>
                </div>

                {/* SLA — click to open drawer */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSelect(c); }}
                  className="flex items-center gap-1.5 text-left hover:opacity-80"
                  title="Open claim details"
                >
                  <span
                    className={cn('h-2 w-2 rounded-full',
                      sla.tone === 'overdue' ? 'bg-red-500'
                      : sla.tone === 'due' ? 'bg-amber-500'
                      : sla.tone === 'soon' ? 'bg-yellow-400'
                      : 'bg-blue-500')}
                  />
                  <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap', slaToneCls[sla.tone])}>
                    {sla.label}
                  </span>
                </button>

                {/* Status */}
                <div className="min-w-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={currentStatusValue}
                    onValueChange={(v) => { if (v !== currentStatusValue) changeStatus(c, v); }}
                    disabled={stageBusyId === c.id}
                  >
                    <SelectTrigger
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'h-7 px-2 text-[11px] font-medium border w-full min-w-0 gap-1',
                        currentStatusMeta?.tone ?? 'bg-slate-100 text-slate-700 border-slate-200',
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent onClick={(e) => e.stopPropagation()}>
                      {SIMPLE_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {APPROVAL_STATUSES.includes(currentStatusValue) && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'flex items-center rounded border px-1.5 h-7 text-[11px] shrink-0',
                        currentStatusValue === 'declined'
                          ? 'bg-rose-50/60 border-rose-200 text-rose-700'
                          : currentStatusValue === 'partially_approved'
                            ? 'bg-lime-50 border-lime-300 text-lime-800'
                            : 'bg-emerald-50 border-emerald-300 text-emerald-800',
                      )}
                      title={
                        currentStatusValue === 'declined'
                          ? 'Rejected — no payment'
                          : currentStatusValue === 'partially_approved'
                            ? 'Enter the partial amount approved'
                            : 'Enter the full amount approved'
                      }
                    >
                      <span className="font-semibold mr-0.5">£</span>
                      {currentStatusValue === 'declined' ? (
                        <span className="font-mono">0</span>
                      ) : (
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          defaultValue={paid ?? ''}
                          placeholder="amount"
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => {
                            const raw = e.currentTarget.value.trim();
                            const parsed = raw === '' ? null : Number(raw.replace(/[^0-9.-]/g, ''));
                            const next = parsed == null || Number.isNaN(parsed) ? null : parsed;
                            if (next !== (paid ?? null)) updateAmount(c.id, 'paid_amount', next);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
                          }}
                          className="w-14 bg-transparent focus:outline-none font-mono text-right"
                          aria-label="Approved amount"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Customer */}
                <div className="min-w-0 flex items-center gap-2">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[11px] font-semibold">
                    {initials(c.customerName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium text-foreground truncate">{c.customerName}</span>
                      {showRepeatBadge && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-semibold whitespace-nowrap"
                          title={`Claim ${index} of ${total} for this vehicle`}
                        >
                          {ordinal(index)} of {total}
                        </span>
                      )}
                    </div>
                    {policyNo && (
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{policyNo}</div>
                    )}
                  </div>
                </div>


                {/* Vehicle */}
                <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                  <NumberPlate reg={c.reg} />
                  <MileageChip purchase={c.purchaseMileage ?? null} current={c.claimMileage ?? null} />
                  {c.hasCancellation && (
                    <span
                      title="Policy cancelled or refunded"
                      className="inline-flex items-center px-1 py-0.5 rounded bg-red-50 text-red-600 border border-red-200"
                    >
                      <Ban className="h-3 w-3" />
                    </span>
                  )}
                  {c.hasMatchingPolicy === false && !c.hasCancellation && (
                    <span
                      title={
                        "No matching policy found for this registration.\n\nAsk the customer:\n• Confirm the exact vehicle registration (spaces / 0 vs O / I vs 1)\n• Which email address was used at purchase (personal vs work)\n• Full name on the policy (could be spouse/partner/company)\n• Approximate purchase date and plan (Basic / Gold / Platinum)\n• Any order/receipt number from the confirmation email\n• Was it bought via a dealer or trade partner?"
                      }
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[hsl(351,83%,55%)] text-white border border-[hsl(351,83%,45%)] text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap cursor-help"
                    >
                      <AlertCircle className="h-3 w-3" />
                      No matching policy
                    </span>
                  )}
                  {c.duplicateSubmission && (
                    <span
                      title={`This vehicle has claims from ${c.duplicateSubmitterCount} different submitters (e.g. customer AND garage). Review both claims and merge into one — contact each party to confirm which is the primary claim, then close the duplicate with a note linking to the surviving claim.`}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-600 text-white border border-purple-700 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap cursor-help"
                    >
                      <AlertCircle className="h-3 w-3" />
                      Duplicated claim
                    </span>
                  )}
                </div>

                {/* Days On Risk */}
                <div>
                  {c.daysOnRisk != null ? (
                    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold', onRiskTone)}>
                      {formatDaysOnRisk(c.daysOnRisk)}
                    </span>
                  ) : <span className="text-muted-foreground/70 text-xs">—</span>}
                </div>


                {/* Miles driven */}
                <div className="text-right font-mono text-xs tabular-nums">
                  {(() => {
                    const purchase = c.purchaseMileage ?? null;
                    const current = c.claimMileage ?? null;
                    if (purchase == null || current == null) {
                      return <span className="text-muted-foreground/70">—</span>;
                    }
                    const delta = Math.max(0, current - purchase);
                    return delta.toLocaleString();
                  })()}
                </div>

                {/* Claimed */}
                <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                  <EditableAmount
                    value={claimed}
                    ariaLabel="Edit claimed amount"
                    onSave={(next) => updateAmount(c.id, 'claimed_amount', next)}
                    className={claimed != null && claimed >= 1500 ? 'text-red-600 font-semibold' : ''}
                  />
                </div>

                {/* Paid */}
                <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                  <EditableAmount
                    value={paid}
                    ariaLabel="Edit paid amount"
                    onSave={(next) => updateAmount(c.id, 'paid_amount', next)}
                  />
                </div>

                {/* Saving/Loss */}
                <div
                  className={cn('text-right font-mono text-xs px-1.5 font-semibold', slTone)}
                  title="We paid − Customer claim (negative = saving, positive = loss)"
                >
                  {savingLoss == null
                    ? '—'
                    : savingLoss === 0
                      ? '£0'
                      : `${savingLoss < 0 ? '-£' : '+£'}${Math.abs(savingLoss).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                </div>

                {/* Notes */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSelect(c); }}
                  className="min-w-0 text-xs text-foreground/80 truncate flex items-center gap-1 text-left hover:text-foreground"
                  title={c.issue || 'Open notes'}
                >
                  {c.issue && c.issue !== '—' ? (
                    <>
                      <AlertCircle className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{c.issue}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/70">Add note…</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <ClaimStatusEmailPreviewDialog
        pending={pendingChange}
        onClose={() => setPendingChange(null)}
      />
    </div>
  );
};
