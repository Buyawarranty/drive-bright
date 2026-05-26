import React, { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  Wrench,
  Wallet,
  Settings2,
  XCircle,
  Clock3,
  Scale,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'desktop' | 'mobile';

interface Section {
  id: string;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  summary: string;
  /** Short, scannable bullets shown by default when expanded */
  highlights: string[];
  /** Optional “read more” deeper detail */
  detail?: string;
}

const SECTIONS: Section[] = [
  {
    id: 'key-terms',
    title: 'Key terms at a glance',
    Icon: FileText,
    summary: 'The essentials of how your warranty works.',
    highlights: [
      'Covers sudden mechanical & electrical failure of insured parts.',
      'Cover starts after a short waiting period from your start date.',
      'Pay monthly or upfront — same level of cover either way.',
      'UK-wide cover, repairs at any VAT-registered garage.',
    ],
    detail:
      'Your warranty is a contract between you and the administrator. The full Terms & Conditions document is sent on purchase and is available on request before checkout.',
  },
  {
    id: 'claim-conditions',
    title: 'Claim conditions',
    Icon: ShieldCheck,
    summary: 'What we need from you when something goes wrong.',
    highlights: [
      'Stop driving as soon as a fault is suspected to avoid further damage.',
      'Call our claims line before any work begins — authorisation required.',
      'Use a VAT-registered garage; we can recommend one if needed.',
      'Provide your policy number, mileage and a brief fault description.',
    ],
    detail:
      'Once authorised, the garage diagnoses the fault, we approve the repair and settle directly with them up to your claim limit. Any amount above your claim limit, plus your voluntary excess, is payable by you.',
  },
  {
    id: 'exclusions',
    title: 'Exclusions',
    Icon: XCircle,
    summary: 'Things that are not covered under any warranty.',
    highlights: [
      'Pre-existing faults present before the policy start date.',
      'Routine servicing, MOT work and consumables (oil, filters, bulbs).',
      'Cosmetic damage, bodywork, paint, glass and trim.',
      'Damage from accident, misuse, modification or neglect.',
    ],
    detail:
      'Full category-level exclusions are listed in the “What’s covered” accordion above (red “Not covered” panel for each component).',
  },
  {
    id: 'wear-and-tear',
    title: 'Wear & tear explained',
    Icon: Settings2,
    summary: 'How gradual wear is treated vs sudden failure.',
    highlights: [
      'Sudden mechanical/electrical failure = covered.',
      'Gradual deterioration through normal use = not covered.',
      'Items with a defined service life (clutch friction plate, brake pads, tyres) are wear items.',
      'If a wear item fails prematurely due to a covered component, the linked failure is assessed on its own merits.',
    ],
  },
  {
    id: 'labour-rules',
    title: 'Labour & claim limit rules',
    Icon: Wrench,
    summary: 'How labour rates and claim limits apply to a repair.',
    highlights: [
      'Your selected claim limit is the maximum we pay per single claim.',
      'Your selected labour rate is the maximum £/hour we contribute.',
      'Garage diagnostic time is included within the claim limit when the claim is valid.',
      'Parts are paid at trade/OE-equivalent cost; we don’t fund upgrades.',
    ],
    detail:
      'You can change your claim limit and labour rate at the top of this page — the price updates instantly so you can see the trade-off.',
  },
  {
    id: 'servicing',
    title: 'Servicing requirements',
    Icon: Wallet,
    summary: 'Keep cover valid by servicing on schedule.',
    highlights: [
      'Service the vehicle in line with the manufacturer’s schedule.',
      'Keep receipts / digital service records — you may be asked for proof.',
      'Servicing can be done at any VAT-registered garage, not just a main dealer.',
      'Missed services can invalidate related claims.',
    ],
  },
  {
    id: 'cancellation',
    title: 'Cancellation rights',
    Icon: Scale,
    summary: 'You can cancel at any time — here’s how it works.',
    highlights: [
      'Full refund within the 14-day cooling-off period if no claim has been made.',
      'After 14 days, a pro-rata refund applies (less any claims paid).',
      'Cancel by email, phone or via your account — no awkward calls.',
      'No cancellation fee for cooling-off cancellations.',
    ],
  },
  {
    id: 'cooling-off',
    title: '14-day cooling-off period',
    Icon: Clock3,
    summary: 'Try the policy risk-free for 14 days.',
    highlights: [
      'Starts on the day your policy is issued.',
      'Full refund if you change your mind and haven’t claimed.',
      'You stay covered during the cooling-off period.',
      'Required by UK consumer regulations — your statutory right.',
    ],
  },
];

interface Props {
  variant?: Variant;
  className?: string;
}

const PolicyTermsAccordion: React.FC<Props> = ({ variant = 'desktop', className }) => {
  const [query, setQuery] = useState('');
  const [openDetail, setOpenDetail] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter((s) => {
      const hay = [s.title, s.summary, ...(s.highlights || []), s.detail || '']
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  const isMobile = variant === 'mobile';

  return (
    <div className={cn(isMobile ? 'p-0' : 'p-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-lg md:text-xl font-bold text-foreground leading-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary flex-shrink-0" />
            Policy &amp; Terms
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Everything you’d normally have to dig for — clearly summarised, before you pay.
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          <ShieldCheck className="w-3 h-3" /> Full transparency
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search terms, exclusions, cancellation…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          aria-label="Search policy and terms"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No matches. Try “excess”, “cancel”, “service” or “labour”.
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filtered.map((s) => {
            const Icon = s.Icon;
            const showDetail = !!openDetail[s.id];
            return (
              <AccordionItem
                key={s.id}
                value={s.id}
                className="border border-border rounded-xl bg-card overflow-hidden data-[state=open]:shadow-sm"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline group">
                  <div className="flex items-center gap-3 text-left w-full">
                    <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4.5 h-4.5" />
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
                  <ul className="space-y-2 mt-1">
                    {s.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">{h}</span>
                      </li>
                    ))}
                  </ul>

                  {s.detail && (
                    <div className="mt-3">
                      {!showDetail ? (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenDetail((prev) => ({ ...prev, [s.id]: true }))
                          }
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Read more
                        </button>
                      ) : (
                        <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs leading-relaxed text-foreground/80">
                          {s.detail}
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenDetail((prev) => ({ ...prev, [s.id]: false }))
                              }
                              className="text-xs font-semibold text-primary hover:underline"
                            >
                              Show less
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Reassurance footer */}
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-[12px] leading-snug text-amber-900">
          Summaries are written in plain English for clarity. The full policy wording is
          authoritative and sent to you on purchase — and available on request before you pay.
        </p>
      </div>
    </div>
  );
};

export default PolicyTermsAccordion;
