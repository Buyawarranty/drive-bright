import React from 'react';
import { Snowflake, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type Rule = { when: string; what: string; note?: string };

/**
 * Lead Freeze rules, shown to every agent in New Leads.
 * Mirrors the policy the Auto block & unblock (Lead Freeze) assessment applies in
 * the ORR Lab — same windows, same wording — so agents always know where they stand.
 */
const RULES: Rule[] = [
  {
    when: '1 sale or fewer across any 2 consecutive agreed service days',
    what: 'One service-day Lead Freeze on your next agreed service day: new live, high-intent and newly allocated leads pause.',
    note: 'You keep working your existing leads and any recovery opportunities management assigns you.',
  },
  {
    when: '1 sale or fewer across any 3 consecutive agreed service days',
    what: 'A fixed two service-day Lead Freeze from your next agreed service day.',
    note: 'The fixed period does not end early if you make a sale during it. Reallocated leads are not automatically returned.',
  },
  {
    when: 'Before any freeze is applied',
    what: 'Management may hold a one-to-one with you first to understand the circumstances.',
    note: 'A quiet run alone is not a breach — but "bad leads" on its own will not stop the operational freeze either.',
  },
  {
    when: 'You have already hit or beaten your monthly revenue target',
    what: 'A freeze is not applied automatically — management look at your month as a whole.',
    note: 'The final decision sits with management, acting reasonably.',
  },
  {
    when: 'Repeat freezes, missed call minimums, leads not progressed, unavailability or inaccurate CRM records',
    what: 'Further service-performance or contractual action may follow.',
  },
];

export const LeadFreezeRulesCard: React.FC = () => {
  const [open, setOpen] = React.useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-card">
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-3 py-2 text-left">
        <Snowflake className="h-4 w-4 text-sky-600" />
        <span className="text-sm font-medium">Lead Freeze rules — how sales affect your lead flow</span>
        <span className="hidden sm:inline text-xs text-muted-foreground">
          2 quiet service days = 1 day freeze · 3 quiet service days = 2 day freeze
        </span>
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 py-3">
        <ul className="space-y-2.5">
          {RULES.map((r, i) => (
            <li key={r.when} className={cn('grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-4', i > 0 && 'pt-2.5 border-t')}>
              <span className="text-sm font-medium">{r.when}</span>
              <span className="text-sm text-muted-foreground">
                {r.what}
                {r.note ? <span className="mt-0.5 block text-xs opacity-90">{r.note}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          A "sale" means a completed and validated sale, and a "service day" means a day you are rota'd to work.
          Management can lift or hold a freeze at their discretion.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default LeadFreezeRulesCard;
