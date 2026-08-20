import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LifeBuoy } from 'lucide-react';

interface SaveCancellationBadgeProps {
  /** Reward paid to the agent who saves the deal (defaults to £15). */
  reward?: number | null;
  reason?: string | null;
  compact?: boolean;
}

/**
 * "SAVE CANCELLATION" tag — a manager has pushed a cancelling customer back
 * into New Leads as a rescue job. Any agent can take it, but it must be phoned.
 */
export const SaveCancellationBadge: React.FC<SaveCancellationBadgeProps> = ({
  reward,
  reason,
  compact,
}) => (
  <Tooltip delayDuration={100}>
    <TooltipTrigger asChild>
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-900 border-amber-400 font-semibold tracking-wide flex items-center gap-0.5 flex-shrink-0"
      >
        <LifeBuoy className="h-3 w-3" />
        {compact ? `SAVE £${reward ?? 15}` : `SAVE CANCELLATION · £${reward ?? 15}`}
      </Badge>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-[260px] text-xs">
      <p className="font-semibold">Save this cancellation — £{reward ?? 15} reward</p>
      <p className="mt-1">Phone the customer to keep the policy. Any agent can take this lead.</p>
      {reason && <p className="mt-1 italic">{reason}</p>}
    </TooltipContent>
  </Tooltip>
);
