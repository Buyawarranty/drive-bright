import React, { useEffect, useState, useCallback } from 'react';
import { ArrowRight, Star, Lock, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMarketingSavings, PaymentPeriod } from '@/lib/pricingMatrix';
import { cn } from '@/lib/utils';

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
  
  // Use actual total price passed from parent for consistency
  const payInFull = totalPrice;
  
  // Calculate cost per month of cover (total ÷ cover months) - same as TermSelector
  const coverMonths = paymentPeriod === '12months' ? 12 : paymentPeriod === '24months' ? 24 : 36;
  const calculatedCostPerMonth = costPerMonthOfCover ?? Math.round(payInFull / coverMonths);

  const toggleMobileExpand = useCallback(() => {
    setIsMobileExpanded(prev => !prev);
  }, []);

  const coverYears = paymentPeriod === '12months' ? '1' : paymentPeriod === '24months' ? '2' : '3';
  const coverText = `${coverYears}-Year Cover`;
  
  // Get color based on plan type (matching TermSelector)
  const getPriceColor = () => {
    if (paymentPeriod === '36months') return 'text-green-600';
    if (paymentPeriod === '24months') return 'text-orange-600';
    return 'text-slate-700';
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] border-t border-gray-200 z-50">
      {/* Desktop Layout */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 py-5">
        <div className="flex items-center justify-between gap-8">
          
          {/* Left Section - Trustpilot */}
          <div className="flex flex-col items-start gap-1 min-w-[160px]">
            <a 
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col items-start gap-0.5 hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-[#00b67a]">★</span>
                <span className="text-sm font-semibold text-gray-800">Trustpilot</span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#00b67a] text-[#00b67a]" />
                ))}
              </div>
            </a>
          </div>

          {/* Centre Section - Primary Pricing Block (matching TermSelector card) */}
          <div className="flex flex-col items-center gap-1">
            {/* Cost per month of cover - HERO PRICE (matching card) */}
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Cost per month of cover</p>
            <div className={cn(
              "flex items-baseline gap-1.5 transition-all duration-300",
              isPulsing && "animate-pulse scale-105"
            )}>
              <span className={cn("text-3xl font-bold", getPriceColor())}>
                £{calculatedCostPerMonth}
              </span>
              <span className="text-base text-muted-foreground">per month</span>
            </div>
            
            {/* Payment breakdown - muted grey (matching card) */}
            <div className="flex flex-col items-center gap-0.5 mt-1">
              <p className="text-sm text-muted-foreground">
                Paid monthly for 12 months <span className="font-semibold text-foreground">£{monthlyPrice} per month</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Total cost <span className="font-semibold text-foreground">£{payInFull}</span>
              </p>
            </div>
          </div>

          {/* Centre-Right Section - Cover Badge (matching card) */}
          <div className="flex flex-col items-center gap-1.5">
            {paymentPeriod === '24months' && (
              <p className="text-sm font-semibold text-orange-600">No payments in year 2</p>
            )}
            {paymentPeriod === '36months' && (
              <p className="text-sm font-semibold text-green-600">No payments in years 2 or 3</p>
            )}
            <span className="text-sm text-muted-foreground">{coverText}</span>
          </div>

          {/* Right Section - CTA */}
          <div className="flex flex-col items-end gap-2 min-w-[200px]">
            <Button
              onClick={onContinue}
              disabled={isLoading || !isValid}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-6 px-8 rounded-xl text-base gap-2 shadow-lg hover:shadow-xl transition-all"
            >
              {isLoading ? (
                'Loading...'
              ) : (
                <>
                  Continue to checkout
                  <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
                </>
              )}
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Lock className="w-3.5 h-3.5" />
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
            isMobileExpanded ? "max-h-[260px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="px-4 pt-4 pb-2 space-y-3">
            {/* Cost per month of cover - HERO PRICE (matching card) */}
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Cost per month of cover</p>
              <div className={cn(
                "flex items-baseline justify-center gap-1.5 transition-all duration-300",
                isPulsing && "animate-pulse"
              )}>
                <span className={cn("text-2xl font-bold", getPriceColor())}>
                  £{calculatedCostPerMonth}
                </span>
                <span className="text-sm text-muted-foreground">per month</span>
              </div>
            </div>

            {/* Payment breakdown - muted grey (matching card) */}
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                Paid monthly for 12 months <span className="font-semibold text-foreground">£{monthlyPrice} per month</span>
              </p>
              {paymentPeriod === '24months' && (
                <p className="text-sm font-semibold text-orange-600">No payments in year 2</p>
              )}
              {paymentPeriod === '36months' && (
                <p className="text-sm font-semibold text-green-600">No payments in years 2 or 3</p>
              )}
              <p className="text-sm text-muted-foreground">
                Total cost <span className="font-semibold text-foreground">£{payInFull}</span>
              </p>
            </div>

            <p className="text-center text-sm text-muted-foreground">{coverText}</p>
          </div>
        </div>

        {/* Collapsed Bar - Always visible */}
        <div className="px-4 py-3">
          {/* Expand/Collapse Toggle */}
          <button
            onClick={toggleMobileExpand}
            className="w-full flex items-center justify-center gap-1 text-xs text-gray-500 mb-2 py-1"
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
            {/* Left: Price Hero */}
            <div className="flex-shrink-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cost per month of cover</p>
              <div className={cn(
                "flex items-baseline gap-1 transition-all duration-300",
                isPulsing && "animate-pulse"
              )}>
                <span className={cn("text-xl font-bold", getPriceColor())}>£{calculatedCostPerMonth}</span>
                <span className="text-xs text-muted-foreground">/mo</span>
              </div>
              <p className="text-xs text-muted-foreground">Total: £{payInFull}</p>
            </div>

            {/* Right: CTA Button */}
            <Button
              onClick={onContinue}
              disabled={isLoading || !isValid}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-5 rounded-lg text-sm gap-1.5 shadow-md flex-shrink-0"
            >
              {isLoading ? (
                'Loading...'
              ) : (
                <>
                  Checkout
                  <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </>
              )}
            </Button>
          </div>

          {/* Security reassurance */}
          <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-gray-500">
            <Lock className="w-3 h-3" />
            <span>Secure checkout – No hidden fees</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickyFooter;
