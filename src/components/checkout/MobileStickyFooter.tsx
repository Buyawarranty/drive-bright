import React from 'react';
import { Lock, Shield, Tag } from 'lucide-react';
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

const MobileStickyFooter: React.FC<MobileStickyFooterProps> = ({
  selectedPayment,
  monthlyPrice,
  totalPrice,
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

  const months = paymentType === '24months' ? 24 : paymentType === '36months' ? 36 : 12;
  const totalCoverDays = Math.round((months / 12) * 365);
  // Daily price MUST derive from monthlyPrice * 12 (actual paid) for consistency with Step 3
  const baseTotal = monthlyPrice * 12;
  const pencePerDay = baseTotal > 0 && totalCoverDays > 0 ? Math.round((baseTotal * 100) / totalCoverDays) : 0;
  const savings = Math.max(0, baseTotal - fullPrice);
  const isMonthly = selectedPayment === 'monthly';
  const isFull = selectedPayment === 'full';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E5E5] lg:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      <div className="px-4 pt-2.5 pb-[env(safe-area-inset-bottom,8px)]">
        {/* Price hero row */}
        {selectedPayment && (
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex flex-col min-w-0">
              {isMonthly ? (
                <>
                  <span className="text-xl font-bold text-[#FF6B00] leading-tight">
                    {pencePerDay >= 100 ? `£${(pencePerDay / 100).toFixed(2)}` : `${pencePerDay}p`}/day over term
                  </span>
                  <span className="text-[11px] text-gray-600 leading-tight">
                    £{monthlyPrice}/mo · 12 payments · Covers {months} months
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xl font-bold text-[#0BA360] leading-tight">
                    £{fullPrice}
                  </span>
                  <span className="text-[11px] text-gray-600 leading-tight">
                    One simple payment
                  </span>
                </>
              )}
            </div>
            {isMonthly && savings > 0 && (
              <div className="flex items-center gap-1.5 bg-[#E8F7EF] border border-[#0BA360]/20 rounded-md px-2 py-1 flex-shrink-0">
                <Tag className="w-3 h-3 text-[#0BA360]" />
                <span className="text-[11px] font-semibold text-[#0BA360] leading-tight whitespace-nowrap">
                  Save £{savings} in full
                </span>
              </div>
            )}
            {isFull && savings > 0 && (
              <div className="flex items-center gap-1.5 bg-[#E8F7EF] border border-[#0BA360]/20 rounded-md px-2 py-1 flex-shrink-0">
                <Tag className="w-3 h-3 text-[#0BA360]" />
                <span className="text-[11px] font-semibold text-[#0BA360] leading-tight whitespace-nowrap">
                  Saving £{savings}
                </span>
              </div>
            )}
          </div>
        )}

        {/* CTA Button */}
        <Button
          onClick={onPayClick}
          disabled={isLoading || !selectedPayment}
          aria-label={selectedPayment ? 'Activate my cover' : 'Select payment option'}
          className="w-full py-5 text-base font-bold rounded-xl animate-breathing"
          style={{
            backgroundColor: !selectedPayment
              ? '#CCCCCC'
              : isMonthly
                ? '#FF6B00'
                : '#0BA360',
            color: '#FFFFFF',
          }}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              {selectedPayment ? 'Activate my cover' : 'Select payment option'}
            </span>
          )}
        </Button>

        {/* Trust strip */}
        <div className="flex items-center justify-center gap-2 mt-1.5 text-[11px] text-gray-600">
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
};

export default MobileStickyFooter;
