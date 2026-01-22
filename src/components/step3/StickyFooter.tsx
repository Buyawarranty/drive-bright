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
}

const StickyFooter: React.FC<StickyFooterProps> = ({
  monthlyPrice,
  totalPrice,
  onContinue,
  isLoading,
  isValid,
  paymentPeriod = '24months',
  hasAddOnsSelected = false
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
  
  // Pay in full = monthly × 12
  const payInFull = monthlyPrice * 12;
  
  // Get marketing savings from centralized pricing matrix
  const savings = getMarketingSavings(paymentPeriod as PaymentPeriod);
  const wasPrice = payInFull + savings;

  const toggleMobileExpand = useCallback(() => {
    setIsMobileExpanded(prev => !prev);
  }, []);

  const coverYears = paymentPeriod === '12months' ? 'One' : paymentPeriod === '24months' ? 'Two' : 'Three';
  const coverText = `${coverYears}-Year Cover`;

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

          {/* Centre Section - Primary Pricing Block (Hero) */}
          <div className="flex flex-col items-center gap-0.5">
            {/* Monthly Price - Hero */}
            <div className={cn(
              "flex items-baseline gap-2 transition-all duration-300",
              isPulsing && "animate-pulse scale-105"
            )}>
              <span className="text-3xl font-bold text-gray-900">£{monthlyPrice}/month</span>
              <span className="text-lg text-gray-600">0% APR</span>
            </div>
            
            {/* 12 Payments - Single mention */}
            <span className="text-sm text-gray-600">Paid over 12 interest-free instalments</span>
            
            {/* Total cost */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-medium text-gray-700">Total cost: £{payInFull}</span>
              <span className="text-sm text-gray-500">•</span>
              <span className="text-sm text-gray-600">{coverText}</span>
            </div>
          </div>

          {/* Centre-Right Section - Cover Badge */}
          <div className="flex flex-col items-center gap-1.5">
            {paymentPeriod === '24months' && (
              <>
                <span className="inline-block bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-sm font-semibold">
                  No payments in year 2
                </span>
                <span className="text-sm text-muted-foreground">24 months of cover</span>
              </>
            )}
            {paymentPeriod === '36months' && (
              <>
                <span className="inline-block bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-sm font-semibold">
                  No payments in years 2 or 3
                </span>
                <span className="text-sm text-muted-foreground">36 months of cover</span>
              </>
            )}
            {paymentPeriod === '12months' && (
              <span className="text-base font-semibold text-foreground">{coverText}</span>
            )}
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
            {/* Primary: Monthly Price Hero */}
            <div className="text-center">
              <div className={cn(
                "flex items-baseline justify-center gap-2 transition-all duration-300",
                isPulsing && "animate-pulse"
              )}>
                <span className="text-2xl font-bold text-gray-900">£{monthlyPrice}/month</span>
                <span className="text-sm text-gray-600">0% APR</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Paid over 12 interest-free instalments</p>
            </div>

            {/* Total cost */}
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Total cost: £{payInFull}</p>
              <p className="text-sm text-gray-600 mt-0.5">{coverText}</p>
            </div>

            {/* No payments badge for multi-year */}
            {paymentPeriod === '24months' && (
              <div className="text-center">
                <span className="inline-block bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-sm font-semibold">
                  No payments in year 2
                </span>
              </div>
            )}
            {paymentPeriod === '36months' && (
              <div className="text-center">
                <span className="inline-block bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-sm font-semibold">
                  No payments in years 2 or 3
                </span>
              </div>
            )}
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
              <div className={cn(
                "flex items-baseline gap-1 transition-all duration-300",
                isPulsing && "animate-pulse"
              )}>
                <span className="text-xl font-bold text-gray-900">£{monthlyPrice}/mo</span>
                <span className="text-xs text-gray-600">0% APR</span>
              </div>
              <p className="text-xs text-gray-600">12 interest-free instalments</p>
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
