import React from 'react';
import { ArrowRight, Star, Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMarketingSavings, PaymentPeriod } from '@/lib/pricingMatrix';

interface StickyFooterProps {
  monthlyPrice: number;
  totalPrice: number;
  freeYearText?: string;
  onContinue: () => void;
  isLoading: boolean;
  isValid: boolean;
  paymentPeriod?: string;
}

const StickyFooter: React.FC<StickyFooterProps> = ({
  monthlyPrice,
  totalPrice,
  onContinue,
  isLoading,
  isValid,
  paymentPeriod = '24months'
}) => {
  // Get marketing savings from centralized pricing matrix
  const savings = getMarketingSavings(paymentPeriod as PaymentPeriod);
  // "Was" price = actual price + marketing savings (display gimmick only)
  const wasPrice = totalPrice + savings;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] border-t border-gray-200 z-50">
      {/* Desktop Layout */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          {/* Left Section - Trust Signals */}
          <div className="flex flex-col items-start gap-1 min-w-[160px]">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-gray-700">Trustpilot</span>
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#00b67a] text-[#00b67a]" />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Shield className="w-3.5 h-3.5" />
              <span>14 days to cancel</span>
            </div>
          </div>

          {/* Middle Section - Pricing */}
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">£{monthlyPrice}/Month</span>
              <span className="text-sm text-gray-500">– 0% APR</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">Only 12 payments</span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-500">Pay in full:</span>
              {savings > 0 && (
                <span className="line-through text-red-500">£{wasPrice}</span>
              )}
              <span className="font-bold text-green-600">£{totalPrice}</span>
              {savings > 0 && (
                <span className="text-gray-600">(Save £{savings})</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {paymentPeriod === '24months' && (
                <>
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                    Year 2 FREE 🎉
                  </span>
                  <span className="text-gray-300">|</span>
                </>
              )}
              <span className="font-medium text-gray-700">
                {paymentPeriod === '12months' ? '1-Year' : paymentPeriod === '24months' ? '2-Year' : '3-Year'} Cover
              </span>
            </div>
          </div>

          {/* Right Section - CTA */}
          <div className="flex flex-col items-end gap-1.5 min-w-[200px]">
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
              <span>Secure checkout – No hidden fees</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden px-4 py-3">
        {/* Top Row - Trust & Pricing Summary */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
          {/* Trust Signal */}
          <div className="flex items-center gap-1">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-[#00b67a] text-[#00b67a]" />
              ))}
            </div>
            <span className="text-xs text-gray-500 ml-1">14 days to cancel</span>
          </div>
          {/* Year 2 Free Badge */}
          {paymentPeriod === '24months' && (
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
              Year 2 FREE 🎉
            </span>
          )}
        </div>

        {/* Middle Row - Pricing */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-gray-900">£{monthlyPrice}/mo</span>
              <span className="text-xs text-gray-500">0% APR</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs mt-0.5">
              <span className="text-gray-500">or</span>
              {savings > 0 && (
                <span className="line-through text-red-500">£{wasPrice}</span>
              )}
              <span className="font-bold text-green-600">£{totalPrice}</span>
              {savings > 0 && (
                <span className="text-gray-500">(Save £{savings})</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-medium text-gray-700">
              {paymentPeriod === '12months' ? '1-Year' : paymentPeriod === '24months' ? '2-Year' : '3-Year'} Cover
            </span>
            <div className="text-xs text-gray-500">12 payments</div>
          </div>
        </div>

        {/* Bottom Row - CTA */}
        <Button
          onClick={onContinue}
          disabled={isLoading || !isValid}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-5 rounded-xl text-base gap-2 shadow-lg"
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
        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mt-2">
          <Lock className="w-3 h-3" />
          <span>Secure checkout – No hidden fees</span>
        </div>
      </div>
    </div>
  );
};

export default StickyFooter;
