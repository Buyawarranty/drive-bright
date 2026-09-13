import React, { useMemo, useState, useEffect } from 'react';
import InlineVehicleEdit from './InlineVehicleEdit';
import type { EditableVehicleData } from '@/components/EditVehicleDialog';
import { cn } from '@/lib/utils';
import { Check, Info, Edit3, ArrowLeft, Star, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CLAIM_LIMIT_TIERS, getBlockedClaimLimits, isPremiumVehicle, getClaimLimitSurcharge, getClaimLimitSurchargeMonthly } from '@/lib/claimLimitTiers';
import {
  calculateLabourRateAdjustment,
  getExcessTotalAdjustment,
  getExcessFactor,
  applyBasePriceFloor,
  getVisibleExcessOptions,
  getExcessBracketBasis,
  type PaymentPeriod,
} from '@/lib/pricingMatrix';
import { applyWebsiteSellFloor, getNetPayableFloor } from '@/lib/pricing/netFloor';
import { calculateAddOnPrice, getAutoIncludedAddOns } from '@/lib/addOnsUtils';
import { calculateVehiclePriceAdjustment, applyPriceAdjustment, isMotorbikeAdjustment } from '@/lib/vehicleValidation';
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
import { useAppliedPromos, calcPromoDiscount, promoPriceFloor } from '@/lib/promoStorage';
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
  onUpdateVehicle?: (vehicle: EditableVehicleData) => void;

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
  boostAddon?: boolean;

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
  { value: 150, label: '£150/hr', sub: 'Specialist garages', note: 'Designed for specialist repairers and higher-value vehicles.', badge: null },
];

const EXCESS_OPTIONS = [
  { value: 0, sub: 'No Excess' },
  { value: 50, sub: 'Low Excess' },
  { value: 100, sub: 'Balanced' },
  { value: 150, sub: 'Best Value' },
  { value: 250, sub: 'Lower Monthly Cost' },
  { value: 500, sub: 'Maximum Saving' },
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
  onUpdateVehicle,
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
  boostAddon = false,
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
  const [vehicleEditOpen, setVehicleEditOpen] = useState(false);

  // Managed claim-limit blocks (make / model / fuel / single reg) hide tiers here.
  const blockedClaimLimits = getBlockedClaimLimits({
    make: vehicleData?.make,
    model: vehicleData?.model,
    fuelType: vehicleData?.fuelType,
    registration: vehicleData?.regNumber,
  });
  const isPremium = blockedClaimLimits.includes(5000);
  const visibleClaimTiers = CLAIM_LIMIT_TIERS.filter(t => !blockedClaimLimits.includes(t.value));

  // Filter excess options by term + claim limit + warranty price:
  // - No £500 on 1-year cover
  // - No £500 when claim limit < £3,000
  // - No £500 when the warranty itself costs £500 or less
  const visibleExcessOptions = EXCESS_OPTIONS.filter((opt) =>
    getVisibleExcessOptions(
      paymentType,
      selectedClaimLimit,
      getExcessBracketBasis(paymentType, totalPrice, voluntaryExcess),
    ).includes(opt.value),
  );
  useEffect(() => {
    if (voluntaryExcess !== null && !visibleExcessOptions.some((o) => o.value === voluntaryExcess)) {
      // Landing default is £100 excess (see mem://pricing/landing-defaults-step3-and-quotes),
      // so fall back to £100 first, then £150, then whatever remains visible.
      setVoluntaryExcess(
        visibleExcessOptions.find((o) => o.value === 100)?.value ??
        visibleExcessOptions.find((o) => o.value === 150)?.value ??
        visibleExcessOptions[0]?.value ??
        100
      );
    }
  }, [visibleExcessOptions, voluntaryExcess, setVoluntaryExcess]);


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
      voluntaryExcess,
      isMotorbikeAdjustment(vehicleAdjustment),
      'customer',
      [vehicleData?.make, (vehicleData as any)?.model].filter(Boolean).join(' '),
      selectedClaimLimit
    );

    const durationMonths = durationId === '12months' ? 12 : durationId === '24months' ? 24 : 36;
    // Canonical multiplicative labour factors (same helper as the selected price / Step 4).
    const labourTotalAdjust = calculateLabourRateAdjustment(selectedLabourRate, durationId as PaymentPeriod, adjustedBasePrice);

    const thisCardAutoIncluded = getAutoIncludedAddOns(durationId);
    const allPossibleAutoIncluded = ['breakdown', 'motFee', 'rental'];
    const cardAddOns = { ...selectedProtectionAddOns };
    allPossibleAutoIncluded.forEach(k => { cardAddOns[k] = thisCardAutoIncluded.includes(k); });
    const durationAddOnPrice = calculateAddOnPrice(cardAddOns, durationId, durationMonths);

    const cardPremiumSurcharge = getClaimLimitSurcharge(selectedClaimLimit, durationId, voluntaryExcess || 100);

    // Boost addon: +£5/mo × 12 = £60 total (same for all durations)
    const boostTotalAdjust = boostAddon ? 60 : 0;

    // Website sell floor MUST be applied here too — without it the duration cards
    // sat £1+ below the selected / sticky / Step 4 price on floor-bound vehicles.
    const total = applyWebsiteSellFloor(
      adjustedBasePrice + labourTotalAdjust + durationAddOnPrice + cardPremiumSurcharge + boostTotalAdjust + getExcessTotalAdjustment(durationId as PaymentPeriod, voluntaryExcess ?? 100, adjustedBasePrice),
      {
        paymentPeriod: durationId as PaymentPeriod,
        voluntaryExcess: voluntaryExcess ?? 100,
        claimLimit: selectedClaimLimit,
        labourRate: selectedLabourRate,
        isMotorbike: isMotorbikeAdjustment(vehicleAdjustment),
      }
    );
    return Math.ceil(total / 12);

  };

  // Approx +£/mo for excess pills (relative to current selection). Excess is
  // proportional, so the step is derived from the tier factors, not the grid cells.
  const excessPillSubText = (amount: number): string => {
    const sub = EXCESS_OPTIONS.find(e => e.value === amount)?.sub || '';
    if (voluntaryExcess === null || !monthlyPrice || amount === voluntaryExcess) return sub;
    const currentFactor = getExcessFactor(voluntaryExcess);
    if (!currentFactor) return sub;
    const diffMonthly = Math.round(monthlyPrice * (getExcessFactor(amount) / currentFactor - 1));
    if (diffMonthly === 0) return sub;
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
  // Mirror Step 4 (StreamlinedCheckout) EXACTLY:
  //   1) 10% pay-in-full discount applies to the base bumper total FIRST
  //   2) promo code is then subtracted from each side (bumper / stripe) independently
  //   3) "Save" = bumperTotal − discountedStripePrice
  // Doing it any other way (e.g. promo-then-10%) caused Step 3 to show different
  // savings/pay-in-full vs Step 4 (£927/£103 vs £922/£158).
  const appliedPromos = useAppliedPromos();
  // Promo codes may never take a sale below the net sell floor for this term
  // (£399/£769/£1,099, halved for motorbikes) — matches the server-side floor.
  const promoTermFloor = getNetPayableFloor({
    paymentPeriod: (paymentType || '12months') as PaymentPeriod,
    voluntaryExcess: voluntaryExcess ?? 100,
    claimLimit: selectedClaimLimit ?? undefined,
    labourRate: selectedLabourRate,
    isMotorbike: isMotorbikeAdjustment(vehicleAdjustment),
    surface: 'admin',
  });
  const stripeBeforePromo = rawMonthlyTotal - Math.floor(rawMonthlyTotal * 0.10);
  const bumperPromoAmt = calcPromoDiscount(rawMonthlyTotal, appliedPromos, promoTermFloor);
  const stripePromoAmt = calcPromoDiscount(stripeBeforePromo, appliedPromos, promoTermFloor);
  const monthlyTotal = Math.max(promoPriceFloor(appliedPromos, promoTermFloor), rawMonthlyTotal - bumperPromoAmt);
  const displayedMonthlyPrice = bumperPromoAmt > 0
    ? Math.max(1, Math.ceil(monthlyTotal / 12))
    : monthlyPrice;
  const payInFull = Math.max(promoPriceFloor(appliedPromos, promoTermFloor), stripeBeforePromo - stripePromoAmt);
  const savings = Math.max(0, rawMonthlyTotal - payInFull);

  const selectedTier = CLAIM_LIMIT_TIERS.find(t => t.value === selectedClaimLimit);
  const selectedLabour = LABOUR_OPTIONS.find(l => l.value === selectedLabourRate);
  const selectedDuration = DURATION_OPTIONS.find(d => d.id === paymentType);

  return (
    <div className="bg-[#f7f7f5] min-h-screen pb-[140px]">
      <main className="max-w-[1180px] mx-auto px-7 pt-6">
        {/* Hero with back + trustpilot inline */}
        <section className="relative mb-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-medium py-2 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <TrustpilotHeader />
          </div>

          <div className="text-center">
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
          </div>
        </section>


        {/* Vehicle bar */}
        <section className="my-[26px]">
          <div className="bg-white border border-[#e9e9e7] rounded-2xl px-[18px] py-[14px] flex items-center gap-4 justify-between shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
            <div className="flex items-center gap-3.5 flex-wrap">
              <strong className="text-[#161616]">Your vehicle</strong>
              <div className="flex gap-3.5 text-[#6c6c6c] text-sm flex-wrap">
                <span>{vehicleData?.year} {vehicleData?.make}</span>
                {vehicleData?.fuelType && <span>{vehicleData.fuelType}</span>}
              </div>
              <span className="bg-[#ffd84c] text-[#111] font-bold rounded-lg px-2.5 py-1 tracking-[0.05em] text-[13px]">
                {vehicleData?.regNumber}
              </span>
            </div>
            <button
              onClick={() => {
                if (onUpdateVehicle) {
                  setVehicleEditOpen((v) => !v);
                } else {
                  onChangeVehicle?.();
                }
              }}
              className="text-[#f36b21] text-sm font-bold flex items-center gap-1 hover:underline"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {vehicleEditOpen ? 'Close' : 'Change'}
              {onUpdateVehicle && (
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', vehicleEditOpen && 'rotate-180')} />
              )}
            </button>
          </div>

          {onUpdateVehicle && vehicleEditOpen && (
            <InlineVehicleEdit
              initialReg={vehicleData?.regNumber || ''}
              initialMileage={vehicleData?.mileage || ''}
              onCancel={() => setVehicleEditOpen(false)}
              onSave={(v) => {
                onUpdateVehicle(v);
                setVehicleEditOpen(false);
              }}
            />
          )}
        </section>

        {/* Two-column grid */}
        <section className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
          {/* LEFT - Stack of cards */}
          <div className="grid gap-3">
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

            {/* Your cover details */}
            <div className="rounded-2xl border border-border bg-white p-4 sm:p-5">
              <div className="mb-3">
                <h3 className="text-[15px] font-bold text-foreground">Your cover details</h3>
                <p className="text-[13px] text-muted-foreground mt-0.5">Check what's included before you continue.</p>
              </div>
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
                          {d.perks.map(p => {
                            const isFreeYear = p.includes('FREE — only 12 instalments');
                            return (
                              <div key={p} className={`text-[12px] text-[#505050] flex gap-2 items-start ${isFreeYear ? 'font-bold' : ''}`}>
                                <span className="text-[#1ca36f] font-black">✓</span>
                                {p}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </OptionCard>
                  );
                })}
              </div>
              {validationErrors.paymentType && (
                <p className="mt-3 text-sm text-red-600 font-medium">Please choose a warranty duration to continue.</p>
              )}
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
                {visibleExcessOptions.map((opt) => {
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

          </div>

          {/* RIGHT - Sticky summary (simplified) */}
          <aside className="lg:sticky lg:top-6 grid gap-4">
            <PriceBeatBanner
              currentMonthlyPrice={monthlyPrice}
              currentExcess={voluntaryExcess}
              currentClaimLimit={selectedClaimLimit}
              currentLabourRate={selectedLabourRate}
            />

            <div className="bg-gradient-to-b from-[#fffaf7] to-white border border-[#ffe0cf] rounded-[22px] overflow-hidden shadow-[0_16px_36px_rgba(243,107,33,0.08),0_10px_30px_rgba(16,24,40,0.06)]">
              <div className="p-[22px] pb-[18px] border-b border-[#f3ece7]">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="text-[#f36b21] text-[12px] font-extrabold tracking-[0.08em] uppercase">Live price</div>
                  {months > 12 && (
                    <span className="text-[10px] font-extrabold tracking-[0.06em] uppercase text-[#f36b21] bg-[#fff1e6] border border-[#ffd9bd] rounded-full px-2.5 py-1">12 instalments only</span>
                  )}
                </div>
                {months > 12 ? (
                  <>
                    <p className="text-[18px] leading-tight font-bold text-[#161616] m-0">12 monthly payments of</p>
                    <p className="text-[56px] leading-none tracking-[-0.04em] font-extrabold m-0 text-[#161616] mt-1">£{displayedMonthlyPrice}</p>
                    <div className="mt-2.5 text-[#161616] text-sm font-semibold">
                      Payments end after 12 months · Cover lasts {months / 12} years
                    </div>
                    <div className="mt-1 text-[#6c6c6c] text-xs font-semibold">Equal to {dailyLabel}</div>
                  </>
                ) : (
                  <>
                    <p className="text-[56px] leading-none tracking-[-0.04em] font-extrabold m-0 text-[#161616] flex items-baseline gap-2">
                      £{displayedMonthlyPrice}<span className="text-[18px] text-[#6c6c6c] font-bold tracking-normal">/month</span>
                    </p>
                    <div className="mt-2.5 text-[#6c6c6c] text-sm font-semibold">
                      Equal to {dailyLabel} · 12 interest-free payments
                    </div>
                  </>
                )}
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
            {months > 12 ? (
              <>
                <div className="text-[26px] font-extrabold tracking-[-0.04em] text-[#161616] leading-none">
                  £{displayedMonthlyPrice}<span className="text-[14px] text-[#6c6c6c] font-bold ml-0.5">/month</span>
                </div>
                <div className="text-[11px] mt-1.5">
                  <span className="text-[10px] font-extrabold tracking-[0.06em] uppercase text-[#f36b21] bg-[#fff1e6] border border-[#ffd9bd] rounded-full px-2 py-0.5">12 instalments only</span>
                </div>
                <div className="text-[11px] text-[#6c6c6c] mt-1 font-semibold">{months / 12}-year cover · no payments after month 12</div>
              </>
            ) : (
              <>
                <div className="text-[26px] font-extrabold tracking-[-0.04em] text-[#161616] leading-none">
                  £{displayedMonthlyPrice}<span className="text-[14px] text-[#6c6c6c] font-bold ml-0.5">/month</span>
                </div>
                <div className="text-[12px] text-[#6c6c6c] mt-1 font-semibold">Equal to {dailyLabel}</div>
                <div className="text-[11px] text-[#919191] font-semibold">Paid over 12 months</div>
              </>
            )}
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

const Card: React.FC<{ children: React.ReactNode; step?: number }> = ({ children }) => (
  <div className="relative bg-white border border-[#e9e9e7] rounded-[18px] shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
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
