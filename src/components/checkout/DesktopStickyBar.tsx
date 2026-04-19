import React from 'react';
import { Button } from '@/components/ui/button';
import { Lock, Shield, Tag } from 'lucide-react';

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
  totalPrice,
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

  const months = paymentType === '24months' ? 24 : paymentType === '36months' ? 36 : 12;
  const totalCoverDays = Math.round((months / 12) * 365);
  // Daily price MUST derive from monthlyPrice * 12 (actual paid) for consistency with Step 3
  const baseTotal = monthlyPrice * 12;
  const pencePerDay = baseTotal > 0 && totalCoverDays > 0 ? Math.round((baseTotal * 100) / totalCoverDays) : 0;
  const fullPencePerDay = fullPrice > 0 && totalCoverDays > 0 ? Math.round((fullPrice * 100) / totalCoverDays) : 0;
  const isMonthly = selectedPayment === 'monthly';

  return (
    <div className="hidden lg:block fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between gap-6">

          {/* SECTION 1: Plan summary */}
          <div className="flex flex-col min-w-fit">
            <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
              {duration}
            </span>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              Local Garages (£50/hour)
            </span>
          </div>

          {/* SECTION 2: Price hero */}
          <div className="flex items-center gap-4 flex-1 justify-center min-w-0">
            <div className="flex flex-col items-start border-l border-gray-200 pl-6">
              {isMonthly ? (
                <>
                  <span className="text-2xl font-bold text-gray-900 leading-none whitespace-nowrap">
                    £{monthlyPrice}/month
                  </span>
                  <span className="text-sm text-gray-600 whitespace-nowrap mt-1">
                    Equal to <span className="font-semibold text-gray-700">{pencePerDay}p/day</span>
                  </span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    Paid over 12 months
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-bold text-[#0BA360] leading-tight whitespace-nowrap">
                    £{fullPrice}
                  </span>
                  <span className="text-sm text-gray-700 whitespace-nowrap">
                    One simple payment <span className="text-gray-500">({fullPencePerDay}p/day)</span>
                  </span>
                  {savings > 0 && (
                    <span className="text-xs font-semibold text-[#0BA360] whitespace-nowrap">
                      You save £{savings} vs monthly
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Savings pill (only show on monthly to highlight pay-in-full deal) */}
            {isMonthly && savings > 0 && (
              <div className="flex items-center gap-2 bg-[#E8F7EF] border border-[#0BA360]/20 rounded-lg px-3 py-2">
                <Tag className="w-4 h-4 text-[#0BA360]" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap leading-tight">
                    Pay in full £{fullPrice}
                  </span>
                  <span className="text-xs text-[#0BA360] font-medium whitespace-nowrap">
                    Save £{savings} vs monthly
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: CTA */}
          <div className="flex flex-col items-center min-w-fit">
            <Button
              onClick={onPayClick}
              disabled={isLoading}
              size="lg"
              aria-label="Activate my cover"
              className="text-base font-bold px-8 py-5 text-white rounded-xl whitespace-nowrap animate-breathing"
              style={{ backgroundColor: isMonthly ? '#FF6B00' : '#0BA360' }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Activate my cover
                </span>
              )}
            </Button>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500 whitespace-nowrap">
              <Shield className="h-3 w-3 flex-shrink-0 text-[#0BA360]" />
              <span>Secure checkout – 14 days to cancel</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopStickyBar;
