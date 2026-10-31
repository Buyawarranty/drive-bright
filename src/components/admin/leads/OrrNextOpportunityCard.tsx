import React from 'react';
import { Info, Lock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { LEAD_TYPE_LABELS, type OrrLeadType } from '@/lib/orrPractice/leadBadges';

/**
 * Agent view — "Next Available Opportunity" card.
 *
 * One shared lead at a time, first to claim. Only the lead reference, source,
 * type, age, call counts and chase day are shown — the customer's name, phone,
 * email and reg stay hidden until the agent claims the lead. Practice only.
 */
export interface NextOpportunityLead {
  id: string;
  leadRef: string;
  sourceLabel: string;
  leadType: OrrLeadType;
  ageLabel: string;
  callsToday: number;
  callsTotal: number;
  chaseDay: number;
}

const TYPE_STYLES: Record<OrrLeadType, string> = {
  overnight: 'bg-rose-100 text-rose-800 border border-rose-200',
  live: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  callback: 'bg-sky-100 text-sky-800 border border-sky-200',
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-[72px]">
    <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">{label}</div>
    <div className="text-sm font-semibold text-foreground mt-0.5">{children}</div>
  </div>
);

export const OrrNextOpportunityCard: React.FC<{
  lead: NextOpportunityLead | null;
  chaseDays: number;
  onClaim: (leadId: string) => void;
  claimDisabledReason?: string | null;
}> = ({ lead, chaseDays, onClaim, claimDisabledReason }) => (
  <section className="rounded-xl border-2 border-emerald-300 bg-emerald-50/50 shadow-sm p-4">
    <div className="flex items-start gap-3 flex-wrap">
      <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
        <Zap className="h-5 w-5 text-emerald-600" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold text-foreground">
          Open Round Robin — <span className="text-emerald-800">Next Available Opportunity</span>
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Shared lead (first to claim) · Customer details hidden until claimed
        </p>
      </div>
    </div>

    {lead ? (
      <div className="mt-3 flex items-center gap-x-6 gap-y-3 flex-wrap">
        <Field label="Lead Ref">{lead.leadRef}</Field>
        <Field label="Source">{lead.sourceLabel}</Field>
        <Field label="Lead Type">
          <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', TYPE_STYLES[lead.leadType])}>
            {LEAD_TYPE_LABELS[lead.leadType]}
          </span>
        </Field>
        <Field label="Age">{lead.ageLabel}</Field>
        <Field label="Calls (Today / Total)">
          <span className="tabular-nums">{lead.callsToday} / {lead.callsTotal}</span>
        </Field>
        <Field label="Chase Day">
          Day {lead.chaseDay} of {chaseDays}
        </Field>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              Claiming is voluntary — there is no penalty for letting a lead pass. You can hold at most 2 unworked
              claimed leads; record an outcome to free a slot.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="ml-auto flex flex-col items-end gap-1">
          <Button
            onClick={() => onClaim(lead.id)}
            disabled={!!claimDisabledReason}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            <Zap className="h-4 w-4 mr-1.5" /> Claim Lead
          </Button>
          {claimDisabledReason && (
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <Lock className="h-3 w-3" /> {claimDisabledReason}
            </span>
          )}
        </div>
      </div>
    ) : (
      <p className="mt-3 text-sm text-muted-foreground">
        No shared opportunity right now — released leads appear here as capacity opens up.
      </p>
    )}
  </section>
);

export default OrrNextOpportunityCard;
