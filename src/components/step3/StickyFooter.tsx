import React, { useEffect, useState, useCallback } from 'react';
import { ArrowRight, Lock, ChevronUp, ChevronDown } from 'lucide-react';
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
  // Use guardrail CPM: ensures CPM × years >= monthly instalment
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
    <div className="fixed bottom-0 left-0 right-0 bg-[#F7F7F7] border-t border-[#DDDDDD] z-50">
      {/* Desktop Layout */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          
          {/* Far Left Section - Trustpilot + Cancel */}
          <div className="flex flex-col items-start gap-1.5 min-w-[140px] pr-6 border-r border-[#DDDDDD]">
            <a 
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
            >
              <span className="text-sm font-semibold text-[#333333]">★ Trustpilot</span>
            </a>
            <span className="text-xs text-[#777777]">14 days to cancel</span>
          </div>

          {/* Main Pricing Section (Centre-Left) */}
          <div className="flex flex-col items-start gap-0.5 px-6 border-r border-[#DDDDDD]">
            <p className="text-sm font-semibold text-[#000000]">{coverText}</p>
            <p className="text-xs text-[#777777]">Cost per month of cover</p>
            <div className={cn(
              "flex items-baseline gap-1 transition-all duration-300",
              isPulsing && "animate-pulse"
            )}>
              <span className="text-2xl font-bold text-[#000000]">£{calculatedCostPerMonth}</span>
              <span className="text-sm text-[#777777]">per month</span>
            </div>
            <p className="text-xs font-semibold text-[#555555]">
              Paid monthly for 12 months <span className="font-bold text-[#000000]">£{monthlyPrice}</span> per month
            </p>
            {paymentPeriod !== '12months' && (
              <p className="text-xs font-semibold text-[#555555]">
                No payments in year {paymentPeriod === '24months' ? '2' : '2 or 3'}
              </p>
            )}
          </div>

          {/* Right-Hand Savings Section */}
          <div className="flex flex-col items-start gap-0.5 px-6 border-r border-[#DDDDDD]">
            <p className="text-xs text-[#777777]">Pay in full and save 10%</p>
            <p className="text-sm text-[#333333]">
              Was £{payInFull} – now <span className="font-semibold text-[#3A8F45]">£{payInFullPrice}</span>
            </p>
            <p className="text-xs font-semibold text-[#3A8F45]">You save £{savings}</p>
          </div>

          {/* Far Right CTA Section */}
          <div className="flex flex-col items-end gap-2 min-w-[180px]">
            <Button
              onClick={onContinue}
              disabled={isLoading || !isValid}
              className="bg-white hover:bg-[#EFEFEF] text-[#000000] font-semibold py-5 px-6 rounded-lg text-sm gap-2 border border-[#000000] shadow-none"
            >
              {isLoading ? (
                'Loading...'
              ) : (
                <>
                  Continue to checkout
                  <ArrowRight className="w-4 h-4 text-[#000000]" strokeWidth={2} />
                </>
              )}
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-[#777777]">
              <Lock className="w-3 h-3" />
              <span>Secure checkout – Easy claims</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout - Collapsible */}
      <div className="md:hidden">
        {/* Expanded Panel */}
        <div 
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isMobileExpanded ? "max-h-[280px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="px-4 pt-4 pb-2 space-y-3">
            {/* Cover heading */}
            <p className="text-center text-sm font-semibold text-[#000000]">{coverText}</p>
            
            {/* Cost per month of cover */}
            <div className="text-center">
              <p className="text-xs text-[#777777] mb-0.5">Cost per month of cover</p>
              <div className={cn(
                "flex items-baseline justify-center gap-1 transition-all duration-300",
                isPulsing && "animate-pulse"
              )}>
                <span className="text-2xl font-bold text-[#000000]">£{calculatedCostPerMonth}</span>
                <span className="text-sm text-[#777777]">per month</span>
              </div>
            </div>

            {/* Payment breakdown */}
            <div className="text-center space-y-0.5">
              <p className="text-xs font-semibold text-[#555555]">
                Paid monthly for 12 months <span className="font-bold text-[#000000]">£{monthlyPrice}</span> per month
              </p>
              {paymentPeriod !== '12months' && (
                <p className="text-xs font-semibold text-[#555555]">
                  No payments in year {paymentPeriod === '24months' ? '2' : '2 or 3'}
                </p>
              )}
              <p className="text-xs text-[#777777]">
                Total cost <span className="font-semibold text-[#000000]">£{payInFull}</span>
              </p>
            </div>

            {/* Pay in full savings */}
            <div className="text-center pt-2 border-t border-[#DDDDDD]">
              <p className="text-xs text-[#777777]">Pay in full and save 10%</p>
              <p className="text-sm text-[#333333]">
                Was £{payInFull} – now <span className="font-semibold text-[#3A8F45]">£{payInFullPrice}</span>
              </p>
              <p className="text-xs font-semibold text-[#3A8F45]">You save £{savings}</p>
            </div>
          </div>
        </div>

        {/* Collapsed Bar - Always visible */}
        <div className="px-4 py-3">
          {/* Expand/Collapse Toggle */}
          <button
            onClick={toggleMobileExpand}
            className="w-full flex items-center justify-center gap-1 text-xs text-[#777777] mb-2 py-1"
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
                "flex items-baseline gap-1 transition-all duration-300",
                isPulsing && "animate-pulse"
              )}>
                <span className="text-xl font-bold text-[#000000]">£{calculatedCostPerMonth}</span>
                <span className="text-xs text-[#777777]">/mo</span>
              </div>
              <p className="text-xs text-[#777777]">Total: £{payInFull}</p>
            </div>

            {/* Right: CTA Button */}
            <Button
              onClick={onContinue}
              disabled={isLoading || !isValid}
              className="bg-white hover:bg-[#EFEFEF] text-[#000000] font-semibold py-3 px-4 rounded-lg text-sm gap-1.5 border border-[#000000] shadow-none flex-shrink-0"
            >
              {isLoading ? (
                'Loading...'
              ) : (
                <>
                  Checkout
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </>
              )}
            </Button>
          </div>

          {/* Security reassurance */}
          <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-[#777777]">
            <Lock className="w-3 h-3" />
            <span>Secure checkout – Easy claims</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickyFooter;
