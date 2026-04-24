import React from 'react';
import { Button } from '@/components/ui/button';
import { Lock, Shield, ArrowRight, Wallet } from 'lucide-react';

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

/**
 * Desktop sticky bar for Step 4 (checkout) — visually mirrors the Step 3
 * pricing sticky bar (5-section divided design from PricingTable.tsx).
 */
const DesktopStickyBar: React.FC<DesktopStickyBarProps> = ({
  monthlyPrice,
  fullPrice,
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

  // Trust strip only mode (kept for parity)
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

  // Match Step 3 derivations
  const months = paymentType === '36months' ? 36 : paymentType === '24months' ? 24 : 12;
  const payInFull = monthlyPrice * 12;
  const stripeSavings = Math.max(0, payInFull - (fullPrice || Math.floor(payInFull * 0.9)));
  const payInFullDiscounted = fullPrice || (payInFull - Math.floor(payInFull * 0.10));
  const totalCoverDays = Math.round((months / 12) * 365);
  const pencePerDayRaw = totalCoverDays > 0 ? (payInFull * 100) / totalCoverDays : 0;
  const dailyPriceLabel = pencePerDayRaw >= 100
    ? `£${(pencePerDayRaw / 100).toFixed(2)}/day`
    : `${Math.round(pencePerDayRaw)}p/day`;

  const yearWord = paymentType === '12months' ? '1-Year' : paymentType === '24months' ? '2-Year' : '3-Year';
  const coverLabel = duration || `${yearWord} Platinum Cover`;

  return (
    <div className="hidden lg:block fixed bottom-0 left-0 right-0 bg-gray-50 border-t-2 border-green-200 shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-stretch w-full bg-white rounded-xl shadow-lg border border-gray-100 divide-x divide-gray-200 gap-0">

          {/* SECTION 1: Trustpilot */}
          <div className="flex-shrink-0 w-[180px] flex items-center gap-2.5 px-5 py-3.5">
            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-green-600" />
            </div>
            <a
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-start hover:opacity-80 transition-opacity leading-tight"
            >
              <span className="text-sm font-bold text-gray-900">Excellent</span>
              <div className="flex gap-0.5 my-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="inline-block w-3 h-3 bg-[#00B67A] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white fill-current">
                      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z" />
                    </svg>
                  </span>
                ))}
              </div>
              <span className="text-[11px] text-gray-600">4.8 out of 5</span>
            </a>
          </div>

          {/* SECTION 2: Your cover */}
          <div className="flex-1 flex flex-col justify-center px-5 py-3.5">
            <span className="text-[11px] font-bold text-orange-500 tracking-wide uppercase leading-tight">Your Cover</span>
            <span className="text-base font-bold text-gray-900 whitespace-nowrap mt-1 leading-tight">{coverLabel}</span>
          </div>

          {/* SECTION 3: Price */}
          <div className="flex-[1.2] flex flex-col items-start justify-center px-5 py-3.5 gap-0.5">
            <span className="text-2xl font-bold text-gray-900 leading-none whitespace-nowrap">£{monthlyPrice}/month</span>
            <span className="text-xs text-gray-600 whitespace-nowrap">
              Equal to <span className="font-semibold text-gray-700">{dailyPriceLabel}</span>
            </span>
            <span className="text-[11px] text-gray-500 whitespace-nowrap">Paid over 12 months</span>
          </div>

          {/* SECTION 4: Pay in full pill */}
          <div className="flex-[1.2] flex items-center justify-center px-5 py-3.5">
            {stripeSavings > 0 && (
              <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                <Wallet className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs text-gray-700 whitespace-nowrap leading-tight">Pay in full <span className="font-bold text-gray-900">£{payInFullDiscounted}</span></span>
                  <span className="text-xs font-semibold text-green-600 whitespace-nowrap leading-tight mt-0.5">Save £{stripeSavings} vs monthly</span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: CTA */}
          <div className="flex-[1.3] flex flex-col items-center justify-center px-5 py-3.5 gap-1.5">
            <Button
              onClick={onPayClick}
              disabled={isLoading}
              aria-label="Continue to checkout"
              size="lg"
              className="text-sm font-bold px-5 py-2.5 bg-orange-500 hover:bg-orange-600 hover:shadow-lg text-white rounded-xl whitespace-nowrap w-full"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                <>
                  Continue to checkout
                  <ArrowRight className="w-4 h-4 ml-2" strokeWidth={3} />
                </>
              )}
            </Button>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 whitespace-nowrap">
              <Lock className="h-3 w-3 flex-shrink-0" />
              <span>Secure checkout – 14 days to cancel</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DesktopStickyBar;
