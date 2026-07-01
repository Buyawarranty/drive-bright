import React, { useState } from 'react';
import { Ban, ChevronDown, ChevronRight, Phone, FileText, Mail, Bell, PoundSterling } from 'lucide-react';
import type { Claim } from '@/types/claim';
import { cn } from '@/lib/utils';
import { deriveStage, STAGE_META, STAGE_TO_DB_STATUS, stageOrder, type WorkflowStage } from './statusMap';
import { computeSla, slaToneCls } from './sla';
import { MileageChip } from './MileageChip';
import { AssignMenu } from './AssignMenu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ClaimAmountEditDialog } from '@/components/admin/claims/ClaimAmountEditDialog';
import { ClaimStatusEmailPreviewDialog, type PendingClaimStatusChange } from '@/components/admin/claims/ClaimStatusEmailPreviewDialog';

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
  'grid grid-cols-[24px_190px_14px_76px_minmax(200px,1.3fr)_minmax(180px,1fr)_96px_minmax(220px,1.5fr)_150px_160px] gap-4 min-w-[1280px]';

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

  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);

  const moveStage = (c: Claim, target: WorkflowStage) => {
    const newStatus = STAGE_TO_DB_STATUS[target];
    // Close the stage popover first, then open the email review dialog on the
    // next tick. Without this, the popover's outside-click handler can race
    // with the dialog mount and silently swallow the open state — which is
    // what was preventing the Approve / Appeal emails from being prompted.
    setOpenPopoverId(null);
    setTimeout(() => {
      setPendingChange({
        claimId: c.id,
        status: newStatus,
        label: STAGE_META[target].adminLabel,
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
          toast({ title: 'Stage updated', description: `Moved to ${STAGE_META[target].adminLabel}.` });
          await onUpdated();
        },
      });
    }, 0);
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
      <div className={cn(COLS, 'px-3 py-2 border-b border-border bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground items-center')}>
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
        <span>Assignee</span>
      </div>
      <div className="overflow-y-auto divide-y divide-border">
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
                'group px-3 py-2.5 items-center text-sm hover:bg-muted/40 transition-colors',
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

                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSelect(c)}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                      aria-label="Reminders"
                    >
                      <Bell className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Reminders</TooltipContent>
                </Tooltip>
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
                  <div className="font-medium text-foreground truncate">{c.customerName}</div>
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

              {/* Status pill opens inline stage picker — quick move without opening drawer */}
              <div onClick={(e) => e.stopPropagation()}>
                <Popover open={openPopoverId === c.id} onOpenChange={(o) => setOpenPopoverId(o ? c.id : null)}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={stageBusyId === c.id}
                      className={cn(
                        'inline-flex items-center justify-between gap-2 px-3 py-1 rounded-md text-xs font-medium w-fit min-w-[110px] hover:opacity-90 transition disabled:opacity-50',
                        softTone,
                      )}
                      title="Change stage"
                    >
                      <span className="truncate">{meta.adminLabel}</span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Move to stage</div>
                    <div className="flex flex-wrap gap-1.5">
                      {stageOrder.filter((s) => s !== 'cancelled').map((s) => {
                        const active = s === stage;
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={active || stageBusyId === c.id}
                            onClick={() => moveStage(c, s)}
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-medium transition',
                              active
                                ? 'bg-muted border-border text-muted-foreground cursor-default'
                                : 'bg-card border-border hover:bg-muted text-foreground',
                            )}
                          >
                            {STAGE_META[s].adminLabel}
                            {!active && <ChevronRight className="h-3 w-3" />}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelect(c)}
                      className="mt-3 text-[11px] text-primary hover:underline"
                    >
                      Open full claim →
                    </button>
                  </PopoverContent>
                </Popover>
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
