import React from 'react';
import { Lock, Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
}

/**
 * Mobile sticky footer for Step 4 (checkout) — visually mirrors the Step 3
 * pricing sticky bar (see PricingTable.tsx mobile sticky design).
 */
const MobileStickyFooter: React.FC<MobileStickyFooterProps> = ({
  selectedPayment,
  monthlyPrice,
  fullPrice,
  paymentType = '12months',
  isLoading,
  onPayClick,
  minimised = false,
  trustStripOnly = false,
}) => {
  if (minimised && !trustStripOnly) return null;

  // Trust strip only mode (kept for parity with previous behaviour)
  if (trustStripOnly) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E5E5] lg:hidden">
        <div className="px-4 py-2.5 pb-[env(safe-area-inset-bottom,8px)]">
          <div className="flex items-center justify-center gap-3 text-[11px] text-gray-600">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#0BA360]" />
              Instant cover
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#0BA360]" />
              Secure
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#0BA360]" />
              14-day refund
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Match Step 3 derivation: pencePerDay derived from displayMonthly * 12 over total cover days
  const months = paymentType === '36months' ? 36 : paymentType === '24months' ? 24 : 12;
  const payInFull = monthlyPrice * 12;
  // Use the actual fullPrice provided (already discounted) for consistency, fall back to 10% off.
  const stripeSavings = Math.max(0, payInFull - (fullPrice || Math.floor(payInFull * 0.9)));
  const totalCoverDays = Math.round((months / 12) * 365);
  const pencePerDayRaw = totalCoverDays > 0 ? (payInFull * 100) / totalCoverDays : 0;
  const dailyPriceLabel = pencePerDayRaw >= 100
    ? `£${(pencePerDayRaw / 100).toFixed(2)}/day`
    : `${Math.round(pencePerDayRaw)}p/day`;

  const coverLabel =
    months === 12 ? '1-Year Platinum Cover' :
    months === 24 ? '2-Year Platinum Cover' :
    '3-Year Platinum Cover';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-50 border-t-2 border-green-200 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] lg:hidden">
      <div className="px-4 pt-3 pb-[env(safe-area-inset-bottom,8px)]">
        <div className="flex flex-col gap-2 w-full">
          {/* Cover label + Trustpilot — matches Step 3 mobile */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wide">Your Cover</span>
              <span className="text-sm font-bold text-gray-900">{coverLabel}</span>
            </div>
            <a
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-end hover:opacity-80 leading-tight flex-shrink-0"
              aria-label="Trustpilot rating: Excellent, 4.8 out of 5"
            >
              <span className="text-[11px] font-bold text-gray-900">Excellent</span>
              <div className="flex gap-0.5 my-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="inline-block w-3 h-3 bg-[#00B67A] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-2 h-2 text-white fill-current">
                      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z" />
                    </svg>
                  </span>
                ))}
              </div>
              <span className="text-[9px] text-gray-600 leading-none">Trustpilot · 4.8/5</span>
            </a>
          </div>

          {/* Price row — big £/mo, divider, equal-to p/day */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-bold text-gray-900 leading-none whitespace-nowrap">£{monthlyPrice}</span>
            <span className="text-sm text-gray-600 leading-none">/mo</span>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-600 leading-none">Equal to</span>
            <span className="text-base font-semibold text-gray-700 leading-none whitespace-nowrap">{dailyPriceLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-600">12 payments · Covers {months} months</span>
            {stripeSavings > 0 && (
              <span className="text-[11px] font-semibold text-green-600">Save £{stripeSavings} today</span>
            )}
          </div>

          {/* CTA Button */}
          <Button
            onClick={onPayClick}
            disabled={isLoading || !selectedPayment}
            aria-label={selectedPayment ? 'Continue to checkout' : 'Select payment option'}
            size="lg"
            className="w-full text-base font-bold py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-[#CCCCCC] text-white rounded-xl"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {selectedPayment ? 'Continue to checkout' : 'Select payment option'}
                {selectedPayment && <ArrowRight className="w-4 h-4" strokeWidth={3} />}
              </span>
            )}
          </Button>

          {/* Security reassurance */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-500">
            <Lock className="h-3 w-3" />
            <span>Secure checkout – 14 days to cancel</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileStickyFooter;
