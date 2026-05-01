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
  isVisible?: boolean;
  minimised?: boolean;
  trustStripOnly?: boolean;
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
  isVisible = true,
  minimised = false,
  trustStripOnly = false,
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
              14-day money-back guarantee
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
    <div className="hidden lg:block fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] border-t border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between gap-5">

          {/* 1. Trustpilot */}
          <a
            href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-green-600" strokeWidth={2} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-gray-900">Excellent</span>
              <img src={trustpilotStars} alt="Trustpilot 5 stars" className="h-3.5 my-0.5" />
              <span className="text-[11px] text-gray-600">4.8 out of 5</span>
            </div>
          </a>

          {/* 2. Your cover */}
          <div className="flex flex-col leading-tight flex-shrink-0">
            <span className="text-[11px] font-bold text-[#FF6B00] tracking-wider uppercase">Your cover</span>
            <span className="text-base font-bold text-gray-900 mt-0.5">{planLabel}</span>
          </div>

          {/* 3. Price */}
          <div className="flex flex-col leading-tight flex-shrink-0">
            {isMonthly ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-gray-900">£{monthlyPrice}</span>
                  <span className="text-sm text-gray-600">/month</span>
                </div>
                <span className="text-[11px] text-gray-600 mt-0.5">
                  Equal to <span className="font-semibold text-gray-700">{pencePerDay >= 100 ? `£${(pencePerDay / 100).toFixed(2)}` : `${pencePerDay}p`}/day</span>
                </span>
                <span className="text-[11px] text-gray-500">Paid over 12 months</span>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-[#0BA360]">£{fullPrice}</span>
                </div>
                <span className="text-[11px] text-gray-600 mt-0.5">One simple payment</span>
                {savings > 0 && (
                  <span className="text-[11px] font-semibold text-[#0BA360]">You save £{savings} vs monthly</span>
                )}
              </>
            )}
          </div>

          {/* 4. Pay in full savings pill (when on monthly) */}
          {isMonthly && savings > 0 && (
            <div className="flex items-center gap-2 bg-[#E8F7EF] border border-[#0BA360]/20 rounded-xl px-4 py-2.5 flex-shrink-0">
              <Wallet className="w-4 h-4 text-[#0BA360]" />
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-bold text-gray-900">Pay in full £{fullPrice}</span>
                <span className="text-[12px] font-semibold text-[#0BA360]">Save £{savings} vs monthly</span>
              </div>
            </div>
          )}

          {/* 5. CTA */}
          <div className="flex flex-col items-center justify-center gap-1 flex-1 min-w-[260px] max-w-[360px]">
            <Button
              onClick={onPayClick}
              disabled={isLoading}
              aria-label="Activate my cover"
              className="w-full bg-[#FF6B00] hover:bg-[#e55f00] text-white font-bold py-6 px-6 rounded-xl text-base gap-2 shadow-lg hover:shadow-xl transition-all"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                <>
                  Continue to checkout
                  <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
                </>
              )}
            </Button>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <Lock className="w-3 h-3" />
              <span>Secure checkout</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopStickyBar;
