import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { FlaskConical, PhoneCall, Info, RotateCcw } from 'lucide-react';
import { formatGBP } from '@/lib/pricingMatrix';
import {
  PROPOSED_AGE_BANDS,
  PROPOSED_MILEAGE_BANDS,
  PROPOSED_POWERTRAIN_FACTORS,
  PROPOSED_VEHICLE_TYPE_FACTORS,
  PROPOSED_MODEL_RISK_FACTORS,
  PROPOSED_MODEL_FLOORS,
  PROPOSED_CLAIM_LIMIT_FACTORS,
  PROPOSED_LABOUR_RATE_FACTORS,
  PROPOSED_EXCESS_FACTORS,
  MANUAL_REFERRAL_MESSAGE,
} from './AgeBandPricingPreview';

/**
 * PRICE TESTING SANDBOX — a visual replica of Quotes & Orders "Step 2: Quote Details".
 * Nothing here writes to the database, sends quotes, or affects live Step 3/Step 4 pricing.
 * It exists so management can practise the proposed age/mileage/factor pricing model
 * in the same layout agents already use.
 */

const TERMS = [
  { key: '12', label: '1-Year Cover', badge: 'POPULAR', months: 12, mult: 1.0 },
  { key: '24', label: '2-Year Cover', badge: 'BEST VALUE', months: 24, mult: 1.65 },
  { key: '36', label: '3-Year Cover', badge: '', months: 36, mult: 2.35 },
] as const;

const LABOUR_META: Record<number, { title: string; badge: string }> = {
  50: { title: 'Local Garages', badge: 'BEST VALUE' },
  70: { title: 'Independent Garages', badge: 'POPULAR' },
  100: { title: 'Approved Garages', badge: '' },
  200: { title: 'Expert Garages', badge: '' },
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

const PAY_IN_FULL_FACTOR = 0.9;

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

export default function PriceTestStep2() {
  // Test vehicle profile (drives the proposed model)
  const [ageKey, setAgeKey] = useState('6-7');
  const [mileageKey, setMileageKey] = useState('80-100k');
  const [powertrainKey, setPowertrainKey] = useState('diesel');
  const [typeKey, setTypeKey] = useState('car');
  const [riskKey, setRiskKey] = useState('normal');
  const [floorKey, setFloorKey] = useState('none');

  // Cover options (mirrors agent Step 2)
  const [termKey, setTermKey] = useState<string>('24');
  const [labour, setLabour] = useState(70);
  const [excess, setExcess] = useState(150);
  const [claimLimit, setClaimLimit] = useState(2000);
  const [freeMonths, setFreeMonths] = useState(0);
  const [transferCover, setTransferCover] = useState(false);
  const [payInFull, setPayInFull] = useState(true);
  const [discount, setDiscount] = useState<{ label: string; kind: 'flat' | 'pct'; value: number } | null>(null);

  const ageBand = PROPOSED_AGE_BANDS.find(b => b.key === ageKey)!;
  const mileageBand = PROPOSED_MILEAGE_BANDS.find(b => b.key === mileageKey)!;
  const powertrain = PROPOSED_POWERTRAIN_FACTORS.find(p => p.key === powertrainKey)!;
  const vehType = PROPOSED_VEHICLE_TYPE_FACTORS.find(v => v.key === typeKey)!;
  const risk = PROPOSED_MODEL_RISK_FACTORS.find(r => r.key === riskKey)!;
  const floor = PROPOSED_MODEL_FLOORS.find(f => f.key === floorKey) || null;
  const term = TERMS.find(t => t.key === termKey)!;

  const claimFactor = PROPOSED_CLAIM_LIMIT_FACTORS.find(c => c.limit === claimLimit)?.factor ?? 1;
  const labourFactor = PROPOSED_LABOUR_RATE_FACTORS.find(l => l.rate === labour)?.factor ?? 1;
  const excessFactor = PROPOSED_EXCESS_FACTORS.find(e => e.excess === excess)?.factor ?? 1;

  const referral =
    ageBand.oneYear === null ||
    mileageBand.factor === null ||
    vehType.factor === null ||
    risk.factor === null ||
    (floor ? !floor.covered : false);

  const calc = useMemo(() => {
    if (referral) return null;
    const annualBase =
      (ageBand.oneYear as number) *
      (mileageBand.factor as number) *
      (powertrain.factor as number) *
      (vehType.factor as number) *
      (risk.factor as number);
    const floored = floor?.minOneYear ? Math.max(annualBase, floor.minOneYear) : annualBase;
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
    const minSellable = MIN_SELLABLE_BY_TERM[term.months] ?? 399;
    const belowMinimum = total < minSellable;
    if (belowMinimum) total = minSellable;
    // We only offer 12 monthly instalments today, regardless of the cover term.
    const monthly = Math.round((total / 12) * 100) / 100;
    const payInFullTotal = Math.round(total * PAY_IN_FULL_FACTOR);
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
    referral, ageBand, mileageBand, powertrain, vehType, risk, floor,
    claimFactor, labourFactor, excessFactor, term, discount, transferCover, freeMonths,
  ]);

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
              Price testing — Step 2 replica
            </CardTitle>
            <CardDescription>
              Same layout as Quotes &amp; Orders Step 2, priced with the proposed age × mileage × factor
              model. Practice only — nothing here saves a quote or changes live pricing.
            </CardDescription>
          </div>
          <Badge variant="secondary">Test environment</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Test vehicle profile */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="mb-3 text-sm font-semibold">Test vehicle profile</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="text-xs">Vehicle age</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={ageKey}
                onChange={e => setAgeKey(e.target.value)}
              >
                {PROPOSED_AGE_BANDS.map(b => (
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
                {PROPOSED_MILEAGE_BANDS.map(b => (
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
                {PROPOSED_POWERTRAIN_FACTORS.map(p => (
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
                {PROPOSED_VEHICLE_TYPE_FACTORS.map(v => (
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
                {PROPOSED_MODEL_RISK_FACTORS.map(r => (
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
                {PROPOSED_MODEL_FLOORS.map(f => (
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
                {PROPOSED_LABOUR_RATE_FACTORS.map(l => (
                  <OptionTile
                    key={l.key}
                    selected={labour === l.rate}
                    onClick={() => setLabour(l.rate)}
                    title={`£${l.rate}/hr`}
                    subtitle={LABOUR_META[l.rate]?.title}
                    badge={LABOUR_META[l.rate]?.badge}
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
                {PROPOSED_EXCESS_FACTORS.map(e => {
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
                {PROPOSED_CLAIM_LIMIT_FACTORS.map(c => (
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

            {/* Free extended cover */}
            <div>
              <Label className="mb-2 block">Free Extended Cover</Label>
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
                    Over {term.months + freeMonths} months ({calc.days} days)
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
                  {floor?.minOneYear ? <div>Floor ({floor.vehicle}): min {formatGBP(floor.minOneYear)}</div> : null}
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
