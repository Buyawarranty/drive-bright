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
      {/* Desktop Layout - One row */}
      <div className="hidden md:block max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between gap-5">

          {/* 1. Trustpilot */}
          <a
            href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-gray-900">Excellent</span>
              <img src={trustpilotStars} alt="Trustpilot 5 stars" className="h-3.5 my-0.5" />
              <span className="text-[11px] text-gray-600">4.8 out of 5</span>
            </div>
          </a>

          {/* 2. Your cover */}
          <div className="flex flex-col leading-tight flex-shrink-0">
            <span className="text-[11px] font-bold text-[#FF6B00] tracking-wider uppercase">Your cover</span>
            <span className="text-base font-bold text-gray-900 mt-0.5">{planLabel}</span>
          </div>

          {/* 3. Monthly price */}
          <div className={cn(
            "flex flex-col leading-tight flex-shrink-0 transition-all duration-300",
            isPulsing && "animate-pulse"
          )}>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-gray-900">£{monthlyPrice}</span>
              <span className="text-sm text-gray-600">/month</span>
            </div>
            <span className="text-[11px] text-gray-600 mt-0.5">
              Equal to {pencePerDay >= 100 ? `£${(pencePerDay / 100).toFixed(2)}` : `${pencePerDay}p`}/day
            </span>
            <span className="text-[11px] text-gray-500">Paid over 12 months</span>
          </div>

          {/* 4. Pay in full savings pill */}
          {stripeSavings > 0 && (
            <div className="flex flex-col leading-tight bg-[#E8F7EF] border border-[#0BA360]/20 rounded-xl px-4 py-2.5 flex-shrink-0">
              <span className="text-sm font-bold text-gray-900">Pay in full £{payInFull - stripeSavings}</span>
              <span className="text-[12px] font-semibold text-[#0BA360]">Save £{stripeSavings} vs monthly</span>
            </div>
          )}

          {/* 5. CTA */}
          <div className="flex flex-col items-center justify-center gap-1 flex-1 min-w-[260px] max-w-[360px]">
            <Button
              onClick={onContinue}
              disabled={isLoading || !isValid}
              className="w-full bg-[#FF6B00] hover:bg-[#e55f00] text-white font-bold py-6 px-6 rounded-xl text-base gap-2 shadow-lg animate-breathing"
            >
              {isLoading ? (
                'Loading...'
              ) : (
                <>
                  Continue to checkout
                  <ArrowRight className="w-5 h-5" strokeWidth={3} />
                </>
              )}
            </Button>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <Lock className="w-3 h-3" />
              <span>Secure checkout</span>
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
