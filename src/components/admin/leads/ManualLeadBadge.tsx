import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PencilLine } from 'lucide-react';

/**
 * "ADDED MANUALLY" tag — the lead was created by an agent in the CRM rather
 * than arriving from the website, so agents know it's not a web enquiry.
 */
export const ManualLeadBadge: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <Tooltip delayDuration={100}>
    <TooltipTrigger asChild>
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0.5 bg-sky-50 text-sky-800 border-sky-300 font-semibold tracking-wide flex items-center gap-0.5 flex-shrink-0"
      >
        <PencilLine className="h-3 w-3" />
        {compact ? 'MANUAL' : 'ADDED MANUALLY'}
      </Badge>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs">
      Added manually by an agent — not a website enquiry
    </TooltipContent>
  </Tooltip>
);
