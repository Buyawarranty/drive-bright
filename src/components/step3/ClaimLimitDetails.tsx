import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  TrendingUp,
  Wrench,
  Settings,
  ShieldCheck,
  Gem,
  Car,
  Cog,
  Building2,
  ShieldQuestion,
  Lock,
  Home,
  Check,
  ChevronRight,
} from 'lucide-react';

interface ClaimLimitDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClaimLimit: number | null;
  onConfirm: (claimLimit: number) => void;
}

interface TierOption {
  value: number;
  displayValue: string;
  icon: React.ElementType;
  tagline: string;
  description: string;
  bullets?: string[];
  popular?: boolean;
}

const TIERS: TierOption[] = [
  {
    value: 750,
    displayValue: '£1,000',
    icon: Wrench,
    tagline: 'COVERS SMALLER REPAIRS',
    description: 'Covers smaller, everyday repairs',
  },
  {
    value: 2000,
    displayValue: '£2,000',
    icon: Settings,
    tagline: 'COVERS MOST COMMON REPAIRS',
    description: 'Covers most common repairs',
  },
  {
    value: 3000,
    displayValue: '£3,000',
    icon: ShieldCheck,
    tagline: 'COVERS MAJOR REPAIRS',
    description: '',
    bullets: [
      'Covers major repairs like engine & gearbox',
      'Best balance of cost & protection',
    ],
    popular: true,
  },
  {
    value: 5000,
    displayValue: '£5,000',
    icon: Gem,
    tagline: 'MAXIMUM COVER',
    description: 'Maximum cover for hybrid, EV & high-value vehicles',
  },
];

const ClaimLimitDetails: React.FC<ClaimLimitDetailsProps> = ({
  open,
  onOpenChange,
  selectedClaimLimit,
  onConfirm,
}) => {
  // Default to currently selected, else most-popular (£3,000)
  const [pending, setPending] = useState<number>(selectedClaimLimit ?? 3000);

  // Sync when reopened
  React.useEffect(() => {
    if (open) setPending(selectedClaimLimit ?? 3000);
  }, [open, selectedClaimLimit]);

  const pendingTier = TIERS.find((t) => t.value === pending) ?? TIERS[2];

  const handleConfirm = () => {
    onConfirm(pending);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col rounded-2xl">
        {/* Scrollable content */}
        <div className="overflow-y-auto px-5 sm:px-8 pt-6 sm:pt-8 pb-4">
          <DialogTitle className="text-center text-2xl sm:text-3xl font-bold text-foreground leading-tight pr-8">
            How much do you want us to cover per repair?
          </DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base text-muted-foreground mt-2 mb-5">
            This is the maximum we pay towards each repair (parts & labour).
          </DialogDescription>

          {/* Stat banner */}
          <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3 mb-5">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-success/15 border border-success/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div className="text-sm sm:text-[15px] leading-snug">
              <span className="font-bold text-success">Most repairs cost £700–£1,500.</span>{' '}
              <span className="text-foreground">Major faults (engine/gearbox) can exceed £2,000.</span>
            </div>
          </div>

          <h3 className="font-bold text-foreground text-base sm:text-lg mb-3">
            Choose your cover
          </h3>

          {/* Tier list */}
          <div className="space-y-2.5 mb-5">
            {TIERS.map((tier) => {
              const Icon = tier.icon;
              const isSelected = pending === tier.value;
              return (
                <button
                  key={tier.value}
                  type="button"
                  onClick={() => setPending(tier.value)}
                  className={cn(
                    'relative w-full text-left rounded-xl border-2 transition-all p-3 sm:p-4 flex items-start gap-3 sm:gap-4',
                    isSelected
                      ? 'border-success bg-success/5 shadow-sm'
                      : 'border-border bg-card hover:border-success/40'
                  )}
                  aria-pressed={isSelected}
                >
                  {/* Radio */}
                  <div
                    className={cn(
                      'mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                      isSelected ? 'border-success' : 'border-muted-foreground/40'
                    )}
                  >
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-success" />}
                  </div>

                  {/* Icon bubble */}
                  <div className="flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {tier.popular && (
                      <span className="inline-block mb-1 bg-success text-success-foreground text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                        Most Popular
                      </span>
                    )}
                    <div
                      className={cn(
                        'font-bold text-xl sm:text-2xl leading-tight',
                        isSelected ? 'text-success' : 'text-foreground'
                      )}
                    >
                      {tier.displayValue}
                    </div>
                    <div className="text-[10px] sm:text-xs font-semibold text-muted-foreground tracking-wide mt-0.5">
                      {tier.tagline}
                    </div>
                    {tier.description && (
                      <p className="text-sm text-muted-foreground mt-1 leading-snug">
                        {tier.description}
                      </p>
                    )}
                    {tier.bullets && (
                      <ul className="mt-1.5 space-y-1">
                        {tier.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-1.5 text-sm text-foreground">
                            <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" strokeWidth={3} />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* What happens if something goes wrong */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 mb-4">
            <h4 className="font-bold text-foreground text-sm sm:text-base mb-3">
              What happens if something goes wrong
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 sm:divide-x sm:divide-border">
              {[
                { Icon: Car, repair: '£1,200', pay: '£1,050', sub: 'You pay your excess' },
                { Icon: Cog, repair: '£2,200', pay: '£2,050', sub: 'You pay your excess' },
                { Icon: Building2, repair: '£3,800', pay: '£3,000', sub: 'You pay the rest + excess' },
              ].map((ex, i) => (
                <div key={i} className={cn('flex items-start gap-2.5', i > 0 && 'sm:pl-4')}>
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
                    <ex.Icon className="w-4 h-4 text-success" />
                  </div>
                  <div className="text-xs sm:text-[13px] leading-snug">
                    <div className="text-foreground font-medium">Repair: {ex.repair}</div>
                    <div className="text-success font-bold">We pay {ex.pay}</div>
                    <div className="text-muted-foreground">{ex.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick tip */}
          <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-4 mb-4">
            <ShieldQuestion className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm leading-snug">
              <div className="font-bold text-primary mb-0.5">Quick tip</div>
              <p className="text-foreground">
                Higher cover = more protection against expensive repairs. You only pay your excess if you make a claim.
              </p>
            </div>
          </div>

          {/* Trust strip */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 rounded-xl border border-border bg-card p-3">
            {[
              { Icon: Wrench, text: 'Parts & labour included' },
              { Icon: Lock, text: 'No hidden fees' },
              { Icon: Home, text: 'We pay the garage directly' },
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs sm:text-sm text-foreground">
                <t.Icon className="w-4 h-4 sm:w-5 sm:h-5 text-success flex-shrink-0" />
                <span className="leading-tight">{t.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sticky footer CTA */}
        <div className="border-t border-border bg-background px-5 sm:px-8 py-4 flex-shrink-0">
          <button
            onClick={handleConfirm}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-success text-success-foreground font-bold text-base sm:text-lg px-5 py-3.5 sm:py-4 shadow-md hover:bg-success/90 transition-colors active:scale-[0.99]"
          >
            Continue with {pendingTier.displayValue} cover
            <ChevronRight className="w-5 h-5" />
          </button>
          <p className="text-center text-xs text-muted-foreground mt-2">
            You can change this anytime.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClaimLimitDetails;
