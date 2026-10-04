import React, { useEffect, useState } from 'react';
import { ArrowRight, Lock, Shield } from 'lucide-react';
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
    <div className="hidden lg:block fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-6px_24px_rgba(0,0,0,0.10)] z-50">
      <div className="max-w-4xl mx-auto px-6 py-2.5">
        {validationError && (
          <div
            role="alert"
            className="mb-1.5 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
          >
            <span aria-hidden>⚠</span>
            <span>{validationError}</span>
          </div>
        )}

        <div className={cn('flex items-center gap-5', isPulsing && 'animate-pulse')}>
          {/* Trustpilot */}
          <a
            href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <span className="w-8 h-8 rounded-full bg-[#E6F7EF] flex items-center justify-center">
              <Shield className="w-4 h-4 text-[#0BA360]" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-gray-900">Excellent</span>
              <span className="flex gap-0.5 my-0.5">
                {[0, 1, 2, 3, 4].map(i => (
                  <span key={i} className="inline-flex w-3 h-3 bg-[#00B67A] items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-2 h-2 fill-white">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </span>
                ))}
              </span>
              <span className="block text-[10px] text-gray-500">4.8 out of 5</span>
            </span>
          </a>

          <div className="h-10 w-px bg-gray-200 flex-shrink-0" />

          {/* Cover label */}
          <div className="leading-tight flex-shrink-0">
            <span className="block text-[10px] font-bold text-[#FF6B00] tracking-wider uppercase">Your cover</span>
            <span className="block text-sm font-bold text-gray-900">{planLabel}</span>
          </div>

          <div className="h-10 w-px bg-gray-200 flex-shrink-0" />

          {/* Monthly option */}
          <button
            type="button"
            onClick={() => onPaymentChange?.('monthly')}
            className={cn(
              'text-left leading-tight rounded-lg px-3 py-1.5 transition-all flex-shrink-0 border-2',
              selectedPayment === 'monthly'
                ? 'border-[#FF6B00] bg-[#FFF4EC]'
                : 'border-transparent hover:bg-gray-50'
            )}
          >
            <span className="block text-lg font-extrabold text-gray-900">
              £{monthlyPrice}
              <span className="text-xs font-semibold text-gray-600">/month</span>
            </span>
            <span className="block text-[11px] text-gray-600">Equal to {dayLabel}/day</span>
            <span className="block text-[11px] text-gray-600">Paid over 12 months</span>
          </button>

          {/* Pay in full pill */}
          <button
            type="button"
            onClick={() => onPaymentChange?.('full')}
            className={cn(
              'text-left rounded-xl px-4 py-2 transition-all flex-shrink-0 border-2 leading-tight',
              selectedPayment === 'full'
                ? 'border-[#0BA360] bg-[#E6F7EF]'
                : 'border-transparent bg-[#F0FAF5] hover:bg-[#E6F7EF]'
            )}
          >
            <span className="block text-sm font-bold text-gray-900">Pay in full £{fullPrice}</span>
            {savings > 0 && (
              <span className="block text-[11px] font-semibold text-[#0BA360]">Save £{savings} vs monthly</span>
            )}
          </button>

          {/* CTA */}
          <div className="flex flex-col items-center flex-shrink-0 ml-auto">
            <button
              onClick={onPayClick}
              disabled={isLoading}
              aria-label={ctaLabel}
              className="bg-[#FF6B00] hover:bg-[#e55f00] disabled:opacity-60 text-white font-bold px-8 py-3 rounded-full text-sm flex items-center gap-2 animate-breathing"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                <>{ctaLabel} <ArrowRight className="w-4 h-4" strokeWidth={3} /></>
              )}
            </button>
            <span className="flex items-center gap-1 mt-1 text-[11px] text-gray-500">
              <Lock className="w-3 h-3" />
              Secure checkout
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopStickyBar;
