import React, { useEffect, useState } from 'react';
import { Lock, ArrowRight, Tag, CreditCard, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface MobileStickyFooterProps {
  selectedPayment: 'monthly' | 'full' | null;
  monthlyPrice: number;
  totalPrice?: number;
  fullPrice: number;
  originalPrice?: number;
  paymentType?: '12months' | '24months' | '36months';
  isLoading: boolean;
  isFormValid: boolean;
  onPayClick: () => void;
  onPaymentChange?: (payment: 'monthly' | 'full') => void;
  minimised?: boolean;
  trustStripOnly?: boolean;
  defaultExpanded?: boolean;
  ctaLabel?: string;
  validationError?: string;
  onEmailQuote?: () => void;
}

const MobileStickyFooter: React.FC<MobileStickyFooterProps> = ({
  selectedPayment,
  monthlyPrice,
  fullPrice,
  paymentType = '12months',
  isLoading,
  onPayClick,
  onPaymentChange,
  minimised = false,
  trustStripOnly = false,
  defaultExpanded = false,
  ctaLabel = 'Continue',
  validationError,
  onEmailQuote,
}) => {
  // NOTE: "Email quote" link intentionally not rendered inside the sticky footer.
  // It now lives below the FAQ section (see MobileSteppedFlow.tsx) to reduce sticky height.
  void onEmailQuote;

  const [isPulsing, setIsPulsing] = useState(false);
  const [prevPrice, setPrevPrice] = useState(monthlyPrice);
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Auto-expand when a validation error appears so the inline message is visible above the CTA
  useEffect(() => {
    if (validationError) setExpanded(true);
  }, [validationError]);


  useEffect(() => {
    if (monthlyPrice !== prevPrice) {
      setIsPulsing(true);
      setPrevPrice(monthlyPrice);
      const t = setTimeout(() => setIsPulsing(false), 600);
      return () => clearTimeout(t);
    }
  }, [monthlyPrice, prevPrice]);

  if (minimised && !trustStripOnly) return null;

  if (trustStripOnly) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border lg:hidden">
        <div className="px-4 py-2.5 pb-[env(safe-area-inset-bottom,8px)]">
          <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-success" />Secure</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-success" />14-day refund</span>
          </div>
        </div>
      </div>
    );
  }

  const baseTotal = monthlyPrice * 12;
  const pencePerDay = baseTotal > 0 ? Math.round((baseTotal * 100) / 365) : 0;
  const dayLabel = pencePerDay >= 100 ? `£${(pencePerDay / 100).toFixed(2)}` : `${pencePerDay}p`;
  const computedSavings = Math.max(0, baseTotal - fullPrice);
  const displaySavings = computedSavings > 0 ? computedSavings : Math.round(baseTotal * 0.1);
  const discountedFull = computedSavings > 0 ? fullPrice : fullPrice - displaySavings;

  const yearWord = paymentType === '12months' ? '1-Year' : paymentType === '24months' ? '2-Year' : '3-Year';
  const planLabel = `${yearWord} Platinum Cover`;

  const selected: 'monthly' | 'full' = selectedPayment ?? 'monthly';

  const activePrice = selected === 'full' ? discountedFull : monthlyPrice;
  const activePriceLabel = selected === 'full' ? 'total' : '/mo';

  const OptionCard = ({
    type,
    title,
    children,
  }: {
    type: 'monthly' | 'full';
    title: string;
    children: React.ReactNode;
  }) => {
    const isSelected = selected === type;
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onPaymentChange?.(type); }}
        className={cn(
          'relative text-left rounded-2xl border-2 flex-1 px-3 py-3 w-full',
          isSelected ? 'border-primary bg-primary/5' : 'bg-white border-border'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-semibold text-foreground">{title}</span>
          <span
            className={cn(
              'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
              isSelected ? 'border-primary' : 'border-gray-400 bg-white'
            )}
          >
            {isSelected && <span className="w-2 h-2 rounded-full bg-primary" />}
          </span>
        </div>
        {children}
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <div className="mx-2 mb-2 bg-white rounded-2xl border border-border shadow-[0_6px_20px_rgba(0,0,0,0.10)] overflow-hidden">
        {/* Main price + CTA row */}
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground leading-tight truncate">{planLabel}</p>
              <div className={cn('flex items-baseline gap-1', isPulsing && 'animate-pulse')}>
                <span className="text-2xl font-extrabold text-foreground tracking-tight leading-tight">£{activePrice}</span>
                <span className="text-[12px] text-muted-foreground">{activePriceLabel}</span>
                {displaySavings > 0 && (
                  <span className="text-[11px] font-semibold text-success ml-1 whitespace-nowrap">
                    Save £{displaySavings}/yr
                  </span>
                )}
              </div>
            </div>

            <Button
              onClick={onPayClick}
              disabled={isLoading || !selectedPayment}
              aria-label={selectedPayment ? 'Continue to checkout' : 'Select payment option'}
              className="flex-shrink-0 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-bold h-10 px-4 rounded-xl text-sm gap-1.5 animate-breathing disabled:animate-none whitespace-nowrap"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  {ctaLabel}
                  <ArrowRight className="w-4 h-4" strokeWidth={3} />
                </span>
              )}
            </Button>
          </div>

          {validationError && (
            <div
              role="alert"
              className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] font-medium text-destructive"
            >
              <span aria-hidden className="mt-px">⚠</span>
              <span>{validationError}</span>
            </div>
          )}
        </div>

        {/* Expandable payment options */}
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full border-t border-border hover:bg-primary/[0.05] px-3 py-2 flex items-center gap-2 transition-colors"
              aria-label={expanded ? 'Hide payment options' : 'Show payment options'}
            >
              <CreditCard className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-[13px] font-semibold text-foreground">View payment options</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-primary transition-transform duration-200',
                  expanded && 'rotate-180'
                )}
              />
            </button>
          </CollapsibleTrigger>


          <CollapsibleContent>
            <div className="px-4 pt-3 pb-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between gap-2">
                <a
                  href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 hover:opacity-80 flex-shrink-0"
                >
                  <span className="text-[11px] font-bold text-foreground">Excellent</span>
                  <div className="flex gap-0.5">
                    {[0, 1, 2, 3, 4].map(i => (
                      <span key={i} className="inline-flex w-3 h-3 bg-[#00B67A] items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-2 h-2 fill-white">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </span>
                    ))}
                  </div>
                  <span className="text-[9px] text-muted-foreground font-medium ml-0.5">Trustpilot</span>
                </a>
              </div>

              <div className="flex gap-2">
                <OptionCard type="full" title="Pay In Full">
                  <div className="mt-1.5">
                    <span className="text-2xl font-extrabold text-success">£{discountedFull}</span>
                  </div>
                  <p className="text-[11px] font-semibold text-foreground mt-1.5">One simple payment</p>
                  {displaySavings > 0 && (
                    <p className="text-[10px] text-success font-bold flex items-center gap-1 mt-0.5">
                      <Tag className="w-3 h-3" />
                      Save £{displaySavings}
                    </p>
                  )}
                </OptionCard>

                <OptionCard type="monthly" title="Pay Monthly">
                  <div className="flex items-baseline gap-1 mt-1.5">
                    <span className="text-2xl font-extrabold text-foreground">£{monthlyPrice}</span>
                    <span className="text-xs text-muted-foreground">/month</span>
                  </div>
                  {paymentType !== '12months' ? (
                    <>
                      <p className="text-[11px] font-semibold text-foreground mt-1.5">12 monthly payments</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Payments end after 12 months · Cover lasts {paymentType === '36months' ? 3 : 2} years</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] font-semibold text-foreground mt-1.5">Paid over 12 months</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Equal to {dayLabel}/day</p>
                    </>
                  )}
                </OptionCard>
              </div>

              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-border p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-success flex-shrink-0" />
                  <div className="leading-tight">
                    <p className="text-[13px] font-bold text-foreground">Easy</p>
                    <p className="text-[11px] text-muted-foreground">claims</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <InfinityIcon className="w-5 h-5 text-success flex-shrink-0" />
                  <div className="leading-tight">
                    <p className="text-[13px] font-bold text-foreground">Unlimited</p>
                    <p className="text-[11px] text-muted-foreground">claims</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-success flex-shrink-0" />
                  <div className="leading-tight">
                    <p className="text-[13px] font-bold text-foreground">Nationwide</p>
                    <p className="text-[11px] text-muted-foreground">approved repairs</p>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};

export default MobileStickyFooter;
