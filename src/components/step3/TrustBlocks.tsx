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
import TrustpilotMicroStarWidget from '@/components/TrustpilotMicroStarWidget';

type Variant = 'desktop' | 'mobile';

interface Block {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  micro: string;
}

const BLOCKS: Block[] = [
  { Icon: Zap, title: 'Fast claims payouts', micro: 'Most claims reviewed within 24 hours.' },
  { Icon: Phone, title: 'UK support team', micro: 'Real humans, based in the UK.' },
  { Icon: MapPin, title: 'Nationwide garages', micro: 'Any VAT-registered garage in the UK.' },
  { Icon: Calendar, title: '14-day cooling-off', micro: 'Full refund within 14 days.' },
  { Icon: Users, title: 'Trusted by UK drivers', micro: 'Thousands of policies live today.' },
  { Icon: ShieldCheck, title: 'Mechanical & electrical', micro: 'Covers sudden failure of insured parts.' },
  { Icon: CheckCircle2, title: 'Simple claims process', micro: 'We authorise, garage gets paid direct.' },
  { Icon: Star, title: 'Rated on Trustpilot', micro: 'Independent reviews from real customers.' },
];

interface Props {
  variant?: Variant;
  className?: string;
}

const TrustBlocks: React.FC<Props> = ({ variant = 'desktop', className }) => {
  const isMobile = variant === 'mobile';

  return (
    <div className={cn(isMobile ? 'p-0' : 'p-5', className)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <h3 className="text-base md:text-lg font-bold text-foreground leading-tight">
              Why drivers choose us
            </h3>
            <p className="text-[11px] md:text-xs text-muted-foreground leading-snug">
              Built for real-world repairs, backed by UK support.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 [&_iframe]:!border-0">
          <TrustpilotMicroWidget />
          <TrustpilotMicroStarWidget />
        </div>
      </div>

      <div
        className={cn(
          'grid gap-2',
          isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'
        )}
      >
        {BLOCKS.map((b) => {
          const Icon = b.Icon;
          return (
            <div
              key={b.title}
              className="rounded-lg border border-emerald-100 bg-[#F6FBF8] p-2.5 flex items-start gap-2"
            >
              <Icon className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[12px] md:text-[13px] font-semibold text-foreground leading-tight">
                  {b.title}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {b.micro}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrustBlocks;
