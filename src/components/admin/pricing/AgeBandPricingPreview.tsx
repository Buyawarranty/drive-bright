import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Info, PhoneCall } from 'lucide-react';
import { formatGBP } from '@/lib/pricingMatrix';

export type AgeBand = {
  key: string;
  label: string;
  oneYear: number | null;
  treatment: string;
};

/**
 * Proposed age-based pricing model (Aug 2026).
 * Replaces the old mileage split (under/over 120k) as the primary driver.
 * PREVIEW ONLY — nothing here touches Quotes & Orders or live Step 3/4 pricing.
 */
export const PROPOSED_AGE_BANDS: AgeBand[] = [
  { key: '1-3', label: '1–3 years', oneYear: 399, treatment: 'Lowest base tier' },
  { key: '4-5', label: '4–5 years', oneYear: 449, treatment: 'Low-risk age band' },
  { key: '6-7', label: '6–7 years', oneYear: 499, treatment: 'Medium-low age band' },
  { key: '8-9', label: '8–9 years', oneYear: 549, treatment: 'Medium age band' },
  { key: '10-11', label: '10–11 years', oneYear: 649, treatment: 'Higher-age band' },
  { key: '12', label: '12 years', oneYear: 699, treatment: 'High age band' },
  { key: '13', label: '13 years', oneYear: 799, treatment: 'Provisional; tighter term rules' },
  { key: '14', label: '14 years', oneYear: 849, treatment: 'Provisional; tighter term rules' },
  { key: '15', label: '15 years', oneYear: 899, treatment: 'Provisional; tighter term rules' },
  { key: '15+', label: 'Over 15 years', oneYear: null, treatment: 'Decline or manual referral' },
];

export type MileageBand = {
  key: string;
  label: string;
  min: number;
  max: number | null;
  factor: number | null;
  customerLabel: string;
};

/** Mileage factors (Aug 2026 proposal) — applied on top of the age band base price. */
export const PROPOSED_MILEAGE_BANDS: MileageBand[] = [
  { key: '0-40k', label: '0–40,000', min: 0, max: 40000, factor: 1.0, customerLabel: 'Lower mileage' },
  { key: '40-60k', label: '40,001–60,000', min: 40001, max: 60000, factor: 1.0, customerLabel: 'Lower mileage' },
  { key: '60-80k', label: '60,001–80,000', min: 60001, max: 80000, factor: 1.05, customerLabel: 'Typical mileage' },
  { key: '80-100k', label: '80,001–100,000', min: 80001, max: 100000, factor: 1.1, customerLabel: 'Higher mileage' },
  { key: '100-120k', label: '100,001–120,000', min: 100001, max: 120000, factor: 1.15, customerLabel: 'Higher mileage' },
  { key: '120-150k', label: '120,001–150,000', min: 120001, max: 150000, factor: 1.25, customerLabel: 'High mileage' },
  { key: '150k+', label: 'Over 150,000', min: 150001, max: null, factor: null, customerLabel: 'Decline or manual referral' },
];

export type PowertrainFactor = {
  key: string;
  label: string;
  factor: number;
  treatment: string;
};

/** Powertrain factors (Aug 2026 proposal) — applied after age × mileage. */
export const PROPOSED_POWERTRAIN_FACTORS: PowertrainFactor[] = [
  { key: 'petrol', label: 'Petrol', factor: 1.0, treatment: 'Reference powertrain' },
  { key: 'diesel', label: 'Diesel', factor: 1.05, treatment: 'Modest uplift; mileage remains the stronger input' },
  { key: 'hev', label: 'Full hybrid / HEV', factor: 1.0, treatment: 'No automatic premium without model evidence' },
  { key: 'phev', label: 'Plug-in hybrid / PHEV', factor: 1.08, treatment: 'Complexity allowance; monitor by model' },
  { key: 'ev', label: 'Battery electric / EV', factor: 1.08, treatment: 'No blanket premium where traction battery is excluded' },
];

export type RiskFactor = {
  key: string;
  label: string;
  /** null = no automatic price (manual underwriting) */
  factor: number | null;
  use: string;
};

/** 4.4 Vehicle type and model-risk factors — applied after powertrain. */
export const PROPOSED_VEHICLE_TYPE_FACTORS: RiskFactor[] = [
  { key: 'car', label: 'Passenger car', factor: 1.0, use: 'Reference vehicle type' },
  { key: 'van', label: 'Van', factor: 1.12, use: 'Provisional commercial-vehicle uplift' },
];

export const PROPOSED_MODEL_RISK_FACTORS: RiskFactor[] = [
  { key: 'low', label: 'Low model risk', factor: 0.95, use: 'Strong reliability and lower repair-cost exposure' },
  { key: 'normal', label: 'Normal model risk', factor: 1.0, use: 'Default band' },
  { key: 'high', label: 'High model risk', factor: 1.1, use: 'Higher repair frequency or severity' },
  { key: 'veryhigh', label: 'Very high model risk', factor: 1.2, use: 'Materially higher expected cost' },
  { key: 'referral', label: 'Referral', factor: null, use: 'Manual underwriting decision' },
];

export type ModelFloor = {
  key: string;
  vehicle: string;
  /** null = referral or exclusion, no automatic price */
  minOneYear: number | null;
  treatment: string;
  covered: boolean;
};

/** 4.5 Model-specific floors and referrals. */
export const PROPOSED_MODEL_FLOORS: ModelFloor[] = [
  { key: 'rr-autobiography', vehicle: 'Range Rover Autobiography', minOneYear: 899, treatment: 'Premium floor', covered: true },
  { key: 'rr-sport', vehicle: 'Range Rover Sport', minOneYear: 799, treatment: 'Premium floor', covered: true },
  { key: 'rr-discovery', vehicle: 'Range Rover Discovery', minOneYear: 699, treatment: 'Premium floor', covered: true },
  { key: 'tesla', vehicle: 'Tesla', minOneYear: 799, treatment: 'Premium EV floor', covered: true },
  { key: 'porsche-911', vehicle: 'Porsche 911', minOneYear: null, treatment: 'Not covered', covered: false },
  { key: 'audi-rs-r8', vehicle: 'Audi RS and R8', minOneYear: null, treatment: 'Not covered — referral or exclusion', covered: false },
  { key: 'bmw-m', vehicle: 'BMW M derivatives', minOneYear: null, treatment: 'Not covered — referral or exclusion', covered: false },
  { key: 'bentley-maserati', vehicle: 'Bentley / Maserati', minOneYear: null, treatment: 'Not covered — referral or exclusion', covered: false },
];

export type ClaimLimitFactor = {
  key: string;
  limit: number;
  factor: number;
  uxPosition: string;
};

/** 5.1 Customer-selected cover options — claim-limit factors. */
export const PROPOSED_CLAIM_LIMIT_FACTORS: ClaimLimitFactor[] = [
  { key: 'cl-1000', limit: 1000, factor: 0.8, uxPosition: 'Lower-price option' },
  { key: 'cl-2000', limit: 2000, factor: 1.0, uxPosition: 'Recommended reference option' },
  { key: 'cl-3000', limit: 3000, factor: 1.15, uxPosition: 'Higher protection' },
  { key: 'cl-5000', limit: 5000, factor: 1.4, uxPosition: 'Maximum protection' },
];

export type LabourRateFactor = {
  key: string;
  rate: number;
  factor: number;
  uxPosition: string;
};

/** 5.2 Customer-selected cover options — labour-rate factors. */
export const PROPOSED_LABOUR_RATE_FACTORS: LabourRateFactor[] = [
  { key: 'lr-50', rate: 50, factor: 0.84, uxPosition: 'Budget garage option' },
  { key: 'lr-70', rate: 70, factor: 1.0, uxPosition: 'Most popular / reference' },
  { key: 'lr-100', rate: 100, factor: 1.18, uxPosition: 'Broader garage choice' },
  { key: 'lr-200', rate: 200, factor: 1.4, uxPosition: 'Premium / specialist repairers' },
];

export type ExcessFactor = {
  key: string;
  excess: number;
  factor: number;
  uxPosition: string;
};

/** 5.3 Customer-selected cover options — excess factors. */
export const PROPOSED_EXCESS_FACTORS: ExcessFactor[] = [
  { key: 'ex-0', excess: 0, factor: 1.25, uxPosition: 'No contribution toward an approved claim; higher price' },
  { key: 'ex-150', excess: 150, factor: 1.0, uxPosition: 'Recommended / best balance' },
  { key: 'ex-250', excess: 250, factor: 0.94, uxPosition: 'Lower-price option' },
];

export const MANUAL_REFERRAL_MESSAGE =
  'We can still help with this vehicle, but it needs a quick manual review. Please call our sales line on 0330 229 5040 or request a callback and one of the team will come straight back to you.';

export const OVER_15_REFERRAL_MESSAGE =
  'We can still help with this vehicle, but it needs a quick manual review. Please call our sales line on 0330 229 5040 or request a callback and one of the team will come straight back to you.';

export default function AgeBandPricingPreview() {
  const [bands, setBands] = useState<AgeBand[]>(PROPOSED_AGE_BANDS);
  const [twoYearMult, setTwoYearMult] = useState(1.6);
  const [threeYearMult, setThreeYearMult] = useState(2.2);
  const [websiteDiscountPct, setWebsiteDiscountPct] = useState(10);
  const [mileageBands, setMileageBands] = useState<MileageBand[]>(PROPOSED_MILEAGE_BANDS);
  const [powertrains, setPowertrains] = useState<PowertrainFactor[]>(PROPOSED_POWERTRAIN_FACTORS);
  const [vehicleTypes, setVehicleTypes] = useState<RiskFactor[]>(PROPOSED_VEHICLE_TYPE_FACTORS);
  const [modelRisks, setModelRisks] = useState<RiskFactor[]>(PROPOSED_MODEL_RISK_FACTORS);
  const [modelFloors, setModelFloors] = useState<ModelFloor[]>(PROPOSED_MODEL_FLOORS);
  const [claimLimits, setClaimLimits] = useState<ClaimLimitFactor[]>(PROPOSED_CLAIM_LIMIT_FACTORS);
  const [labourRates, setLabourRates] = useState<LabourRateFactor[]>(PROPOSED_LABOUR_RATE_FACTORS);
  const [excessFactors, setExcessFactors] = useState<ExcessFactor[]>(PROPOSED_EXCESS_FACTORS);

  function setClaimLimitFactor(key: string, value: string) {
    const n = Math.max(0, Number(value) || 0);
    setClaimLimits(prev => prev.map(c => (c.key === key ? { ...c, factor: n } : c)));
  }

  function setLabourRateFactor(key: string, value: string) {
    const n = Math.max(0, Number(value) || 0);
    setLabourRates(prev => prev.map(l => (l.key === key ? { ...l, factor: n } : l)));
  }




  function setRiskFactor(
    setter: React.Dispatch<React.SetStateAction<RiskFactor[]>>,
    key: string,
    value: string
  ) {
    const n = Math.max(0, Number(value) || 0);
    setter(prev => prev.map(r => (r.key === key ? { ...r, factor: n } : r)));
  }

  function setFloorPrice(key: string, value: string) {
    const n = Math.max(0, Math.round(Number(value.replace(/[^0-9]/g, '')) || 0));
    setModelFloors(prev => prev.map(f => (f.key === key ? { ...f, minOneYear: n } : f)));
  }

  function setPowertrainFactor(key: string, value: string) {
    const n = Math.max(0, Number(value) || 0);
    setPowertrains(prev => prev.map(p => (p.key === key ? { ...p, factor: n } : p)));
  }

  function setMileageFactor(key: string, value: string) {
    const n = Math.max(0, Number(value) || 0);
    setMileageBands(prev => prev.map(b => (b.key === key ? { ...b, factor: n } : b)));
  }


  function setOneYear(key: string, value: string) {
    const n = Math.max(0, Math.round(Number(value.replace(/[^0-9]/g, '')) || 0));
    setBands(prev => prev.map(b => (b.key === key ? { ...b, oneYear: n } : b)));
  }

  const rows = useMemo(
    () =>
      bands.map(b => {
        if (b.oneYear === null) return { ...b, twoYear: null, threeYear: null, web1: null };
        const web = (v: number) => Math.round(v * (1 - websiteDiscountPct / 100));
        const twoYear = Math.round(b.oneYear * twoYearMult);
        const threeYear = Math.round(b.oneYear * threeYearMult);
        return {
          ...b,
          twoYear,
          threeYear,
          web1: web(b.oneYear),
          web2: web(twoYear),
          web3: web(threeYear),
        } as any;
      }),
    [bands, twoYearMult, threeYearMult, websiteDiscountPct]
  );

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Proposed age-based pricing</CardTitle>
            <CardDescription>
              New model: an age band sets the base price, then a mileage factor is applied on top.
              This replaces the old under/over 120,000 mile split.
            </CardDescription>
          </div>
          <Badge variant="secondary">Preview only — nothing is live</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This preview sits inside Price updates only. Quotes &amp; Orders and the live customer
            journey (Steps 3 and 4) keep using today's prices until you build a draft from this and
            press Push live.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label>2 year multiplier (of 1 year price)</Label>
            <Input
              type="number"
              step="0.05"
              value={twoYearMult}
              onChange={e => setTwoYearMult(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label>3 year multiplier (of 1 year price)</Label>
            <Input
              type="number"
              step="0.05"
              value={threeYearMult}
              onChange={e => setThreeYearMult(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label>Website price is this much less (%)</Label>
            <Input
              type="number"
              min={0}
              max={50}
              value={websiteDiscountPct}
              onChange={e => setWebsiteDiscountPct(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="p-3 font-semibold">Vehicle age at policy start</th>
                <th className="p-3 font-semibold">1 year (Quotes &amp; Orders)</th>
                <th className="p-3 font-semibold">2 years</th>
                <th className="p-3 font-semibold">3 years</th>
                <th className="p-3 font-semibold">Website 1 / 2 / 3 year</th>
                <th className="p-3 font-semibold">Launch treatment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.key} className="border-t">
                  <td className="p-3 font-medium">{r.label}</td>
                  {r.oneYear === null ? (
                    <td className="p-3 text-muted-foreground" colSpan={4}>
                      No automatic quote — manual referral
                    </td>
                  ) : (
                    <>
                      <td className="p-2">
                        <Input
                          className="h-9 w-24"
                          value={r.oneYear}
                          onChange={e => setOneYear(r.key, e.target.value)}
                        />
                      </td>
                      <td className="p-3">{formatGBP(r.twoYear)}</td>
                      <td className="p-3">{formatGBP(r.threeYear)}</td>
                      <td className="p-3 text-muted-foreground">
                        {formatGBP(r.web1)} / {formatGBP(r.web2)} / {formatGBP(r.web3)}
                      </td>
                    </>
                  )}
                  <td className="p-3 text-muted-foreground">{r.treatment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Mileage factors</p>
          <p className="text-xs text-muted-foreground">
            Applied on top of the age band price: age base price × mileage factor, rounded to the
            nearest whole pound.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Exact mileage</th>
                  <th className="p-3 font-semibold">Factor</th>
                  <th className="p-3 font-semibold">Customer-facing label</th>
                </tr>
              </thead>
              <tbody>
                {mileageBands.map(m => (
                  <tr key={m.key} className="border-t">
                    <td className="p-3 font-medium">{m.label}</td>
                    <td className="p-2">
                      {m.factor === null ? (
                        <span className="text-muted-foreground">No automatic quote</span>
                      ) : (
                        <Input
                          className="h-9 w-24"
                          type="number"
                          step="0.05"
                          value={m.factor}
                          onChange={e => setMileageFactor(m.key, e.target.value)}
                        />
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{m.customerLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Powertrain factors</p>
          <p className="text-xs text-muted-foreground">
            Applied after the age and mileage steps: age base price × mileage factor × powertrain
            factor, rounded to the nearest whole pound.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Powertrain</th>
                  <th className="p-3 font-semibold">Provisional factor</th>
                  <th className="p-3 font-semibold">Pricing treatment</th>
                </tr>
              </thead>
              <tbody>
                {powertrains.map(p => (
                  <tr key={p.key} className="border-t">
                    <td className="p-3 font-medium">{p.label}</td>
                    <td className="p-2">
                      <Input
                        className="h-9 w-24"
                        type="number"
                        step="0.01"
                        value={p.factor}
                        onChange={e => setPowertrainFactor(p.key, e.target.value)}
                      />
                    </td>
                    <td className="p-3 text-muted-foreground">{p.treatment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Vehicle type and model-risk factors</p>
          <p className="text-xs text-muted-foreground">
            Applied last: age base × mileage factor × powertrain factor × vehicle type × model risk.
            Referral means no automatic price — the quote goes to manual underwriting.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Risk input</th>
                  <th className="p-3 font-semibold">Factor / result</th>
                  <th className="p-3 font-semibold">Use</th>
                </tr>
              </thead>
              <tbody>
                {vehicleTypes.map(r => (
                  <tr key={r.key} className="border-t">
                    <td className="p-3 font-medium">{r.label}</td>
                    <td className="p-2">
                      <Input
                        className="h-9 w-24"
                        type="number"
                        step="0.01"
                        value={r.factor ?? ''}
                        onChange={e => setRiskFactor(setVehicleTypes, r.key, e.target.value)}
                      />
                    </td>
                    <td className="p-3 text-muted-foreground">{r.use}</td>
                  </tr>
                ))}
                {modelRisks.map(r => (
                  <tr key={r.key} className="border-t">
                    <td className="p-3 font-medium">{r.label}</td>
                    <td className="p-2">
                      {r.factor === null ? (
                        <span className="text-muted-foreground">No automatic price</span>
                      ) : (
                        <Input
                          className="h-9 w-24"
                          type="number"
                          step="0.01"
                          value={r.factor}
                          onChange={e => setRiskFactor(setModelRisks, r.key, e.target.value)}
                        />
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{r.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Model-specific floors and referrals</p>
          <p className="text-xs text-muted-foreground">
            These override the calculated price. A premium floor is the lowest one-year price we will
            quote for that vehicle, even if age, mileage and risk factors work out lower. Not covered
            vehicles get the manual referral message instead of a price.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Vehicle / derivative</th>
                  <th className="p-3 font-semibold">Minimum one-year price</th>
                  <th className="p-3 font-semibold">Treatment</th>
                </tr>
              </thead>
              <tbody>
                {modelFloors.map(f => (
                  <tr key={f.key} className="border-t">
                    <td className="p-3 font-medium">{f.vehicle}</td>
                    <td className="p-2">
                      {f.minOneYear === null ? (
                        <span className="text-muted-foreground">Referral or exclusion</span>
                      ) : (
                        <Input
                          className="h-9 w-28"
                          value={String(f.minOneYear)}
                          onChange={e => setFloorPrice(f.key, e.target.value)}
                        />
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={
                          f.covered
                            ? 'text-muted-foreground'
                            : 'font-medium text-destructive'
                        }
                      >
                        {f.treatment}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Excluded vehicles stay excluded: Bentley, Maserati, Porsche 911, Audi RS / R8 and BMW M
            derivatives never get an automatic quote.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Customer-selected cover options — claim-limit factors</p>
          <p className="text-xs text-muted-foreground">
            Applied to the calculated price once the customer picks a claim limit. £2,000 is the
            recommended reference option at factor 1.00.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Claim limit per approved claim</th>
                  <th className="p-3 font-semibold">Factor</th>
                  <th className="p-3 font-semibold">UX position</th>
                  <th className="p-3 font-semibold">Example on £499 base</th>
                </tr>
              </thead>
              <tbody>
                {claimLimits.map(c => (
                  <tr key={c.key} className="border-t">
                    <td className="p-3 font-medium">£{c.limit.toLocaleString()}</td>
                    <td className="p-2">
                      <Input
                        className="h-9 w-24"
                        type="number"
                        step="0.01"
                        value={c.factor}
                        onChange={e => setClaimLimitFactor(c.key, e.target.value)}
                      />
                    </td>
                    <td className="p-3 text-muted-foreground">{c.uxPosition}</td>
                    <td className="p-3">£{Math.round(499 * c.factor).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Labour-rate factors</p>
          <p className="text-xs text-muted-foreground">
            Applied alongside the claim limit once the customer picks a maximum covered labour rate.
            £70/hour is the reference option at factor 1.00.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Maximum covered labour rate</th>
                  <th className="p-3 font-semibold">Factor</th>
                  <th className="p-3 font-semibold">UX position</th>
                  <th className="p-3 font-semibold">Example on £499 base</th>
                </tr>
              </thead>
              <tbody>
                {labourRates.map(l => (
                  <tr key={l.key} className="border-t">
                    <td className="p-3 font-medium">£{l.rate}/hour</td>
                    <td className="p-2">
                      <Input
                        className="h-9 w-24"
                        type="number"
                        step="0.01"
                        value={l.factor}
                        onChange={e => setLabourRateFactor(l.key, e.target.value)}
                      />
                    </td>
                    <td className="p-3 text-muted-foreground">{l.uxPosition}</td>
                    <td className="p-3">£{Math.round(499 * l.factor).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>


        <div className="space-y-2">
          <p className="text-sm font-semibold">Combined 1 year price — age × mileage</p>
          <p className="text-xs text-muted-foreground">
            Quotes &amp; Orders price. The website price is {websiteDiscountPct}% lower, rounded.
            Blank cells need a manual referral.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr>
                  <th className="p-2 text-left font-semibold">Age \ mileage</th>
                  {mileageBands.map(m => (
                    <th key={m.key} className="p-2 text-left font-semibold whitespace-nowrap">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bands.map(b => (
                  <tr key={b.key} className="border-t">
                    <td className="p-2 font-medium whitespace-nowrap">{b.label}</td>
                    {mileageBands.map(m => {
                      const refer = b.oneYear === null || m.factor === null;
                      return (
                        <td
                          key={m.key}
                          className={refer ? 'p-2 text-muted-foreground' : 'p-2 tabular-nums'}
                        >
                          {refer ? 'Refer' : formatGBP(Math.round((b.oneYear as number) * (m.factor as number)))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-4">
          <p className="mb-2 text-sm font-semibold">
            Over 15 years or over 150,000 miles — what the customer would see
          </p>
          <p className="text-sm text-muted-foreground">{MANUAL_REFERRAL_MESSAGE}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled>
              <PhoneCall className="mr-1 h-4 w-4" /> Call 0330 229 5040
            </Button>
            <Button size="sm" disabled>
              Request a callback
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Buttons shown for layout only in this preview.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
