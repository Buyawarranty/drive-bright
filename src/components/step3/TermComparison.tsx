import React, { useState } from 'react';
import { Check, ChevronDown, TrendingDown, Award, ShieldCheck, CalendarRange, Lock, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type PaymentType = '12months' | '24months' | '36months';
type Variant = 'desktop' | 'mobile';

interface Props {
  variant?: Variant;
  selectedTerm: PaymentType | null;
  onSelectTerm?: (t: PaymentType) => void;
  availableTerms: PaymentType[];
  className?: string;
}

const TERM_LABEL: Record<PaymentType, string> = {
  '12months': '1 year',
  '24months': '2 years',
  '36months': '3 years',
};

const BADGES: Partial<Record<PaymentType, { text: string; tone: 'orange' | 'green' }>> = {
  '24months': { text: 'Most customers choose this', tone: 'orange' },
  '36months': { text: 'Best long-term value', tone: 'green' },
};

interface Row {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  values: Record<PaymentType, { tier: 0 | 1 | 2 | 3; text?: string }>;
}

const ROWS: Row[] = [
  {
    label: 'Monthly savings vs 1 year',
    Icon: TrendingDown,
    values: {
      '12months': { tier: 1, text: 'Baseline' },
      '24months': { tier: 2, text: 'Better' },
      '36months': { tier: 3, text: 'Best' },
    },
  },
  {
    label: 'Extra benefits included',
    Icon: Award,
    values: {
      '12months': { tier: 1, text: 'Standard' },
      '24months': { tier: 2, text: 'Extras' },
      '36months': { tier: 3, text: 'All extras' },
    },
  },
  {
    label: 'Price locked-in (no rises)',
    Icon: Lock,
    values: {
      '12months': { tier: 1, text: '12 months' },
      '24months': { tier: 2, text: '24 months' },
      '36months': { tier: 3, text: '36 months' },
    },
  },
  {
    label: 'Coverage continuity',
    Icon: CalendarRange,
    values: {
      '12months': { tier: 1, text: 'Short term' },
      '24months': { tier: 2, text: 'Continuous' },
      '36months': { tier: 3, text: 'Fully continuous' },
    },
  },
  {
    label: 'Payment advantages',
    Icon: Heart,
    values: {
      '12months': { tier: 1, text: '12 payments' },
      '24months': { tier: 2, text: 'No payments in year 2' },
      '36months': { tier: 3, text: 'No payments in years 2 & 3' },
    },
  },
];

const INCLUDED: Record<PaymentType, string[]> = {
  '12months': [
    'Full Platinum Complete cover for 12 months',
    'Claims handling, UK call centre support',
    '14-day cooling-off period',
    'Repairs at any VAT-registered garage',
  ],
  '24months': [
    'Everything in the 1-year plan',
    'No payments in year 2 — cover continues',
    'Price locked in for 24 months',
    'Extra benefits package included',
    'Free policy transfer if you sell the car',
  ],
  '36months': [
    'Everything in the 2-year plan',
    'No payments in years 2 & 3 — cover continues',
    'Maximum price protection (36 months)',
    'All extra benefits included',
    'Priority claims handling',
    'Best total value per year of cover',
  ],
};

const Pip: React.FC<{ filled: boolean }> = ({ filled }) => (
  <span
    className={cn(
      'inline-block w-2 h-2 rounded-full',
      filled ? 'bg-emerald-500' : 'bg-muted'
    )}
  />
);

const TierCell: React.FC<{ tier: 0 | 1 | 2 | 3; text?: string; emphasize?: boolean }> = ({
  tier,
  text,
  emphasize,
}) => (
  <div className={cn('flex flex-col items-center gap-1.5 py-2', emphasize && 'font-semibold')}>
    <div className="flex items-center gap-1">
      <Pip filled={tier >= 1} />
      <Pip filled={tier >= 2} />
      <Pip filled={tier >= 3} />
    </div>
    {text && <span className="text-[11px] text-muted-foreground text-center leading-tight">{text}</span>}
  </div>
);

const TermComparison: React.FC<Props> = ({
  variant = 'desktop',
  selectedTerm,
  onSelectTerm,
  availableTerms,
  className,
}) => {
  const isMobile = variant === 'mobile';
  const terms = (['12months', '24months', '36months'] as PaymentType[]).filter((t) =>
    availableTerms.includes(t)
  );

  return (
    <div className={cn('mt-4', className)}>
      {/* Comparison table */}
      <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm md:text-[15px] font-bold text-foreground leading-tight">
              Compare your options
            </h4>
            <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
              Longer cover = stronger value, more benefits, more peace of mind.
            </p>
          </div>
          <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 hidden sm:block" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="bg-card/60">
                <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Feature
                </th>
                {terms.map((t) => {
                  const sel = selectedTerm === t;
                  const badge = BADGES[t];
                  return (
                    <th
                      key={t}
                      className={cn(
                        'px-2 py-2 text-center text-[12px] font-bold relative',
                        sel ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectTerm?.(t)}
                        className={cn(
                          'w-full rounded-md px-1 py-1 transition-colors',
                          sel ? 'bg-primary/10' : 'hover:bg-muted'
                        )}
                      >
                        {TERM_LABEL[t]}
                      </button>
                      {badge && (
                        <span
                          className={cn(
                            'absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap text-white',
                            badge.tone === 'green' ? 'bg-emerald-600' : 'bg-orange-500'
                          )}
                        >
                          {badge.text}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, idx) => {
                const Icon = row.Icon;
                return (
                  <tr
                    key={row.label}
                    className={cn('border-t border-border', idx % 2 === 1 ? 'bg-card/40' : '')}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-[12px] md:text-[13px] text-foreground/90 leading-tight">
                          {row.label}
                        </span>
                      </div>
                    </td>
                    {terms.map((t) => (
                      <td key={t} className={cn(selectedTerm === t && 'bg-primary/5')}>
                        <TierCell
                          tier={row.values[t].tier}
                          text={row.values[t].text}
                          emphasize={selectedTerm === t}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* What's included per plan */}
      <div className="mt-3">
        <Accordion type="multiple" className="space-y-2">
          {terms.map((t) => (
            <AccordionItem
              key={t}
              value={t}
              className="border border-border rounded-xl bg-card overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 text-left w-full">
                  <span
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[12px] font-extrabold',
                      selectedTerm === t
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-primary/10 text-primary'
                    )}
                  >
                    {t === '12months' ? '1Y' : t === '24months' ? '2Y' : '3Y'}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm md:text-[15px] font-semibold text-foreground leading-tight">
                      What’s included in the {TERM_LABEL[t]} plan
                    </span>
                    {BADGES[t] && (
                      <span className="block text-[11px] text-muted-foreground mt-0.5">
                        {BADGES[t]!.text}
                      </span>
                    )}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
                <ul className="space-y-1.5">
                  {INCLUDED[t].map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="leading-snug">{line}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};

export default TermComparison;
