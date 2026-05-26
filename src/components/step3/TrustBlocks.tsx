import React from 'react';
import {
  Zap,
  Phone,
  MapPin,
  Calendar,
  Users,
  Star,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import TrustpilotMicroWidget from '@/components/TrustpilotMicroWidget';

type Variant = 'desktop' | 'mobile';

interface Block {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  micro: string;
}

const BLOCKS: Block[] = [
  {
    Icon: Zap,
    title: 'Fast claims payouts',
    micro: 'Most claims reviewed within 24 hours.',
  },
  {
    Icon: Phone,
    title: 'UK support team',
    micro: 'Real humans, based in the UK — no overseas call centres.',
  },
  {
    Icon: MapPin,
    title: 'Nationwide garages',
    micro: 'Repairs at any VAT-registered garage across the UK.',
  },
  {
    Icon: Calendar,
    title: '14-day cooling-off',
    micro: 'Change your mind? Full refund within 14 days.',
  },
  {
    Icon: Users,
    title: 'Trusted by UK drivers',
    micro: 'Thousands of policies protecting cars every day.',
  },
  {
    Icon: ShieldCheck,
    title: 'Mechanical & electrical protection',
    micro: 'Covers sudden failure of insured parts.',
  },
  {
    Icon: CheckCircle2,
    title: 'Simple claims process',
    micro: 'Call us, we authorise, garage gets paid direct.',
  },
  {
    Icon: Star,
    title: 'Rated on Trustpilot',
    micro: 'Independent reviews from real customers.',
  },
];

interface Props {
  variant?: Variant;
  className?: string;
}

const TrustBlocks: React.FC<Props> = ({ variant = 'desktop', className }) => {
  const isMobile = variant === 'mobile';

  return (
    <div className={cn(isMobile ? 'p-0' : 'p-6', className)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-lg md:text-xl font-bold text-foreground leading-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            Why drivers choose us
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Built for real-world repairs, backed by real UK support.
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3" /> Trusted
        </span>
      </div>

      <div
        className={cn(
          'grid gap-2.5',
          isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'
        )}
      >
        {BLOCKS.map((b) => {
          const Icon = b.Icon;
          return (
            <div
              key={b.title}
              className="rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/60 to-card p-3 flex flex-col gap-2 hover:border-emerald-300 transition-colors"
            >
              <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4.5 h-4.5" />
              </span>
              <div>
                <div className="text-[13px] md:text-sm font-bold text-foreground leading-tight">
                  {b.title}
                </div>
                <div className="text-[11.5px] md:text-xs text-muted-foreground mt-1 leading-snug">
                  {b.micro}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trustpilot strip */}
      <div className="mt-4 rounded-xl border border-border bg-card px-3 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] md:text-[13px] font-bold text-foreground leading-tight">
            See what real customers say
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            Independent reviews on Trustpilot — updated daily.
          </div>
        </div>
        <div className="flex-shrink-0">
          <TrustpilotMicroWidget />
        </div>
      </div>
    </div>
  );
};

export default TrustBlocks;
