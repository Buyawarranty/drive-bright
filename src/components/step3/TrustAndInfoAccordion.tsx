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
  Icon: React.ComponentType<any>;
  iconBg: string;
  iconColor: string;
  render: (variant: Variant) => React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'trust',
    title: 'Why drivers choose us',
    subtitle: 'No jargon. No surprises. Just great protection so you can drive with confidence.',
    Icon: ShieldCheck,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    render: (v) => <TrustBlocks variant={v} />,
  },
  {
    id: 'not-covered',
    title: "What's not covered",
    subtitle: 'Clear exclusions so there are no surprises.',
    Icon: XCircle,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    render: (v) => <WhatsNotCoveredAccordion variant={v} />,
  },
  {
    id: 'policy',
    title: 'Policy summary',
    subtitle: 'Key terms and important information.',
    Icon: FileText,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
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
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    render: (v) => <CheckoutFAQ variant={v} />,
  },
];

interface Props {
  variant?: Variant;
}

const TrustAndInfoAccordion: React.FC<Props> = ({ variant = 'desktop' }) => {
  // All sections open by default; each toggles independently
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(SECTIONS.map((s) => s.id))
  );

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {SECTIONS.map((s) => {
        const open = openIds.has(s.id);
        const Icon = s.Icon;
        return (
          <div
            key={s.id}
            className="rounded-2xl overflow-hidden border border-border bg-card"
          >
            <button
              type="button"
              onClick={() => toggle(s.id)}
              className={cn(
                'w-full flex items-center gap-4 px-4 md:px-5 py-4 md:py-5 text-left transition-colors',
                'hover:bg-primary/5',
                open && 'border-b border-border'
              )}
              aria-expanded={open}
            >
              <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center bg-primary/10">
                <Icon className="w-6 h-6 md:w-7 md:h-7 text-primary" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base md:text-lg leading-tight text-foreground">
                  {s.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                  {s.subtitle}
                </p>
              </div>
              <div
                className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                  open ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/70'
                )}
                aria-hidden
              >
                <ChevronDown
                  className={cn('w-4 h-4 transition-transform', open && 'rotate-180')}
                />
              </div>
            </button>
            {open && <div className="p-3 md:p-4 bg-card">{s.render(variant)}</div>}
          </div>
        );
      })}
    </div>
  );
};

export default TrustAndInfoAccordion;
