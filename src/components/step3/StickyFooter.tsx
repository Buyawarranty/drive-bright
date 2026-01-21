import React, { useEffect, useState, useCallback } from 'react';
import { ArrowRight, Star, Lock, ChevronUp, ChevronDown, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMarketingSavings, PaymentPeriod, DURATION_MONTHS, getCostPerCoverMonth, getCostPerYear } from '@/lib/pricingMatrix';
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
  
  // Calculate equivalent per-cover-month
  const coverMonths = DURATION_MONTHS[paymentPeriod as PaymentPeriod] || 12;
  const costPerCoverMonth = Math.floor(payInFull / coverMonths);
  
  // Calculate per year
  const years = paymentPeriod === '12months' ? 1 : paymentPeriod === '24months' ? 2 : 3;
  const costPerYear = Math.floor(payInFull / years);

  const toggleMobileExpand = useCallback(() => {
    setIsMobileExpanded(prev => !prev);
  }, []);

  const coverYears = paymentPeriod === '12months' ? 'One' : paymentPeriod === '24months' ? 'Two' : 'Three';
  const coverText = `${coverYears}-Year Cover`;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] border-t border-border z-50">
      {/* Desktop Layout */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 py-5">
        <div className="flex items-center justify-between gap-6">
          
          {/* Left Section - Trustpilot & Claims */}
          <div className="flex flex-col items-start gap-1.5 min-w-[180px]">
            <a 
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col items-start gap-0.5 hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-[#00b67a]">★</span>
                <span className="text-sm font-semibold text-foreground">Trustpilot</span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#00b67a] text-[#00b67a]" />
                ))}
              </div>
            </a>
            <div className="flex items-center gap-1.5 text-xs text-success">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="font-medium">94% of claims approved fast</span>
            </div>
          </div>

          {/* Centre Section - Primary Pricing Block (Hero) */}
          <div className="flex flex-col items-center gap-1">
            {/* Monthly Price - Hero */}
            <div className={cn(
              "flex items-baseline gap-2 transition-all duration-300",
              isPulsing && "animate-pulse scale-105"
            )}>
              <span className="text-sm font-medium text-muted-foreground">Total:</span>
              <span className="text-3xl font-bold text-foreground">£{monthlyPrice}/Month</span>
              <span className="text-lg text-muted-foreground">– 0% APR</span>
            </div>
            
            {/* Three aligned numbers */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>12 payments</span>
              <span className="text-foreground font-medium">£{costPerCoverMonth}/cover-month</span>
              {years > 1 && <span>£{costPerYear}/year</span>}
            </div>
            
            {/* Pay in full with savings */}
            <div className="flex items-center gap-2 mt-1">
              {savings > 0 && (
                <span className="text-sm text-muted-foreground line-through">£{wasPrice}</span>
              )}
              <span className="text-sm font-semibold text-foreground">Pay in full £{payInFull}</span>
              {savings > 0 && (
                <span className="text-sm font-medium text-success">(Save £{savings})</span>
              )}
            </div>
          </div>

          {/* Centre-Right Section - Cover Badge */}
          <div className="flex flex-col items-center gap-1.5">
            {paymentPeriod === '24months' && (
              <>
                <span className="text-lg font-bold text-foreground">Year 2 FREE 🎉</span>
                <span className="text-sm text-muted-foreground">{coverText}</span>
              </>
            )}
            {paymentPeriod === '36months' && (
              <>
                <span className="text-lg font-bold text-foreground">Years 2 & 3 FREE 🎉</span>
                <span className="text-sm text-muted-foreground">{coverText}</span>
              </>
            )}
            {paymentPeriod === '12months' && (
              <span className="text-lg font-bold text-foreground">{coverText}</span>
            )}
          </div>

          {/* Right Section - CTA */}
          <div className="flex flex-col items-end gap-2 min-w-[200px]">
            <Button
              onClick={onContinue}
              disabled={isLoading || !isValid}
              className="bg-success hover:bg-success/90 text-success-foreground font-semibold py-6 px-8 rounded-xl text-base gap-2 shadow-lg hover:shadow-xl transition-all"
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
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="w-3.5 h-3.5" />
              <span>Secure checkout – No hidden fees</span>
            </div>
          </div>
        </div>
        
        {/* 94% Claims Bar */}
        <div className="mt-3 pt-3 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            We pay approved repairs directly to the garage.
          </p>
        </div>
      </div>

      {/* Mobile Layout - Collapsible */}
      <div className="md:hidden">
        {/* Expanded Panel */}
        <div 
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isMobileExpanded ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="px-4 pt-4 pb-2 space-y-3">
            {/* Primary: Monthly Price Hero */}
            <div className="text-center">
              <div className={cn(
                "flex items-baseline justify-center gap-2 transition-all duration-300",
                isPulsing && "animate-pulse"
              )}>
                <span className="text-sm font-medium text-muted-foreground">Total:</span>
                <span className="text-2xl font-bold text-foreground">£{monthlyPrice}/Month</span>
                <span className="text-sm text-muted-foreground">– 0% APR</span>
              </div>
              <p className="text-sm text-foreground mt-1">12 payments</p>
            </div>
            
            {/* Three numbers row */}
            <div className="flex items-center justify-center gap-3 text-sm">
              <span className="text-muted-foreground">£{costPerCoverMonth}/cover-mo</span>
              {years > 1 && <span className="text-muted-foreground">£{costPerYear}/year</span>}
            </div>

            {/* Pay in full with savings */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                {savings > 0 && (
                  <span className="text-sm text-muted-foreground line-through">£{wasPrice}</span>
                )}
                <span className="text-sm font-semibold text-foreground">Pay in full £{payInFull}</span>
                {savings > 0 && (
                  <span className="text-sm font-medium text-success">(Save £{savings})</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{coverText}</p>
            </div>

            {/* Year 2/3 FREE Badge */}
            {paymentPeriod === '24months' && (
              <div className="text-center">
                <span className="text-base font-bold text-foreground">Year 2 FREE 🎉</span>
              </div>
            )}
            {paymentPeriod === '36months' && (
              <div className="text-center">
                <span className="inline-block bg-success/10 text-success px-3 py-1 rounded-full text-sm font-medium">
                  Years 2 & 3 FREE 🎉
                </span>
              </div>
            )}
            
            {/* 94% Claims */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-success">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="font-medium">94% of claims approved fast</span>
            </div>
          </div>
        </div>

        {/* Collapsed Bar - Always visible */}
        <div className="px-4 py-3">
          {/* Expand/Collapse Toggle */}
          <button
            onClick={toggleMobileExpand}
            className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground mb-2 py-1"
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
                <span className="text-xs text-muted-foreground">Total:</span>
                <span className="text-xl font-bold text-foreground">£{monthlyPrice}/mo</span>
              </div>
              <p className="text-xs text-foreground">12 payments</p>
            </div>

            {/* Right: CTA Button */}
            <Button
              onClick={onContinue}
              disabled={isLoading || !isValid}
              className="bg-success hover:bg-success/90 text-success-foreground font-semibold py-3 px-5 rounded-lg text-sm gap-1.5 shadow-md flex-shrink-0 min-h-[44px] min-w-[44px]"
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
          <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" />
            <span>Secure checkout – No hidden fees</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickyFooter;