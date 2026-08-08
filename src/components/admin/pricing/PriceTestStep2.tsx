import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { FlaskConical, PhoneCall, Info, RotateCcw } from 'lucide-react';
import { formatGBP } from '@/lib/pricingMatrix';
import { MANUAL_REFERRAL_MESSAGE } from './AgeBandPricingPreview';
import { useSavedPricingModel } from './useSavedPricingModel';
import RegLookupBar, { mapVehicleToBandKeys, type ResolvedTestVehicle } from './RegLookupBar';
import {
  getVisibleExcessOptions,
  getExcessMonthlyDelta,
  getExcessTotalAdjustment,
  type PaymentPeriod,
} from '@/lib/pricingMatrix';

import { calculateAddOnPrice } from '@/lib/addOnsUtils';
import { getExclusionReason, EXCLUSION_MESSAGE } from '@/lib/vehicleExclusions';
import {
  JOURNEY_DURATIONS,
  JOURNEY_EXCESS_OPTIONS,
  JOURNEY_CLAIM_TIERS,
  JOURNEY_LABOUR_OPTIONS,
  JOURNEY_BONUS_MONTHS,
  getJourneyAddOns,
  periodForMonths,
} from '@/lib/pricing/journeyOptions';

/** Per-day figures are shown in whole pence (or whole pounds) — never pounds-with-pence. */
const perDayLabel = (amount: number) =>
  amount < 1 ? `${Math.round(amount * 100)}p/day` : `£${Math.round(amount)}/day`;



/**
 * PRICE TESTING SANDBOX — a visual replica of Quotes & Orders "Step 2: Quote Details".
 * Nothing here writes to the database, sends quotes, or affects live Step 3/Step 4 pricing.
 * It exists so management can practise the proposed age/mileage/factor pricing model
 * in the same layout agents already use.
 */

/** Cover terms use the SAME labels, badges and perks the customer sees on Step 3. */
function buildTerms(twoYearMult: number, threeYearMult: number) {
  return JOURNEY_DURATIONS.map(d => ({
    key: d.key,
    label: d.label,
    badge: d.badge,
    months: d.months,
    perks: d.perks,
    period: d.id,
    mult: d.months === 24 ? twoYearMult : d.months === 36 ? threeYearMult : 1.0,
  }));
}

const LABOUR_META: Record<number, { title: string; badge: string }> = Object.fromEntries(
  JOURNEY_LABOUR_OPTIONS.map(l => [l.rate, { title: l.title, badge: l.badge }]),
);

const CLAIM_META: Record<number, { title: string; badge: string }> = Object.fromEntries(
  JOURNEY_CLAIM_TIERS.map(t => [t.value, { title: t.name, badge: t.badge }]),
);

/** Nearest configured factor, so a journey option is never left unpriced. */
function nearestFactor<T extends { factor: number }>(list: T[], pick: (item: T) => number, value: number): number {
  if (!list.length) return 1;
  const exact = list.find(item => pick(item) === value);
  if (exact) return exact.factor;
  const sorted = [...list].sort((a, b) => Math.abs(pick(a) - value) - Math.abs(pick(b) - value));
  return sorted[0]?.factor ?? 1;
}

/** Never sell below £399 for one year; 2/3 year floors follow the ×1.65 / ×2.35 multipliers. */
const MIN_SELLABLE_BY_TERM: Record<number, number> = {
  12: 399,
  24: 659,
  36: 938,
};



const DISCOUNTS = [
  { label: '£25 off', kind: 'flat' as const, value: 25 },
  { label: '£50 off', kind: 'flat' as const, value: 50 },
  { label: '5% off', kind: 'pct' as const, value: 5 },
  { label: '10% off', kind: 'pct' as const, value: 10 },
  { label: '15% off', kind: 'pct' as const, value: 15 },
  { label: '20% off', kind: 'pct' as const, value: 20 },
  { label: '25% off', kind: 'pct' as const, value: 25 },
  { label: '30% off', kind: 'pct' as const, value: 30 },
];


function OptionTile({
  selected,
  onClick,
  title,
  subtitle,
  badge,
  note,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
  note?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative rounded-lg border-2 p-3 text-left transition-colors',
        disabled
          ? 'cursor-not-allowed border-border bg-muted/40 opacity-50'
          : selected
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50',
      ].join(' ')}
    >
      {badge ? (
        <span className="absolute -top-2 right-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
          {badge}
        </span>
      ) : null}
      <div className="text-sm font-semibold">{title}</div>
      {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
      {note ? <div className="mt-1 text-xs font-medium text-primary">{note}</div> : null}
    </button>
  );
}

export interface PriceTestQuoteSnapshot {
  /** True when this profile refers out instead of auto-quoting. */
  referral: boolean;
  /** One-year-equivalent price before term multipliers. */
  annual: number | null;
  /** Total price per cover term, floors and options applied. */
  terms: { key: string; label: string; months: number; total: number }[];
}

export default function PriceTestStep2({
  liveModel,
  title,
  subtitle,
  badgeText,
  vehicle,
  showRegLookup = true,
  autoQuoteCeiling = null,
  onQuoteChange,
}: {
  liveModel?: any;
  title?: string;
  subtitle?: string;
  badgeText?: string;
  /** Vehicle resolved elsewhere (e.g. one shared reg box driving both columns). */
  vehicle?: ResolvedTestVehicle | null;
  showRegLookup?: boolean;
  /** Highest one-year-equivalent price allowed to auto-quote; above it the quote refers out. */
  autoQuoteCeiling?: number | null;
  /** Reports the priced terms so a parent can show an overall price difference. */
  onQuoteChange?: (snapshot: PriceTestQuoteSnapshot) => void;
} = {}) {



  // Always preview with the figures currently saved in the Price updates editor,
  // so a new labour rate (e.g. £150/hr) or changed factor shows up here on save.
  const savedModel = useSavedPricingModel();
  // While the editor below is open, follow what is typed there straight away —
  // no need to save first for the replica to reflect a changed factor.
  const {
    ageBands,
    mileageBands,
    powertrains,
    vehicleTypes,
    modelRisks,
    modelFloors,
    claimLimits,
    labourRateFactors,
    excessFactors,
    twoYearMult,
    threeYearMult,
    payInFullFactor,
  } = useMemo(() => {
    if (!liveModel) return savedModel;
    const use = <T,>(value: T[] | undefined, fallback: T[]) =>
      Array.isArray(value) && value.length ? value : fallback;
    return {
      ...savedModel,
      ageBands: use(liveModel.bands, savedModel.ageBands),
      mileageBands: use(liveModel.mileageBands, savedModel.mileageBands),
      powertrains: use(liveModel.powertrains, savedModel.powertrains),
      vehicleTypes: use(liveModel.vehicleTypes, savedModel.vehicleTypes),
      modelRisks: use(liveModel.modelRisks, savedModel.modelRisks),
      modelFloors: use(liveModel.modelFloors, savedModel.modelFloors),
      claimLimits: use(liveModel.claimLimits, savedModel.claimLimits),
      labourRateFactors: use(liveModel.labourRates, savedModel.labourRateFactors),
      excessFactors: use(liveModel.excessFactors, savedModel.excessFactors),
      twoYearMult: Number(liveModel.twoYearMult ?? savedModel.twoYearMult),
      threeYearMult: Number(liveModel.threeYearMult ?? savedModel.threeYearMult),
      payInFullFactor: Number(liveModel.payInFullFactor ?? savedModel.payInFullFactor),
    };
  }, [liveModel, savedModel]);

  const TERMS = useMemo(() => buildTerms(twoYearMult, threeYearMult), [twoYearMult, threeYearMult]);
  // Test vehicle profile (drives the proposed model)
  const [ageKey, setAgeKey] = useState('6-7');
  const [mileageKey, setMileageKey] = useState('80-100k');
  const [powertrainKey, setPowertrainKey] = useState('diesel');
  const [typeKey, setTypeKey] = useState('car');
  const [riskKey, setRiskKey] = useState('normal');
  const [floorKey, setFloorKey] = useState('none');
  const [ownVehicle, setOwnVehicle] = useState<ResolvedTestVehicle | null>(null);
  const activeVehicle = vehicle ?? ownVehicle;

  /** A looked-up reg drives the profile selects (age, mileage, powertrain, type, floor). */
  function applyVehicle(v: ResolvedTestVehicle) {
    const keys = mapVehicleToBandKeys(v, {
      ageBands,
      mileageBands,
      powertrains,
      vehicleTypes,
      modelFloors,
    });
    if (keys.ageKey) setAgeKey(keys.ageKey);
    if (keys.mileageKey) setMileageKey(keys.mileageKey);
    if (keys.powertrainKey) setPowertrainKey(keys.powertrainKey);
    if (keys.typeKey) setTypeKey(keys.typeKey);
    setFloorKey(keys.floorKey ?? 'none');
  }

  // Follow a vehicle supplied by a parent (shared reg box).
  useEffect(() => {
    if (vehicle) applyVehicle(vehicle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.reg, vehicle?.mileage, ageBands, mileageBands, powertrains, vehicleTypes, modelFloors]);



  // Cover options (mirrors agent Step 2)
  const [termKey, setTermKey] = useState<string>('24');
  const [labour, setLabour] = useState(70);
  const [excess, setExcess] = useState(150);
  const [claimLimit, setClaimLimit] = useState(2000);
  const [freeMonths, setFreeMonths] = useState(0);
  /** Chargeable add-ons exactly as the customer journey offers them (transfer included). */
  const [addOns, setAddOns] = useState<Record<string, boolean>>({});
  const [payInFull, setPayInFull] = useState(true);
  const [discount, setDiscount] = useState<{ label: string; kind: 'flat' | 'pct'; value: number } | null>(null);

  const ageBand = ageBands.find(b => b.key === ageKey) ?? ageBands[0];
  const mileageBand = mileageBands.find(b => b.key === mileageKey) ?? mileageBands[0];
  const powertrain = powertrains.find(p => p.key === powertrainKey) ?? powertrains[0];
  const vehType = vehicleTypes.find(v => v.key === typeKey) ?? vehicleTypes[0];
  const risk = modelRisks.find(r => r.key === riskKey) ?? modelRisks[0];
  const floor = modelFloors.find(f => f.key === floorKey) || null;
  const term = TERMS.find(t => t.key === termKey) ?? TERMS[0];

  // The option lists are the CUSTOMER JOURNEY lists, not the editor's rows — a
  // missing editor row is priced from the nearest factor instead of hiding the
  // option, so nothing can go live unpriced.

  // Nearest configured factor so every journey option (claim limit, labour rate,
  // excess) always prices, even if the editor is missing that exact row.
  const claimFactor = nearestFactor(claimLimits, c => c.limit, claimLimit);
  const labourFactor = nearestFactor(labourRateFactors, l => l.rate, labour);
  /**
   * Excess is NOT a multiplier any more. It is the SAME flat £/mo difference vs the
   * £100 "Balanced" baseline that Step 3/4 and Quotes & Orders use, applied once to
   * the whole-term total. Each term has its own stored delta table.
   */
  /** Excess is proportional to the term total, so it needs the base to price. */
  const excessAdjFor = (period: string, base: number) =>
    getExcessTotalAdjustment(period as PaymentPeriod, excess, base);

  /** Chargeable add-on total for the selected term, priced exactly like Step 3/4. */
  const addOnTotalFor = (months: number) =>
    calculateAddOnPrice(addOns, periodForMonths(months), months);

  /**
   * Excluded vehicle matrix — the same one the live journey uses. An excluded
   * make/model can never be priced, in a test or live, so there is no price to
   * push and no override here.
   */
  const exclusionReason = activeVehicle
    ? getExclusionReason(activeVehicle.make, activeVehicle.model)
    : null;

  const referral =
    !!exclusionReason ||
    ageBand.oneYear === null ||
    mileageBand.factor === null ||
    vehType.factor === null ||
    risk.factor === null ||
    (floor ? !floor.covered : false);

  const isMotorbike = typeKey === 'motorbike';
  /** Motorbikes price at 50% of a standard vehicle — the floors halve with the price. */
  const motorbikeFactor = isMotorbike ? 0.5 : 1;

  const calc = useMemo(() => {
    if (referral) return null;
    const annualBase =
      (ageBand.oneYear as number) *
      (mileageBand.factor as number) *
      (powertrain.factor as number) *
      (vehType.factor as number) *
      (risk.factor as number);
    const modelFloor = floor?.minOneYear ? floor.minOneYear * motorbikeFactor : null;
    const floored = modelFloor ? Math.max(annualBase, modelFloor) : annualBase;
    const annual = floored * claimFactor * labourFactor;
    /** Excess-neutral term total — used for the £250/£500 bracket basis. */
    const baseTermTotal = annual * term.mult;
    let total = baseTermTotal + excessAdjFor(term.period, baseTermTotal);

    let discountAmount = 0;
    if (discount) {
      discountAmount =
        discount.kind === 'flat' ? Math.min(discount.value, total) : Math.round((total * discount.value) / 100);
      total -= discountAmount;
    }
    const addOnTotal = addOnTotalFor(term.months);
    total += addOnTotal;
    total = Math.round(total);
    // Rule of thumb: never sell below £399 for one year (scaled by term multiplier).
    // Motorbikes sit at 50% of standard vehicle pricing, so the floor halves too.
    const minSellable = Math.round((MIN_SELLABLE_BY_TERM[term.months] ?? 399) * motorbikeFactor);
    const belowMinimum = total < minSellable;
    if (belowMinimum) total = minSellable;

    // We only offer 12 monthly instalments today, regardless of the cover term.
    // Whole pounds only — we never quote pence on an instalment.
    const monthly = Math.ceil(total / 12);
    const payInFullTotal = Math.round(total * payInFullFactor);
    const days = term.months * 30.42 + freeMonths * 30.42;
    return {
      annualBase,
      floored,
      annual,
      baseTermTotal,
      excessAdjustment: excessAdjFor(term.period, baseTermTotal),
      total,
      monthly,
      minSellable,
      belowMinimum,
      addOnTotal,
      payInFullTotal,
      payInFullSaving: total - payInFullTotal,
      discountAmount,
      perDay: total / days,
      payInFullPerDay: payInFullTotal / days,
      days: Math.round(days),
    };
  }, [
    referral, ageBand, mileageBand, powertrain, vehType, risk, floor, motorbikeFactor,
    claimFactor, labourFactor, excess, term, discount, addOns, freeMonths,
  ]);

  /** Every cover term priced with the same options — used for the overall price difference. */
  const termTotals = useMemo(() => {
    if (referral || !calc) return [];
    return TERMS.map(t => {
      // Each term applies its OWN stored excess delta table — never the 12mo one.
      const termBase = calc.annual * t.mult;
      let total = termBase + getExcessTotalAdjustment(t.period as PaymentPeriod, excess, termBase);
      if (discount) {
        total -=
          discount.kind === 'flat' ? Math.min(discount.value, total) : (total * discount.value) / 100;
      }
      total += addOnTotalFor(t.months);
      total = Math.round(total);
      const min = Math.round((MIN_SELLABLE_BY_TERM[t.months] ?? 399) * motorbikeFactor);
      return { key: t.key, label: t.label, months: t.months, total: Math.max(total, min) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referral, calc, TERMS, discount, addOns, motorbikeFactor, excess]);


  useEffect(() => {
    onQuoteChange?.({ referral, annual: calc ? calc.annual : null, terms: termTotals });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referral, calc?.annual, termTotals]);


  /** Auto-quote ceiling: a one-year-equivalent price above the cap refers out instead of
   *  showing a number we know does not convert. */
  const ceilingBreach = !!(autoQuoteCeiling && calc && calc.annual > autoQuoteCeiling);


  /**
   * Excess visibility uses the SAME rule as the live journey (pricingMatrix): the
   * £250/£500 tiers unlock on the excess-neutral (£100 baseline) term total, so
   * picking a cheaper excess can never hide the option just selected.
   */
  const visibleExcesses = useMemo(
    () => getVisibleExcessOptions(term.period, claimLimit, calc?.baseTermTotal ?? null),
    [term.period, claimLimit, calc?.baseTermTotal],
  );


  /** Add-ons exactly as Step 3/4 lists them for this term. */
  const journeyAddOns = useMemo(
    () => getJourneyAddOns(term.period, term.months),
    [term.period, term.months],
  );

  // Keep the excess valid the way Step 3 does when the term or claim limit changes.
  useEffect(() => {
    if (!visibleExcesses.includes(excess)) {
      setExcess(visibleExcesses.includes(150) ? 150 : visibleExcesses[0] ?? 100);
    }
  }, [visibleExcesses, excess]);


  function resetAll() {
    setTermKey('24');
    setLabour(70);
    setExcess(150);
    setClaimLimit(2000);
    setFreeMonths(0);
    setAddOns({});
    setDiscount(null);
    setPayInFull(true);
  }

  return (
    <Card className="border-2 border-dashed border-primary/40">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              {title ?? 'Price testing — Step 2 replica'}
            </CardTitle>
            <CardDescription>
              {subtitle ??
                'Same layout as Quotes & Orders Step 2, priced with the proposed age × mileage × factor model. Practice only — nothing here saves a quote or changes live pricing.'}
            </CardDescription>
          </div>
          <Badge variant="secondary">{badgeText ?? 'Test environment'}</Badge>
        </div>
      </CardHeader>


      <CardContent className="space-y-6">
        {/* Reg lookup — same DVLA + MOT sources as the homepage quote box */}
        {showRegLookup && (
          <RegLookupBar
            onResolved={v => {
              setOwnVehicle(v);
              applyVehicle(v);
            }}
          />
        )}

        {/* Test vehicle profile */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">Test vehicle profile</div>
            {activeVehicle && (
              <Badge variant="outline">
                {activeVehicle.reg} · {activeVehicle.make} {activeVehicle.model}
              </Badge>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="text-xs">Vehicle age</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={ageKey}
                onChange={e => setAgeKey(e.target.value)}
              >
                {ageBands.map(b => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Mileage</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={mileageKey}
                onChange={e => setMileageKey(e.target.value)}
              >
                {mileageBands.map(b => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Powertrain</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={powertrainKey}
                onChange={e => setPowertrainKey(e.target.value)}
              >
                {powertrains.map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Vehicle type</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={typeKey}
                onChange={e => setTypeKey(e.target.value)}
              >
                {vehicleTypes.map(v => (
                  <option key={v.key} value={v.key}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Model risk</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={riskKey}
                onChange={e => setRiskKey(e.target.value)}
              >
                {modelRisks.map(r => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Model floor / exclusion</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={floorKey}
                onChange={e => setFloorKey(e.target.value)}
              >
                <option value="none">None (standard vehicle)</option>
                {modelFloors.map(f => (
                  <option key={f.key} value={f.key}>{f.vehicle}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Step 2 heading, matching the agent screen */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div>
            <div className="text-base font-semibold">Step 2: Quote Details</div>
            <div className="text-sm text-muted-foreground">Configure cover options for this vehicle</div>
          </div>
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset options
          </Button>
        </div>

        {exclusionReason ? (
          <Alert className="border-destructive/60 bg-destructive/10">
            <PhoneCall className="h-4 w-4" />
            <AlertDescription>
              <span className="font-semibold">
                Excluded vehicle — no price, in test or live ({exclusionReason}).
              </span>{' '}
              {EXCLUSION_MESSAGE}
            </AlertDescription>
          </Alert>
        ) : referral ? (
          <Alert>
            <PhoneCall className="h-4 w-4" />
            <AlertDescription>
              <span className="font-semibold">No automatic quote for this profile.</span>{' '}
              {MANUAL_REFERRAL_MESSAGE}
            </AlertDescription>
          </Alert>
        ) : null}

        {ceilingBreach && calc ? (
          <Alert className="border-amber-500/60 bg-amber-500/10">
            <PhoneCall className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <span className="font-semibold">
                Over the auto-quote ceiling ({formatGBP(autoQuoteCeiling as number)} for one year).
              </span>{' '}
              One-year equivalent here is {formatGBP(Math.round(calc.annual))}, so this vehicle would go
              to manual underwriting rather than show a price that historically does not convert.
            </AlertDescription>
          </Alert>
        ) : null}


        <div className="grid gap-6 lg:grid-cols-3">
          {/* Options column */}
          <div className={`space-y-6 lg:col-span-2 ${referral ? 'pointer-events-none opacity-50' : ''}`}>
            {/* Cover duration — same three terms, labels and perks as Step 3 */}
            <div>
              <Label className="mb-2 block">Cover Duration</Label>
              <div className="grid grid-cols-3 gap-3">
                {TERMS.map(t => (
                  <OptionTile
                    key={t.key}
                    selected={termKey === t.key}
                    onClick={() => setTermKey(t.key)}
                    title={t.label}
                    subtitle={t.perks[0]}
                    badge={t.badge}
                    note={`${t.mult.toFixed(2)}× one-year`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {term.perks.join(' · ')} · always paid over 12 instalments
              </p>
            </div>

            {/* Labour rate — the four rates the customer journey offers */}
            <div>
              <Label className="mb-2 block">Labour Rate</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {JOURNEY_LABOUR_OPTIONS.map(l => (
                  <OptionTile
                    key={l.rate}
                    selected={labour === l.rate}
                    onClick={() => setLabour(l.rate)}
                    title={`£${l.rate}/hr`}
                    subtitle={l.title}
                    badge={l.badge}
                    note={`×${nearestFactor(labourRateFactors, x => x.rate, l.rate).toFixed(2)}`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Higher rate = more garage choice</p>
            </div>

            {/* Excess — canonical Step 3 options, priced as a flat £/mo difference */}
            <div>
              <Label className="mb-2 block">Excess Amount</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {JOURNEY_EXCESS_OPTIONS.map(e => {
                  const allowed = visibleExcesses.includes(e.value);
                  const delta = getExcessMonthlyDelta(term.period as PaymentPeriod, e.value);
                  return (
                    <OptionTile
                      key={e.value}
                      selected={excess === e.value}
                      onClick={() => allowed && setExcess(e.value)}
                      disabled={!allowed}
                      title={e.label}
                      subtitle={allowed ? e.description : 'Only on warranties over £500'}
                      note={
                        allowed
                          ? delta === 0
                            ? 'baseline'
                            : `${delta > 0 ? '+' : '−'}£${Math.abs(delta)}/mo`
                          : undefined
                      }
                    />
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Lower excess = higher monthly cost. Each tier is a flat £/mo difference vs the £100
                “Balanced” baseline, and £250/£500 only unlock on warranties of £500+ — exactly as on
                Step 3 and Quotes &amp; Orders.
              </p>
            </div>


            {/* Claim limit — the four AutoCare tiers the customer sees */}
            <div>
              <Label className="mb-2 block">Claim Limit 🚗</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {JOURNEY_CLAIM_TIERS.map(c => (
                  <OptionTile
                    key={c.value}
                    selected={claimLimit === c.value}
                    onClick={() => {
                      setClaimLimit(c.value);
                      // Excess availability is price-bracket driven now, not claim-limit driven.
                    }}
                    title={formatGBP(c.value)}
                    subtitle={c.name}
                    badge={c.badge}
                    note={`×${nearestFactor(claimLimits, x => x.limit, c.value).toFixed(2)}`}
                  />
                ))}
              </div>
            </div>

            {/* Add-ons — every add-on the customer journey shows, priced the same way */}
            <div>
              <Label className="mb-2 block">Add-ons (Step 3/Step 4 parity)</Label>
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium">✓ Included free on every term:</div>
                <div className="text-muted-foreground">
                  {journeyAddOns.filter(a => a.isAutoIncluded).map(a => a.name).join(' · ')}
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {journeyAddOns.filter(a => !a.isAutoIncluded).map(a => (
                  <div key={a.key} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                    <div>
                      <div className="text-sm font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.oneTimePrice ? `£${a.oneTimePrice} one-off` : `£${a.monthlyPrice}/mo · £${a.monthlyPrice * term.months} over the term`}
                      </div>
                    </div>
                    <Switch
                      checked={!!addOns[a.key]}
                      onCheckedChange={v => setAddOns(prev => ({ ...prev, [a.key]: v }))}
                    />
                  </div>
                ))}
              </div>
              {calc?.addOnTotal ? (
                <p className="mt-1 text-xs font-medium text-primary">
                  Add-ons add {formatGBP(calc.addOnTotal)} to this term.
                </p>
              ) : null}
            </div>

            {/* Optional extended cover */}
            <div>
              <Label className="mb-2 block">Optional Extended Cover</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {JOURNEY_BONUS_MONTHS.map(m => (
                  <OptionTile
                    key={m}
                    selected={freeMonths === m}
                    onClick={() => setFreeMonths(m)}
                    title={m === 0 ? 'None' : `+ ${m} month${m === 1 ? '' : 's'} free`}
                    subtitle={m === 0 ? 'No bonus months' : m === 1 ? '+1 month per year' : 'Adds cover, no extra cost'}
                  />
                ))}
              </div>
            </div>

            {/* Quick discounts */}
            <div>
              <Label className="mb-2 block">Quick discounts</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={discount === null ? 'default' : 'outline'}
                  onClick={() => setDiscount(null)}
                >
                  Reset price
                </Button>
                {DISCOUNTS.map(d => (
                  <Button
                    key={d.label}
                    size="sm"
                    variant={discount?.label === d.label ? 'default' : 'outline'}
                    onClick={() => setDiscount(d)}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Applied to the calculated total. 31% to 40% needs management authorisation on the live page.
              </p>
            </div>
          </div>

          {/* Summary column */}
          <div className="space-y-4">
            <div className="rounded-lg border-2 p-4">
              <div className="text-sm font-semibold">Monthly · Bumper (12 instalments)</div>
              <div className="text-3xl font-bold">
                {calc ? formatGBP(calc.monthly) : '—'}
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              {calc ? (
                <div className="text-xs text-muted-foreground">
                  12 payments only · equal to just {perDayLabel(calc.perDay)}
                </div>
              ) : null}

              <div className="mt-4 border-t pt-3">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Pay in Full · Stripe (10% off)</span>
                  <Switch checked={payInFull} onCheckedChange={setPayInFull} />
                </div>
                {calc ? (
                  <>
                    <div className="text-2xl font-bold">
                      {formatGBP(calc.payInFullTotal)}
                      <span className="ml-2 text-xs font-medium text-primary">
                        Save {formatGBP(calc.payInFullSaving)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Equal to just {perDayLabel(calc.payInFullPerDay)}
                    </div>
                  </>
                ) : null}
              </div>

              {calc ? (
                <div className="mt-4 space-y-1 border-t pt-3 text-xs text-muted-foreground">
                  <div className="text-sm font-semibold text-foreground">Total {formatGBP(calc.total)}</div>
                  <div>Claim {formatGBP(claimLimit)} · Labour £{labour}/hr · Excess £{excess}</div>
                  <div>
                    Cover runs {term.months + freeMonths} months ({calc.days} days) · paid over 12 instalments
                    {freeMonths ? ` · includes ${freeMonths} free months` : ''}
                  </div>
                  {calc.discountAmount ? <div>Discount applied: {formatGBP(calc.discountAmount)} off</div> : null}
                </div>
              ) : null}
            </div>

            {/* Working */}
            {calc ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-xs">
                <div className="mb-2 flex items-center gap-1 text-sm font-semibold">
                  <Info className="h-4 w-4" /> How this price was built
                </div>
                <div className="space-y-1">
                  <div>Age base ({ageBand.label}): {formatGBP(ageBand.oneYear as number)}</div>
                  <div>× Mileage {mileageBand.label}: ×{(mileageBand.factor as number).toFixed(2)}</div>
                  <div>× {powertrain.label}: ×{powertrain.factor.toFixed(2)}</div>
                  <div>× {vehType.label}: ×{(vehType.factor as number).toFixed(2)}</div>
                  <div>× {risk.label}: ×{(risk.factor as number).toFixed(2)}</div>
                  {floor?.minOneYear ? <div>Floor ({floor.vehicle}): min {formatGBP(Math.round(floor.minOneYear * motorbikeFactor))}{isMotorbike ? ' (halved for motorbikes)' : ''}</div> : null}
                  {isMotorbike ? <div className="font-medium text-primary">Motorbike: 50% of standard vehicle pricing (floor {formatGBP(calc.minSellable)})</div> : null}

                  <div className="pt-1">Adjusted one-year base: {formatGBP(Math.round(calc.floored))}</div>
                  <div>× Claim limit: ×{claimFactor.toFixed(2)} · × Labour: ×{labourFactor.toFixed(2)}</div>
                  <div>One-year price: {formatGBP(Math.round(calc.annual))}</div>
                  <div>× Term {term.label}: ×{term.mult.toFixed(2)}</div>
                  <div>
                    Excess £{excess}: {(() => {
                      const adj = calc?.excessAdjustment ?? 0;
                      const perMo = Math.round(adj / 12);
                      return perMo === 0 ? 'baseline (£100 Balanced)' : `${perMo > 0 ? '+' : '−'}£${Math.abs(perMo)}/mo`;
                    })()}
                    {calc?.excessAdjustment ? ` (${calc.excessAdjustment > 0 ? '+' : '−'}${formatGBP(Math.abs(calc.excessAdjustment))} on the total)` : ''}
                  </div>

                  {calc.addOnTotal ? <div>+ Add-ons: {formatGBP(calc.addOnTotal)}</div> : null}
                  {calc.belowMinimum ? (
                    <div className="text-destructive">
                      Raised to minimum sellable price {formatGBP(calc.minSellable)} ({term.label})
                    </div>
                  ) : null}
                  <div className="pt-1 font-semibold text-foreground">Term total: {formatGBP(calc.total)}</div>
                  <div>÷ 12 instalments: {formatGBP(calc.monthly)}/month (only 12-payment plans available today)</div>


                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>Save Quote</Button>
              <Button variant="outline" size="sm" disabled>Preview Quote</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Buttons are disabled on purpose — this page never sends a quote or takes payment.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
