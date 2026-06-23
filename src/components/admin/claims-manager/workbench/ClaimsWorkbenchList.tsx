import React from 'react';
import { AlertTriangle, Ban } from 'lucide-react';
import type { Claim } from '@/types/claim';
import { cn } from '@/lib/utils';
import { deriveStage, STAGE_META } from './statusMap';
import { computeSla, slaToneCls } from './sla';

interface Props {
  claims: Claim[];
  selectedId?: string | null;
  onSelect: (c: Claim) => void;
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

export const ClaimsWorkbenchList: React.FC<Props> = ({ claims, selectedId, onSelect }) => {
  if (claims.length === 0) {
    return (
      <div className="flex-1 bg-card border border-border rounded-lg flex items-center justify-center text-sm text-muted-foreground py-16">
        No claims match this queue.
      </div>
    );
  }

  return (
    <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
      <div className="grid grid-cols-[16px_70px_minmax(0,1fr)_minmax(0,1fr)_88px_minmax(0,1.2fr)_minmax(0,140px)_minmax(0,140px)_80px] gap-3 px-3 py-2 border-b border-border bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className={cn(
                'w-full text-left grid grid-cols-[16px_70px_minmax(0,1fr)_minmax(0,1fr)_88px_minmax(0,1.2fr)_minmax(0,140px)_minmax(0,140px)_80px] gap-3 px-3 py-2.5 items-center text-sm hover:bg-muted/40 transition-colors',
                isSelected && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
              )}
            >
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
              <div className="min-w-0 flex items-center gap-1.5">
                <NumberPlate reg={c.reg} />
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
              <div className="text-[11px] truncate">
                {isUnassigned ? (
                  <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                    <AlertTriangle className="h-3 w-3" />
                    Unassigned
                  </span>
                ) : (
                  <span className="text-foreground/80">{c.assignee}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
