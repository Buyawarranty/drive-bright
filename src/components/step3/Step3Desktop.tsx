import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Check, Info, Edit3, ArrowLeft, Star, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CLAIM_LIMIT_TIERS, isPremiumVehicle, getClaimLimitSurcharge, getClaimLimitSurchargeMonthly } from '@/lib/claimLimitTiers';
import {
  calculateLabourRateAdjustment,
  applyBasePriceFloor,
  type PaymentPeriod,
} from '@/lib/pricingMatrix';
import { calculateAddOnPrice, getAutoIncludedAddOns } from '@/lib/addOnsUtils';
import { calculateVehiclePriceAdjustment, applyPriceAdjustment } from '@/lib/vehicleValidation';
import ClaimLimitDetails from './ClaimLimitDetails';
import LabourRateDetails from './LabourRateDetails';
import ExcessDetails from './ExcessDetails';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import PartsListContent from './PartsListContent';
import SeeWhatsIncludedCard from './SeeWhatsIncludedCard';
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
import CheckoutFAQ from './CheckoutFAQ';
import { useAppliedPromos, calcPromoDiscount } from '@/lib/promoStorage';
import TrustAndInfoAccordion from './TrustAndInfoAccordion';
import SidebarQuickActions from './SidebarQuickActions';
import PriceBeatBanner from './PriceBeatBanner';
import { Lock, Shield, Clock, Zap } from 'lucide-react';

type PaymentType = '12months' | '24months' | '36months';

interface VehicleData {
  regNumber: string;
  mileage: string;
  make?: string;
  model?: string;
  fuelType?: string;
  year?: string;
  vehicleType?: string;
}

interface Step3DesktopProps {
  vehicleData: VehicleData;
  onBack: () => void;
  onChangeVehicle?: () => void;

  // Selections
  selectedClaimLimit: number | null;
  setSelectedClaimLimit: (v: number) => void;
  selectedLabourRate: number;
  setSelectedLabourRate: (v: number) => void;
  paymentType: PaymentType | null;
  setPaymentType: (v: PaymentType) => void;
  voluntaryExcess: number | null;
  setVoluntaryExcess: (v: number) => void;

  // Pricing helpers / values from parent
  getPricingData: (excess: number, claimLimit: number, paymentPeriod: string) => number;
  selectedProtectionAddOns: { [key: string]: boolean };
  monthlyPrice: number;
  totalPrice: number;

  // Available durations (vehicle age/mileage filtered)
  availableDurations: PaymentType[];

  // CTA + validation
  onSelectPlan: () => void;
  validationErrors: { voluntaryExcess: boolean; claimLimit: boolean; paymentType: boolean };
  onOpenPriceMatch?: () => void;
  platinumDocUrl?: string;
  termsDocUrl?: string;
}

const LABOUR_OPTIONS = [
  { value: 50, label: '£50/hr', sub: 'Local garages', note: 'Affordable cover for smaller independent garages and everyday repairs.', badge: { text: 'Best value', tone: 'green' as const } },
  { value: 70, label: '£70/hr', sub: 'Independent garages', note: 'A strong middle ground for trusted local repairers and servicing specialists.', badge: { text: 'Most popular', tone: 'orange' as const } },
  { value: 100, label: '£100/hr', sub: 'Approved garages', note: 'Broader coverage for branded workshops and larger nationwide networks.', badge: null },
  { value: 200, label: '£200/hr', sub: 'Expert garages', note: 'Perfect for main dealers and specialists.', badge: null },
];

const EXCESS_OPTIONS = [
  { value: 0, sub: 'Nothing to pay' },
  { value: 50, sub: 'Lower monthly' },
  { value: 100, sub: 'Balanced' },
  { value: 150, sub: 'Best balance' },
  { value: 250, sub: 'Save more' },
  { value: 500, sub: 'Biggest saving' },
];

const DURATION_OPTIONS: { id: PaymentType; label: string; badge: { text: string; tone: 'orange' | 'green' } | null; perks: string[] }[] = [
  { id: '12months', label: '1-year cover', badge: null, perks: ['Lowest monthly cost', 'Flexible shorter-term cover'] },
  { id: '24months', label: '2-year cover', badge: { text: 'Most popular', tone: 'orange' }, perks: ['Year 2 FREE — only 12 instalments', 'No renewal needed next year'] },
  { id: '36months', label: '3-year cover', badge: { text: 'Best value', tone: 'green' }, perks: ['Years 2 & 3 FREE — only 12 instalments', 'Locked-in protection for 3 years'] },
];

const Step3Desktop: React.FC<Step3DesktopProps> = ({
  vehicleData,
  onBack,
  onChangeVehicle,
  selectedClaimLimit,
  setSelectedClaimLimit,
  selectedLabourRate,
  setSelectedLabourRate,
  paymentType,
  setPaymentType,
  voluntaryExcess,
  setVoluntaryExcess,
  getPricingData,
  selectedProtectionAddOns,
  monthlyPrice,
  totalPrice,
  availableDurations,
  onSelectPlan,
  validationErrors,
  onOpenPriceMatch,
  platinumDocUrl,
  termsDocUrl,
}) => {
  const [partsListOpen, setPartsListOpen] = React.useState(false);
  const [claimLimitDetailsOpen, setClaimLimitDetailsOpen] = React.useState(false);
  const [labourRateDetailsOpen, setLabourRateDetailsOpen] = React.useState(false);
  const [excessDetailsOpen, setExcessDetailsOpen] = React.useState(false);

  const isPremium = isPremiumVehicle(vehicleData?.make);
  const visibleClaimTiers = isPremium
    ? CLAIM_LIMIT_TIERS.filter(t => t.value !== 5000)
    : [...CLAIM_LIMIT_TIERS];

  // Per-duration monthly price calculation (mirrors logic inside PricingTable map)
  // CRITICAL: Must match PricingTable's `displayMonthlyPrice` formula exactly so Step 3
  // sticky / cards / Step 4 always show identical prices. See .note/pricing-sync-constraint.md
  const computeDurationMonthly = (durationId: PaymentType): number => {
    if (voluntaryExcess === null || !selectedClaimLimit) return 0;
    const warrantyYears = durationId === '12months' ? 1 : durationId === '24months' ? 2 : 3;
    const vehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
    const basePrice = getPricingData(voluntaryExcess, selectedClaimLimit, durationId);
    const adjustedBasePrice = applyBasePriceFloor(
      applyPriceAdjustment(basePrice, vehicleAdjustment),
      durationId as PaymentPeriod,
      voluntaryExcess
    );

    const durationMonths = durationId === '12months' ? 12 : durationId === '24months' ? 24 : 36;
    const labourMonthlyAdjust = selectedLabourRate === 50 ? -5 : selectedLabourRate === 70 ? 0 : selectedLabourRate === 100 ? 8 : selectedLabourRate === 200 ? 24 : 0;
    const labourTotalAdjust = labourMonthlyAdjust * durationMonths;

    const thisCardAutoIncluded = getAutoIncludedAddOns(durationId);
    const allPossibleAutoIncluded = ['breakdown', 'motFee', 'rental', 'tyre'];
    const cardAddOns = { ...selectedProtectionAddOns };
    allPossibleAutoIncluded.forEach(k => { cardAddOns[k] = thisCardAutoIncluded.includes(k); });
    const durationAddOnPrice = calculateAddOnPrice(cardAddOns, durationId, durationMonths);

    const cardPremiumSurcharge = getClaimLimitSurcharge(selectedClaimLimit, durationId, voluntaryExcess || 100);

    // Boost addon: +£5/mo × 12 = £60 total (same for all durations) — must be included
    // to match PricingTable's basePlanPrice + boostTotalAdjustment formula
    const boostTotalAdjust = 0; // boostAddon not currently passed to Step3Desktop; included as 0 for parity

    const total = adjustedBasePrice + labourTotalAdjust + durationAddOnPrice + cardPremiumSurcharge + boostTotalAdjust;
    return Math.floor(total / 12);
  };

  // Approx +£/mo for excess pills (relative to current selection)
  const excessPillSubText = (amount: number): string => {
    if (voluntaryExcess === null || !selectedClaimLimit || !paymentType) {
      return EXCESS_OPTIONS.find(e => e.value === amount)?.sub || '';
    }
    const baseCurrent = getPricingData(voluntaryExcess, selectedClaimLimit, paymentType);
    const baseAt = getPricingData(amount, selectedClaimLimit, paymentType);
    const diffMonthly = Math.round((baseAt - baseCurrent) / 12);
    if (amount === voluntaryExcess) return EXCESS_OPTIONS.find(e => e.value === amount)?.sub || '';
    if (diffMonthly === 0) return EXCESS_OPTIONS.find(e => e.value === amount)?.sub || '';
    return diffMonthly > 0 ? `+£${diffMonthly}/mo` : `−£${Math.abs(diffMonthly)}/mo`;
  };

  const dailyLabel = useMemo(() => {
    const months = paymentType === '12months' ? 12 : paymentType === '24months' ? 24 : 36;
    const days = months === 12 ? 365 : months === 24 ? 730 : 1095;
    const annual = monthlyPrice * 12;
    const daily = (annual * (months / 12)) / days;
    return daily < 1 ? `${Math.round(daily * 100)}p/day` : `£${daily.toFixed(2)}/day`;
  }, [monthlyPrice, paymentType]);

  const months = paymentType === '24months' ? 24 : paymentType === '36months' ? 36 : 12;
  // Pay in full = monthly × 12 (always 12 instalments) - matches Step 4 / StickyFooter
  const rawMonthlyTotal = monthlyPrice * 12;
  // Apply persisted promo so the right-rail price matches Step 4 (was £50 here vs £42 in Step 4)
  const appliedPromos = useAppliedPromos();
  const promoDiscount = calcPromoDiscount(rawMonthlyTotal, appliedPromos);
  const monthlyTotal = Math.max(12, rawMonthlyTotal - promoDiscount);
  const displayedMonthlyPrice = promoDiscount > 0 ? Math.max(1, Math.floor(monthlyTotal / 12)) : monthlyPrice;
  // Match Step 4 formula exactly: total - Math.floor(total * 0.10)
  const savings = Math.floor(monthlyTotal * 0.10);
  const payInFull = monthlyTotal - savings;

  const selectedTier = CLAIM_LIMIT_TIERS.find(t => t.value === selectedClaimLimit);
  const selectedLabour = LABOUR_OPTIONS.find(l => l.value === selectedLabourRate);
  const selectedDuration = DURATION_OPTIONS.find(d => d.id === paymentType);

  return (
    <div className="bg-[#f7f7f5] min-h-screen pb-[260px]">
      {/* Top sub-header (back + vehicle) */}
      <div className="bg-white border-b border-[#e9e9e7]">
        <div className="max-w-[1180px] mx-auto px-7 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium py-2 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="ml-auto flex items-center gap-3">
            <TrustpilotHeader />
          </div>
        </div>
      </div>

      <main className="max-w-[1180px] mx-auto px-7 pt-8">
        {/* Hero */}
        <section className="text-center mb-6">
          <h1 className="text-[40px] leading-[1.05] tracking-[-0.04em] font-bold text-[#161616] mb-2">
            One complete warranty.<br />Tailored to your car.
          </h1>
          <p className="text-[17px] text-[#6c6c6c] m-0">
            All plans include full comprehensive cover — customise your protection below.
          </p>

          <div className="mt-[18px] flex justify-center gap-[18px] flex-wrap">
            {['Easy claims, fast payouts', 'Excellent 4.8 out of 5', '14-day cooling off period'].map((t) => (
              <div key={t} className="inline-flex items-center gap-2 border border-[#e9e9e7] bg-white rounded-full px-3.5 py-2.5 text-[13px] text-[#4f4f4f] shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
                <span className="w-[18px] h-[18px] rounded-full bg-[#eaf8f2] relative flex-shrink-0">
                  <Check className="w-3 h-3 text-[#1ca36f] absolute inset-0 m-auto" strokeWidth={3} />
                </span>
                {t}
              </div>
            ))}
          </div>
        </section>

        {/* Vehicle bar */}
        <section className="my-[26px] bg-white border border-[#e9e9e7] rounded-2xl px-[18px] py-[14px] flex items-center gap-4 justify-between shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
          <div className="flex items-center gap-3.5 flex-wrap">
            <strong className="text-[#161616]">Your vehicle</strong>
            <div className="flex gap-3.5 text-[#6c6c6c] text-sm flex-wrap">
              <span>{vehicleData?.year} {vehicleData?.make}</span>
              <span>{vehicleData?.mileage && parseInt(vehicleData.mileage) >= 120000 ? 'Over 120,000 miles' : 'Under 120,000 miles'}</span>
              {vehicleData?.fuelType && <span>{vehicleData.fuelType}</span>}
            </div>
            <span className="bg-[#ffd84c] text-[#111] font-bold rounded-lg px-2.5 py-1 tracking-[0.05em] text-[13px]">
              {vehicleData?.regNumber}
            </span>
          </div>
          <button
            onClick={onChangeVehicle}
            className="text-[#f36b21] text-sm font-bold flex items-center gap-1 hover:underline"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Change
          </button>
        </section>

        {/* Two-column grid */}
        <section className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-[22px] items-start">
          {/* LEFT - Stack of cards */}
          <div className="grid gap-[18px]">
            {/* CARD 1 - Cover Level */}
            <Card step={1}>
              <SectionHead
                eyebrow="Claim limit"
                title="How much cover do you need?"
                subtitle="Parts & labour covered — pick the limit that matches your car's value."
                onDetails={() => setClaimLimitDetailsOpen(true)}
              />
              <div className={cn('grid gap-3', visibleClaimTiers.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
                {visibleClaimTiers.map((tier) => {
                  const selected = selectedClaimLimit === tier.value;
                  return (
                    <OptionCard
                      key={tier.value}
                      selected={selected}
                      badge={tier.popular ? { text: 'Most popular', tone: 'orange' } : null}
                      onClick={() => setSelectedClaimLimit(tier.value)}
                    >
                      <div className="text-[28px] font-extrabold tracking-[-0.04em] leading-none mb-2 text-[#161616]">
                        £{(tier.displayValue ?? tier.value).toLocaleString()}
                      </div>
                      <div className="text-[13px] font-bold text-[#333] mb-1 min-h-[34px] leading-tight">{tier.name}</div>
                      <div className="text-[12px] text-[#6c6c6c] leading-snug">per claim</div>
                      {CLAIM_LIMIT_SUITABILITY[tier.value] && (
                        <div className="mt-2 pt-2 border-t border-[#eee] text-[11.5px] text-[#0a6b3f] font-semibold leading-snug">
                          {CLAIM_LIMIT_SUITABILITY[tier.value]}
                        </div>
                      )}
                    </OptionCard>
                  );
                })}
              </div>
              {validationErrors.claimLimit && (
                <p className="mt-3 text-sm text-red-600 font-medium">Please choose a claim limit to continue.</p>
              )}
              <HelperCallout topic="claim-limit" />
            </Card>

            {/* CARD 2 - Labour Rate */}
            <Card step={2}>
              <SectionHead
                eyebrow="Labour rate"
                title="Where do you usually repair your car?"
                subtitle="Pick the garage type that matches where you'd feel comfortable having repairs done."
                onDetails={() => setLabourRateDetailsOpen(true)}
              />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {LABOUR_OPTIONS.map((opt) => {
                  const selected = selectedLabourRate === opt.value;
                  return (
                    <OptionCard
                      key={opt.value}
                      selected={selected}
                      badge={opt.badge}
                      onClick={() => setSelectedLabourRate(opt.value)}
                    >
                      <div className="h-[28px] flex items-center mb-2">
                        <div className="text-[24px] font-extrabold tracking-[-0.04em] leading-none text-[#161616]">{opt.label}</div>
                      </div>
                      <div className="text-[13px] font-bold text-[#333] mb-1 min-h-[36px] leading-tight">{opt.sub}</div>
                      <div className="text-[12px] text-[#6c6c6c] leading-snug">{opt.note}</div>
                      {LABOUR_RATE_SUITABILITY[opt.value] && (
                        <div className="mt-2 pt-2 border-t border-[#eee] text-[11.5px] text-[#0a6b3f] font-semibold leading-snug">
                          {LABOUR_RATE_SUITABILITY[opt.value]}
                        </div>
                      )}
                    </OptionCard>
                  );
                })}
              </div>
              <HelperCallout topic="labour-rate" />
            </Card>

            {/* CARD 3 - Term length */}
            <Card step={3}>
              <SectionHead
                eyebrow="Term length"
                title="Lock in your price and save"
                subtitle="Longer cover means stronger value and fewer payment months overall."
              />
              <div className={cn('grid gap-3', availableDurations.length === 1 ? 'grid-cols-1' : availableDurations.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
                {DURATION_OPTIONS.filter(d => availableDurations.includes(d.id)).map((d) => {
                  const selected = paymentType === d.id;
                  const m = computeDurationMonthly(d.id);
                  const months = d.id === '12months' ? 12 : d.id === '24months' ? 24 : 36;
                  const days = months === 12 ? 365 : months === 24 ? 730 : 1095;
                  const dailyVal = (m * 12 * (months / 12)) / days;
                  const dailyTxt = dailyVal < 1 ? `${Math.round(dailyVal * 100)}p/day` : `£${dailyVal.toFixed(2)}/day`;
                  // Pay-in-full savings = Math.floor(annualTotal * 0.10) — must match Step 4 formula
                  const save = Math.floor(m * 12 * 0.10);
                  return (
                    <OptionCard
                      key={d.id}
                      selected={selected}
                      badge={d.badge}
                      onClick={() => setPaymentType(d.id)}
                    >
                      <div className="min-h-[52px]">
                        <div className="text-[18px] font-extrabold tracking-[-0.04em] leading-tight mb-1 text-[#161616]">{d.label}</div>
                        <div className="text-[13px] font-bold text-[#333] leading-tight">Platinum Complete Plan</div>
                      </div>
                      <div className="mt-3 text-[30px] font-extrabold tracking-[-0.04em] leading-none text-[#161616]">
                        £{m}<span className="text-[15px] text-[#6c6c6c] font-semibold">/mo</span>
                      </div>
                      <div className="text-[12px] text-[#919191] mt-1 min-h-[16px]">Equal to {dailyTxt}</div>
                      <div className="mt-2.5 min-h-[18px] text-[#1ca36f] text-[13px] font-extrabold">
                        {save > 0 ? `Save £${save} today` : ''}
                      </div>
                      {d.perks.length > 0 && (
                        <div className="mt-2.5 grid gap-1.5">
                          {d.perks.map(p => (
                            <div key={p} className="text-[12px] text-[#505050] flex gap-2 items-start">
                              <span className="text-[#1ca36f] font-black">✓</span>
                              {p}
                            </div>
                          ))}
                        </div>
                      )}
                    </OptionCard>
                  );
                })}
              </div>
              {validationErrors.paymentType && (
                <p className="mt-3 text-sm text-red-600 font-medium">Please choose a warranty duration to continue.</p>
              )}
              <div className="mt-5">
                <SeeWhatsIncludedCard
                  variant="desktop"
                  vehicleData={vehicleData}
                  selectedPlan={{
                    monthlyPrice,
                    paymentType,
                    claimLimit: selectedClaimLimit,
                    labourRate: selectedLabourRate,
                    voluntaryExcess,
                  }}
                />
              </div>


            </Card>

            {/* CARD 4 - Voluntary Excess */}
            <Card step={4}>
              <SectionHead
                eyebrow="Voluntary excess"
                title="Choose your excess"
                subtitle="Excess is what you pay towards a claim. Lower excess = higher monthly cost."
                onDetails={() => setExcessDetailsOpen(true)}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {EXCESS_OPTIONS.map((opt) => {
                  const selected = voluntaryExcess === opt.value;
                  return (
                    <OptionCard
                      key={opt.value}
                      selected={selected}
                      badge={opt.value === 150 ? { text: 'Best', tone: 'orange' } : null}
                      onClick={() => setVoluntaryExcess(opt.value)}
                    >
                      <div className="text-[28px] font-extrabold tracking-[-0.04em] leading-none mb-2 text-[#161616]">
                        £{opt.value}
                      </div>
                      {EXCESS_SUITABILITY[opt.value] && (
                        <div className="text-[12px] text-[#0a6b3f] font-semibold leading-snug">
                          {EXCESS_SUITABILITY[opt.value]}
                        </div>
                      )}

                    </OptionCard>
                  );
                })}
              </div>
              {validationErrors.voluntaryExcess && (
                <p className="mt-3 text-sm text-red-600 font-medium">Please choose a voluntary excess to continue.</p>
              )}
              <HelperCallout topic="excess" />
            </Card>

            {/* CARD 5 - Combined trust + info accordions */}
            <Card step={5}>
              <TrustAndInfoAccordion variant="desktop" />
            </Card>



            {/* PRICE BEAT */}
            <PriceBeatBanner
              currentMonthlyPrice={monthlyPrice}
              currentExcess={voluntaryExcess}
              currentClaimLimit={selectedClaimLimit}
              currentLabourRate={selectedLabourRate}
            />

          </div>

          {/* RIGHT - Sticky summary (simplified) */}
          <aside className="lg:sticky lg:top-6 grid gap-4">
            <div className="bg-gradient-to-b from-[#fffaf7] to-white border border-[#ffe0cf] rounded-[22px] overflow-hidden shadow-[0_16px_36px_rgba(243,107,33,0.08),0_10px_30px_rgba(16,24,40,0.06)]">
              <div className="p-[22px] pb-[18px] border-b border-[#f3ece7]">
                <div className="text-[#f36b21] text-[12px] font-extrabold tracking-[0.08em] uppercase mb-2.5">Live price</div>
                <p className="text-[56px] leading-none tracking-[-0.04em] font-extrabold m-0 text-[#161616] flex items-baseline gap-2">
                  £{monthlyPrice}<span className="text-[18px] text-[#6c6c6c] font-bold tracking-normal">/month</span>
                </p>
                <div className="mt-2.5 text-[#6c6c6c] text-sm font-semibold">
                  Equal to {dailyLabel} · 12 interest-free payments
                </div>
                <div className="mt-3 flex items-center justify-between rounded-lg bg-[#eaf8f2] border border-[#cdebd9] px-3 py-2">
                  <div className="text-[13px] text-[#3e3e3e] font-semibold">
                    Or pay in full <strong className="text-[#161616]">£{payInFull}</strong>
                  </div>
                  {savings > 0 && (
                    <div className="text-[12px] text-[#1ca36f] font-extrabold">Save £{savings}</div>
                  )}
                </div>
              </div>

              <div className="p-[18px] pt-4 grid gap-2 border-b border-[#f3ece7]">
                {selectedTier && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6c6c6c]">Claim limit</span>
                    <span className="font-bold text-[#161616]">£{(selectedTier.displayValue ?? selectedTier.value).toLocaleString()}</span>
                  </div>
                )}
                {selectedLabour && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6c6c6c]">Labour</span>
                    <span className="font-bold text-[#161616]">{selectedLabour.label}</span>
                  </div>
                )}
                {selectedDuration && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6c6c6c]">Cover</span>
                    <span className="font-bold text-[#161616]">{selectedDuration.label}</span>
                  </div>
                )}
                {voluntaryExcess !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6c6c6c]">Excess</span>
                    <span className="font-bold text-[#161616]">£{voluntaryExcess}</span>
                  </div>
                )}
              </div>

              <div className="p-[18px]">
                <button
                  onClick={onSelectPlan}
                  className="animate-breathing w-full border-0 rounded-2xl bg-[#f36b21] hover:bg-[#df5d17] text-white font-extrabold text-base px-6 py-[18px] min-h-[56px] cursor-pointer shadow-[0_10px_22px_rgba(243,107,33,0.22)] leading-none"
                >
                  Continue to checkout →
                </button>

                <div className="mt-3.5 flex items-center justify-between text-[12px] font-semibold text-[#4f4f4f]">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#1ca36f]" strokeWidth={2.25} /> Secure checkout
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#1ca36f]" strokeWidth={2.25} /> 14-day cooling off
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#1ca36f]" strokeWidth={2.25} /> Fast claims
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>

      {/* Sticky bottom bar - original design */}
      <div className="fixed left-0 right-0 bottom-0 z-30 bg-white border-t border-[#e9e9e7] shadow-[0_-12px_32px_rgba(16,24,40,0.06)]">
        <div className="max-w-[1180px] mx-auto px-7 py-4 flex items-center gap-6 divide-x divide-[#e9e9e7]">
          {/* Trustpilot */}
          <div className="flex items-center gap-2.5 pr-6">
            <span className="w-9 h-9 rounded-full bg-[#eaf8f2] flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-[#1ca36f]" />
            </span>
            <div className="leading-tight">
              <div className="text-[13px] font-bold text-[#161616]">Excellent</div>
              <div className="text-[#1ca36f] text-[13px] tracking-[1px] leading-none my-0.5">★★★★★</div>
              <div className="text-[11px] text-[#6c6c6c] font-semibold">4.8 out of 5</div>
            </div>
          </div>

          {/* Your cover */}
          <div className="px-6 leading-tight">
            <div className="text-[#f36b21] text-[11px] font-extrabold tracking-[0.08em] uppercase mb-1">Your cover</div>
            <div className="text-[15px] font-extrabold text-[#161616]">{selectedDuration?.label ? `${selectedDuration.label.replace(' cover','').replace('1-year','1-Year').replace('2-year','2-Year').replace('3-year','3-Year')} Platinum Cover` : '2-Year Platinum Cover'}</div>
          </div>

          {/* Price */}
          <div className="px-6 leading-tight">
            <div className="text-[26px] font-extrabold tracking-[-0.04em] text-[#161616] leading-none">
              £{monthlyPrice}<span className="text-[14px] text-[#6c6c6c] font-bold ml-0.5">/month</span>
            </div>
            <div className="text-[12px] text-[#6c6c6c] mt-1 font-semibold">Equal to {dailyLabel}</div>
            <div className="text-[11px] text-[#919191] font-semibold">Paid over 12 months</div>
          </div>

          {/* Pay in full pill */}
          <div className="px-6">
            <div className="bg-[#eaf8f2] border border-[#cdebd9] rounded-2xl px-5 py-3 leading-tight">
              <div className="text-[15px] text-[#3e3e3e] font-semibold">Pay in full <strong className="text-[#161616] text-[16px]">£{payInFull}</strong></div>
              {savings > 0 && <div className="text-[14px] text-[#1ca36f] font-bold mt-0.5">Save £{savings} vs monthly</div>}
            </div>
          </div>

          {/* CTA */}
          <div className="pl-6 ml-auto">
            <button
              onClick={onSelectPlan}
              className="animate-breathing border-0 rounded-2xl bg-[#f36b21] hover:bg-[#df5d17] text-white font-extrabold text-[15px] px-7 py-4 min-h-[52px] cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 leading-none"
            >
              Continue to checkout →
            </button>
            <div className="mt-1.5 text-center text-[#919191] text-[11px] font-semibold flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" /> Secure checkout
            </div>
          </div>
        </div>
      </div>

      {/* Detail modals (existing components) */}
      <ClaimLimitDetails
        open={claimLimitDetailsOpen}
        onOpenChange={setClaimLimitDetailsOpen}
        selectedClaimLimit={selectedClaimLimit}
        onConfirm={(limit) => setSelectedClaimLimit(limit)}
      />
      <LabourRateDetails
        open={labourRateDetailsOpen}
        onOpenChange={setLabourRateDetailsOpen}
        selectedLabourRate={selectedLabourRate}
        onConfirm={setSelectedLabourRate}
      />
      <ExcessDetails
        open={excessDetailsOpen}
        onOpenChange={setExcessDetailsOpen}
        selectedExcess={voluntaryExcess}
        onConfirm={(amt) => setVoluntaryExcess(amt)}
      />
    </div>
  );
};

/* ───────── helpers ───────── */

const Card: React.FC<{ children: React.ReactNode; step?: number }> = ({ children, step }) => (
  <div className="relative bg-white border border-[#e9e9e7] rounded-[18px] shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
    {step !== undefined && (
      <div className="absolute top-4 right-5 text-[11px] font-semibold tracking-[0.12em] text-[#b8b8b6] tabular-nums select-none pointer-events-none">
        {String(step).padStart(2, '0')}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);


const SectionHead: React.FC<{ eyebrow: string; title: string; subtitle: string; onDetails?: () => void }> = ({ eyebrow, title, subtitle, onDetails }) => (
  <div className="flex items-start justify-between gap-4 mb-4">
    <div>
      <div className="text-[#f36b21] text-[12px] font-extrabold uppercase tracking-[0.08em] mb-2">{eyebrow}</div>
      <h2 className="m-0 mb-1.5 text-[24px] leading-tight tracking-[-0.03em] font-bold text-[#161616]">{title}</h2>
      <p className="m-0 text-[#6c6c6c] text-[15px]">{subtitle}</p>
    </div>
    {onDetails && (
      <button onClick={onDetails} className="text-[#00a89d] text-sm font-bold whitespace-nowrap flex items-center gap-1 hover:underline">
        Details <Info className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

const OptionCard: React.FC<{
  selected: boolean;
  badge: { text: string; tone: 'orange' | 'green' } | null;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ selected, badge, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'relative text-left border-[1.5px] rounded-2xl p-4 pt-4 bg-white transition min-h-[136px]',
      selected
        ? 'border-[#f36b21] bg-gradient-to-b from-[#fffaf7] to-[#fff3ec] shadow-[0_0_0_3px_rgba(243,107,33,0.08)]'
        : 'border-[#e6e6e4] hover:border-[#f3b58a]'
    )}
  >
    {badge && (
      <span className={cn(
        'absolute -top-2.5 left-4 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-white',
        badge.tone === 'orange' ? 'bg-[#f36b21]' : 'bg-[#1ca36f]'
      )}>
        {badge.text}
      </span>
    )}
    <span
      className={cn(
        'absolute top-4 right-4 w-[22px] h-[22px] rounded-full border-2 bg-white block',
        selected ? 'border-[#f36b21] bg-[#f36b21]' : 'border-[#d7d7d7]'
      )}
    >
      {selected && <span className="block w-2 h-2 rounded-full bg-white absolute left-[5px] top-[5px]" />}
    </span>
    <div className="pr-7">{children}</div>
  </button>
);

const SummaryRow: React.FC<{ strong: string; sub: string }> = ({ strong, sub }) => (
  <div className="flex items-start gap-2.5 text-sm text-[#3e3e3e] leading-snug">
    <span className="w-[18px] h-[18px] rounded-full bg-[#eaf8f2] relative flex-shrink-0 mt-0.5">
      <Check className="w-3 h-3 text-[#1ca36f] absolute inset-0 m-auto" strokeWidth={3} />
    </span>
    <div>
      <strong className="block text-[#161616]">{strong}</strong>
      <span>{sub}</span>
    </div>
  </div>
);

export default Step3Desktop;
