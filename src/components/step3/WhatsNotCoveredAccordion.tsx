import React, { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Info,
  Search,
  Wrench,
  Droplets,
  Cog,
  History,
  CalendarX,
  Stethoscope,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'desktop' | 'mobile';

interface Item {
  id: string;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  summary: string;
  examples: string[];
  whyNote: string;
}

const ITEMS: Item[] = [
  {
    id: 'wear-and-tear',
    title: 'General wear & tear',
    Icon: History,
    summary: 'Parts that gradually deteriorate through normal everyday use.',
    examples: [
      'Worn brake pads and discs from regular braking',
      'Tyres losing tread over time',
      'Clutch friction plate worn from city driving',
      'Suspension bushes softening with age',
    ],
    whyNote:
      'Warranties are designed for sudden mechanical or electrical failure — not for parts reaching the end of their natural service life.',
  },
  {
    id: 'maintenance',
    title: 'Routine maintenance',
    Icon: Wrench,
    summary: 'Scheduled servicing work that keeps your car running.',
    examples: [
      'Annual or interval services',
      'MOT preparation and remedial work',
      'Cambelt / timing belt replacement at scheduled intervals',
      'Wheel alignment and tracking adjustments',
    ],
    whyNote:
      'Servicing is the owner’s responsibility — keeping up to date actually protects your cover.',
  },
  {
    id: 'consumables',
    title: 'Consumables & fluids',
    Icon: Droplets,
    summary: 'Items that are designed to be used up and replaced regularly.',
    examples: [
      'Engine oil, coolant, brake fluid, AdBlue',
      'Oil, air, fuel and pollen filters',
      'Wiper blades and bulbs',
      'Spark plugs and glow plugs (unless failed due to a covered component)',
    ],
    whyNote:
      'These are standard service items — covered by your garage’s service bill, not a mechanical warranty.',
  },
  {
    id: 'pre-existing',
    title: 'Pre-existing faults',
    Icon: ShieldAlert,
    summary: 'Anything that was already faulty before your policy started.',
    examples: [
      'Warning lights already on at point of sale',
      'Known issues flagged on a recent MOT advisory',
      'Faults the previous owner had diagnosed but not repaired',
      'Damage caused before the cover start date',
    ],
    whyNote:
      'Cover applies to failures that happen after your start date — that’s how all warranties work, and why the waiting period exists.',
  },
  {
    id: 'service-neglect',
    title: 'Service neglect or missed services',
    Icon: CalendarX,
    summary: 'Damage caused by skipping scheduled servicing.',
    examples: [
      'Engine damage from running on degraded oil',
      'Cambelt failure after a missed replacement interval',
      'Cooling system damage from old, untreated coolant',
      'DPF damage from ignored warning lights',
    ],
    whyNote:
      'Keep service records (any VAT-registered garage is fine) and you’ll have no issue here.',
  },
  {
    id: 'diagnostics',
    title: 'Diagnostics in specific scenarios',
    Icon: Stethoscope,
    summary: 'Diagnostic time is included when the fault is covered — not in every case.',
    examples: [
      'Diagnostics for a fault that turns out to be a wear item',
      'Investigation of warning lights that don’t indicate a covered failure',
      'Re-diagnosis after a previous repair you arranged outside the policy',
      'Pre-purchase or pre-MOT health checks',
    ],
    whyNote:
      'When a covered component fails, the linked diagnostic time is paid within your claim limit.',
  },
  {
    id: 'modifications-misuse',
    title: 'Modifications, misuse & accident damage',
    Icon: Cog,
    summary: 'Damage from changes or events outside normal driving.',
    examples: [
      'Remap, tuning chips, performance modifications',
      'Track use, racing or off-road driving',
      'Accident, collision, flood or fire damage',
      'Damage from using incorrect fuel',
    ],
    whyNote:
      'These sit with your motor insurer or the modification specialist — not your mechanical warranty.',
  },
];

interface Props {
  variant?: Variant;
  className?: string;
}

const WhatsNotCoveredAccordion: React.FC<Props> = ({ variant = 'desktop', className }) => {
  const [query, setQuery] = useState('');
  const isMobile = variant === 'mobile';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter((s) => {
      const hay = [s.title, s.summary, s.whyNote, ...s.examples].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  return (
    <div className={cn(isMobile ? 'p-0' : 'p-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-lg md:text-xl font-bold text-foreground leading-tight flex items-center gap-2">
            <Info className="w-5 h-5 text-primary flex-shrink-0" />
            What’s not covered?
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Plain English, no jargon — so you know exactly where your warranty starts and stops.
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
          Full transparency
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exclusions, e.g. ‘brake pads’, ‘oil’, ‘MOT’"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          aria-label="Search what’s not covered"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No matches. Try “wear”, “service”, “oil” or “modifications”.
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filtered.map((s) => {
            const Icon = s.Icon;
            return (
              <AccordionItem
                key={s.id}
                value={s.id}
                className="border border-border rounded-xl bg-card overflow-hidden data-[state=open]:shadow-sm"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-3 text-left w-full">
                    <span className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm md:text-[15px] font-semibold text-foreground leading-tight">
                        {s.title}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5 truncate">
                        {s.summary}
                      </span>
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-0">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Examples
                    </div>
                    <ul className="space-y-1.5">
                      {s.examples.map((ex, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                          <span className="leading-snug">{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                    <Info className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] leading-snug text-emerald-900">{s.whyNote}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <div className="mt-4 text-[12px] leading-snug text-muted-foreground">
        Your warranty is designed for sudden mechanical and electrical failure of insured parts.
        Anything outside that is shown above — clearly, before you pay.
      </div>
    </div>
  );
};

export default WhatsNotCoveredAccordion;
