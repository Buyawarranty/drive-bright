import React, { useEffect, useState } from 'react';
import { ArrowRight, Star, Shield, Lock, Package } from 'lucide-react';
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
  // Track price changes for pulse animation
  const [isPulsing, setIsPulsing] = useState(false);
  const [prevPrice, setPrevPrice] = useState(monthlyPrice);
  
  useEffect(() => {
    if (monthlyPrice !== prevPrice) {
      setIsPulsing(true);
      setPrevPrice(monthlyPrice);
      const timer = setTimeout(() => setIsPulsing(false), 600);
      return () => clearTimeout(timer);
    }
  }, [monthlyPrice, prevPrice]);
  
  // Pay in full = monthly × 12 (what user actually pays over 12 months)
  const payInFull = monthlyPrice * 12;
  
  // Get marketing savings from centralized pricing matrix
  const savings = getMarketingSavings(paymentPeriod as PaymentPeriod);
  // "Was" price = pay in full + marketing savings (display gimmick only)
  const wasPrice = payInFull + savings;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] border-t border-gray-200 z-50">
      {/* Desktop Layout */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          {/* Left Section - Trustpilot */}
          <a 
            href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex flex-col items-start gap-1 min-w-[160px] hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-gray-800">Rated Excellent</span>
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#00b67a] text-[#00b67a]" />
                ))}
              </div>
            </div>
            <span className="text-xs text-gray-500">Trusted by UK drivers</span>
          </a>

          {/* Centre Section - Pricing */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            {/* Top: Monthly Price + APR */}
            <div className="flex flex-col items-center">
              <div className={cn(
                "flex items-baseline gap-2 transition-all duration-300",
                isPulsing && "animate-pulse scale-105"
              )}>
                <span className="text-lg font-medium text-gray-700">
                  {hasAddOnsSelected ? 'Your monthly price incl. add-ons:' : 'Your monthly price:'}
                </span>
                <span className="text-2xl font-bold text-gray-900">£{monthlyPrice}/month</span>
                <span className="text-sm font-medium text-green-600">· 0% APR</span>
              </div>
              {/* Middle: 12 payments */}
              <span className="text-sm text-gray-500">Just 12 monthly payments, nothing more</span>
            </div>
            
            {/* Bottom: Savings */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Or pay upfront:</span>
              {savings > 0 && (
                <span className="line-through text-gray-400">Was £{wasPrice}</span>
              )}
              <span className="font-bold text-gray-900">Now £{payInFull}</span>
              {savings > 0 && (
                <span className="text-green-600 font-medium">— You save £{savings}</span>
              )}
            </div>
            
            {/* Cover Duration + Benefits */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-medium text-gray-700 text-sm">
                {paymentPeriod === '12months' ? '1-Year' : paymentPeriod === '24months' ? '2-Year' : '3-Year'} Cover included
              </span>
              <span className="text-xs text-gray-500">Easy claims, Fast payouts</span>
              {paymentPeriod === '24months' && (
                <span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-medium mt-1">
                  Year 2 FREE
                </span>
              )}
            </div>
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
                  Continue to Checkout
                  <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
                </>
              )}
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Lock className="w-3.5 h-3.5" />
              <span>Secure checkout — You have 14 days to cancel</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden px-5 py-4">
        {/* Plan Title */}
        <div className="text-center mb-3">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-lg font-bold text-gray-900">Platinum Plan</h3>
            {hasAddOnsSelected && (
              <span className="bg-success/10 text-success text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                <Package className="w-3 h-3" />
                + Add-ons
              </span>
            )}
          </div>
          <p className={cn(
            "text-base text-gray-700 mt-1 transition-all duration-300",
            isPulsing && "animate-pulse"
          )}>
            <span className="font-semibold">£{monthlyPrice}/month</span>
            <span className="text-gray-500"> for 12 months</span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Or pay <span className="font-semibold text-green-600">£{payInFull}</span> upfront
            {savings > 0 && <span className="text-gray-500"> (Save £{savings})</span>}
          </p>
        </div>

        {/* CTA Button */}
        <Button
          onClick={onContinue}
          disabled={isLoading || !isValid}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-5 rounded-xl text-base gap-2 shadow-lg"
        >
          {isLoading ? (
            'Loading...'
          ) : (
            <>
              Secure Checkout
              <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </>
          )}
        </Button>
        
        {/* Trust Text */}
        <p className="text-center text-xs text-gray-500 mt-3">
          SSL encrypted – Safe & fast
        </p>
      </div>
    </div>
  );
};

export default StickyFooter;
