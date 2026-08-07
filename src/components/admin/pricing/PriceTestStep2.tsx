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


/**
 * PRICE TESTING SANDBOX — a visual replica of Quotes & Orders "Step 2: Quote Details".
 * Nothing here writes to the database, sends quotes, or affects live Step 3/Step 4 pricing.
 * It exists so management can practise the proposed age/mileage/factor pricing model
 * in the same layout agents already use.
 */

function buildTerms(twoYearMult: number, threeYearMult: number) {
  return [
    { key: '12', label: '1-Year Cover', badge: 'POPULAR', months: 12, mult: 1.0 },
    { key: '24', label: '2-Year Cover', badge: 'BEST VALUE', months: 24, mult: twoYearMult },
    { key: '36', label: '3-Year Cover', badge: '', months: 36, mult: threeYearMult },
  ];
}

const LABOUR_META: Record<number, { title: string; badge: string }> = {
  50: { title: 'Local Garages', badge: 'BEST VALUE' },
  70: { title: 'Independent Garages', badge: 'POPULAR' },
  100: { title: 'Approved Garages', badge: '' },
  150: { title: 'Specialist garages', badge: '' },
};

const CLAIM_META: Record<number, { title: string; badge: string }> = {
  1000: { title: 'AutoCare Basic', badge: 'POPULAR' },
  2000: { title: 'AutoCare Essential', badge: '' },
  3000: { title: 'AutoCare Elite', badge: '' },
  5000: { title: 'AutoCare Premium', badge: '' },
};

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

export default function PriceTestStep2({
  liveModel,
  title,
  subtitle,
  badgeText,
  vehicle,
  showRegLookup = true,
  autoQuoteCeiling = null,
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
  const [transferCover, setTransferCover] = useState(false);
  const [payInFull, setPayInFull] = useState(true);
  const [discount, setDiscount] = useState<{ label: string; kind: 'flat' | 'pct'; value: number } | null>(null);

  const ageBand = ageBands.find(b => b.key === ageKey) ?? ageBands[0];
  const mileageBand = mileageBands.find(b => b.key === mileageKey) ?? mileageBands[0];
  const powertrain = powertrains.find(p => p.key === powertrainKey) ?? powertrains[0];
  const vehType = vehicleTypes.find(v => v.key === typeKey) ?? vehicleTypes[0];
  const risk = modelRisks.find(r => r.key === riskKey) ?? modelRisks[0];
  const floor = modelFloors.find(f => f.key === floorKey) || null;
  const term = TERMS.find(t => t.key === termKey) ?? TERMS[0];

  // Keep the selection valid when a rate/excess/limit is removed or renumbered in the editor.
  useEffect(() => {
    if (labourRateFactors.length && !labourRateFactors.some(l => l.rate === labour)) {
      setLabour(labourRateFactors[0].rate);
    }
  }, [labourRateFactors, labour]);
  useEffect(() => {
    if (excessFactors.length && !excessFactors.some(e => e.excess === excess)) {
      setExcess(excessFactors[0].excess);
    }
  }, [excessFactors, excess]);
  useEffect(() => {
    if (claimLimits.length && !claimLimits.some(c => c.limit === claimLimit)) {
      setClaimLimit(claimLimits[0].limit);
    }
  }, [claimLimits, claimLimit]);

  const claimFactor = claimLimits.find(c => c.limit === claimLimit)?.factor ?? 1;
  const labourFactor = labourRateFactors.find(l => l.rate === labour)?.factor ?? 1;
  const excessFactor = excessFactors.find(e => e.excess === excess)?.factor ?? 1;

  const referral =
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
    const annual = floored * claimFactor * labourFactor * excessFactor;
    let total = annual * term.mult;
    let discountAmount = 0;
    if (discount) {
      discountAmount =
        discount.kind === 'flat' ? Math.min(discount.value, total) : Math.round((total * discount.value) / 100);
      total -= discountAmount;
    }
    if (transferCover) total += 19;
    total = Math.round(total);
    // Rule of thumb: never sell below £399 for one year (scaled by term multiplier).
    // Motorbikes sit at 50% of standard vehicle pricing, so the floor halves too.
    const minSellable = Math.round((MIN_SELLABLE_BY_TERM[term.months] ?? 399) * motorbikeFactor);
    const belowMinimum = total < minSellable;
    if (belowMinimum) total = minSellable;

    // We only offer 12 monthly instalments today, regardless of the cover term.
    const monthly = Math.round((total / 12) * 100) / 100;
    const payInFullTotal = Math.round(total * payInFullFactor);
    const days = term.months * 30.42 + freeMonths * 30.42;
    return {
      annualBase,
      floored,
      annual,
      total,
      monthly,
      minSellable,
      belowMinimum,
      payInFullTotal,
      payInFullSaving: total - payInFullTotal,
      discountAmount,
      perDay: total / days,
      payInFullPerDay: payInFullTotal / days,
      days: Math.round(days),
    };
  }, [
    referral, ageBand, mileageBand, powertrain, vehType, risk, floor, motorbikeFactor,
    claimFactor, labourFactor, excessFactor, term, discount, transferCover, freeMonths,
  ]);

  /** Auto-quote ceiling: a one-year-equivalent price above the cap refers out instead of
   *  showing a number we know does not convert. */
  const ceilingBreach = !!(autoQuoteCeiling && calc && calc.annual > autoQuoteCeiling);


  function excessAllowed(exValue: number) {
    // Customer-value guardrail: never show an excess above 25% of the claim limit,
    // and never pair a £500 excess with a £1,000 claim limit.
    if (exValue > claimLimit * 0.25) return false;
    if (exValue === 500 && claimLimit < 3000) return false;
    // No £500 excess on one-year cover.
    if (exValue === 500 && term.months === 12) return false;
    return true;
  }


  function resetAll() {
    setTermKey('24');
    setLabour(70);
    setExcess(150);
    setClaimLimit(2000);
    setFreeMonths(0);
    setTransferCover(false);
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

        {referral ? (
          <Alert>
            <PhoneCall className="h-4 w-4" />
            <AlertDescription>
              <span className="font-semibold">No automatic quote for this profile.</span>{' '}
              {MANUAL_REFERRAL_MESSAGE}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Options column */}
          <div className={`space-y-6 lg:col-span-2 ${referral ? 'pointer-events-none opacity-50' : ''}`}>
            {/* Cover duration */}
            <div>
              <Label className="mb-2 block">Cover Duration</Label>
              <div className="grid grid-cols-3 gap-3">
                {TERMS.map(t => (
                  <OptionTile
                    key={t.key}
                    selected={termKey === t.key}
                    onClick={() => setTermKey(t.key)}
                    title={t.label}
                    subtitle={`${t.mult.toFixed(2)}× one-year`}
                    badge={t.badge}
                  />
                ))}
              </div>
            </div>

            {/* Labour rate */}
            <div>
              <Label className="mb-2 block">Labour Rate</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {labourRateFactors.map(l => (
                  <OptionTile
                    key={l.key}
                    selected={labour === l.rate}
                    onClick={() => setLabour(l.rate)}
                    title={`£${l.rate}/hr`}
                    subtitle={LABOUR_META[l.rate]?.title ?? l.uxPosition}
                    badge={LABOUR_META[l.rate]?.badge ?? ''}
                    note={`×${l.factor.toFixed(2)}`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Higher rate = more garage choice</p>
            </div>

            {/* Excess */}
            <div>
              <Label className="mb-2 block">Excess Amount</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {excessFactors.map(e => {
                  const allowed = excessAllowed(e.excess);
                  return (
                    <OptionTile
                      key={e.key}
                      selected={excess === e.excess}
                      onClick={() => allowed && setExcess(e.excess)}
                      disabled={!allowed}
                      title={`£${e.excess}`}
                      subtitle={allowed ? e.uxPosition : 'Not shown with this claim limit'}
                      note={allowed ? `×${e.factor.toFixed(2)}` : undefined}
                    />
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Lower excess = higher monthly cost. Excess is never shown above 25% of the claim limit.
              </p>
            </div>

            {/* Claim limit */}
            <div>
              <Label className="mb-2 block">Claim Limit 🚗</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {claimLimits.map(c => (
                  <OptionTile
                    key={c.key}
                    selected={claimLimit === c.limit}
                    onClick={() => {
                      setClaimLimit(c.limit);
                      if (excess > c.limit * 0.25 || (excess === 500 && c.limit < 3000)) setExcess(150);
                    }}
                    title={formatGBP(c.limit)}
                    subtitle={CLAIM_META[c.limit]?.title}
                    badge={CLAIM_META[c.limit]?.badge}
                    note={`×${c.factor.toFixed(2)}`}
                  />
                ))}
              </div>
            </div>

            {/* Add-ons */}
            <div>
              <Label className="mb-2 block">Optional Add-ons</Label>
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium">✓ Included free with 2-Year and 3-Year Cover:</div>
                <div className="text-muted-foreground">Vehicle Recovery · Hire Car · European Cover</div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Transfer Cover</div>
                  <div className="text-xs text-muted-foreground">£19 one-off · transfer warranty to new owner</div>
                </div>
                <Switch checked={transferCover} onCheckedChange={setTransferCover} />
              </div>
            </div>

            {/* Optional extended cover */}
            <div>
              <Label className="mb-2 block">Optional Extended Cover</Label>
              <div className="grid grid-cols-3 gap-3">
                {[0, 3, 6].map(m => (
                  <OptionTile
                    key={m}
                    selected={freeMonths === m}
                    onClick={() => setFreeMonths(m)}
                    title={m === 0 ? 'None' : `+ ${m} Months Free`}
                    subtitle={m === 0 ? 'No bonus months' : 'Adds cover, no extra cost'}
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
                {calc ? `£${calc.monthly.toFixed(2)}` : '—'}
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              {calc ? (
                <div className="text-xs text-muted-foreground">
                  12 payments only · equal to just £{calc.perDay.toFixed(2)}/day
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
                      Equal to just £{calc.payInFullPerDay.toFixed(2)}/day
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
                  <div>× Claim limit: ×{claimFactor.toFixed(2)} · × Labour: ×{labourFactor.toFixed(2)} · × Excess: ×{excessFactor.toFixed(2)}</div>
                  <div>One-year price: {formatGBP(Math.round(calc.annual))}</div>
                  <div>× Term {term.label}: ×{term.mult.toFixed(2)}</div>
                  {transferCover ? <div>+ Transfer cover: £19</div> : null}
                  {calc.belowMinimum ? (
                    <div className="text-destructive">
                      Raised to minimum sellable price {formatGBP(calc.minSellable)} ({term.label})
                    </div>
                  ) : null}
                  <div className="pt-1 font-semibold text-foreground">Term total: {formatGBP(calc.total)}</div>
                  <div>÷ 12 instalments: £{calc.monthly.toFixed(2)}/month (only 12-payment plans available today)</div>


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
