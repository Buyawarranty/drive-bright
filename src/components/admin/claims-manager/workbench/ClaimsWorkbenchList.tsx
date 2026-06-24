import React from 'react';
import { AlertTriangle, Ban, UserPlus, ChevronRight } from 'lucide-react';
import type { Claim } from '@/types/claim';
import { cn } from '@/lib/utils';
import { deriveStage, STAGE_META } from './statusMap';
import { computeSla, slaToneCls } from './sla';
import { MileageChip } from './MileageChip';
import { AssignMenu } from './AssignMenu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  claims: Claim[];
  selectedId?: string | null;
  onSelect: (c: Claim) => void;
  selectedIds: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onUpdated: () => void | Promise<void>;
  /** Map of assignee display name -> user_id, derived from useClaims staff lookup. */
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

const COLS =
  'grid grid-cols-[20px_16px_70px_minmax(0,1fr)_minmax(0,1fr)_88px_minmax(0,1.2fr)_minmax(0,140px)_minmax(0,140px)_minmax(0,110px)] gap-3';

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
        <span />
        <span>SLA</span>
        <span>Customer</span>
        <span>Vehicle</span>
        <span className="text-right">Amount</span>
        <span>Issue</span>
        <span>Status</span>
        <span>Next action</span>
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
          return (
            <div
              key={c.id}
              className={cn(
                COLS,
                'px-3 py-2.5 items-center text-sm hover:bg-muted/40 transition-colors cursor-pointer',
                isSelected && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
                isChecked && 'bg-primary/[0.03]',
              )}
              onClick={() => onSelect(c)}
            >
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggleOne(c.id)}
                  aria-label={`Select claim ${c.id}`}
                />
              </div>
              <span className={cn('h-2 w-2 rounded-full', priorityDot[c.priority])} title={`${c.priority} priority`} />
              <span className={cn('inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-semibold border', slaToneCls[sla.tone])}>
                {sla.label}
              </span>
              <div className="min-w-0 flex items-center gap-2">
                <div className="h-7 w-7 shrink-0 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-semibold">
                  {initials(c.customerName)}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{c.customerName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">BAW-{c.reg}</div>
                </div>
              </div>
              <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                <NumberPlate reg={c.reg} />
                <MileageChip purchase={c.purchaseMileage} current={c.claimMileage} />
                {c.hasCancellation && (
                  <span title="Policy cancelled" className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-red-100 text-red-700 border border-red-200">
                    <Ban className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>
              <div className={cn('text-right font-mono text-xs', c.amount >= 1500 ? 'text-red-600 font-semibold' : 'text-foreground')}>
                £{c.amount.toLocaleString()}
              </div>
              <div className="truncate text-xs text-foreground/80" title={c.issue}>{c.issue}</div>
              <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border w-fit', meta.cls)}>
                {meta.adminLabel}
              </span>
              <div className="text-[11px] text-muted-foreground truncate">{meta.nextAction}</div>
              <div
                className="text-[11px] truncate"
                onClick={(e) => e.stopPropagation()}
              >
                <AssignMenu
                  onAssign={(uid) => assignClaim(c.id, uid)}
                  trigger={
                    isUnassigned ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-[11px] font-semibold"
                      >
                        <UserPlus className="h-3 w-3" />
                        Assign
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-[11px] text-foreground/80 hover:text-foreground hover:underline"
                        title="Click to reassign"
                      >
                        <span className="h-4 w-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[8px] font-semibold">
                          {initials(c.assignee)}
                        </span>
                        <span className="truncate">{c.assignee}</span>
                      </button>
                    )
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
