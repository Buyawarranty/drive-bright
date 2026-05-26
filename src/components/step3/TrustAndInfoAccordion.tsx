import React, { useState } from 'react';
import { ShieldCheck, XCircle, FileText, HelpCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import TrustBlocks from './TrustBlocks';
import WhatsNotCoveredAccordion from './WhatsNotCoveredAccordion';
import PolicyTermsAccordion from './PolicyTermsAccordion';
import CheckoutFAQ from './CheckoutFAQ';

type Variant = 'desktop' | 'mobile';

interface Section {
  id: string;
  title: string;
  subtitle: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  titleColor: string;
  chevronColor: string;
  render: (variant: Variant) => React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'trust',
    title: 'Why drivers choose us',
    subtitle: 'No jargon. No surprises. Just great protection so you can drive with confidence.',
    Icon: ShieldCheck,
    bg: 'bg-emerald-50/60 hover:bg-emerald-50',
    border: 'border border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    titleColor: 'text-emerald-700',
    chevronColor: 'text-emerald-600',
    render: (v) => <TrustBlocks variant={v} />,
  },
  {
    id: 'not-covered',
    title: "What's not covered",
    subtitle: 'Clear exclusions so there are no surprises.',
    Icon: XCircle,
    bg: 'bg-rose-50/60 hover:bg-rose-50',
    border: 'border border-rose-200',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    titleColor: 'text-rose-700',
    chevronColor: 'text-rose-500',
    render: (v) => <WhatsNotCoveredAccordion variant={v} />,
  },
  {
    id: 'policy',
    title: 'Policy summary',
    subtitle: 'Key terms and important information.',
    Icon: FileText,
    bg: 'bg-amber-50/60 hover:bg-amber-50',
    border: 'border border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    titleColor: 'text-amber-800',
    chevronColor: 'text-amber-600',
    render: (v) => (
      <div id="policy-terms-section">
        <PolicyTermsAccordion variant={v} />
      </div>
    ),
  },
  {
    id: 'faq',
    title: 'Frequently asked questions',
    subtitle: 'Answers to the most common questions.',
    Icon: HelpCircle,
    bg: 'bg-sky-50/60 hover:bg-sky-50',
    border: 'border border-sky-200',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    titleColor: 'text-sky-700',
    chevronColor: 'text-sky-600',
    render: (v) => <CheckoutFAQ variant={v} />,
  },
];

interface Props {
  variant?: Variant;
}

const TrustAndInfoAccordion: React.FC<Props> = ({ variant = 'desktop' }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {SECTIONS.map((s) => {
        const open = openId === s.id;
        const Icon = s.Icon;
        return (
          <div key={s.id} className="rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : s.id)}
              className={cn(
                'w-full flex items-center gap-4 px-4 md:px-5 py-4 md:py-5 rounded-2xl transition-colors text-left',
                s.bg,
                s.border
              )}
              aria-expanded={open}
            >
              <div
                className={cn(
                  'flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center',
                  s.iconBg
                )}
              >
                <Icon className={cn('w-6 h-6 md:w-7 md:h-7', s.iconColor)} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={cn('font-bold text-base md:text-lg leading-tight', s.titleColor)}>
                  {s.title}
                </h3>
                <p className="text-sm text-foreground/70 mt-0.5 leading-snug">{s.subtitle}</p>
              </div>
              <ChevronDown
                className={cn(
                  'w-5 h-5 flex-shrink-0 transition-transform',
                  s.chevronColor,
                  open && 'rotate-180'
                )}
              />
            </button>
            {open && (
              <div className="mt-2 rounded-2xl border border-border bg-card p-3 md:p-4">
                {s.render(variant)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TrustAndInfoAccordion;
