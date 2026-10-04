import React, { useEffect, useState } from 'react';
import { Lock, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DesktopStickyBarProps {
  selectedPayment: 'monthly' | 'full';
  monthlyPrice: number;
  totalPrice: number;
  originalPrice?: number;
  fullPrice: number;
  savings: number;
  duration: string;
  paymentType: '12months' | '24months' | '36months';
  isLoading: boolean;
  hasPromoDiscount?: boolean;
  onPayClick: () => void;
  onPaymentChange?: (payment: 'monthly' | 'full') => void;
  ctaLabel?: string;
  isVisible?: boolean;
  minimised?: boolean;
  trustStripOnly?: boolean;
  validationError?: string;
}

const DesktopStickyBar: React.FC<DesktopStickyBarProps> = ({
  selectedPayment,
  monthlyPrice,
  fullPrice,
  savings,
  duration,
  paymentType,
  isLoading,
  onPayClick,
  onPaymentChange,
  ctaLabel = 'Continue to checkout',
  isVisible = true,
  minimised = false,
  trustStripOnly = false,
  validationError,
}) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const [prevPrice, setPrevPrice] = useState(monthlyPrice);

  useEffect(() => {
    if (monthlyPrice !== prevPrice) {
      setIsPulsing(true);
      setPrevPrice(monthlyPrice);
      const t = setTimeout(() => setIsPulsing(false), 600);
      return () => clearTimeout(t);
    }
  }, [monthlyPrice, prevPrice]);

  if (!isVisible) return null;
  if (minimised && !trustStripOnly) return null;

  // Trust strip only mode
  if (trustStripOnly) {
    return (
      <div className="hidden lg:block fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#0BA360]" />
              Instant cover
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#0BA360]" />
              Secure checkout
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#0BA360]" />
              14-day cooling-off
            </span>
          </div>
        </div>
      </div>
    );
  }

  const pencePerDay = Math.round((monthlyPrice * 12 * 100) / 365);
  const dayLabel = pencePerDay >= 100 ? `£${(pencePerDay / 100).toFixed(2)}` : `${pencePerDay}p`;

  const yearWord = paymentType === '12months' ? '1-Year' : paymentType === '24months' ? '2-Year' : '3-Year';
  const planLabel = duration || `${yearWord} Platinum Cover`;

  return (
    <div className="hidden lg:block fixed left-0 right-0 bottom-0 z-50 bg-white border-t border-[#e9e9e7] shadow-[0_-12px_32px_rgba(16,24,40,0.06)]">
      <div className="max-w-[1180px] mx-auto px-7 py-4">
        {validationError && (
          <div
            role="alert"
            className="mb-1.5 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
          >
            <span aria-hidden>⚠</span>
            <span>{validationError}</span>
          </div>
        )}

        <div className={cn('flex items-center gap-6 divide-x divide-[#e9e9e7]', isPulsing && 'animate-pulse')}>
          {/* Trustpilot */}
          <div className="flex items-center gap-2.5 pr-6 flex-shrink-0">
            <span className="w-9 h-9 rounded-full bg-[#eaf8f2] flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-[#1ca36f]" />
            </span>
            <div className="leading-tight">
              <div className="text-[13px] font-bold text-[#161616]">Excellent</div>
              <div className="text-[#1ca36f] text-[13px] tracking-[1px] leading-none my-0.5">★★★★★</div>
              <div className="text-[11px] text-[#6c6c6c] font-semibold">4.8 out of 5</div>
            </div>
          </div>

          {/* Cover label */}
          <div className="px-6 leading-tight flex-shrink-0">
            <div className="text-[#f36b21] text-[11px] font-extrabold tracking-[0.08em] uppercase mb-1">Your cover</div>
            <div className="text-[15px] font-extrabold text-[#161616]">{planLabel}</div>
          </div>

          {/* Monthly option */}
          <button
            type="button"
            onClick={() => onPaymentChange?.('monthly')}
            className={cn(
              'px-6 text-left leading-tight rounded-lg py-1 transition-all flex-shrink-0 border-2',
              selectedPayment === 'monthly'
                ? 'border-[#FF6B00] bg-[#FFF4EC]'
                : 'border-transparent hover:bg-gray-50'
            )}
          >
            <span className="block text-[22px] font-extrabold tracking-[-0.04em] text-[#161616] leading-none">
              £{monthlyPrice}
              <span className="text-[14px] font-bold text-[#6c6c6c] ml-0.5">/month</span>
            </span>
            <span className="block text-[12px] text-[#6c6c6c] mt-1 font-semibold">Equal to {dayLabel}/day</span>
            <span className="block text-[11px] text-[#919191] font-semibold">Paid over 12 months</span>
          </button>

          {/* Pay in full pill */}
          <button
            type="button"
            onClick={() => onPaymentChange?.('full')}
            className={cn(
              'px-6 flex-shrink-0',
            )}
          >
            <span
              className={cn(
                'block rounded-2xl px-5 py-3 leading-tight border-2 transition-all',
                selectedPayment === 'full'
                  ? 'border-[#1ca36f] bg-[#eaf8f2]'
                  : 'border-[#cdebd9] bg-[#eaf8f2] hover:bg-[#dff3e9]'
              )}
            >
              <span className="block text-[15px] text-[#3e3e3e] font-semibold">
                Pay in full <strong className="text-[#161616] text-[16px]">£{fullPrice}</strong>
              </span>
              {savings > 0 && (
                <span className="block text-[14px] text-[#1ca36f] font-bold mt-0.5">Save £{savings} vs monthly</span>
              )}
            </span>
          </button>

          {/* CTA */}
          <div className="pl-6 ml-auto flex-shrink-0">
            <button
              onClick={onPayClick}
              disabled={isLoading}
              aria-label={ctaLabel}
              className="animate-breathing border-0 rounded-2xl bg-[#f36b21] hover:bg-[#df5d17] disabled:opacity-60 text-white font-extrabold text-[15px] px-7 py-4 min-h-[52px] cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 leading-none"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                <>{ctaLabel} →</>
              )}
            </button>
            <div className="mt-1.5 text-center text-[#919191] text-[11px] font-semibold flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" /> Secure checkout
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopStickyBar;
