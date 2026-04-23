import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Check, Info, Edit3, ArrowLeft, Star } from 'lucide-react';
import { CLAIM_LIMIT_TIERS, isPremiumVehicle, getClaimLimitSurcharge, getClaimLimitSurchargeMonthly } from '@/lib/claimLimitTiers';
import {
  calculateLabourRateAdjustment,
  type PaymentPeriod,
} from '@/lib/pricingMatrix';
import { calculateAddOnPrice, getAutoIncludedAddOns } from '@/lib/addOnsUtils';
import { calculateVehiclePriceAdjustment, applyPriceAdjustment } from '@/lib/vehicleValidation';
import ClaimLimitDetails from './ClaimLimitDetails';
import LabourRateDetails from './LabourRateDetails';
import ExcessDetails from './ExcessDetails';
import TrustpilotHeader from '@/components/TrustpilotHeader';

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
}

const LABOUR_OPTIONS = [
  { value: 50, label: '£50/hr', sub: 'Local garages', note: 'Affordable cover for smaller independent garages and everyday repairs.', badge: { text: 'Best value', tone: 'green' as const } },
  { value: 70, label: '£70/hr', sub: 'Independent garages', note: 'A strong middle ground for trusted local repairers and servicing specialists.', badge: { text: 'Most popular', tone: 'orange' as const } },
  { value: 100, label: '£100/hr', sub: 'Approved garages', note: 'Broader coverage for branded workshops and larger nationwide networks.', badge: null },
  { value: 200, label: '£200/hr', sub: 'Expert garages', note: 'Perfect for main dealers and specialists.', badge: null },
];

const EXCESS_OPTIONS = [
  { value: 0, sub: 'Pay nothing first' },
  { value: 50, sub: 'Lower upfront' },
  { value: 100, sub: 'Recommended' },
  { value: 150, sub: 'Lowest price' },
];

const DURATION_OPTIONS: { id: PaymentType; label: string; badge: { text: string; tone: 'orange' | 'green' } | null; perks: string[] }[] = [
  { id: '12months', label: '1-year cover', badge: null, perks: [] },
  { id: '24months', label: '2-year cover', badge: { text: 'Most popular', tone: 'orange' }, perks: ['No payments in year 2', 'Includes extra benefits'] },
  { id: '36months', label: '3-year cover', badge: { text: 'Best value', tone: 'green' }, perks: ['No payments in years 2 & 3', 'Includes extra benefits'] },
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
}) => {
  const [claimLimitDetailsOpen, setClaimLimitDetailsOpen] = React.useState(false);
  const [labourRateDetailsOpen, setLabourRateDetailsOpen] = React.useState(false);
  const [excessDetailsOpen, setExcessDetailsOpen] = React.useState(false);

  const isPremium = isPremiumVehicle(vehicleData?.make);
  const visibleClaimTiers = isPremium
    ? CLAIM_LIMIT_TIERS.filter(t => t.value !== 5000)
    : [...CLAIM_LIMIT_TIERS];

  // Per-duration monthly price calculation (mirrors logic inside PricingTable map)
  const computeDurationMonthly = (durationId: PaymentType): number => {
    if (voluntaryExcess === null || !selectedClaimLimit) return 0;
    const warrantyYears = durationId === '12months' ? 1 : durationId === '24months' ? 2 : 3;
    const vehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
    const basePrice = getPricingData(voluntaryExcess, selectedClaimLimit, durationId);
    const adjustedBasePrice = applyPriceAdjustment(basePrice, vehicleAdjustment);

    const durationMonths = durationId === '12months' ? 12 : durationId === '24months' ? 24 : 36;
    const labourMonthlyAdjust = selectedLabourRate === 50 ? -5 : selectedLabourRate === 70 ? 0 : selectedLabourRate === 100 ? 8 : selectedLabourRate === 200 ? 24 : 0;
    const labourTotalAdjust = labourMonthlyAdjust * durationMonths;

    const thisCardAutoIncluded = getAutoIncludedAddOns(durationId);
    const allPossibleAutoIncluded = ['breakdown', 'motFee', 'rental', 'tyre'];
    const cardAddOns = { ...selectedProtectionAddOns };
    allPossibleAutoIncluded.forEach(k => { cardAddOns[k] = thisCardAutoIncluded.includes(k); });
    const durationAddOnPrice = calculateAddOnPrice(cardAddOns, durationId, durationMonths);

    const cardPremiumSurcharge = getClaimLimitSurcharge(selectedClaimLimit, durationId, voluntaryExcess || 100);

    const total = adjustedBasePrice + labourTotalAdjust + durationAddOnPrice + cardPremiumSurcharge;
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

  const payInFull = monthlyPrice * 12;
  const savings = paymentType === '24months' ? 100 : paymentType === '36months' ? 200 : 0;

  const selectedTier = CLAIM_LIMIT_TIERS.find(t => t.value === selectedClaimLimit);
  const selectedLabour = LABOUR_OPTIONS.find(l => l.value === selectedLabourRate);
  const selectedDuration = DURATION_OPTIONS.find(d => d.id === paymentType);

  return (
    <div className="bg-[#f7f7f5] min-h-screen pb-32">
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
            {['Easy claims, fast payouts', 'Excellent 4.8 out of 5', '14-day money-back guarantee'].map((t) => (
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
            <Card>
              <SectionHead
                eyebrow="Cover level"
                title="How much cover do you need?"
                subtitle="Choose the repair limit that feels right for your car and budget."
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
                      <div className="text-[28px] font-extrabold tracking-[-0.04em] leading-none mb-1 text-[#161616]">
                        £{(tier.displayValue ?? tier.value).toLocaleString()}
                      </div>
                      <div className="text-[13px] font-bold text-[#333] mb-1">{tier.name}</div>
                      <div className="text-[12px] text-[#6c6c6c] leading-snug">per claim</div>
                    </OptionCard>
                  );
                })}
              </div>
              {validationErrors.claimLimit && (
                <p className="mt-3 text-sm text-red-600 font-medium">Please choose a claim limit to continue.</p>
              )}
            </Card>

            {/* CARD 2 - Labour Rate */}
            <Card>
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
                      <div className="text-[24px] font-extrabold tracking-[-0.04em] leading-none mb-1 text-[#161616]">{opt.label}</div>
                      <div className="text-[13px] font-bold text-[#333] mb-1">{opt.sub}</div>
                      <div className="text-[12px] text-[#6c6c6c] leading-snug">{opt.note}</div>
                    </OptionCard>
                  );
                })}
              </div>
              <div className="mt-3.5 bg-[#fbfffd] border border-[#dff2eb] text-[#206d4d] rounded-2xl px-4 py-3.5 text-sm font-bold flex items-center gap-2.5">
                <span className="w-[18px] h-[18px] rounded-full bg-[#eaf8f2] relative flex-shrink-0">
                  <Check className="w-3 h-3 text-[#1ca36f] absolute inset-0 m-auto" strokeWidth={3} />
                </span>
                Most drivers with similar cars choose this setup.
              </div>
            </Card>

            {/* CARD 3 - Term length */}
            <Card>
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
                  const save = d.id === '24months' ? 100 : d.id === '36months' ? 200 : 0;
                  return (
                    <OptionCard
                      key={d.id}
                      selected={selected}
                      badge={d.badge}
                      onClick={() => setPaymentType(d.id)}
                    >
                      <div className="text-[18px] font-extrabold tracking-[-0.04em] leading-none mb-1 text-[#161616]">{d.label}</div>
                      <div className="text-[13px] font-bold text-[#333] mb-1">Platinum Complete Plan</div>
                      <div className="mt-2 text-[30px] font-extrabold tracking-[-0.04em] leading-none text-[#161616]">
                        £{m}<span className="text-[15px] text-[#6c6c6c] font-semibold">/mo</span>
                      </div>
                      <div className="text-[12px] text-[#919191] mt-1">Equal to {dailyTxt}</div>
                      {save > 0 && <div className="mt-2.5 text-[#1ca36f] text-[13px] font-extrabold">Save £{save} today</div>}
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
            </Card>

            {/* CARD 4 - Excess */}
            <Card>
              <SectionHead
                eyebrow="Excess"
                title="Want to lower your monthly price?"
                subtitle="Choose how much you'd pay first if you ever make a claim."
                onDetails={() => setExcessDetailsOpen(true)}
              />
              <div className="grid grid-cols-4 gap-3 mb-4">
                {EXCESS_OPTIONS.map((opt) => {
                  const selected = voluntaryExcess === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setVoluntaryExcess(opt.value)}
                      className={cn(
                        'rounded-2xl border-[1.5px] py-4 px-3 text-center transition',
                        selected
                          ? 'border-[#f36b21] bg-gradient-to-b from-[#fffaf7] to-[#fff3ec] shadow-[0_0_0_3px_rgba(243,107,33,0.08)]'
                          : 'border-[#e4e4e2] bg-white hover:border-[#f3b58a]'
                      )}
                    >
                      <strong className="block text-[22px] tracking-[-0.04em] mb-1 text-[#161616]">£{opt.value}</strong>
                      <span className="text-[12px] text-[#6c6c6c] font-bold">{excessPillSubText(opt.value)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="border-l-4 border-[#f36b21] bg-[#faf9f7] rounded-2xl px-4 py-4 text-[#505050] text-sm leading-relaxed">
                Pay the first <strong>£{voluntaryExcess ?? 100}</strong> if you claim and we'll cover the rest up to your plan limit. This is the most common choice.
              </div>
              {validationErrors.voluntaryExcess && (
                <p className="mt-3 text-sm text-red-600 font-medium">Please select your excess amount before continuing.</p>
              )}
            </Card>

            {/* Price Beat */}
            <div className="flex items-center justify-between gap-4 bg-[#fffdf5] border border-[#f2e6bb] rounded-2xl px-5 py-4 shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
              <div>
                <strong className="block mb-1 text-[16px] text-[#161616]">Price Beat Guarantee</strong>
                <p className="m-0 text-[#6c6c6c] text-sm">Found a cheaper quote elsewhere? We'll beat it — guaranteed.</p>
              </div>
              <a href="/price-match" className="text-[#f36b21] font-extrabold whitespace-nowrap text-sm hover:underline">Beat my quote →</a>
            </div>
          </div>

          {/* RIGHT - Sticky summary */}
          <aside className="lg:sticky lg:top-6 grid gap-4">
            {/* Price card */}
            <div className="bg-gradient-to-b from-[#fffaf7] to-white border border-[#ffe0cf] rounded-[22px] overflow-hidden shadow-[0_16px_36px_rgba(243,107,33,0.08),0_10px_30px_rgba(16,24,40,0.06)]">
              <div className="p-[22px] pb-[18px] border-b border-[#f3ece7]">
                <div className="text-[#f36b21] text-[12px] font-extrabold tracking-[0.08em] uppercase mb-2.5">Live price</div>
                <div className="text-[16px] text-[#6c6c6c] mb-1.5 font-bold">Your personalised cover</div>
                <p className="text-[48px] leading-none tracking-[-0.06em] font-extrabold m-0 text-[#161616]">
                  £{monthlyPrice}<span className="text-[18px] text-[#6c6c6c] font-bold ml-1">/month</span>
                </p>
                <div className="mt-2.5 text-[#6c6c6c] text-sm font-semibold">
                  Equal to {dailyLabel} · 12 interest-free payments
                </div>
              </div>
              <div className="p-[18px] pt-4 grid gap-3">
                {selectedTier && (
                  <SummaryRow strong={`£${(selectedTier.displayValue ?? selectedTier.value).toLocaleString()} per claim`} sub={selectedTier.name} />
                )}
                {selectedLabour && (
                  <SummaryRow strong={`${selectedLabour.label} labour`} sub={selectedLabour.sub} />
                )}
                {selectedDuration && (
                  <SummaryRow strong={selectedDuration.label} sub="Platinum Complete Plan" />
                )}
                {voluntaryExcess !== null && (
                  <SummaryRow strong={`£${voluntaryExcess} excess`} sub={voluntaryExcess === 100 ? 'Recommended' : voluntaryExcess === 0 ? 'Pay nothing first' : voluntaryExcess === 150 ? 'Lowest price' : 'Lower upfront'} />
                )}
              </div>
            </div>

            {/* CTA card */}
            <div className="bg-white border border-[#e9e9e7] rounded-2xl shadow-[0_10px_30px_rgba(16,24,40,0.06)] p-[18px]">
              {savings > 0 && (
                <div className="bg-[#fffaf5] border border-[#ffe8d7] rounded-2xl px-3.5 py-3.5 text-[13px] text-[#624a3c] mb-3.5 leading-snug">
                  Pay in full for <strong>£{payInFull}</strong> and save <strong>£{savings}</strong> today versus the standard monthly plan.
                </div>
              )}
              <button
                onClick={onSelectPlan}
                className="w-full border-0 rounded-2xl bg-[#f36b21] hover:bg-[#df5d17] text-white font-extrabold text-base px-5 py-4 cursor-pointer shadow-[0_10px_22px_rgba(243,107,33,0.22)] transition"
              >
                Continue to checkout →
              </button>
              <div className="mt-3 text-center text-[#919191] text-[12px] font-semibold">
                Secure checkout · 14 days to cancel
              </div>
            </div>

            {/* Mini cards */}
            <div className="grid gap-3">
              <div className="bg-white border border-[#e9e9e7] rounded-2xl p-4 shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
                <h3 className="m-0 mb-3 text-base tracking-tight text-[#161616]">Your cover, made simple</h3>
                <ul className="m-0 p-0 list-none grid gap-2.5 text-sm text-[#4f4f4f]">
                  {['No hidden catches or surprise exclusions', 'Fast claims and quick payouts', '14-day money-back guarantee'].map(t => (
                    <li key={t} className="flex gap-2.5 items-start leading-snug">
                      <span className="w-[18px] h-[18px] rounded-full bg-[#eaf8f2] relative flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-[#1ca36f] absolute inset-0 m-auto" strokeWidth={3} />
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white border border-[#e9e9e7] rounded-2xl p-4 shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
                <h3 className="m-0 mb-3 text-base tracking-tight text-[#161616]">What's included</h3>
                <ul className="m-0 p-0 list-none grid gap-2.5 text-sm text-[#4f4f4f]">
                  {['Mechanical and electrical parts', 'Nationwide garage network', 'Labour and covered repair costs'].map(t => (
                    <li key={t} className="flex gap-2.5 items-start leading-snug">
                      <span className="w-[18px] h-[18px] rounded-full bg-[#eaf8f2] relative flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-[#1ca36f] absolute inset-0 m-auto" strokeWidth={3} />
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </section>
      </main>

      {/* Sticky bottom bar */}
      <div className="fixed left-0 right-0 bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#e9e9e7] shadow-[0_-12px_32px_rgba(16,24,40,0.06)]">
        <div className="max-w-[1180px] mx-auto px-7 py-3.5 flex items-center justify-between gap-[18px]">
          <div className="flex items-center gap-[18px] flex-wrap">
            <div className="text-[12px] text-[#6c6c6c] font-bold leading-tight">
              <div className="text-[#1ca36f] tracking-[1px] text-sm">★★★★★</div>
              Excellent · 4.8 out of 5
            </div>
            <div>
              <strong className="block text-sm text-[#161616]">{selectedDuration?.label ?? '2-year cover'} Platinum</strong>
              <span className="text-[#6c6c6c] text-[12px] font-semibold">Your cover</span>
            </div>
            <div className="text-[30px] leading-none tracking-[-0.05em] font-extrabold text-[#161616]">
              £{monthlyPrice}<span className="text-sm text-[#6c6c6c] font-bold ml-1">/month</span>
            </div>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="text-right text-[13px] text-[#6c6c6c] font-bold">
              <strong className="block text-[15px] text-[#161616]">Pay in full: £{payInFull}</strong>
              {savings > 0 && <span>Save £{savings} today</span>}
            </div>
            <button
              onClick={onSelectPlan}
              className="border-0 rounded-2xl bg-[#f36b21] hover:bg-[#df5d17] text-white font-extrabold text-[15px] px-5 py-3.5 cursor-pointer whitespace-nowrap transition"
            >
              Continue to checkout →
            </button>
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

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white border border-[#e9e9e7] rounded-[18px] shadow-[0_10px_30px_rgba(16,24,40,0.06)] overflow-hidden">
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
