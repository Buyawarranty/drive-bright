import React, { useState } from 'react';
import { Lock, Check, Tag, X, Shield, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TrustpilotSliderWidget from '@/components/TrustpilotSliderWidget';

interface HowToPaySectionProps {
  selectedPayment: 'monthly' | 'full' | null;
  onPaymentChange: (payment: 'monthly' | 'full') => void;
  monthlyPrice: number;
  totalPrice: number;
  fullPrice: number;
  originalPrice: number;
  savings: number;
  isLoading: boolean;
  onPayClick: (paymentOverride?: 'monthly' | 'full') => void;
  // Plan duration for Platinum label
  planDurationMonths?: number;
  // Promo code props
  promoOpen: boolean;
  setPromoOpen: (open: boolean) => void;
  promoCodeInput: string;
  setPromoCodeInput: (code: string) => void;
  promoCodeError: string;
  isValidatingPromoCode: boolean;
  onApplyPromoCode: () => void;
  appliedDiscountCodes: Array<{
    code: string;
    discountAmount: number;
  }>;
  onRemoveDiscountCode: (code: string) => void;
  totalDiscountAmount: number;
  // Hide CTA when embedded checkout is showing
  hidePayButton?: boolean;
  // Hide the inline Trustpilot reviews slider (e.g. when shown elsewhere)
  hideTrustpilot?: boolean;
  // Hide the inline promo-code section (e.g. when rendered elsewhere on the page)
  hidePromoCode?: boolean;
}

const HowToPaySection: React.FC<HowToPaySectionProps> = ({
  selectedPayment,
  onPaymentChange,
  monthlyPrice,
  totalPrice,
  fullPrice,
  originalPrice,
  savings,
  isLoading,
  onPayClick,
  planDurationMonths = 12,
  promoOpen,
  setPromoOpen,
  promoCodeInput,
  setPromoCodeInput,
  promoCodeError,
  isValidatingPromoCode,
  onApplyPromoCode,
  appliedDiscountCodes,
  onRemoveDiscountCode,
  totalDiscountAmount,
  hidePayButton = false,
  hideTrustpilot = false,
  hidePromoCode = false,
}) => {
  // Calculate plan duration in years
  const planYears = Math.round(planDurationMonths / 12);
  // Per-day pricing - MUST derive from monthlyPrice * 12 (actual paid amount) divided by total cover days
  const totalCoverDays = Math.round((planDurationMonths / 12) * 365);
  const monthlyPaidTotal = monthlyPrice * 12;
  const monthlyPencePerDay = monthlyPaidTotal > 0 && totalCoverDays > 0 ? Math.round((monthlyPaidTotal * 100) / totalCoverDays) : 0;
  const fullPencePerDay = fullPrice > 0 && totalCoverDays > 0 ? Math.round((fullPrice * 100) / totalCoverDays) : 0;

  const handleCardSelect = (payment: 'monthly' | 'full') => {
    onPaymentChange(payment);
  };

  const handlePayInside = (payment: 'monthly' | 'full', e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedPayment !== payment) {
      onPaymentChange(payment);
    }
    // Pass explicit payment method to avoid stale-closure race conditions
    // (otherwise Stripe button could route to Bumper before state updates)
    onPayClick(payment);
  };

  return (
    <section className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-7">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-[#1a1a1a]">Choose how you want to pay</h2>
        <p className="text-sm text-gray-500 mt-1">Select the option that works best for you.</p>
      </div>

      {/* Payment Cards - Vertical on mobile, horizontal (side-by-side) on desktop */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 sm:items-stretch">
        {/* Pay in Full Card — RECOMMENDED */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleCardSelect('full')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardSelect('full'); } }}
          className={`w-full sm:flex-1 sm:flex sm:flex-col text-left rounded-2xl p-5 sm:p-6 border-2 transition-all cursor-pointer ${
            selectedPayment === 'full'
              ? 'bg-[#F4FBF6] border-[#0BA360] shadow-[0_4px_20px_-8px_rgba(11,163,96,0.4)]'
              : 'bg-white border-[#0BA360]/40 hover:border-[#0BA360] hover:bg-[#F4FBF6]/50'
          }`}
        >
          {/* Title row with radio */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Radio indicator */}
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedPayment === 'full' ? 'border-[#0BA360]' : 'border-gray-400'
                }`}
              >
                {selectedPayment === 'full' && <span className="w-2.5 h-2.5 rounded-full bg-[#0BA360]" />}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#1a1a1a]">Pay in full</h3>
              <span className="bg-[#0BA360] text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                Recommended
              </span>
            </div>
          </div>

          {/* Price + benefits row */}
          <div className="mt-4 flex flex-col gap-4">
            <div className="pl-7">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#0BA360] leading-none tracking-tight">
                  £{fullPrice}
                </span>
                <span className="text-sm text-[#1a1a1a] font-medium">today</span>
              </div>
              <p className="text-sm text-[#0BA360] font-semibold mt-1">
                Save £{Math.max(monthlyPaidTotal - fullPrice, Math.round(fullPrice * 0.1))} vs monthly payments
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-1.5 pl-7">
              <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" strokeWidth={3} />
                <span>10% cheaper than spreading the cost</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" strokeWidth={3} />
                <span>No ongoing payments</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" strokeWidth={3} />
                <span>Best value option</span>
              </div>
            </div>
          </div>

          {/* Per-card CTA */}
          {!hidePayButton && (
            <div className="mt-5 sm:mt-auto sm:pt-5">
              <Button
                type="button"
                onClick={(e) => handlePayInside('full', e)}
                disabled={isLoading}
                className="w-full py-5 text-sm sm:text-base font-bold rounded-xl bg-[#0BA360] hover:bg-[#099355] text-white animate-breathing"
              >
                {isLoading && selectedPayment === 'full' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <span>Pay £{fullPrice} today</span>
                )}
              </Button>
            </div>
          )}

        </div>

        {/* Monthly / Spread the cost Card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleCardSelect('monthly')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardSelect('monthly'); } }}
          className={`w-full sm:flex-1 sm:flex sm:flex-col text-left rounded-2xl p-5 sm:p-6 border-2 transition-all cursor-pointer ${
            selectedPayment === 'monthly'
              ? 'bg-primary/5 border-primary shadow-sm'
              : 'bg-card border-border hover:border-primary/60 hover:bg-primary/5'
          }`}
        >
          {/* Title row with radio */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 flex-wrap">
              {/* Radio indicator */}
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedPayment === 'monthly' ? 'border-primary' : 'border-muted-foreground'
                }`}
              >
                {selectedPayment === 'monthly' && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#1a1a1a]">Spread the cost</h3>
            </div>
            <span className="flex-shrink-0 bg-primary text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide">0% APR</span>
          </div>

          {/* Price + benefits row */}
          <div className="mt-4 flex flex-col gap-5 sm:pl-10">
            <div>
              <div className="mb-4 flex items-center gap-2 font-bold text-primary">
                <CalendarDays className="h-5 w-5 flex-shrink-0" strokeWidth={2.5} />
                <span className="text-base sm:text-lg">12 monthly instalments</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl sm:text-6xl font-extrabold text-primary leading-none">
                  £{monthlyPrice}
                </span>
                <span className="text-xl text-foreground font-bold">today</span>
              </div>
              <p className="mt-2 text-base sm:text-lg text-primary font-bold">
                Your first of 12 monthly instalments
              </p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-base sm:text-lg text-foreground">
                Then 11 monthly instalments of £{monthlyPrice}
              </p>
              <div className="mt-4 grid grid-cols-2 rounded-lg border border-border bg-secondary/70 px-4 py-3">
                <div className="border-r border-border pr-3">
                  <span className="block text-xs font-bold uppercase text-muted-foreground">Today</span>
                  <strong className="mt-1 block text-xl text-foreground">£{monthlyPrice}</strong>
                  <span className="text-sm text-muted-foreground">First instalment</span>
                </div>
                <div className="pl-4">
                  <span className="block text-xs font-bold uppercase text-muted-foreground">After today</span>
                  <strong className="mt-1 block text-xl text-foreground">11 × £{monthlyPrice}</strong>
                  <span className="text-sm text-muted-foreground">Monthly instalments</span>
                </div>
              </div>
              <p className="mt-4 text-lg font-bold text-primary">£{monthlyPaidTotal} total payable · 0% APR</p>
            </div>

            {/* Benefits */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-base text-foreground">
                <Check className="w-5 h-5 text-primary flex-shrink-0" strokeWidth={3} />
                <span>No large upfront payment</span>
              </div>
              <div className="flex items-center gap-3 text-base text-foreground">
                <Check className="w-5 h-5 text-primary flex-shrink-0" strokeWidth={3} />
                <span>Soft eligibility check only</span>
              </div>
              <div className="flex items-center gap-3 text-base text-foreground">
                <Check className="w-5 h-5 text-primary flex-shrink-0" strokeWidth={3} />
                <span>No impact on your credit score</span>
              </div>
            </div>
          </div>

          {/* Per-card CTA */}
          {!hidePayButton && (
            <div className="mt-5 sm:mt-auto sm:pt-5">
              <Button
                type="button"
                onClick={(e) => handlePayInside('monthly', e)}
                disabled={isLoading}
                className="w-full py-5 text-sm sm:text-base font-bold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground animate-breathing"
              >
                {isLoading && selectedPayment === 'monthly' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <span>Continue with monthly payments</span>
                )}
              </Button>
            </div>
          )}

        </div>
      </div>

      {/* Trust strip footer (Secure · UK support) — two side-by-side on mobile and desktop */}
      <div className="mt-5 grid grid-cols-2 gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2 text-[#1a1a1a]">
          <Lock className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <div>
            <div className="font-semibold">Secure checkout</div>
            <div className="text-gray-500 text-xs">256-bit SSL encrypted</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[#1a1a1a]">
          <svg className="w-4 h-4 text-[#FF6B00] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 0 0-1.02.24l-2.2 2.2a15.05 15.05 0 0 1-6.59-6.59l2.2-2.2a1 1 0 0 0 .25-1.02A11.36 11.36 0 0 1 8.5 4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1c0 9.39 7.61 17 17 17a1 1 0 0 0 1-1v-3.5a1 1 0 0 0-1-1z"/></svg>
          <div>
            <div className="font-semibold">UK support</div>
            <a href="tel:03302295040" className="text-[#FF6B00] text-xs font-semibold hover:underline">0330 229 5040</a>
          </div>

        </div>
      </div>

      {/* Promo Code Section — hidden when promo is rendered elsewhere on the page */}
      {!hidePromoCode && (
        <>
          <div className="mt-6 bg-[#FFFBF0] border border-[#FFD980] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-[#FF8C00]" />
              <span className="text-sm font-bold text-[#1a1a1a]">Have a promo code?</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter code"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                className="flex-1 h-11 text-base uppercase bg-white"
                disabled={isValidatingPromoCode}
              />
              <Button
                type="button"
                onClick={onApplyPromoCode}
                disabled={!promoCodeInput.trim() || isValidatingPromoCode}
                className="h-11 px-5 bg-[#FF8C00] hover:bg-[#e57e00] text-white font-semibold"
              >
                {isValidatingPromoCode ? 'Checking...' : 'Apply'}
              </Button>
            </div>
            {promoCodeError && (
              <p className="text-destructive text-sm mt-2">{promoCodeError}</p>
            )}
          </div>

          {/* Discount Applied Row */}
          {appliedDiscountCodes.length > 0 && totalDiscountAmount > 0 && (
            <div className="mt-4 border border-[#0BA360] bg-green-50 rounded-lg px-4 py-3">
              {appliedDiscountCodes.map((discount) => (
                <div key={discount.code} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Tag className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                    <span className="font-semibold text-[#1a1a1a] truncate">{discount.code}</span>
                    <span className="text-sm text-gray-600 flex-shrink-0">applied</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[#0BA360] font-bold text-base whitespace-nowrap">
                      -£{totalDiscountAmount.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveDiscountCode(discount.code)}
                      className="p-1 hover:bg-red-100 rounded-full transition-colors"
                      title="Remove promo code"
                    >
                      <X className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Secure Checkout Text */}
      {!hidePayButton && (
        <div className="flex items-center justify-center gap-2 mt-5 text-sm text-gray-600">
          <Lock className="w-4 h-4 text-gray-400" />
          <span>Secure checkout processing</span>
        </div>
      )}

      {/* Trustpilot Slider Widget */}
      {!hideTrustpilot && <TrustpilotSliderWidget className="mt-4" />}
    </section>
  );
};

export default HowToPaySection;
