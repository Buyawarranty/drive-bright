import React, { useState } from 'react';
import { Lock, Check, Tag, ChevronDown, ChevronUp, X, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import bumperLogo from '@/assets/bumper-logo-transparent.png';
import stripeLogo from '@/assets/stripe-logo.png';
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
  onPayClick: () => void;
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
}

const InlineGuarantee = ({ accepted, setAccepted }: { accepted: boolean; setAccepted: (v: boolean) => void }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-5">
      {/* Guarantee banner */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between bg-[#F0FDF4] border border-[#C8F3D2] rounded-xl px-4 py-3 text-left transition-all hover:bg-[#E8FAF0]"
        type="button"
      >
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-[#0BA360] flex-shrink-0" />
          <span className="text-sm font-bold text-[#1a1a1a]">14-day money-back guarantee</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <>
              <span className="hidden sm:inline">Full refund if no claim is made.</span>
              <span className="text-[#0BA360] font-medium">See details</span>
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5 animate-fade-in">
          <div className="flex items-center gap-2.5 mb-3">
            <Shield className="w-5 h-5 text-[#0BA360] flex-shrink-0" />
            <h4 className="text-sm font-bold text-[#1a1a1a]">Your 14-day peace of mind guarantee</h4>
          </div>
          <p className="text-sm text-gray-600 mb-3">Enjoy full flexibility when you start your cover:</p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#1a1a1a]">Cancel within 14 days for a <span className="font-semibold">full refund</span> if no claim has been made</p>
            </div>
            <div className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#1a1a1a]">If a claim is made within 14 days, a small <span className="font-semibold">£40 handling fee</span> plus any assessment costs</p>
            </div>
            <div className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#1a1a1a]">After 14 days, refunds are calculated <span className="font-semibold">pro-rata</span> based on time remaining, less any claims made</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-3">Designed to keep things fair for everyone.</p>
        </div>
      )}

      {/* Checkbox */}
      <label className={`flex items-center gap-3 mt-3 cursor-pointer select-none rounded-lg p-2 -mx-2 transition-colors ${!accepted ? 'bg-red-50' : ''}`}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="w-5 h-5 rounded border-gray-300 text-[#0BA360] focus:ring-[#0BA360] accent-[#0BA360] cursor-pointer flex-shrink-0"
        />
        <span className={`text-sm leading-5 ${!accepted ? 'text-red-600 font-medium' : 'text-[#1a1a1a]'}`}>
          I understand the 14 day money back guarantee
        </span>
      </label>
      {!accepted && (
        <p className="text-xs text-red-500 mt-1 ml-10 animate-fade-in">Please accept the cancellation terms to continue</p>
      )}
    </div>
  );
};

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
}) => {
  const [termsAccepted, setTermsAccepted] = useState(true);
  // Calculate plan duration in years
  const planYears = Math.round(planDurationMonths / 12);
  // Per-day pricing - MUST derive from monthlyPrice * 12 (actual paid amount) divided by total cover days
  // This keeps the daily price identical to Step 3 regardless of cover length
  const totalCoverDays = Math.round((planDurationMonths / 12) * 365);
  const monthlyPaidTotal = monthlyPrice * 12;
  const monthlyPencePerDay = monthlyPaidTotal > 0 && totalCoverDays > 0 ? Math.round((monthlyPaidTotal * 100) / totalCoverDays) : 0;
  const fullPencePerDay = fullPrice > 0 && totalCoverDays > 0 ? Math.round((fullPrice * 100) / totalCoverDays) : 0;
  return (
    <section className="bg-white rounded-xl border border-[#E5E5E5] p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Lock className="w-5 h-5 text-[#1a1a1a]" />
        <h2 className="text-lg sm:text-xl font-bold text-[#1a1a1a]">How To Pay</h2>
      </div>

      {/* Payment Cards - Side by Side. Pay-in-full leads (recommended). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Pay in Full Card — RECOMMENDED */}
        <div className="relative">
          {/* Recommended Badge */}
          <div className="absolute -top-3 left-4 z-10">
            <span className="bg-[#0BA360] text-white text-xs font-bold px-2.5 py-1 rounded-md whitespace-nowrap shadow-sm">
              ★ RECOMMENDED · SAVE £{savings}
            </span>
          </div>

          <button
            onClick={() => onPaymentChange('full')}
            className={`w-full h-full text-left rounded-xl p-4 sm:p-5 border-2 transition-all ${
              selectedPayment === 'full'
                ? 'border-[#0BA360] bg-white shadow-[0_4px_20px_-8px_rgba(11,163,96,0.4)]'
                : 'border-[#0BA360]/40 bg-white hover:border-[#0BA360]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className="text-lg sm:text-xl font-bold text-[#1a1a1a]">Pay in full · save 10%</h3>
                <div className="flex items-center gap-2 mt-1 mb-2">
                  <Shield className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                  <span className="text-sm font-semibold text-gray-600">
                    Platinum {planYears}-Year Cover
                  </span>
                </div>

                {/* Hero: total price */}
                <div className="mt-3 bg-[#F0FDF4] border border-[#C8F3D2] rounded-lg p-4">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-4xl sm:text-5xl font-extrabold text-[#1a1a1a] leading-none tracking-tight">
                      £{fullPrice}
                    </span>
                    {savings > 0 && (
                      <span className="text-base text-gray-400 line-through">£{originalPrice}</span>
                    )}
                  </div>
                  <p className="text-sm text-[#0BA360] font-semibold mt-2">
                    Equal to just {fullPencePerDay >= 100 ? `£${(fullPencePerDay / 100).toFixed(2)}` : `${fullPencePerDay}p`}/day over term
                  </p>
                  {savings > 0 && (
                    <p className="text-sm text-[#0BA360] font-bold mt-1">
                      Save £{savings} instantly · 10% off
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">One payment today · covers {planDurationMonths} months</p>
                </div>

                {/* Benefits */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                    <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                    <span>Instant 10% saving</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                    <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                    <span>No ongoing payments to manage</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                    <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                    <span>No credit check required</span>
                  </div>
                </div>

                {/* Trust signal + Stripe logo */}
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2">
                    <Lock className="w-3.5 h-3.5 text-gray-500" />
                    <span>Secure card payment · Apple Pay & Google Pay</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">Powered by</span>
                    <img src={stripeLogo} alt="Stripe" className="h-4 object-contain" />
                  </div>
                </div>
              </div>

              {/* Radio/Check indicator */}
              <div
                className={`w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedPayment === 'full'
                    ? 'bg-[#0BA360] border-[#0BA360]'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {selectedPayment === 'full' && (
                  <Check className="w-4 h-4 text-white" />
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Monthly Card */}
        <div className="relative">
          {/* 0% APR Badge */}
          <div className="absolute -top-3 left-4 z-10">
            <span className="bg-[#FF6B00] text-white text-xs font-bold px-2.5 py-1 rounded-md whitespace-nowrap">
              0% APR
            </span>
          </div>

          <button
            onClick={() => onPaymentChange('monthly')}
            className={`w-full h-full text-left rounded-xl p-4 sm:p-5 border-2 transition-all ${
              selectedPayment === 'monthly'
                ? 'border-[#FF6B00] bg-white'
                : 'border-[#E5E5E5] bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className="text-lg sm:text-xl font-bold text-[#1a1a1a]">Spread the cost</h3>
                <div className="flex items-center gap-2 mt-1 mb-2">
                  <Shield className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                  <span className="text-sm font-semibold text-gray-600">
                    Platinum {planYears}-Year Cover
                  </span>
                </div>

                {/* Hero: monthly price (matches Step 3) */}
                <div className="mt-3 bg-[#FFF5EB] border border-[#FFD7B5] rounded-lg p-4">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl sm:text-5xl font-extrabold text-[#1a1a1a] leading-none tracking-tight">
                        £{monthlyPrice}
                      </span>
                      <span className="text-lg sm:text-xl font-medium text-[#1a1a1a] leading-none">/mo</span>
                    </div>
                    <span className="text-sm text-gray-600 font-medium">
                      · £{monthlyPrice * 12} total
                    </span>
                  </div>
                  <p className="text-sm text-[#FF6B00] font-semibold mt-2">
                    Equal to just {monthlyPencePerDay >= 100 ? `£${(monthlyPencePerDay / 100).toFixed(2)}` : `${monthlyPencePerDay}p`}/day over term
                  </p>
                  <p className="text-sm text-[#1a1a1a] font-semibold mt-1">
                    £{monthlyPrice} today, then 11 monthly payments
                  </p>
                  <p className="text-xs text-gray-500 mt-1">12 payments total · covers {planDurationMonths} months</p>
                </div>

                {/* Benefits */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                    <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                    <span>0% interest, ever</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                    <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                    <span>Soft credit check only — no impact on score</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                    <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                    <span>Cancel anytime within 14 days</span>
                  </div>
                </div>

                {/* Trust signal + Bumper logo */}
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2">
                    <Lock className="w-3.5 h-3.5 text-gray-500" />
                    <span>FCA-regulated finance partner</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">Powered by</span>
                    <img src={bumperLogo} alt="Bumper" className="h-4 object-contain" />
                  </div>
                </div>
              </div>

              {/* Radio/Check indicator */}
              <div
                className={`w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedPayment === 'monthly'
                    ? 'bg-[#FF6B00] border-[#FF6B00]'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {selectedPayment === 'monthly' && (
                  <Check className="w-4 h-4 text-white" />
                )}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Promo Code Section — always visible */}
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
                {/* Display the total calculated discount amount */}
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

      {/* 14-day money-back guarantee */}
      {!hidePayButton && <InlineGuarantee accepted={termsAccepted} setAccepted={setTermsAccepted} />}

      {/* Pay Button - Hidden when embedded checkout is showing */}
      {!hidePayButton && (
        <div className="mt-5">
          <Button
            onClick={onPayClick}
            disabled={isLoading || !selectedPayment || !termsAccepted}
            className={`w-full py-6 text-lg font-bold rounded-xl animate-breathing hover:opacity-90 ${
              !selectedPayment 
                ? 'bg-gray-400' 
                : selectedPayment === 'full'
                ? 'bg-[#0BA360] hover:bg-[#099355]'
                : 'bg-[#FF6B00] hover:bg-[#e56000]'
            }`}
            style={{ color: '#FFFFFF' }}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                {selectedPayment 
                  ? 'Activate my cover'
                  : 'Select payment option'}
              </span>
            )}
          </Button>
        </div>
      )}

      {/* Secure Checkout Text - Only show when button is visible */}
      {!hidePayButton && (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-600">
          <Lock className="w-4 h-4 text-gray-400" />
          <span>Secure checkout processing</span>
        </div>
      )}

      {/* Trustpilot Slider Widget */}
      <TrustpilotSliderWidget className="mt-4" />

      {/* Divider */}
      <div className="h-px bg-border mt-6 mb-5" />

      {/* Trust Footer */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Lock className="w-4 h-4" />
          <span>256-bit encryption</span>
        </div>
        <a 
          href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-foreground transition-colors"
        >
          <img 
            src="/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png" 
            alt="Trustpilot" 
            className="h-5 object-contain"
          />
          <span className="text-[#1a1a1a] font-semibold">Rated Excellent</span>
        </a>
      </div>
    </section>
  );
};

export default HowToPaySection;
