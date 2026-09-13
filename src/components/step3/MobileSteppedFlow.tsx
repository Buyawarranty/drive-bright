import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Lock, Shield, ShieldCheck, Car, Wrench, Building2, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { CLAIM_LIMIT_TIERS, getBlockedClaimLimits } from '@/lib/claimLimitTiers';
import { getVisibleExcessOptions, getExcessMonthlyDelta, getExcessBracketBasis } from '@/lib/pricingMatrix';
import { getMarketingSavings, type PaymentPeriod } from '@/lib/pricingMatrix';

import trustpilotStars from '@/assets/trustpilot-5-stars.png';
import MobileStickyFooter from '@/components/checkout/MobileStickyFooter';
import { payInFullTotal } from '@/lib/pricing/payInFull';
import { getPaymentPreference, setPaymentPreference } from '@/lib/checkoutPaymentPreference';
import WhatsCoveredAccordion from './WhatsCoveredAccordion';
import WhatsNotCoveredAccordion from './WhatsNotCoveredAccordion';

import HelperCallout from './HelperCallout';
import {
  CLAIM_LIMIT_SUITABILITY,
  LABOUR_RATE_SUITABILITY,
  EXCESS_SUITABILITY,
} from './suitabilityCopy';
import TrustBlocks from './TrustBlocks';
import PolicyTermsAccordion from './PolicyTermsAccordion';
import SeeWhatsIncludedCard from './SeeWhatsIncludedCard';
import PriceBeatBanner from './PriceBeatBanner';
import CheckoutFAQ from './CheckoutFAQ';
import TrustAndInfoAccordion from './TrustAndInfoAccordion';
import EmailQuoteDialog from './EmailQuoteDialog';
import { useAppliedPromos, calcPromoDiscount, clearAppliedPromos, promoPriceFloor } from '@/lib/promoStorage';
import { getNetPayableFloor } from '@/lib/pricing/netFloor';
import { toast } from 'sonner';

type PaymentType = '12months' | '24months' | '36months';

interface MobileSteppedFlowProps {
  vehicleData: {
    regNumber: string;
    make?: string;
    model?: string;
    fuelType?: string;
    year?: string;
    mileage?: string;
  };
  onBack: () => void;
  onChangeVehicle?: () => void;
  selectedClaimLimit: number | null;
  onClaimLimitChange: (v: number) => void;
  selectedLabourRate: number;
  onLabourRateChange: (v: number) => void;
  paymentType: PaymentType | null;
  onPaymentTypeChange: (v: PaymentType) => void;
  voluntaryExcess: number | null;
  onVoluntaryExcessChange: (v: number) => void;
  availableDurations: PaymentType[];
  currentMonthlyPrice: number;
  currentTotalPrice: number;
  calculateMonthlyPrice: (term: string) => number;
  onContinue: () => void;
  isLoading: boolean;
  isFormValid: boolean;
  selectedAddOns?: { [key: string]: boolean };
  onAddOnChange?: (key: string, selected: boolean) => void;
}

// Repair preference (labour rate) options
const REPAIR_OPTIONS: {
  value: number;
  title: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  recommended?: boolean;
  bestValue?: boolean;
}[] = [
  { value: 50, title: 'Local Garage', sub: 'Affordable everyday repairs', icon: Car, bestValue: true },
  { value: 70, title: 'Independent Garages', sub: 'Ideal for your trusted local garage', icon: ShieldCheck, recommended: true },
  { value: 100, title: 'Approved Garage', sub: 'Broader approved network', icon: Building2 },
  { value: 150, title: 'Specialist garages', sub: 'Designed for specialist repairers and higher-value vehicles', icon: Wrench },
];

const EXCESS_OPTIONS = [
  { value: 0, label: '£0', sub: 'No Excess' },
  { value: 50, label: '£50', sub: 'Low Excess' },
  { value: 100, label: '£100', sub: 'Balanced' },
  { value: 150, label: '£150', sub: 'Best Value', best: true },
  { value: 250, label: '£250', sub: 'Lower Monthly Cost' },
  { value: 500, label: '£500', sub: 'Maximum Saving' },
];

const TERM_META: Record<PaymentType, { years: string; payments: string; badge?: string; badgeTone?: 'orange' | 'green' }> = {
  '12months': { years: '1 Year', payments: '12 payments' },
  '24months': { years: '2 Years', payments: '12 payments', badge: 'Most Popular', badgeTone: 'orange' },
  '36months': { years: '3 Years', payments: '12 payments', badge: 'Best Value', badgeTone: 'green' },
};

const CLAIM_COPY: Record<number, { title: string; sub: string }> = {
  750: { title: 'Basic cover', sub: 'Good for smaller repairs' },
  2000: { title: 'Most popular', sub: 'Covers most common repairs' },
  3000: { title: 'Higher protection', sub: 'Greater peace of mind' },
  5000: { title: 'Maximum cover', sub: 'Complete confidence' },
};

const MobileSteppedFlow: React.FC<MobileSteppedFlowProps> = ({
  vehicleData,
  onBack,
  onChangeVehicle,
  selectedClaimLimit,
  onClaimLimitChange,
  selectedLabourRate,
  onLabourRateChange,
  paymentType,
  onPaymentTypeChange,
  voluntaryExcess,
  onVoluntaryExcessChange,
  availableDurations,
  currentMonthlyPrice,
  currentTotalPrice,
  calculateMonthlyPrice,
  onContinue,
  isLoading,
  selectedAddOns,
  onAddOnChange,
}) => {
  const [emailQuoteOpen, setEmailQuoteOpen] = useState(false);
  const blockedClaimLimits = getBlockedClaimLimits({
    make: vehicleData?.make,
    model: vehicleData?.model,
    fuelType: vehicleData?.fuelType,
    registration: vehicleData?.regNumber,
  });
  const isPremium = blockedClaimLimits.includes(5000);
  const claimTiers = CLAIM_LIMIT_TIERS.filter(t => !blockedClaimLimits.includes(t.value));

  const visibleTerms = (Object.keys(TERM_META) as PaymentType[]).filter(t =>
    availableDurations.includes(t)
  );

  const canAdvance =
    selectedClaimLimit !== null &&
    paymentType !== null &&
    !!selectedLabourRate &&
    voluntaryExcess !== null;

  // Remembered so step 4 opens on the same option the customer picked here.
  const [stickyPayment, setStickyPayment] = useState<'monthly' | 'full'>(() => getPaymentPreference() || 'monthly');
  const handleStickyPaymentChange = (payment: 'monthly' | 'full') => {
    setStickyPayment(payment);
    setPaymentPreference(payment);
  };

  // Mirror any promo applied on Step 4 so prices stay consistent across steps.
  const appliedPromos = useAppliedPromos();
  const promoCode = appliedPromos[0];
  const baseAnnualPrice = currentMonthlyPrice * 12;
  // Promo codes may never take a sale below the net sell floor for this term
  // (£399/£769/£1,099, halved for motorbikes) — matches the server-side floor.
  const promoTermFloor = getNetPayableFloor({
    paymentPeriod: (paymentType || '12months') as PaymentType,
    voluntaryExcess: voluntaryExcess ?? 100,
    claimLimit: selectedClaimLimit ?? undefined,
    labourRate: selectedLabourRate,
    isMotorbike: /motor\s*(bike|cycle)|\bbike\b/i.test(String((vehicleData as any)?.vehicleType || '')),
    surface: 'admin',
  });
  const promoDiscount = calcPromoDiscount(baseAnnualPrice, appliedPromos, promoTermFloor);
  const discountedAnnualPrice = Math.max(promoPriceFloor(appliedPromos, promoTermFloor), baseAnnualPrice - promoDiscount);
  const discountedMonthlyPrice = promoDiscount > 0
    ? Math.max(1, Math.ceil(discountedAnnualPrice / 12))
    : currentMonthlyPrice;

  const handleNext = () => {
    onContinue();
  };

  const handleBack = () => {
    onBack();
  };

  // Footer copy
  const termMeta = paymentType ? TERM_META[paymentType] : TERM_META['24months'];
  const planLabel = `${termMeta.years} Platinum Cover`;
  const pencePerDay = currentMonthlyPrice > 0
    ? Math.round((currentMonthlyPrice * 12 * 100) / 365)
    : 0;
  const dayLabel = pencePerDay >= 100 ? `£${(pencePerDay / 100).toFixed(2)}/day` : `${pencePerDay}p/day`;

  // Real savings = (1yr equivalent total × N years) − selected term total.
  // All plans are billed over 12 monthly payments, so total = monthly × 12.
  const years = paymentType === '36months' ? 3 : paymentType === '24months' ? 2 : 1;
  const oneYearMonthly = calculateMonthlyPrice('12months');
  const selectedMonthly = currentMonthlyPrice;
  // Multi-year saving is marketing copy only — it must never reduce the payable total.
  const marketingSavings = years > 1
    ? Math.max(0, (oneYearMonthly * years - selectedMonthly) * 12)
    : 0;
  void marketingSavings;
  const paymentsCount = 12;

  return (
    <div className="bg-background pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Top bar */}
      <div className="bg-card border-b border-border sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary transition-colors -ml-1 px-1 py-1"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <a href="/" className="hover:opacity-80">
            <img
              src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png"
              alt="buyawarranty"
              className="h-6 w-auto"
            />
          </a>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            Secure
          </div>
        </div>
      </div>

      {/* Vehicle card */}
      <div className="mx-4 mt-3 bg-card border border-border rounded-xl p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
          <Car className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-foreground text-sm leading-tight">
            {vehicleData.year} {vehicleData.make} {vehicleData.model}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <span className="font-mono font-semibold text-foreground">{vehicleData.regNumber}</span>
            {vehicleData.fuelType && <> · {vehicleData.fuelType}</>}
          </div>
        </div>
        <button onClick={onChangeVehicle ?? onBack} className="text-primary text-sm font-semibold">Edit</button>
      </div>


      {/* Step content */}
      <div className="px-4 mt-4 space-y-6">
        {true && (
          <>
            {/* Cover level */}
            <section className="relative">
              <span className="absolute top-0 right-0 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/60 tabular-nums select-none pointer-events-none">01</span>
              <p className="text-xs font-extrabold text-primary uppercase tracking-wider">Claim limit</p>
              <h2 className="text-lg font-bold text-foreground mt-1">Choose your cover level</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Select the amount we'll pay towards repairs
              </p>
              <div className="grid grid-cols-2 gap-3">
                {claimTiers.map(tier => {
                  const selected = selectedClaimLimit === tier.value;
                  const copy = CLAIM_COPY[tier.value] || { title: tier.shortName, sub: '' };
                  const recommended = tier.value === 2000;
                  return (
                    <button
                      key={tier.value}
                      onClick={() => onClaimLimitChange(tier.value)}
                      className={cn(
                        'relative text-left rounded-xl border-2 p-4 transition-all',
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/40'
                      )}
                    >
                      {recommended && (
                        <span className="absolute -top-2 right-9 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">
                          Recommended
                        </span>
                      )}
                      <div className="absolute top-2 right-2">
                        <RadioDot selected={selected} />
                      </div>
                      <div className="text-2xl font-bold text-foreground leading-tight">
                        £{tier.displayValue.toLocaleString()}
                      </div>
                      <div className="text-sm font-semibold text-foreground mt-1.5">{copy.title}</div>
                      <div className="text-xs text-muted-foreground mt-1 leading-snug">{copy.sub}</div>
                      {CLAIM_LIMIT_SUITABILITY[tier.value] && (
                        <div className="mt-2 pt-2 border-t border-border text-[11px] font-semibold text-emerald-700 leading-snug">
                          {CLAIM_LIMIT_SUITABILITY[tier.value]}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <HelperCallout topic="claim-limit" />
            </section>

            {/* Your cover details */}
            <section className="rounded-2xl border border-border bg-white p-4">
              <div className="mb-3">
                <h3 className="text-base font-bold text-foreground">Your cover details</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Check what's included before you continue.</p>
              </div>
              <SeeWhatsIncludedCard
                variant="mobile"
                vehicleData={vehicleData}
                selectedPlan={{
                  monthlyPrice: currentMonthlyPrice,
                  paymentType,
                  claimLimit: selectedClaimLimit,
                  labourRate: selectedLabourRate,
                  voluntaryExcess,
                }}
                selectedAddOns={selectedAddOns}
                onAddOnChange={onAddOnChange}
              />
            </section>



            <section className="relative">
              <span className="absolute top-0 right-0 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/60 tabular-nums select-none pointer-events-none">02</span>
              <p className="text-xs font-extrabold text-primary uppercase tracking-wider">Labour rate</p>
              <h2 className="text-lg font-bold text-foreground mt-1">Where do you usually repair your car?</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Pick the garage type that matches where you'd feel comfortable having repairs done
              </p>
              <div className="grid grid-cols-2 gap-3">
                {REPAIR_OPTIONS.map(opt => {
                  const selected = selectedLabourRate === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => onLabourRateChange(opt.value)}
                      className={cn(
                        'relative text-left rounded-xl border-2 p-4 transition-all min-h-[140px] flex flex-col',
                        selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                      )}
                    >
                      {opt.recommended && (
                        <span className="absolute -top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded">
                          Most popular
                        </span>
                      )}
                      {opt.bestValue && (
                        <span className="absolute -top-2 left-2 bg-success text-white text-[10px] font-bold px-2 py-0.5 rounded">
                          Best value
                        </span>
                      )}
                      <Icon className={cn('w-6 h-6 mb-2', selected ? 'text-primary' : 'text-muted-foreground')} />
                      <div className="text-lg font-extrabold text-foreground leading-tight">£{opt.value}<span className="text-xs font-normal text-muted-foreground">/hour</span></div>
                      <div className="text-sm font-bold text-foreground leading-tight mt-1">{opt.title}</div>
                      <div className="text-xs text-muted-foreground mt-1 leading-snug">{opt.sub}</div>
                      {LABOUR_RATE_SUITABILITY[opt.value] && (
                        <div className="mt-auto pt-2 text-[11px] font-semibold text-emerald-700 leading-snug">
                          {LABOUR_RATE_SUITABILITY[opt.value]}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <HelperCallout topic="labour-rate" />
            </section>

            {/* Cover length */}
            <section className="relative">
              <span className="absolute top-0 right-0 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/60 tabular-nums select-none pointer-events-none">03</span>
              <p className="text-xs font-extrabold text-primary uppercase tracking-wider">Term length</p>
              <h2 className="text-lg font-bold text-foreground mt-1">Choose your cover length</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Longer cover means more savings
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {visibleTerms.map(term => {
                  const selected = paymentType === term;
                  const monthly = calculateMonthlyPrice(term);
                  const meta = TERM_META[term];
                  const termYears = term === '36months' ? 3 : term === '24months' ? 2 : 1;
                  const oneYrMonthly = calculateMonthlyPrice('12months');
                  const cardSavings = termYears > 1
                    ? Math.max(0, (oneYrMonthly * termYears - monthly) * 12)
                    : 0;
                  return (
                    <button
                      key={term}
                      onClick={() => onPaymentTypeChange(term)}
                      className={cn(
                        'relative rounded-xl border-2 p-3 min-h-[120px] text-center transition-all',
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/40'
                      )}
                    >
                      {meta.badge && (
                        <span
                          className={cn(
                            'absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-xl whitespace-nowrap text-white',
                            meta.badgeTone === 'green' ? 'bg-emerald-700' : 'bg-primary'
                          )}
                        >
                          {meta.badge}
                        </span>
                      )}
                      <div className="text-sm font-semibold text-foreground">{meta.years}</div>
                      <div className="text-xl font-bold text-foreground mt-1.5">£{monthly}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                      <div className="text-[11px] text-muted-foreground mt-1">12 payments</div>
                      {cardSavings > 0 && (
                        <div className="text-[11px] font-bold text-success mt-1">Save £{cardSavings}</div>
                      )}
                      <div className="mt-2 flex justify-center">
                        <RadioDot selected={selected} small />
                      </div>
                    </button>
                  );
                })}
              </div>



            </section>



            <section className="relative">
              <span className="absolute top-0 right-0 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/60 tabular-nums select-none pointer-events-none">04</span>
              <p className="text-xs font-extrabold text-primary uppercase tracking-wider">Voluntary excess</p>
              <h2 className="text-lg font-bold text-foreground mt-1">Choose your excess</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Higher excess lowers your monthly payments
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {EXCESS_OPTIONS.filter(ex =>
                  getVisibleExcessOptions(
                    paymentType || '24months',
                    selectedClaimLimit,
                    getExcessBracketBasis(
                      paymentType || '24months',
                      currentMonthlyPrice ? currentMonthlyPrice * 12 : null,
                      voluntaryExcess,
                    ),
                  ).includes(ex.value),
                ).map(ex => {
                  const delta = getExcessMonthlyDelta(
                    (paymentType || '24months') as PaymentPeriod,
                    ex.value,
                    getExcessBracketBasis(paymentType || '24months', currentMonthlyPrice ? currentMonthlyPrice * 12 : null, voluntaryExcess),
                  );
                  const selected = voluntaryExcess === ex.value;
                  return (
                    <button
                      key={ex.value}
                      onClick={() => onVoluntaryExcessChange(ex.value)}
                      className={cn(
                        'relative rounded-xl border-2 p-3 min-h-[72px] text-center transition-all',
                        selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                      )}
                    >
                      {ex.best && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">
                          Best
                        </span>
                      )}
                      <div className="text-base font-bold text-foreground">{ex.label}</div>
                      <div className="text-[10px] font-semibold text-muted-foreground leading-snug">
                        {delta === 0 ? '£0' : delta > 0 ? `+£${delta}/mo` : `−£${Math.abs(delta)}/mo`}
                      </div>
                      {EXCESS_SUITABILITY[ex.value] && (
                        <div className="mt-1 text-[10px] font-semibold text-emerald-700 leading-snug">
                          {EXCESS_SUITABILITY[ex.value]}
                        </div>
                      )}

                    </button>
                  );
                })}
              </div>
              <HelperCallout topic="excess" />
            </section>

            {/* Combined trust + info accordions */}
            <section className="relative">
              <TrustAndInfoAccordion variant="mobile" />
            </section>

            {/* Price Beat Guarantee — near the live price box */}
            <section>
              <PriceBeatBanner
                currentMonthlyPrice={currentMonthlyPrice}
                currentExcess={voluntaryExcess}
                currentClaimLimit={selectedClaimLimit}
                currentLabourRate={selectedLabourRate}
              />
            </section>

            {/* Email quote link — placed below FAQ to keep sticky bar compact */}
            <div className="py-1 text-center">
              <button
                type="button"
                onClick={() => setEmailQuoteOpen(true)}
                className="text-sm font-semibold text-primary underline underline-offset-2 hover:opacity-80"
              >
                Email me this quote
              </button>
            </div>
          </>
        )}

      </div>


      {/* Promo banner — shows above sticky when a code is persisted from Step 4 */}
      {promoCode && promoDiscount > 0 && (
        <div className="fixed left-0 right-0 z-40 lg:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 220px)' }}>
          <div className="mx-3 mb-2 rounded-xl bg-[#FFF1E6] border border-[#FF6B00] px-3 py-2 flex items-center justify-between shadow">
            <span className="text-[12px] font-semibold text-[#1a1a1a]">
              Promo <span className="font-bold">{promoCode.code}</span> applied — save £{promoDiscount}
            </span>
            <button
              type="button"
              onClick={() => { clearAppliedPromos(); toast.success('Promo code removed'); }}
              className="text-[11px] font-semibold text-gray-600 underline ml-2"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Sticky checkout footer (shared with step 4) */}
      <MobileStickyFooter
        selectedPayment={stickyPayment}
        onPaymentChange={handleStickyPaymentChange}
        monthlyPrice={discountedMonthlyPrice}
        fullPrice={payInFullTotal(discountedMonthlyPrice)}
        paymentType={paymentType || '24months'}
        isLoading={isLoading}
        isFormValid={canAdvance}
        onPayClick={handleNext}
        onEmailQuote={() => setEmailQuoteOpen(true)}
      />


      <EmailQuoteDialog
        open={emailQuoteOpen}
        onOpenChange={setEmailQuoteOpen}
        vehicleData={vehicleData}
        selectedPlan={{
          monthlyPrice: currentMonthlyPrice,
          paymentType,
          claimLimit: selectedClaimLimit,
          labourRate: selectedLabourRate,
          voluntaryExcess,
        }}
      />
    </div>
  );
};

// ---- Subcomponents ----

const RadioDot: React.FC<{ selected: boolean; small?: boolean }> = ({ selected, small }) => (
  <div
    className={cn(
      'rounded-full border-2 flex items-center justify-center',
      small ? 'w-4 h-4' : 'w-5 h-5',
      selected ? 'border-primary bg-primary' : 'border-border bg-card'
    )}
  >
    {selected && <div className={cn('rounded-full bg-white', small ? 'w-1.5 h-1.5' : 'w-2 h-2')} />}
  </div>
);

const ReviewRow: React.FC<{ label: string; value: string; onEdit: () => void }> = ({
  label,
  value,
  onEdit,
}) => (
  <div className="flex items-center justify-between px-4 py-3">
    <span className="text-sm text-muted-foreground">{label}</span>
    <div className="flex items-center gap-3">
      <span className="text-sm font-semibold text-foreground">{value}</span>
      <button onClick={onEdit} className="text-primary text-sm font-semibold">Edit</button>
    </div>
  </div>
);

function getDisplay(value: number | null): number {
  if (!value) return 0;
  const tier = CLAIM_LIMIT_TIERS.find(t => t.value === value);
  return tier?.displayValue ?? value;
}

export default MobileSteppedFlow;
