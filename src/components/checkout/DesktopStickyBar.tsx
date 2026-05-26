import React from 'react';
import { Button } from '@/components/ui/button';
import { Lock, Shield, ArrowRight, Wallet } from 'lucide-react';
import trustpilotStars from '@/assets/trustpilot-5-stars.png';

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
              14-day cooling off period
            </span>
          </div>
        </div>
      </div>
    );
  }

  const baseTotal = monthlyPrice * 12;
  const pencePerDay = baseTotal > 0 ? Math.round((baseTotal * 100) / 365) : 0;
  const isMonthly = selectedPayment === 'monthly';

  // Plan label derived from duration / paymentType
  const yearWord = paymentType === '12months' ? '1-Year' : paymentType === '24months' ? '2-Year' : '3-Year';
  const planLabel = duration || `${yearWord} Platinum Cover`;

  return (
    <div className="hidden lg:block fixed bottom-0 left-0 right-0 bg-white shadow-[0_-6px_22px_rgba(0,0,0,0.12)] border-t border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-5 py-2">
        {validationError && (
          <div
            role="alert"
            className="mb-2 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-[13px] font-medium text-red-700"
          >
            <span aria-hidden>⚠</span>
            <span>{validationError}</span>
          </div>
        )}
        <div className="flex items-center gap-3 min-h-[58px]">

          {/* LEFT: Trust + plan stacked tightly */}
          <div className="flex flex-col justify-center gap-1 flex-shrink-0 pr-3 border-r border-gray-200">
            <a
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity leading-none"
            >
              <span className="text-sm font-bold text-gray-900">Excellent</span>
              <img src="/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png" alt="Trustpilot" className="h-4 w-auto" />
            </a>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[10px] font-bold text-[#FF6B00] tracking-wider uppercase">Cover</span>
              <span className="text-[13px] font-bold text-black">{planLabel}</span>
            </div>
          </div>

          {/* MIDDLE: Price block */}
          <div className="flex flex-col justify-center leading-none flex-shrink-0 min-w-[180px]">
            {isMonthly ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-[22px] font-extrabold text-gray-900">£{monthlyPrice}</span>
                  <span className="text-sm text-gray-600">/mo</span>
                  <span className="text-xs text-gray-500 ml-1">· {pencePerDay >= 100 ? `£${(pencePerDay / 100).toFixed(2)}` : `${pencePerDay}p`}/day</span>
                </div>
                <span className="text-[11px] text-gray-500 mt-0.5">Paid over 12 months · 0% APR</span>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-[22px] font-extrabold text-[#0BA360]">£{fullPrice}</span>
                  <span className="text-xs text-gray-500">one-off</span>
                </div>
                {savings > 0 && (
                  <span className="text-[11px] font-semibold text-[#0BA360] mt-0.5">You save £{savings} vs monthly</span>
                )}
              </>
            )}
          </div>

          {/* OPTIONAL: Switch-to-full pill (only when on monthly with savings) */}
          {isMonthly && savings > 0 && (
            <button
              type="button"
              onClick={() => onPaymentChange?.('full')}
              className="hidden xl:flex items-center gap-2 bg-[#E8F7EF] hover:bg-[#d6f0e2] border border-[#0BA360]/30 hover:border-[#0BA360] rounded-lg px-3 py-1.5 flex-shrink-0 transition-colors cursor-pointer"
              aria-label={`Switch to one-off payment of £${fullPrice}`}
            >
              <Wallet className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
              <div className="flex flex-col leading-tight text-left">
                <span className="text-[12px] font-bold text-gray-900">Pay £{fullPrice} upfront</span>
                <span className="text-[11px] font-semibold text-[#0BA360]">Save £{savings}</span>
              </div>
            </button>
          )}
          {!isMonthly && (
            <button
              type="button"
              onClick={() => onPaymentChange?.('monthly')}
              className="hidden xl:flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg px-3 py-1.5 flex-shrink-0 transition-colors cursor-pointer"
              aria-label={`Switch to monthly payment of £${monthlyPrice}`}
            >
              <Wallet className="w-4 h-4 text-gray-700 flex-shrink-0" />
              <div className="flex flex-col leading-tight text-left">
                <span className="text-[12px] font-bold text-gray-900">Pay £{monthlyPrice}/mo</span>
                <span className="text-[11px] font-semibold text-gray-600">12 months · 0% APR</span>
              </div>
            </button>
          )}


          {/* RIGHT: CTA fills remaining space */}
          <div className="flex-1 flex items-center justify-end gap-3 min-w-0">
            <span className="hidden md:flex items-center gap-1.5 text-[11px] text-gray-500 flex-shrink-0">
              <Lock className="w-3 h-3" />
              Secure checkout
            </span>
            <Button
              onClick={onPayClick}
              disabled={isLoading}
              aria-label={ctaLabel}
              className="bg-[#FF6B00] hover:bg-[#e55f00] text-white font-bold h-12 px-8 rounded-lg text-base gap-2 shadow-md min-w-[248px] animate-breathing"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                <>
                  {ctaLabel}
                  <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopStickyBar;
