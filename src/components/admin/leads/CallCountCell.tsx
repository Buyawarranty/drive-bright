import React, { memo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Phone } from 'lucide-react';
import { Lead, LeadStatus } from '@/hooks/useLeads';
import { cn } from '@/lib/utils';

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
 * Display-only call counter.
 *
 * The number shown here is derived by the database from real Dial 9 / Zoiper
 * outbound calls to the customer's phone number (see
 * `recompute_sales_lead_call_count` + trigger `trg_zoiper_events_recompute_call_count`).
 *
 * We deliberately removed the manual +/- buttons: the previous setup let the
 * agent's quick +1 and the Dial 9 sync both bump the counter, which produced
 * inflated numbers (e.g. "22" when only 3 calls happened). The counter now
 * equals the exact count of real dials — no agent can push a customer over
 * their attempt budget by fat-fingering the button, and the number can no
 * longer drift from reality.
 */
export const CallCountCell: React.FC<CallCountCellProps> = memo(({ lead }) => {
  const callCount = lead.call_count || 0;

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <div className="flex items-center justify-center gap-1">
          <Phone className={cn(
            "h-3 w-3",
            callCount === 0 ? "text-muted-foreground" : "text-primary"
          )} />
          <span className={cn(
            "min-w-[18px] text-center text-sm font-medium tabular-nums",
            callCount === 0 && "text-muted-foreground",
            callCount > 0 && "text-primary"
          )}>
            {callCount}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs">
        Real outbound calls to this customer via Dial 9 / Zoiper.
        Counts automatically — no manual adjustment.
      </TooltipContent>
    </Tooltip>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.lead.id === nextProps.lead.id &&
    prevProps.lead.call_count === nextProps.lead.call_count &&
    prevProps.lead.status === nextProps.lead.status
  );
});

CallCountCell.displayName = 'CallCountCell';
