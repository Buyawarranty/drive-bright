import React from 'react';
import { Lock, Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import trustpilotStars from '@/assets/trustpilot-5-stars.png';

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

  // Trust strip only mode
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

  const baseTotal = monthlyPrice * 12;
  const pencePerDay = baseTotal > 0 ? Math.round((baseTotal * 100) / 365) : 0;
  const savings = Math.max(0, baseTotal - fullPrice);
  const isMonthly = selectedPayment === 'monthly';
  const isFull = selectedPayment === 'full';

  const yearWord = paymentType === '12months' ? '1-Year' : paymentType === '24months' ? '2-Year' : '3-Year';
  const planLabel = `${yearWord} Platinum Cover`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl border-t border-gray-200 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] lg:hidden">
      <div className="px-4 pt-3 pb-[env(safe-area-inset-bottom,8px)]">
        {/* Trustpilot + Cover label row */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[10px] font-bold text-[#FF6B00] tracking-wider uppercase">Your cover</span>
            <span className="text-[12px] font-bold text-gray-900">{planLabel}</span>
          </div>
          <a
            href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:opacity-80"
          >
            <span className="text-sm font-bold text-gray-900 leading-none">Excellent</span>
            <img src="/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png" alt="Trustpilot" className="h-4 w-auto" />
          </a>
        </div>

        {/* Price row */}
        {selectedPayment && (
          <>
          <div className="flex items-end justify-between gap-3 mb-2">
            <div className="flex flex-col leading-tight min-w-0">
              {isMonthly ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-gray-900">£{monthlyPrice}</span>
                    <span className="text-sm text-gray-600">/month</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-700">Paid over 12 months</span>
                  <span className="text-[11px] text-gray-600">
                    Equal to <span className="font-semibold text-gray-700">{pencePerDay >= 100 ? `£${(pencePerDay / 100).toFixed(2)}` : `${pencePerDay}p`}/day</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xl font-extrabold text-[#0BA360] leading-tight">£{fullPrice}</span>
                  <span className="text-[11px] text-gray-600">One simple payment</span>
                </>
              )}
            </div>

            {isMonthly && (
              <div className="flex flex-col items-end bg-[#E8F7EF] border border-[#0BA360]/20 rounded-lg px-2.5 py-1.5 flex-shrink-0">
                <span className="text-[13px] font-extrabold text-[#0BA360] leading-tight whitespace-nowrap">
                  Pay in full £{fullPrice}
                </span>
                {savings > 0 && (
                  <span className="text-[10px] font-semibold text-[#0BA360] leading-tight whitespace-nowrap">
                    Save £{savings} today
                  </span>
                )}
              </div>
            )}

            {isFull && savings > 0 && (
              <div className="flex flex-col items-end bg-[#E8F7EF] border border-[#0BA360]/20 rounded-lg px-2.5 py-1.5 flex-shrink-0">
                <span className="text-[11px] font-semibold text-[#0BA360] leading-tight whitespace-nowrap">
                  Saving £{savings}
                </span>
              </div>
            )}
          </div>
          </>
        )}

        {/* CTA Button */}
        <Button
          onClick={onPayClick}
          disabled={isLoading || !selectedPayment}
          aria-label={selectedPayment ? 'Continue to checkout' : 'Select payment option'}
          className="w-full bg-[#FF6B00] hover:bg-[#e55f00] disabled:bg-[#CCCCCC] text-white font-bold py-5 rounded-xl text-base gap-2 shadow-lg"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              {selectedPayment ? 'Continue to checkout' : 'Select payment option'}
              {selectedPayment && <ArrowRight className="w-5 h-5" strokeWidth={2.5} />}
            </span>
          )}
        </Button>

        {/* Security reassurance */}
        <div className="flex items-center justify-center gap-1.5 mt-1.5 text-[11px] text-gray-500">
          <Lock className="w-3 h-3" />
          <span>Secure checkout</span>
        </div>
      </div>
    </div>
  );
};

export default MobileStickyFooter;
