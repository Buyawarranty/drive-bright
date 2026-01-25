import React, { useEffect, useState, useCallback } from 'react';
import { ArrowRight, Lock, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { calculateCPMWithGuardrail } from '@/lib/cpmUtils';

interface StickyFooterProps {
  monthlyPrice: number;
  totalPrice: number;
  freeYearText?: string;
  onContinue: () => void;
  isLoading: boolean;
  isValid: boolean;
  paymentPeriod?: string;
  hasAddOnsSelected?: boolean;
  costPerMonthOfCover?: number;
}

const StickyFooter: React.FC<StickyFooterProps> = ({
  monthlyPrice,
  totalPrice,
  onContinue,
  isLoading,
  isValid,
  paymentPeriod = '24months',
  hasAddOnsSelected = false,
  costPerMonthOfCover
}) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const [prevPrice, setPrevPrice] = useState(monthlyPrice);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  
  useEffect(() => {
    if (monthlyPrice !== prevPrice) {
      setIsPulsing(true);
      setPrevPrice(monthlyPrice);
      const timer = setTimeout(() => setIsPulsing(false), 600);
      return () => clearTimeout(timer);
    }
  }, [monthlyPrice, prevPrice]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (isMobileExpanded && currentScrollY - lastScrollY > 300) {
        setIsMobileExpanded(false);
      }
      if (!isMobileExpanded) {
        lastScrollY = currentScrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobileExpanded]);
  
  const payInFull = totalPrice;
  const coverMonths = paymentPeriod === '12months' ? 12 : paymentPeriod === '24months' ? 24 : 36;
  const calculatedCostPerMonth = costPerMonthOfCover ?? calculateCPMWithGuardrail(payInFull, coverMonths, monthlyPrice);

  const toggleMobileExpand = useCallback(() => {
    setIsMobileExpanded(prev => !prev);
  }, []);

  const coverYears = paymentPeriod === '12months' ? '1' : paymentPeriod === '24months' ? '2' : '3';
  const coverText = `${coverYears}-Year Cover`;

  // Calculate pay in full savings (10%)
  const payInFullPrice = Math.round(payInFull * 0.9);
  const savings = payInFull - payInFullPrice;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-[#E8E8E8] shadow-lg z-50">
      {/* Desktop Layout */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          
          {/* Left Section - Trustpilot */}
          <div className="flex items-center gap-3">
            <a 
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
            >
              <span className="text-sm font-semibold text-[#00B67A]">★ Trustpilot</span>
            </a>
            <span className="text-xs text-[#888888]">14 days to cancel</span>
          </div>

          {/* Centre Section - Main Pricing */}
          <div className="flex flex-col items-start flex-1">
            <div className="flex items-baseline gap-2">
              <p className={cn(
                "text-2xl font-bold text-[#000000] transition-all duration-300",
                isPulsing && "animate-pulse"
              )}>
                £{monthlyPrice}/month for 12 months
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-[#666666]">£{calculatedCostPerMonth}/month average</span>
              {paymentPeriod !== '12months' && (
                <span className="text-sm text-[#666666]">£0 in year {paymentPeriod === '24months' ? '2' : '2 & year 3'}</span>
              )}
              <span className="text-sm text-[#666666]">Total: £{payInFull.toLocaleString()}</span>
            </div>
          </div>

          {/* Right Section - Savings + CTA */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-[#666666]">Pay in full and save £{savings}</p>
              <p className="text-sm">
                <span className="font-bold text-[#000000]">£{payInFullPrice}</span>
                <span className="text-[#888888] ml-1">today</span>
                <span className="text-[#888888] line-through ml-1">(was £{payInFull})</span>
              </p>
            </div>
            
            {paymentPeriod !== '12months' && (
              <div className="text-center px-3 py-2 bg-[#F0FDF4] rounded-lg">
                <p className="text-sm font-bold text-[#3A8F45]">
                  Year {paymentPeriod === '24months' ? '2' : '2 & 3'} FREE 🎉
                </p>
                <p className="text-xs text-[#666666]">{coverText}</p>
              </div>
            )}
            
            <Button
              onClick={onContinue}
              disabled={isLoading || !isValid}
              className="bg-[#3A8F45] hover:bg-[#2E7A38] text-white font-semibold py-5 px-6 rounded-lg text-sm gap-2 shadow-md"
            >
              {isLoading ? (
                'Loading...'
              ) : (
                <>
                  Continue to checkout
                  <ArrowRight className="w-4 h-4 text-white" strokeWidth={2} />
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Security line */}
        <div className="flex items-center justify-end gap-1.5 mt-2 text-xs text-[#888888]">
          <Lock className="w-3 h-3" />
          <span>Secure checkout – SSL encrypted</span>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Expanded Panel */}
        <div 
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isMobileExpanded ? "max-h-[280px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="px-4 pt-4 pb-2 space-y-3">
            {/* Plan info */}
            <div className="text-center">
              <p className={cn(
                "text-xl font-bold text-[#000000] transition-all duration-300",
                isPulsing && "animate-pulse"
              )}>
                £{monthlyPrice}/month for 12 months
              </p>
              <p className="text-sm text-[#666666]">£{calculatedCostPerMonth}/month average</p>
            </div>
            
            {paymentPeriod !== '12months' && (
              <p className="text-center text-sm text-[#666666]">
                £0 in year {paymentPeriod === '24months' ? '2' : '2 & year 3'}
              </p>
            )}
            
            <p className="text-center text-sm font-semibold text-[#000000]">
              Total: £{payInFull.toLocaleString()}
            </p>

            {/* Pay in full savings */}
            <div className="text-center pt-2 border-t border-[#E8E8E8]">
              <p className="text-sm text-[#666666]">
                Pay in full and <span className="font-semibold text-[#3A8F45]">save £{savings}</span>
              </p>
              <p className="text-sm text-[#666666]">
                <span className="font-bold text-[#000000]">£{payInFullPrice}</span> today <span className="text-[#888888] line-through">(was £{payInFull})</span>
              </p>
            </div>
            
            {paymentPeriod !== '12months' && (
              <p className="text-center text-sm text-[#3A8F45] font-medium">
                ✓ You're covered in 60 seconds – no payment taken until confirmation
              </p>
            )}
          </div>
        </div>

        {/* Collapsed Bar - Always visible */}
        <div className="px-4 py-3">
          {/* Expand/Collapse Toggle */}
          <button
            onClick={toggleMobileExpand}
            className="w-full flex items-center justify-center gap-1 text-xs text-[#888888] mb-2 py-1"
            aria-expanded={isMobileExpanded}
            aria-label={isMobileExpanded ? "Hide details" : "Show more details"}
          >
            {isMobileExpanded ? (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Hide details</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>More details</span>
              </>
            )}
          </button>

          {/* Main row: Price + CTA */}
          <div className="flex items-center justify-between gap-3">
            {/* Left: Price summary */}
            <div className="flex-shrink-0">
              <p className="text-xs font-semibold text-[#000000]">{coverText}</p>
              <div className={cn(
                "transition-all duration-300",
                isPulsing && "animate-pulse"
              )}>
                <p className="text-lg font-bold text-[#000000]">£{calculatedCostPerMonth} <span className="text-sm font-normal text-[#666666]">per month</span></p>
              </div>
              <p className="text-xs text-[#666666]">Paid monthly for 12 months £{monthlyPrice} per month</p>
              {paymentPeriod !== '12months' && (
                <p className="text-xs text-[#666666]">No payments in year {paymentPeriod === '24months' ? '2' : '2 or 3'}</p>
              )}
            </div>

            {/* Right: CTA Button */}
            <Button
              onClick={onContinue}
              disabled={isLoading || !isValid}
              className="bg-white hover:bg-[#F5F5F5] text-[#000000] font-semibold py-3 px-4 rounded-lg text-sm gap-1.5 border border-[#000000] shadow-none flex-shrink-0"
            >
              {isLoading ? (
                'Loading...'
              ) : (
                <>
                  Continue to secure payment
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </>
              )}
            </Button>
          </div>

          {/* Security reassurance */}
          <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-[#888888]">
            <Lock className="w-3 h-3" />
            <span>Secure checkout – SSL encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickyFooter;