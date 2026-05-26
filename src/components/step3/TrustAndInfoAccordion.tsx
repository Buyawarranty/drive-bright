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
  Icon: React.ComponentType<{ className?: string }>;
  bg: string;
  text: string;
  render: (variant: Variant) => React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'trust',
    title: 'Why drivers choose us',
    Icon: ShieldCheck,
    bg: 'bg-emerald-600 hover:bg-emerald-700',
    text: 'text-white',
    render: (v) => <TrustBlocks variant={v} />,
  },
  {
    id: 'not-covered',
    title: "What's not covered",
    Icon: XCircle,
    bg: 'bg-rose-50 hover:bg-rose-100 border border-rose-200',
    text: 'text-rose-800',
    render: (v) => <WhatsNotCoveredAccordion variant={v} />,
  },
  {
    id: 'policy',
    title: 'Policy & Terms',
    Icon: FileText,
    bg: 'bg-amber-50 hover:bg-amber-100 border border-amber-200',
    text: 'text-amber-900',
    render: (v) => (
      <div id="policy-terms-section">
        <PolicyTermsAccordion variant={v} />
      </div>
    ),
  },
  {
    id: 'faq',
    title: 'Frequently asked questions',
    Icon: HelpCircle,
    bg: 'bg-sky-50 hover:bg-sky-100 border border-sky-200',
    text: 'text-sky-800',
    render: (v) => <CheckoutFAQ variant={v} />,
  },
];

interface Props {
  variant?: Variant;
}

const TrustAndInfoAccordion: React.FC<Props> = ({ variant = 'desktop' }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-2.5">
      {SECTIONS.map((s) => {
        const open = openId === s.id;
        const Icon = s.Icon;
        return (
          <div key={s.id} className="rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : s.id)}
              className={cn(
                'w-full flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 md:py-4 rounded-xl transition-colors',
                s.bg,
                s.text
              )}
              aria-expanded={open}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-bold text-sm md:text-base text-left truncate">
                  {s.title}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'w-5 h-5 flex-shrink-0 transition-transform',
                  open && 'rotate-180'
                )}
              />
            </button>
            {open && (
              <div className="mt-2 rounded-xl border border-border bg-card p-3 md:p-4">
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
