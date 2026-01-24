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
            {/* Large headline: £X/month for 12 months */}
            <p className={cn(
              "text-xl font-bold text-[#000000] transition-all duration-300",
              isPulsing && "animate-pulse"
            )}>
              £{monthlyPrice}/month for 12 months
            </p>
            
            {/* Average price line */}
            <p className="text-sm text-[#333333]">
              <span className="font-semibold text-[#000000]">£{calculatedCostPerMonth}/month</span> average
            </p>
            
            {/* £0 in year 2 & year 3 - for multi-year plans */}
            {paymentPeriod !== '12months' && (
              <p className="text-sm font-semibold text-[#333333]">
                £0 in year {paymentPeriod === '24months' ? '2' : '2 & year 3'}
              </p>
            )}
            
            {/* Total */}
            <p className="text-sm text-[#333333]">
              Total: <span className="font-semibold">£{payInFull.toLocaleString()}</span>
            </p>
          </div>

          {/* Right-Hand Savings Section */}
          <div className="flex flex-col items-start gap-1 px-6 border-r border-[#DDDDDD]">
            <p className="text-sm font-bold text-[#000000]">{coverText}</p>
            <p className="text-sm text-[#333333]">
              Pay in full and <span className="font-semibold text-[#3A8F45]">save £{savings}</span>
            </p>
            <p className="text-sm text-[#333333]">
              <span className="font-semibold text-[#000000]">£{payInFullPrice.toLocaleString()}</span> today <span className="text-[#777777]">(was £{payInFull.toLocaleString()})</span>
            </p>
          </div>

          {/* Far Right CTA Section */}
          <div className="flex flex-col items-end gap-2 min-w-[180px]">
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
            <div className="flex items-center gap-1.5 text-xs text-[#777777]">
              <Lock className="w-3 h-3" />
              <span>Secure checkout – No hidden fees</span>
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
          <div className="px-4 pt-4 pb-2 space-y-2">
            {/* Actual payment - BOLD AND LARGE - First */}
            <div className={cn(
              "text-center transition-all duration-300",
              isPulsing && "animate-pulse"
            )}>
              <p className="text-lg font-bold text-[#000000]">
                £{monthlyPrice}/month for 12 months
              </p>
            </div>
            
            {/* Average per month */}
            <p className="text-center text-sm text-[#555555]">
              <span className="font-semibold text-[#000000]">£{calculatedCostPerMonth}/month</span> average
            </p>
            
            {/* £0 in year 2 & year 3 */}
            {paymentPeriod !== '12months' && (
              <p className="text-center text-sm text-[#555555]">
                £0 in year {paymentPeriod === '24months' ? '2' : '2 & year 3'}
              </p>
            )}
            
            {/* Total */}
            <p className="text-center text-sm font-semibold text-[#000000]">
              Total: £{payInFull.toLocaleString()}
            </p>

            {/* Pay in full savings */}
            <div className="text-center pt-2 border-t border-[#DDDDDD]">
              <p className="text-sm text-[#333333]">
                Pay in full and <span className="font-semibold text-[#3A8F45]">save £{savings}</span>
              </p>
              <p className="text-sm text-[#333333]">
                <span className="font-bold text-[#000000]">£{payInFullPrice.toLocaleString()}</span> today <span className="text-[#777777]">(was £{payInFull.toLocaleString()})</span>
              </p>
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
              <div className={cn(
                "transition-all duration-300",
                isPulsing && "animate-pulse"
              )}>
                <p className="text-sm font-bold text-[#000000]">£{monthlyPrice}/mo × 12</p>
              </div>
              <p className="text-xs text-[#555555]">
                <span className="font-semibold text-[#000000]">£{calculatedCostPerMonth}/mo</span> avg
              </p>
              <p className="text-xs text-[#555555]">Total: £{payInFull.toLocaleString()}</p>
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
