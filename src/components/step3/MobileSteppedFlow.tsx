import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Lock, Shield, ShieldCheck, Car, Wrench, Building2, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { CLAIM_LIMIT_TIERS, isPremiumVehicle } from '@/lib/claimLimitTiers';
import { getMarketingSavings, type PaymentPeriod } from '@/lib/pricingMatrix';
import trustpilotStars from '@/assets/trustpilot-5-stars.png';
import MobileStickyFooter from '@/components/checkout/MobileStickyFooter';
import WhatsCoveredAccordion from './WhatsCoveredAccordion';
import WhatsNotCoveredAccordion from './WhatsNotCoveredAccordion';
import TermComparison from './TermComparison';
import HelperCallout from './HelperCallout';
import {
  CLAIM_LIMIT_SUITABILITY,
  LABOUR_RATE_SUITABILITY,
  EXCESS_SUITABILITY,
} from './suitabilityCopy';
import TrustBlocks from './TrustBlocks';
import PolicyTermsAccordion from './PolicyTermsAccordion';
import CheckoutFAQ from './CheckoutFAQ';

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
  { value: 200, title: 'Expert Garages', sub: 'Main dealers and specialists', icon: Wrench },
];

const EXCESS_OPTIONS = [
  { value: 0, label: '£0', sub: 'Nothing to pay' },
  { value: 50, label: '£50', sub: 'Lower monthly' },
  { value: 100, label: '£100', sub: 'Balanced' },
  { value: 150, label: '£150', sub: 'Best balance', best: true },
  { value: 250, label: '£250', sub: 'Save more' },
  { value: 500, label: '£500', sub: 'Biggest saving' },
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
}) => {
  const isPremium = isPremiumVehicle(vehicleData?.make);
  const claimTiers = isPremium
    ? CLAIM_LIMIT_TIERS.filter(t => t.value !== 5000)
    : [...CLAIM_LIMIT_TIERS];

  const visibleTerms = (Object.keys(TERM_META) as PaymentType[]).filter(t =>
    availableDurations.includes(t)
  );

  const canAdvance =
    selectedClaimLimit !== null &&
    paymentType !== null &&
    !!selectedLabourRate &&
    voluntaryExcess !== null;

  const [stickyPayment, setStickyPayment] = useState<'monthly' | 'full'>('monthly');

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
  const marketingSavings = years > 1
    ? Math.max(0, (oneYearMonthly * years - selectedMonthly) * 12)
    : 0;
  const paymentsCount = 12;

  return (
    <div className="bg-background pb-[calc(5rem+env(safe-area-inset-bottom))]">
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
        <div className="flex-1 min-w-0">
          <div className="font-bold text-foreground text-sm leading-tight">
            {vehicleData.year} {vehicleData.make} {vehicleData.model}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <span className="font-mono font-semibold text-foreground">{vehicleData.regNumber}</span>
            {vehicleData.fuelType && <> · {vehicleData.fuelType}</>}
            {vehicleData.mileage && <> · Under {Math.ceil((parseInt(String(vehicleData.mileage).replace(/[^0-9]/g, '')) || 0) / 10000) * 10000} miles</>}
          </div>
        </div>
        <button onClick={onBack} className="text-primary text-sm font-semibold">Edit</button>
      </div>


      {/* Step content */}
      <div className="px-4 mt-4 space-y-6">
        {true && (
          <>
            {/* Cover level */}
            <section>
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
                        'relative text-left rounded-xl border-2 p-4 min-h-[120px] transition-all',
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/40'
                      )}
                    >
                      {recommended && (
                        <span className="absolute -top-2 right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded">
                          Recommended
                        </span>
                      )}
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
                      <div className="mt-2 flex justify-end">
                        <RadioDot selected={selected} />
                      </div>
                    </button>
                  );
                })}
              </div>
              <HelperCallout topic="claim-limit" />
            </section>

            {/* Cover length */}
            <section>
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
                            'absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap text-white',
                            meta.badgeTone === 'green' ? 'bg-success' : 'bg-primary'
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
              <TermComparison
                variant="mobile"
                selectedTerm={paymentType}
                onSelectTerm={onPaymentTypeChange}
                availableTerms={visibleTerms as any}
              />
            </section>

            <section>
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

            <section>
              <p className="text-xs font-extrabold text-primary uppercase tracking-wider">Voluntary excess</p>
              <h2 className="text-lg font-bold text-foreground mt-1">Choose your excess</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Higher excess lowers your monthly payments
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {EXCESS_OPTIONS.map(ex => {
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
                      <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{ex.sub}</div>
                      {EXCESS_SUITABILITY[ex.value] && (
                        <div className="mt-1.5 pt-1.5 border-t border-border text-[10px] font-semibold text-emerald-700 leading-snug">
                          {EXCESS_SUITABILITY[ex.value]}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <HelperCallout topic="excess" />
            </section>

            {/* Trust & reassurance blocks */}
            <section className="bg-card border border-border rounded-2xl p-4">
              <TrustBlocks variant="mobile" />
            </section>

            {/* What's covered — transparency accordion */}
            <section className="bg-card border border-border rounded-2xl p-4">
              <WhatsCoveredAccordion variant="mobile" />
            </section>

            {/* What's not covered — trust through transparency */}
            <section className="bg-card border border-border rounded-2xl p-4">
              <WhatsNotCoveredAccordion variant="mobile" />
            </section>

            {/* Policy & Terms — full transparency before checkout */}
            <section className="bg-card border border-border rounded-2xl p-4">
              <PolicyTermsAccordion variant="mobile" />
            </section>

            {/* FAQ — reduce exits */}
            <section className="bg-card border border-border rounded-2xl p-4">
              <CheckoutFAQ variant="mobile" />
            </section>
          </>
        )}

      </div>


      {/* Sticky checkout footer (shared with step 4) */}
      <MobileStickyFooter
        selectedPayment={stickyPayment}
        onPaymentChange={setStickyPayment}
        monthlyPrice={currentMonthlyPrice}
        fullPrice={Math.max(0, currentMonthlyPrice * 12 - marketingSavings)}
        paymentType={paymentType || '24months'}
        isLoading={isLoading}
        isFormValid={canAdvance}
        onPayClick={handleNext}
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
