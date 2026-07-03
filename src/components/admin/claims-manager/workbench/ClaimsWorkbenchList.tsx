import React, { useState, useEffect, useRef } from 'react';
import { ThumbsUp, ThumbsDown, Phone, Mail } from 'lucide-react';
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

// Simplified admin status options for the row dropdown.
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

const NumberPlate: React.FC<{ reg: string }> = ({ reg }) => (
  <span className="inline-block px-1.5 py-0.5 rounded bg-yellow-300 border border-slate-800 text-slate-900 font-mono font-bold text-[10px] tracking-wider whitespace-nowrap">
    {reg}
  </span>
);

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

// Column order: checkbox | STATUS | customer | reg | email | phone | date | claimed | approved | diff | review
const COLS =
  'grid grid-cols-[24px_160px_minmax(180px,1.3fr)_100px_minmax(200px,1.4fr)_130px_110px_110px_110px_110px_140px] gap-4 min-w-[1480px]';

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
          <span>Status</span>
          <span>Customer Name</span>
          <span>Reg</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Claim date</span>
          <span className="text-right">Claimed</span>
          <span className="text-right">Approved</span>
          <span className="text-right">Difference</span>
          <span>TP Review</span>
        </div>
        <div className="divide-y divide-border">
          {claims.map((c) => {
            const isSelected = selectedId === c.id;
            const isChecked = selectedIds.has(c.id);
            const currentStatusValue = deriveSimpleStatus(c);
            const currentStatusMeta = STATUS_META[currentStatusValue];
            const claimed = c.claimedAmount ?? null;
            const paid = c.paidAmount ?? null;
            const diff = claimed != null && paid != null ? claimed - paid : null;
            const diffTone =
              diff == null ? 'text-muted-foreground/70'
              : diff > 0 ? 'text-amber-700'
              : diff < 0 ? 'text-rose-700'
              : 'text-emerald-700';

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

                {/* Status */}
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

                {/* Customer */}
                <div className="min-w-0 flex items-center gap-2">
                  <div className="h-7 w-7 shrink-0 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-semibold">
                    {initials(c.customerName)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{c.customerName}</div>
                  </div>
                </div>

                {/* Reg */}
                <div className="min-w-0"><NumberPlate reg={c.reg} /></div>

                {/* Email */}
                <div className="min-w-0 truncate text-xs text-foreground/80" title={c.email} onClick={(e) => e.stopPropagation()}>
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-orange-600">
                      <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{c.email}</span>
                    </a>
                  ) : <span className="text-muted-foreground/70">—</span>}
                </div>

                {/* Phone */}
                <div className="min-w-0 truncate text-xs text-foreground/80" onClick={(e) => e.stopPropagation()}>
                  {c.phone ? (
                    <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-green-700">
                      <Phone className="h-3 w-3 shrink-0 text-green-600" />
                      <span className="truncate">{c.phone}</span>
                    </a>
                  ) : <span className="text-muted-foreground/70">—</span>}
                </div>

                {/* Claim date */}
                <div className="text-xs text-foreground/80 tabular-nums">
                  {c.date || '—'}
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

                {/* Approved */}
                <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                  <EditableAmount
                    value={paid}
                    ariaLabel="Edit approved amount"
                    onSave={(next) => updateAmount(c.id, 'paid_amount', next)}
                  />
                </div>

                {/* Difference */}
                <div className={cn('text-right font-mono text-xs px-1.5', diffTone)} title="Claimed − Approved">
                  {diff == null
                    ? '—'
                    : `${diff < 0 ? '-' : ''}£${Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                </div>

                {/* TP Review */}
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
                      aria-label="Positive review"
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
                      aria-label="Negative review"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </ReviewNotePopover>
                </div>
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
