import React, { useEffect, useState } from 'react';
import { Lock, Shield, ArrowRight, Tag, Infinity as InfinityIcon, MapPin, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E5E5] lg:hidden">
        <div className="px-4 py-2.5 pb-[env(safe-area-inset-bottom,8px)]">
          <div className="flex items-center justify-center gap-3 text-[11px] text-gray-600">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-[#0BA360]" />Instant cover</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-[#0BA360]" />Secure</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-[#0BA360]" />14-day refund</span>
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

  const Card = ({
    type,
    title,
    children,
  }: {
    type: 'monthly' | 'full';
    title: string;
    children: React.ReactNode;
  }) => {
    const isSelected = selected === type;
    const accent = type === 'monthly' ? '#FF6B00' : '#0BA360';
    const selectedBg = type === 'monthly' ? '#FFF1E6' : '#E6F7EF';
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onPaymentChange?.(type); }}
        className={cn(
          'relative text-left rounded-2xl border-2 flex-1 px-3 py-3',
          isSelected ? '' : 'bg-white border-gray-200'
        )}
        style={isSelected ? { backgroundColor: selectedBg, borderColor: accent } : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-semibold text-gray-900">{title}</span>
          <span
            className={cn(
              'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
              isSelected ? '' : 'border-gray-400 bg-white'
            )}
            style={isSelected ? { borderColor: accent } : undefined}
          >
            {isSelected && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />}
          </span>
        </div>
        {children}
      </button>
    );
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 lg:hidden'
      )}
    >
      {/* Floating card container with margin for clear separation */}
      <div
        className={cn(
          'mx-3 mb-3 bg-white rounded-2xl border border-gray-200',
          'shadow-[0_8px_30px_rgba(0,0,0,0.12)]'
        )}
      >
        {/* Drag handle / expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-label={expanded ? 'Collapse payment details' : 'Expand payment details'}
          className="w-full flex flex-col items-center gap-1 pt-2 pb-1.5"
        >
          <span className="w-10 h-1 rounded-full bg-gray-300" />
          <span className="text-[11px] font-medium text-gray-500">
            {expanded ? 'Hide payment options ⌄' : 'View payment options ⌃'}
          </span>
        </button>



        {/* Expanded section */}
        {expanded && (
          <div className="px-4 pt-0 pb-3">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-sm font-semibold text-black">{planLabel}</span>
              <a
                href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 hover:opacity-80 flex-shrink-0"
              >
                <span className="text-[11px] font-bold text-gray-900">Excellent</span>
                <div className="flex gap-0.5">
                  {[0, 1, 2, 3, 4].map(i => (
                    <span key={i} className="inline-flex w-3 h-3 bg-[#00B67A] items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-2 h-2 fill-white">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </span>
                  ))}
                </div>
                <span className="text-[9px] text-gray-700 font-medium ml-0.5">Trustpilot</span>
              </a>
            </div>

            <div className="flex gap-2 mb-3">
              <Card type="full" title="Pay In Full">
                <div className="mt-1.5">
                  <span className="text-2xl font-extrabold text-[#0BA360]">£{discountedFull}</span>
                </div>
                <p className="text-[11px] font-semibold text-gray-900 mt-1.5">One simple payment</p>
                {displaySavings > 0 && (
                  <p className="text-[10px] text-[#0BA360] font-bold flex items-center gap-1 mt-0.5">
                    <Tag className="w-3 h-3" />
                    Save £{displaySavings}
                  </p>
                )}
              </Card>

              <Card type="monthly" title="Pay Monthly">
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className="text-2xl font-extrabold text-gray-900">£{monthlyPrice}</span>
                  <span className="text-xs text-gray-700">/month</span>
                </div>
                <p className="text-[11px] font-semibold text-gray-900 mt-1.5">Paid over 12 months</p>
                <p className="text-[10px] text-gray-600 mt-0.5">Equal to {dayLabel}/day</p>
              </Card>
            </div>


            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2 mb-3 rounded-xl border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0BA360] flex-shrink-0" />
                <div className="leading-tight">
                  <p className="text-[13px] font-bold text-gray-900">14-day</p>
                  <p className="text-[11px] text-gray-600">cooling off</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <InfinityIcon className="w-5 h-5 text-[#0BA360] flex-shrink-0" />
                <div className="leading-tight">
                  <p className="text-[13px] font-bold text-gray-900">Unlimited</p>
                  <p className="text-[11px] text-gray-600">claims</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#0BA360] flex-shrink-0" />
                <div className="leading-tight">
                  <p className="text-[13px] font-bold text-gray-900">Nationwide</p>
                  <p className="text-[11px] text-gray-600">approved repairs</p>
                </div>
              </div>
            </div>


            {validationError && (
              <div
                role="alert"
                className="mb-2 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700"
              >
                <span aria-hidden className="mt-px">⚠</span>
                <span>{validationError}</span>
              </div>
            )}
            <Button
              onClick={onPayClick}
              disabled={isLoading || !selectedPayment}
              className="w-full bg-[#FF6B00] hover:bg-[#e55f00] disabled:bg-[#CCCCCC] text-white font-bold h-12 px-6 rounded-xl text-sm gap-1.5 animate-breathing disabled:animate-none"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  {ctaLabel}
                  <ArrowRight className="w-4 h-4" strokeWidth={3} />
                </span>

              )}
            </Button>
          </div>
        )}

        {/* Compact action bar (collapsed) */}
        {!expanded && (
          <div className="px-4 pb-3 pt-0">
            {validationError && (
              <div
                role="alert"
                className="mb-2 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700"
              >
                <span aria-hidden className="mt-px">⚠</span>
                <span>{validationError}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="flex flex-col leading-tight min-w-0 flex-shrink">
                <span className="text-[12px] font-medium text-black truncate">{planLabel}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-gray-900">£{selected === 'full' ? discountedFull : monthlyPrice}</span>
                  <span className="text-[12px] text-gray-600">{selected === 'full' ? 'total' : '/mo'}</span>
                </div>
                {displaySavings > 0 && (
                  <span className="text-[11px] font-semibold text-[#0BA360]">Save £{displaySavings} annually</span>
                )}
              </div>

              <Button
                onClick={onPayClick}
                disabled={isLoading || !selectedPayment}
                aria-label={selectedPayment ? 'Continue to checkout' : 'Select payment option'}
                className="flex-1 bg-[#FF6B00] hover:bg-[#e55f00] disabled:bg-[#CCCCCC] text-white font-bold h-12 px-6 rounded-xl text-sm gap-1.5 animate-breathing disabled:animate-none"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    {ctaLabel}
                    <ArrowRight className="w-4 h-4" strokeWidth={3} />
                  </span>

                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileStickyFooter;
