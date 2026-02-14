import React from 'react';
import { Button } from '@/components/ui/button';
import { Lock, ArrowRight, Shield, Clock } from 'lucide-react';
import TrustpilotHeader from '@/components/TrustpilotHeader';

interface DesktopStickyBarProps {
  selectedPayment: 'monthly' | 'full';
  monthlyPrice: number;
  totalPrice: number;
  fullPrice: number;
  savings: number;
  duration: string;
  paymentType: '12months' | '24months' | '36months';
  isLoading: boolean;
  hasPromoDiscount?: boolean;
  onPayClick: () => void;
  isVisible?: boolean;
  minimised?: boolean;
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
  hasPromoDiscount,
  onPayClick,
  isVisible = true,
  minimised = false,
}) => {
  if (!isVisible) return null;

  // Minimised: slim trust/info strip instead of full CTA bar
  if (minimised) {
    return (
      <div className="hidden lg:block fixed bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 py-2.5">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
            <a 
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <TrustpilotHeader className="flex-shrink-0 scale-[0.5] origin-center" />
            </a>
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-[#0BA360]" />
              Instant cover
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#0BA360]" />
              14-day refund
            </span>
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-[#0BA360]" />
              Secure payment
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden lg:block fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-stretch justify-between bg-white rounded-xl overflow-hidden">
          
          {/* SECTION 1: Trust & Reassurance */}
          <div className="flex flex-col items-center justify-center px-4 lg:px-6 py-3 border-r border-gray-100 min-w-fit">
            <a 
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <TrustpilotHeader className="flex-shrink-0 scale-[0.65] origin-center" />
            </a>
            <div className="text-xs text-gray-500 mt-1 whitespace-nowrap">Easy Claims</div>
          </div>
          
          {/* SECTION 2: Price */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 lg:px-6 py-3 border-r border-gray-100 text-center min-w-0">
            {selectedPayment === 'monthly' ? (
              <>
                <div className="text-xl lg:text-2xl font-bold text-gray-900 whitespace-nowrap">
                  £{monthlyPrice}/Month <span className="text-sm lg:text-base font-normal text-gray-600">– 0% APR</span>
                </div>
                <div className="text-xs lg:text-sm text-gray-500 mt-0.5 whitespace-nowrap">
                  Only 12 payments · Total: £{totalPrice}
                </div>
              </>
            ) : (
              <>
                <div className="text-xl lg:text-2xl font-bold text-gray-900 whitespace-nowrap">
                  Pay in Full: £{fullPrice}
                </div>
                <div className="flex items-center gap-2 text-xs lg:text-sm mt-0.5 flex-wrap justify-center">
                  <span className="line-through text-red-500">£{totalPrice}</span>
                  <span className="font-bold text-green-600">Save £{savings}</span>
                  {hasPromoDiscount ? (
                    <span className="text-gray-600 whitespace-nowrap">(inc. promo)</span>
                  ) : (
                    <span className="text-gray-600 whitespace-nowrap">(10% off)</span>
                  )}
                </div>
              </>
            )}
          </div>
          
          {/* SECTION 3: Cover & Free Years */}
          <div className="flex flex-col items-center justify-center px-4 lg:px-6 py-3 border-r border-gray-100 text-center min-w-fit">
            <span className="font-bold text-gray-900 text-sm lg:text-base whitespace-nowrap">
              {duration}
            </span>
            {paymentType !== '12months' && (
              <span className="text-gray-900 text-xs lg:text-sm font-bold mt-1 whitespace-nowrap">
                {paymentType === '24months' && 'No payments in year 2'}
                {paymentType === '36months' && 'No payments in years 2 & 3'}
              </span>
            )}
          </div>
          
          {/* SECTION 4: CTA */}
          <div className="flex flex-col items-center justify-center px-4 lg:px-6 py-3 min-w-fit">
            <Button
              onClick={onPayClick}
              disabled={isLoading}
              size="lg"
              aria-label={
                selectedPayment === 'full'
                  ? `Pay £${fullPrice} now`
                  : `Pay £${monthlyPrice} today`
              }
              className="text-base lg:text-lg font-semibold px-6 lg:px-8 py-3 lg:py-3.5 text-white rounded-xl whitespace-nowrap animate-breathing"
              style={{ backgroundColor: selectedPayment === 'monthly' ? '#FF6B00' : '#0BA360' }}
            >
              {selectedPayment === 'full' 
                ? `Pay £${fullPrice} now`
                : `Pay £${monthlyPrice} today`
              }
              <ArrowRight className="w-4 lg:w-5 h-4 lg:h-5 ml-2" strokeWidth={3} />
            </Button>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500 whitespace-nowrap">
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
