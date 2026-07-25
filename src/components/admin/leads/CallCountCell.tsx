import React, { memo, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Phone, Minus, Plus } from 'lucide-react';
import { Lead, LeadStatus } from '@/hooks/useLeads';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CallCountCellProps {
  lead: Lead;
  // Kept for prop compatibility with existing call sites; no longer used.
  onUpdateCallCount?: (increment: number) => void;
  onUpdateStatus?: (status: LeadStatus) => void;
  onScheduleFollowUp?: (actionType: string, actionDate: string) => void;
  onLogActivity?: (type: string, description: string) => void;
  agentId?: string;
  agentName?: string;
}

/**
 * Call counter — automatic, with a manual backup.
 *
 * The base number is derived by the database from real Dial 9 / Zoiper
 * outbound calls to the customer's phone number (see
 * `recompute_sales_lead_call_count`).
 *
 * The +/- buttons write to `sales_leads.manual_call_adjustment` — a separate
 * offset that survives every automatic recount. They exist as a BACKUP for
 * when the softphone/Dial 9 sync misses a call (e.g. agent dialled from a
 * mobile). Because the offset is stored apart from the auto count, a manual
 * bump can no longer be double-counted by the sync.
 */
export const CallCountCell: React.FC<CallCountCellProps> = memo(({ lead }) => {
  const [optimistic, setOptimistic] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const callCount = optimistic ?? (lead.call_count || 0);
  const adjustment = (lead as any).manual_call_adjustment ?? 0;

  const adjust = async (delta: 1 | -1, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (delta === -1 && callCount <= 0) return;
    setBusy(true);
    const next = Math.max(callCount + delta, 0);
    setOptimistic(next);
    const { data, error } = await supabase.rpc('adjust_sales_lead_call_count', {
      p_lead_id: lead.id,
      p_delta: delta,
    });
    setBusy(false);
    if (error) {
      setOptimistic(null);
      toast.error('Could not adjust the call count');
      return;
    }
    if (typeof data === 'number') setOptimistic(data);
  };

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <div className="flex items-center justify-center gap-0.5">
          <button
            type="button"
            onClick={(e) => adjust(-1, e)}
            disabled={busy || callCount <= 0}
            aria-label="Decrease call count"
            className="h-5 w-5 rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 flex items-center justify-center"
          >
            <Minus className="h-3 w-3" />
          </button>
          <Phone className={cn(
            "h-3 w-3 mx-0.5",
            callCount === 0 ? "text-muted-foreground" : "text-primary"
          )} />
          <span className={cn(
            "min-w-[18px] text-center text-sm font-medium tabular-nums",
            callCount === 0 && "text-muted-foreground",
            callCount > 0 && "text-primary"
          )}>
            {callCount}
          </span>
          <button
            type="button"
            onClick={(e) => adjust(1, e)}
            disabled={busy}
            aria-label="Increase call count"
            className="h-5 w-5 rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 flex items-center justify-center"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs">
        Counts real outbound calls via Dial 9 / Zoiper automatically.
        Use +/- only as a backup if a call wasn't picked up by the sync
        {adjustment !== 0 && ` (manual adjustment: ${adjustment > 0 ? '+' : ''}${adjustment})`}.
      </TooltipContent>
    </Tooltip>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.lead.id === nextProps.lead.id &&
    prevProps.lead.call_count === nextProps.lead.call_count &&
    (prevProps.lead as any).manual_call_adjustment === (nextProps.lead as any).manual_call_adjustment &&
    prevProps.lead.status === nextProps.lead.status
  );
});


CallCountCell.displayName = 'CallCountCell';
