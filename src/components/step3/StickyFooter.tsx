import React, { useEffect, useState, useCallback } from 'react';
import { ArrowRight, Star, Lock, ChevronUp, ChevronDown } from 'lucide-react';
import trustpilotStars from '@/assets/trustpilot-5-stars.png';
import { Button } from '@/components/ui/button';
import { PaymentPeriod } from '@/lib/pricingMatrix';
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
  
  // Calculate average cost per month of cover
  const coverMonths = paymentPeriod === '12months' ? 12 : paymentPeriod === '24months' ? 24 : 36;
  const averageCostPerMonth = Math.floor(payInFull / coverMonths);
  
  // Calculate Stripe 10% discount savings
  const stripeSavings = Math.floor(payInFull * 0.10);

  const toggleMobileExpand = useCallback(() => {
    setIsMobileExpanded(prev => !prev);
  }, []);

  const coverYears = paymentPeriod === '12months' ? 'One' : paymentPeriod === '24months' ? 'Two' : 'Three';
  const coverText = `${coverYears}-Year Cover`;

  // Pence per day calc
  const pencePerDay = Math.round((monthlyPrice * 12) / 365);
  
  // Savings vs monthly (pay in full discount)
  const savingsVsMonthly = stripeSavings;
  
  const planLabelMap: Record<string, string> = {
    '12months': '1-Year Platinum Cover',
    '24months': '2-Year Platinum Cover',
    '36months': '3-Year Platinum Cover',
  };
  const planLabel = planLabelMap[paymentPeriod] || '2-Year Platinum Cover';

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] border-t border-gray-200 z-50">
      {/* Desktop Layout */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-stretch justify-between gap-6 divide-x divide-gray-200">

          {/* 1. Trustpilot */}
          <a
            href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center gap-1 hover:opacity-80 transition-opacity flex-shrink-0 px-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">Excellent</span>
              <img src={trustpilotStars} alt="Trustpilot 5 stars" className="h-4" />
            </div>
            <span className="text-xs text-gray-600">Easy Claims</span>
          </a>

          {/* 2. Total / Pay in full */}
          <div className={cn(
            "flex flex-col items-center justify-center text-center px-4 flex-1 transition-all duration-300",
            isPulsing && "animate-pulse"
          )}>
            <div className="flex items-baseline gap-1.5 flex-wrap justify-center">
              <span className="text-xl font-bold text-gray-900">Total: £{monthlyPrice}/Month</span>
              <span className="text-sm text-gray-600">– 0% APR</span>
            </div>
            <span className="text-xs text-gray-600">Only 12 payments</span>
            <div className="text-sm font-semibold text-green-600 mt-0.5">Pay in full £{payInFull - stripeSavings}</div>
            {stripeSavings > 0 && (
              <span className="text-xs text-gray-600">– You save £{stripeSavings} today</span>
            )}
          </div>

          {/* 3. Cover summary */}
          <div className="flex flex-col items-center justify-center text-center px-4 flex-shrink-0">
            <span className="text-base font-bold text-gray-900">{coverText}</span>
            {paymentPeriod === '24months' && (
              <span className="text-xs text-gray-600">No payments in year 2</span>
            )}
            {paymentPeriod === '36months' && (
              <span className="text-xs text-gray-600">No payments in years 2 & 3</span>
            )}
          </div>

          {/* 4. CTA */}
          <div className="flex flex-col items-center justify-center gap-1.5 flex-shrink-0 pl-6">
            <Button
              onClick={onContinue}
              disabled={isLoading || !isValid}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-6 px-8 rounded-xl text-base gap-2 shadow-lg hover:shadow-xl transition-all"
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
              <span>Secure checkout – 14 days to cancel</span>
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
                <span className="text-sm font-medium text-gray-600">Total:</span>
                <span className="text-2xl font-bold text-gray-900">£{monthlyPrice} / month</span>
                <span className="text-sm text-gray-600">– 0% APR</span>
              </div>
              {paymentPeriod === '12months' && (
                <p className="text-sm text-gray-600 mt-1">Only 12 payments • Total <span className="font-bold text-gray-900">£{payInFull}</span></p>
              )}
              {paymentPeriod === '24months' && (
                <p className="text-sm text-gray-600 mt-1">Approx. £{Math.floor(monthlyPrice / 2)}/month over 2 years • Total <span className="font-bold text-gray-900">£{payInFull}</span></p>
              )}
              {paymentPeriod === '36months' && (
                <p className="text-sm text-gray-600 mt-1">Approx. £{Math.floor(monthlyPrice / 3)}/month over 3 years • Total <span className="font-bold text-gray-900">£{payInFull}</span></p>
              )}
            </div>

            {/* Pay in full with 10% discount savings */}
            <div className="text-center">
              <p className="text-base font-bold text-gray-900">Pay in Full: £{payInFull - stripeSavings}</p>
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-sm text-red-500 line-through">£{payInFull}</span>
                <span className="text-sm font-bold text-green-600">Save £{stripeSavings}</span>
                <span className="text-sm text-gray-500">(10% off)</span>
              </div>
            </div>

            {/* Year 2 FREE Badge */}
            {paymentPeriod === '24months' && (
              <div className="text-center">
                <span className="text-base font-bold text-gray-900">Year 2 FREE 🎉</span>
              </div>
            )}
            {paymentPeriod === '36months' && (
              <div className="text-center">
                <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                  Best Value
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

          {/* Main row: Trustpilot + Price + CTA */}
          <div className="flex items-center justify-between gap-3">
            {/* Left: Trustpilot + Total price */}
            <div className={cn("flex-shrink-0 transition-all duration-300", isPulsing && "animate-pulse")}>
              <a
                href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 mb-1 hover:opacity-80 transition-opacity"
              >
                <span className="text-[11px] font-bold text-gray-900">Excellent</span>
                <img src={trustpilotStars} alt="Trustpilot 5 stars" className="h-3" />
              </a>
              <div className="text-base font-bold text-gray-900">Total: £{monthlyPrice}/Month</div>
              <p className="text-[11px] text-gray-600">12 payments · 0% APR</p>
              {stripeSavings > 0 && (
                <p className="text-[11px] font-semibold text-green-600">
                  Pay in full £{payInFull - stripeSavings} · Save £{stripeSavings}
                </p>
              )}
              <p className="text-[11px] text-gray-700 font-medium mt-0.5">
                {coverText}
                {paymentPeriod === '24months' && ' · No payments yr 2'}
                {paymentPeriod === '36months' && ' · No payments yrs 2 & 3'}
              </p>
            </div>

            {/* Right: CTA Button */}
            <Button
              onClick={onContinue}
              disabled={isLoading || !isValid}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-5 rounded-lg text-sm gap-1.5 shadow-md flex-shrink-0"
            >
              {isLoading ? (
                'Loading...'
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </>
              )}
            </Button>
          </div>

          {/* Security reassurance */}
          <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-gray-500">
            <Lock className="w-3 h-3" />
            <span>Secure checkout – 14 days to cancel</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickyFooter;
