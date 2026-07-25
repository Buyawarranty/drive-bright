import React, { memo, useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Phone, Minus, Plus } from 'lucide-react';
import { Lead, LeadStatus } from '@/hooks/useLeads';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addSystemNote } from '@/utils/leadSystemNotes';
import { subscribeLiveCallStats, primeLiveCallStat, LiveCallStat } from '@/lib/liveCallStats';


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
 * `recompute_sales_lead_call_count`). A shared 30s poller keeps the number
 * live while the leads list is open, so calls made right now show up without
 * a page refresh.
 *
 * The +/- buttons write to `sales_leads.manual_call_adjustment` — a separate
 * offset that survives every automatic recount. They exist as a BACKUP for
 * when the softphone/Dial 9 sync misses a call (e.g. agent dialled from a
 * mobile). Because the offset is stored apart from the auto count, a manual
 * bump can no longer be double-counted by the sync.
 */
export const CallCountCell: React.FC<CallCountCellProps> = memo(({ lead, agentId }) => {
  const [optimistic, setOptimistic] = useState<number | null>(null);
  const [lastCallOverride, setLastCallOverride] = useState<string | null>(null);
  const [live, setLive] = useState<LiveCallStat | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep this row's counter in sync with Dial 9 events as they land.
  useEffect(() => {
    setLive(null);
    setOptimistic(null);
    setLastCallOverride(null);
    return subscribeLiveCallStats(lead.id, (stat) => setLive(stat));
  }, [lead.id]);

  const callCount = optimistic ?? live?.call_count ?? (lead.call_count || 0);
  const adjustment = live?.manual_call_adjustment ?? (lead as any).manual_call_adjustment ?? 0;
  const lastContacted = lastCallOverride ?? live?.last_contacted_at ?? (lead as any).last_contacted_at ?? null;


  const formatWhen = (iso: string) => {
    const d = new Date(iso);
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    const rel =
      mins < 1 ? 'just now'
      : mins < 60 ? `${mins}m ago`
      : mins < 1440 ? `${Math.round(mins / 60)}h ago`
      : `${Math.round(mins / 1440)}d ago`;
    return `${d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} (${rel})`;
  };

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
    const confirmed = typeof data === 'number' ? data : next;
    setOptimistic(confirmed);
    // Prime the shared poller cache so the next poll doesn't flash the old value.
    primeLiveCallStat(lead.id, {
      call_count: confirmed,
      manual_call_adjustment: adjustment + delta,
      last_contacted_at: delta === 1 ? new Date().toISOString() : lastContacted,
    });


    if (delta === 1) {
      const nowIso = new Date().toISOString();
      setLastCallOverride(nowIso);
      // Stamp the contact time so "last call" is visible everywhere
      supabase
        .from('sales_leads')
        .update({ last_contacted_at: nowIso })
        .eq('id', lead.id)
        .then(() => {});
      addSystemNote(
        lead.id,
        `📞 Call logged manually (call #${next}) — not captured by Dial 9 / Zoiper sync.`,
        agentId ?? null
      );
      toast.success('Call logged to notes');
    } else {
      addSystemNote(lead.id, `↩️ Manual call count corrected down (now ${next}).`, agentId ?? null);
    }
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
      <TooltipContent side="top" className="max-w-[260px] text-xs space-y-1">
        <div className="font-medium">
          {lastContacted ? `Last call: ${formatWhen(lastContacted)}` : 'No call logged yet'}
        </div>
        <div>
          Counts real outbound calls via Dial 9 / Zoiper automatically. Use +/- only as a backup —
          each manual + writes a timestamped note to the lead
          {adjustment !== 0 && ` (manual adjustment: ${adjustment > 0 ? '+' : ''}${adjustment})`}.
        </div>
      </TooltipContent>
    </Tooltip>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.lead.id === nextProps.lead.id &&
    prevProps.lead.call_count === nextProps.lead.call_count &&
    (prevProps.lead as any).manual_call_adjustment === (nextProps.lead as any).manual_call_adjustment &&
    (prevProps.lead as any).last_contacted_at === (nextProps.lead as any).last_contacted_at &&
    prevProps.lead.status === nextProps.lead.status
  );
});



CallCountCell.displayName = 'CallCountCell';
