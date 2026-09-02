/**
 * APPEAL — merged into the main claims list.
 * ---------------------------------------------------------------------------
 * There is no longer a separate "Appeals" section. Instead, every claim row
 * shows its appeal state inline:
 *   • no appeal yet  → a gavel button that opens the appeal email builder
 *                      (preview first, then send the secure appeal link)
 *   • appeal open     → a big amber "APPEAL MADE" tag
 *   • appeal returned → the tag turns orange and reads "APPEAL BACK"
 */

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Gavel } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface ClaimAppealState {
  /** An appeal has been opened on this claim. */
  open: boolean;
  /** The customer has sent their appeal back with details/evidence. */
  returned: boolean;
}

/** Appeal state for every claim currently on screen. */
export const useClaimAppealStates = (claimIds: string[]) => {
  const [states, setStates] = useState<Record<string, ClaimAppealState>>({});
  const key = claimIds.join(',');

  const fetchStates = useCallback(async () => {
    const ids = key ? key.split(',') : [];
    if (ids.length === 0) { setStates({}); return; }

    const [{ data: appeals }, { data: responses }] = await Promise.all([
      supabase.from('claim_appeals').select('claim_id').is('closed_at', null).in('claim_id', ids),
      supabase.from('claim_update_responses').select('claim_id').in('claim_id', ids),
    ]);

    const returnedSet = new Set((responses || []).map((r: any) => r.claim_id));
    const map: Record<string, ClaimAppealState> = {};
    (appeals || []).forEach((a: any) => {
      map[a.claim_id] = { open: true, returned: returnedSet.has(a.claim_id) };
    });
    setStates(map);
  }, [key]);

  useEffect(() => { fetchStates(); }, [fetchStates]);

  return {
    appealState: (id: string): ClaimAppealState => states[id] || { open: false, returned: false },
    appealCount: Object.keys(states).length,
    refetchAppeals: fetchStates,
  };
};

/** Big inline tag shown against a claim that has an appeal. */
export const AppealMadeTag: React.FC<{ state: ClaimAppealState; onClick?: () => void }> = ({ state, onClick }) => {
  if (!state.open) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap',
              state.returned
                ? 'bg-[#E8541A] border-[#E8541A] text-white animate-pulse'
                : 'bg-amber-100 border-amber-300 text-amber-800',
            )}
          >
            <Gavel className="h-3 w-3" />
            {state.returned ? 'Appeal back' : 'Appeal made'}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] text-xs">
          {state.returned
            ? 'The customer has sent their appeal back with details and evidence — open the claim to read it.'
            : 'An appeal has been opened on this claim and is waiting on the customer.'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/** Row action: build, preview and send the appeal email for this claim. */
export const SendAppealEmailButton: React.FC<{ hasAppeal: boolean; onClick: () => void }> = ({ hasAppeal, onClick }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className={cn(
            'h-7 w-7 inline-flex items-center justify-center rounded-md border transition',
            hasAppeal
              ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200'
              : 'bg-card border-border text-muted-foreground hover:bg-amber-50 hover:text-amber-700',
          )}
          aria-label="Send appeal email"
        >
          <Gavel className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs">
        {hasAppeal
          ? 'Appeal already open — resend or update the appeal email (you can preview it before sending).'
          : 'Send this customer the appeal email with their secure appeal link. You can preview the email before it goes out.'}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
