import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import type { RepeatCustomerInfo } from '@/hooks/useRepeatCustomers';

/**
 * "REPEAT" tag — the lead has bought from us before. Shown in the New Leads
 * table and on the new-lead allocation pop-ups so agents know instantly.
 */
export const RepeatCustomerBadge: React.FC<{ info?: RepeatCustomerInfo; compact?: boolean }> = ({ info, compact }) => {
  if (!info) return null;

  const detail = [
    info.policyCount > 1 ? `${info.policyCount} previous policies` : '1 previous policy',
    info.lastPurchaseAt ? `last bought ${format(new Date(info.lastPurchaseAt), 'dd/MM/yyyy')}` : null,
    info.lastPlanType ? `plan: ${info.lastPlanType}` : null,
    info.matchedOn === 'reg' ? 'matched on registration' : 'matched on email',
  ].filter(Boolean).join(' • ');

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold tracking-wide flex items-center gap-0.5 flex-shrink-0"
        >
          <UserCheck className="h-3 w-3" />
          {compact ? 'REPEAT' : 'REPEAT CUSTOMER'}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Existing customer — {detail}
      </TooltipContent>
    </Tooltip>
  );
};
