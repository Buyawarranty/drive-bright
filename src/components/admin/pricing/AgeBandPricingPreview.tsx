import { TERM_ELIGIBILITY_TABLE } from '@/lib/pricing/termEligibility';
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Info, PhoneCall, Save, RotateCcw, Rocket, Search, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { formatGBP, getExcessTotalAdjustment, getExcessMonthlyDelta, type PaymentPeriod } from '@/lib/pricingMatrix';
import { JOURNEY_EXCESS_OPTIONS } from '@/lib/pricing/journeyOptions';
import { supabase } from '@/integrations/supabase/client';
import { matchModelFloor, describeFloorMatch } from '@/lib/pricing/modelFloorMatch';
import { setVehiclePricingRules } from '@/lib/pricing/vehicleRules';
import { PRICING_MODEL_SAVED_EVENT } from './pricingModelEvents';




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

/** Mileage factors (August 2026 test model) — applied on top of the age band base price. */
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

/** Powertrain factors (August 2026 test model) — applied after age × mileage. */
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
  { key: 'motorbike', label: 'Motorbike / motorcycle', factor: 0.5, use: '50% of standard vehicle pricing (floors halve too)' },
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

export const TREATMENT_OPTIONS = [
  'Premium floor',
  'Premium EV floor',
  'Not covered',
  'Not covered — referral or exclusion',
] as const;

/** 4.5 Model-specific floors and referrals. */
export const PROPOSED_MODEL_FLOORS: ModelFloor[] = [
  { key: 'rr-autobiography', vehicle: 'Range Rover Autobiography', minOneYear: 899, treatment: 'Premium floor', covered: true },
  { key: 'rr-sport', vehicle: 'Range Rover Sport', minOneYear: 799, treatment: 'Premium floor', covered: true },
  { key: 'rr-velar', vehicle: 'Range Rover Velar', minOneYear: 749, treatment: 'Premium floor', covered: true },
  { key: 'rr-evoque', vehicle: 'Range Rover Evoque', minOneYear: 699, treatment: 'Premium floor', covered: true },
  { key: 'rr-discovery', vehicle: 'Range Rover Discovery', minOneYear: 699, treatment: 'Premium floor', covered: true },
  { key: 'tesla', vehicle: 'Tesla', minOneYear: 799, treatment: 'Premium EV floor', covered: true },

  { key: 'porsche-911', vehicle: 'Porsche 911', minOneYear: null, treatment: 'Not covered', covered: false },
  { key: 'audi-rs', vehicle: 'Audi RS', minOneYear: null, treatment: 'Not covered — referral or exclusion', covered: false },
  { key: 'audi-r8', vehicle: 'Audi R8', minOneYear: null, treatment: 'Not covered — referral or exclusion', covered: false },
  { key: 'bmw-m2', vehicle: 'BMW M2', minOneYear: null, treatment: 'Not covered — referral or exclusion', covered: false },
  { key: 'bmw-m3', vehicle: 'BMW M3', minOneYear: null, treatment: 'Not covered — referral or exclusion', covered: false },
  { key: 'bmw-m4', vehicle: 'BMW M4', minOneYear: null, treatment: 'Not covered — referral or exclusion', covered: false },
  { key: 'bmw-m5', vehicle: 'BMW M5', minOneYear: null, treatment: 'Not covered — referral or exclusion', covered: false },
  { key: 'bmw-m8', vehicle: 'BMW M8', minOneYear: null, treatment: 'Not covered — referral or exclusion', covered: false },
  { key: 'bentley', vehicle: 'Bentley', minOneYear: null, treatment: 'Not covered — referral or exclusion', covered: false },
  { key: 'maserati', vehicle: 'Maserati', minOneYear: null, treatment: 'Not covered — referral or exclusion', covered: false },

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
  { key: 'lr-150', rate: 150, factor: 1.80, uxPosition: 'Specialist garages' },
];


export type ExcessFactor = {
  key: string;
  excess: number;
  factor: number;
  uxPosition: string;
  /** true = optional only, not part of the default online journey */
  optional?: boolean;
};

/** 5.3 Customer-selected cover options — excess factors. */
export const PROPOSED_EXCESS_FACTORS: ExcessFactor[] = [
  { key: 'ex-0', excess: 0, factor: 1.25, uxPosition: 'No contribution toward an approved claim; higher price' },
  { key: 'ex-150', excess: 150, factor: 1.0, uxPosition: 'Recommended / best balance' },
  { key: 'ex-250', excess: 250, factor: 0.94, uxPosition: 'Lower-price option' },
  { key: 'ex-500', excess: 500, factor: 0.88, uxPosition: 'Optional only — biggest saving', optional: true },
];

export const MANUAL_REFERRAL_MESSAGE =
  'We can still help with this vehicle, but it needs a quick manual review. Please call our sales line on 0330 229 5040 or request a callback and one of the team will come straight back to you.';

export const OVER_15_REFERRAL_MESSAGE =
  'We can still help with this vehicle, but it needs a quick manual review. Please call our sales line on 0330 229 5040 or request a callback and one of the team will come straight back to you.';

export const AGE_BAND_PRICING_STORAGE_KEY = 'ageBandPricingModel.v1';

export type AgeBandModel = {
  bands: AgeBand[];
  twoYearMult: number;
  threeYearMult: number;
  payInFullFactor: number;
  websiteDiscountPct: number;
  mileageBands: MileageBand[];
  powertrains: PowertrainFactor[];
  vehicleTypes: RiskFactor[];
  modelRisks: RiskFactor[];
  modelFloors: ModelFloor[];
  claimLimits: ClaimLimitFactor[];
  labourRates: LabourRateFactor[];
  excessFactors: ExcessFactor[];
  refBandKey: string;
};

/**
 * Internal grid columns → the claim limit whose factor prices them.
 * The three columns must map to three DIFFERENT limits, otherwise the published
 * grid has identical columns and the customer sees no price change when they
 * switch claim limit on Step 3.
 */
/** Grid columns are the cover levels themselves — no retired names left to map. */
const CLAIM_LIMIT_COLUMNS = [1000, 2000, 3000] as const;
const GRID_EXCESSES = [0, 50, 100, 150, 250, 500];
const MIN_SELLABLE_BY_PERIOD: Record<string, number> = {
  '12months': 399,
  '24months': 659,
  '36months': 938,
};

/**
 * Turn the age-band model into a Quotes & Orders grid
 * (period × excess × internal claim-limit column).
 */
export function buildAdminMatrixFromModel(model: AgeBandModel): Record<string, Record<string, Record<string, number>>> {
  const ref = model.bands.find(b => b.key === model.refBandKey) || model.bands[0];
  const base = ref?.oneYear ?? 399;
  const termMult: Record<string, number> = {
    '12months': 1,
    '24months': model.twoYearMult,
    '36months': model.threeYearMult,
  };
  /**
   * Excess is a flat £/mo difference vs the £100 "Balanced" baseline (per term),
   * exactly as Step 3/4 and Quotes & Orders price it — never a multiplier.
   */
  const excessAdjustmentFor = (period: string, excess: number, base?: number) =>
    getExcessTotalAdjustment(period as PaymentPeriod, excess, base);


  /**
   * IMPORTANT: the grid is the REFERENCE-BAND price, not a sellable price.
   * At quote time the live engine multiplies this cell by the vehicle factor
   * (age band / mileage / powertrain / type) and only THEN applies the
   * £399/£659/£938 minimum sellable floor (applyBasePriceFloor).
   *
   * So the floor must NOT be baked in here. Scaling the whole reference grid up
   * to the floor and then multiplying by the age factor charged the lift twice —
   * that is why an 8-9 year diesel priced £493 in the Aug hybrid sandbox but
   * £778 on Step 3. The grid now stays at the model's own reference figures.
   */
  const out: Record<string, Record<string, Record<string, number>>> = {};
  for (const period of ['12months', '24months', '36months']) {
    out[period] = {};
    for (const excess of GRID_EXCESSES) {
      out[period][String(excess)] = {};
      for (const column of CLAIM_LIMIT_COLUMNS) {
        const clFactor =
          model.claimLimits.find(c => c.limit === column)?.factor ?? 1;
        const cellBase = base * termMult[period] * clFactor;
        const value = cellBase + excessAdjustmentFor(period, excess, cellBase);
        out[period][String(excess)][String(column)] = Math.max(1, Math.round(value));
      }
    }
  }
  return out;
}



export default function AgeBandPricingPreview({
  onBuildDraft,
  onModelChange,
}: {
  onBuildDraft?: (
    matrix: Record<string, Record<string, Record<string, number>>>,
    websiteDiscountPct: number,
    publish?: boolean,
    claimLimitFactors?: { limit: number; factor: number }[] | null,
    labourRateFactors?: { rate: number; factor: number; label?: string | null }[] | null
  ) => void | Promise<void>;

  /** Reports the figures currently in the editor so previews can follow them live. */
  onModelChange?: (model: AgeBandModel) => void;


} = {}) {
  const saved: Partial<AgeBandModel> = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(AGE_BAND_PRICING_STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }, []);

  const [bands, setBands] = useState<AgeBand[]>(saved.bands ?? PROPOSED_AGE_BANDS);
  const [twoYearMult, setTwoYearMult] = useState(saved.twoYearMult ?? 1.65);
  const [threeYearMult, setThreeYearMult] = useState(saved.threeYearMult ?? 2.35);
  const [payInFullFactor, setPayInFullFactor] = useState(saved.payInFullFactor ?? 0.9);
  const [websiteDiscountPct, setWebsiteDiscountPct] = useState(saved.websiteDiscountPct ?? 10);
  const [mileageBands, setMileageBands] = useState<MileageBand[]>(saved.mileageBands ?? PROPOSED_MILEAGE_BANDS);
  const [powertrains, setPowertrains] = useState<PowertrainFactor[]>(saved.powertrains ?? PROPOSED_POWERTRAIN_FACTORS);
  const [vehicleTypes, setVehicleTypes] = useState<RiskFactor[]>(saved.vehicleTypes ?? PROPOSED_VEHICLE_TYPE_FACTORS);
  const [modelRisks, setModelRisks] = useState<RiskFactor[]>(saved.modelRisks ?? PROPOSED_MODEL_RISK_FACTORS);
  const [modelFloors, setModelFloors] = useState<ModelFloor[]>(saved.modelFloors ?? PROPOSED_MODEL_FLOORS);
  const [claimLimits, setClaimLimits] = useState<ClaimLimitFactor[]>(saved.claimLimits ?? PROPOSED_CLAIM_LIMIT_FACTORS);
  const [labourRates, setLabourRates] = useState<LabourRateFactor[]>(saved.labourRates ?? PROPOSED_LABOUR_RATE_FACTORS);
  const [excessFactors, setExcessFactors] = useState<ExcessFactor[]>(saved.excessFactors ?? PROPOSED_EXCESS_FACTORS);
  const [refBandKey, setRefBandKey] = useState(saved.refBandKey ?? '6-7');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newFloorVehicle, setNewFloorVehicle] = useState('');
  const [newFloorTreatment, setNewFloorTreatment] = useState('Premium floor');
  const [newFloorPrice, setNewFloorPrice] = useState('');
  const [lookupReg, setLookupReg] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupNote, setLookupNote] = useState('');
  const [checkText, setCheckText] = useState('');

  /** Live preview of which rule a typed vehicle name would hit. */
  const checkMatch = useMemo(
    () => (checkText.trim() ? matchModelFloor(checkText, modelFloors) : null),
    [checkText, modelFloors]
  );
  const newFloorMatch = useMemo(
    () => (newFloorVehicle.trim() ? matchModelFloor(newFloorVehicle, modelFloors) : null),
    [newFloorVehicle, modelFloors]
  );



  async function handleRegLookup() {
    const reg = lookupReg.replace(/\s+/g, '').toUpperCase();
    if (reg.length < 2) {
      toast.error('Enter a registration plate first');
      return;
    }
    setLookupBusy(true);
    setLookupNote('');
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: reg },
      });
      if (error) throw error;
      if (data?.found || data?.make) {
        const name = [data.make, data.model].filter(Boolean).join(' ').trim();
        if (name) setNewFloorVehicle(name);
        const fuel = String(data.fuelType || '').toLowerCase();
        const isEv = fuel.includes('electric');
        setNewFloorTreatment(isEv ? 'Premium EV floor' : 'Premium floor');
        setLookupNote(
          [name || reg, data.yearOfManufacture, data.fuelType].filter(Boolean).join(' · '),
        );
        toast.success(`Found ${name || reg} — set the floor or block it below`);
      } else {
        setLookupNote('No DVLA match — type the make and model by hand');
        toast.error('No DVLA match for that plate');
      }
    } catch (e: any) {
      setLookupNote('Lookup unavailable — type the make and model by hand');
      toast.error(e?.message || 'Could not look that plate up');
    } finally {
      setLookupBusy(false);
    }
  }


  const model: AgeBandModel = {
    bands,
    twoYearMult,
    threeYearMult,
    payInFullFactor,
    websiteDiscountPct,
    mileageBands,
    powertrains,
    vehicleTypes,
    modelRisks,
    modelFloors,
    claimLimits,
    labourRates,
    excessFactors,
    refBandKey,
  };

  React.useEffect(() => {
    setDirty(true);
  }, [
    bands,
    twoYearMult,
    threeYearMult,
    payInFullFactor,
    websiteDiscountPct,
    mileageBands,
    powertrains,
    vehicleTypes,
    modelRisks,
    modelFloors,
    claimLimits,
    labourRates,
    excessFactors,
    refBandKey,
  ]);

  // Keep the Step 2 replica in step with the editor as figures are typed, so a
  // changed claim-limit or labour factor shows immediately — saved or not.
  React.useEffect(() => {
    onModelChange?.(model);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bands,
    twoYearMult,
    threeYearMult,
    payInFullFactor,
    websiteDiscountPct,
    mileageBands,
    powertrains,
    vehicleTypes,
    modelRisks,
    modelFloors,
    claimLimits,
    labourRates,
    excessFactors,
    refBandKey,
  ]);



  function handleSaveModel() {
    try {
      localStorage.setItem(AGE_BAND_PRICING_STORAGE_KEY, JSON.stringify(model));
      // Tell the Step 2 replica (and any other preview) to re-read the saved figures.
      window.dispatchEvent(new Event(PRICING_MODEL_SAVED_EVENT));
      setDirty(false);
      toast.success('Figures saved — they will still be here next time you open this tab');
    } catch {
      toast.error('Could not save these figures in this browser');
    }
  }

  /**
   * Publish the model-specific floors and "Not covered" rules so they apply for
   * everyone: the admin Quotes & Orders page and the customer journey (Steps 3 → 4).
   */
  async function handlePublishFloors() {
    setBusy(true);
    try {
      const rows = modelFloors
        .filter(f => f.vehicle.trim())
        .map((f, i) => ({
          vehicle: f.vehicle.trim(),
          min_one_year: f.covered ? f.minOneYear : null,
          treatment: f.treatment,
          covered: f.covered,
          sort_order: i,
        }));

      const { error: delError } = await supabase
        .from('pricing_vehicle_rules')
        .delete()
        .not('id', 'is', null);
      if (delError) throw delError;

      if (rows.length) {
        const { error: insError } = await supabase.from('pricing_vehicle_rules').insert(rows);
        if (insError) throw insError;
      }

      setVehiclePricingRules(
        rows.map((r, i) => ({
          key: `local-${i}`,
          vehicle: r.vehicle,
          minOneYear: r.min_one_year,
          treatment: r.treatment,
          covered: r.covered,
        }))
      );

      handleSaveModel();
      toast.success('Floors saved and now live on Quotes & Orders and Steps 3–4');
    } catch (e: any) {
      toast.error(e?.message || 'Could not publish these floors');
    } finally {
      setBusy(false);
    }
  }



  function handleResetModel() {
    localStorage.removeItem(AGE_BAND_PRICING_STORAGE_KEY);
    window.dispatchEvent(new Event(PRICING_MODEL_SAVED_EVENT));
    setBands(PROPOSED_AGE_BANDS);
    setTwoYearMult(1.65);
    setThreeYearMult(2.35);
    setPayInFullFactor(0.9);
    setWebsiteDiscountPct(10);
    setMileageBands(PROPOSED_MILEAGE_BANDS);
    setPowertrains(PROPOSED_POWERTRAIN_FACTORS);
    setVehicleTypes(PROPOSED_VEHICLE_TYPE_FACTORS);
    setModelRisks(PROPOSED_MODEL_RISK_FACTORS);
    setModelFloors(PROPOSED_MODEL_FLOORS);
    setClaimLimits(PROPOSED_CLAIM_LIMIT_FACTORS);
    setLabourRates(PROPOSED_LABOUR_RATE_FACTORS);
    setExcessFactors(PROPOSED_EXCESS_FACTORS);
    setRefBandKey('6-7');
    toast.success('Reset to the proposed defaults');
  }

  async function handleBuildDraft(publish = false) {
    if (!onBuildDraft) return;
    setBusy(true);
    try {
      handleSaveModel();
      await onBuildDraft(
        buildAdminMatrixFromModel(model),
        websiteDiscountPct,
        publish,
        claimLimits.map(c => ({ limit: Number(c.limit), factor: Number(c.factor) })),
        labourRates.map(l => ({ rate: Number(l.rate), factor: Number(l.factor), label: l.uxPosition }))
      );
    } catch (e: any) {
      toast.error(e?.message || 'Could not build a draft from this model');
    } finally {
      setBusy(false);
    }
  }




  function setClaimLimitFactor(key: string, value: string) {
    const n = Math.max(0, Number(value) || 0);
    setClaimLimits(prev => prev.map(c => (c.key === key ? { ...c, factor: n } : c)));
  }

  function setLabourRateFactor(key: string, value: string) {
    const n = Math.max(0, Number(value) || 0);
    setLabourRates(prev => prev.map(l => (l.key === key ? { ...l, factor: n } : l)));
  }

  /** Managers can change the hourly rate itself (e.g. £200/hr → £150/hr). */
  function setLabourRateValue(key: string, value: string) {
    const n = Math.max(0, Math.round(Number(value) || 0));
    setLabourRates(prev =>
      prev
        .map(l => (l.key === key ? { ...l, rate: n } : l))
        .sort((a, b) => a.rate - b.rate)
    );
  }

  function setLabourRateUxPosition(key: string, value: string) {
    setLabourRates(prev => prev.map(l => (l.key === key ? { ...l, uxPosition: value } : l)));
  }

  function setExcessFactor(key: string, value: string) {
    const n = Math.max(0, Number(value) || 0);
    setExcessFactors(prev => prev.map(e => (e.key === key ? { ...e, factor: n } : e)));
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

  function setFloorVehicle(key: string, value: string) {
    setModelFloors(prev => prev.map(f => (f.key === key ? { ...f, vehicle: value } : f)));
    setDirty(true);
  }

  function setFloorTreatment(key: string, treatment: string) {
    setModelFloors(prev =>
      prev.map(f => {
        if (f.key !== key) return f;
        const covered = treatment === 'Premium floor' || treatment === 'Premium EV floor';
        return {
          ...f,
          treatment,
          covered,
          minOneYear: covered ? (f.minOneYear ?? 799) : null,
        };
      })
    );
    setDirty(true);
  }

  function removeFloor(key: string) {
    setModelFloors(prev => prev.filter(f => f.key !== key));
    setDirty(true);
  }

  function addFloor() {
    const vehicle = newFloorVehicle.trim();
    if (!vehicle) {
      toast.error('Enter a vehicle or derivative name');
      return;
    }
    const covered =
      newFloorTreatment === 'Premium floor' || newFloorTreatment === 'Premium EV floor';
    const price = Math.max(0, Math.round(Number(newFloorPrice.replace(/[^0-9]/g, '')) || 0));
    if (covered && !price) {
      toast.error('Enter a minimum one-year price for a premium floor');
      return;
    }
    setModelFloors(prev => [
      ...prev,
      {
        key: `${vehicle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
        vehicle,
        minOneYear: covered ? price : null,
        treatment: newFloorTreatment,
        covered,
      },
    ]);
    setNewFloorVehicle('');
    setNewFloorPrice('');
    setDirty(true);
    toast.success(`${vehicle} added — remember to save`);
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
        {/* Save bar — sticky so it is reachable from anywhere in this long panel */}
        <div className="sticky top-0 z-20 -mx-6 flex flex-wrap items-center gap-2 border-b bg-background/95 px-6 py-3 backdrop-blur">
          <Button size="sm" onClick={handleSaveModel} disabled={busy}>
            <Save className="mr-1 h-4 w-4" /> Save figures
          </Button>
          {onBuildDraft && (
            <>
              <Button size="sm" variant="secondary" onClick={() => handleBuildDraft(false)} disabled={busy}>
                <Rocket className="mr-1 h-4 w-4" /> Build test draft from this model
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleBuildDraft(true)}
                disabled={busy}
              >
                <Rocket className="mr-1 h-4 w-4" /> Save &amp; push this model live
              </Button>
            </>
          )}

          <Button size="sm" variant="outline" onClick={handleResetModel} disabled={busy}>
            <RotateCcw className="mr-1 h-4 w-4" /> Reset to defaults
          </Button>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Reference age band</Label>
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs"
              value={refBandKey}
              onChange={e => setRefBandKey(e.target.value)}
            >
              {bands
                .filter(b => b.oneYear !== null)
                .map(b => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
            </select>
          </div>
          <Badge variant={dirty ? 'destructive' : 'secondary'} className="ml-auto">
            {dirty ? 'Unsaved changes' : 'Saved'}
          </Badge>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>This is the calculator, not the live prices.</strong> “Save figures” only keeps
            your numbers here. To make them count, press “Build test draft from this model” — that
            writes them into the <strong>Price grid</strong> tab, which you then publish with{' '}
            <strong>Push live</strong> at the top of Price updates. The website (Step 3 / Step 4)
            price is always the grid minus the website discount below, defaulting to 10%.
          </AlertDescription>
        </Alert>


        <div className="space-y-2">
          <p className="text-sm font-semibold">6.1 Recommended temporary term multipliers</p>
          <p className="text-xs text-muted-foreground">
            Temporary while every term is still paid over 12 monthly payments. Revisit once 24 and 36
            month payment plans exist.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Warranty term</th>
                  <th className="p-3 font-semibold">Multiplier</th>
                  <th className="p-3 font-semibold">Current payment count</th>
                  <th className="p-3 font-semibold">Customer positioning</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { term: '1 year', mult: 1, position: 'Lowest total price' },
                  { term: '2 years', mult: twoYearMult, position: 'Most popular' },
                  { term: '3 years', mult: threeYearMult, position: 'Best long-term value' },
                ].map(row => (
                  <tr key={row.term} className="border-t">
                    <td className="p-3 font-medium">{row.term}</td>
                    <td className="p-3">{row.mult.toFixed(2)}x</td>
                    <td className="p-3">12</td>
                    <td className="p-3 text-muted-foreground">{row.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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

        <div className="space-y-2">
          <p className="text-sm font-semibold">6.4 Pay-in-full rule</p>
          <p className="text-xs text-muted-foreground">
            Pay-in-full price = selected term total × {payInFullFactor.toFixed(2)}
          </p>
          <div className="max-w-xs space-y-1">
            <Label>Pay-in-full factor</Label>
            <Input
              type="number"
              step="0.01"
              min={0.5}
              max={1}
              value={payInFullFactor}
              onChange={e => setPayInFullFactor(Number(e.target.value) || 0)}
            />
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Warranty term</th>
                  <th className="p-3 font-semibold">Term total (from £499 base)</th>
                  <th className="p-3 font-semibold">Pay in full</th>
                  <th className="p-3 font-semibold">Customer saves</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { term: '1 year', mult: 1 },
                  { term: '2 years', mult: twoYearMult },
                  { term: '3 years', mult: threeYearMult },
                ].map(row => {
                  const total = Math.round(499 * row.mult);
                  const full = Math.round(total * payInFullFactor);
                  return (
                    <tr key={row.term} className="border-t">
                      <td className="p-3 font-medium">{row.term}</td>
                      <td className="p-3">£{total.toLocaleString()}</td>
                      <td className="p-3 font-semibold">£{full.toLocaleString()}</td>
                      <td className="p-3 text-muted-foreground">
                        £{(total - full).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">7. Eligibility and term controls</p>
          <p className="text-xs text-muted-foreground">
            These restrictions are live in the sales tools now — Step 2 of Quotes &amp; Orders shows a
            light notice to the agent explaining which terms are available for the vehicle.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Vehicle position at policy start</th>
                  <th className="p-3 font-semibold">Automatic terms</th>
                  <th className="p-3 font-semibold">Treatment</th>

                </tr>
              </thead>
              <tbody>
                {TERM_ELIGIBILITY_TABLE.map(row => (
                  <tr key={row.position} className="border-t">
                    <td className="p-3 font-medium">{row.position}</td>
                    <td className="p-3">{row.automaticTerms}</td>
                    <td className="p-3 text-muted-foreground">{row.treatment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  <th className="p-3 font-semibold text-right">Actions</th>

                </tr>
              </thead>
              <tbody>
                {modelFloors.map(f => (
                  <tr key={f.key} className="border-t">
                    <td className="p-2">
                      <Input
                        className="h-9 min-w-[200px]"
                        value={f.vehicle}
                        onChange={e => setFloorVehicle(f.key, e.target.value)}
                      />
                    </td>
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
                    <td className="p-2">
                      <select
                        className="h-9 w-full min-w-[220px] rounded-md border border-input bg-background px-2 text-sm"
                        value={f.treatment}
                        onChange={e => setFloorTreatment(f.key, e.target.value)}
                      >
                        {TREATMENT_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeFloor(f.key)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
            <div className="space-y-1">
              <Label className="text-xs">Look up by registration</Label>
              <div className="flex items-center gap-2">
                <Input
                  className="h-9 w-40 font-semibold uppercase tracking-wider"
                  placeholder="AB12 CDE"
                  value={lookupReg}
                  onChange={e => setLookupReg(e.target.value.toUpperCase())}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRegLookup();
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleRegLookup}
                  disabled={lookupBusy}
                >
                  {lookupBusy ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-1 h-4 w-4" />
                  )}
                  Find vehicle
                </Button>
              </div>
              {lookupNote && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Check className="h-3 w-3" /> {lookupNote}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vehicle / derivative</Label>
              <Input
                className="h-9 w-56"
                placeholder="Type a make and model, or use a plate"
                value={newFloorVehicle}
                onChange={e => setNewFloorVehicle(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Treatment</Label>
              <select
                className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                value={newFloorTreatment}
                onChange={e => setNewFloorTreatment(e.target.value)}
              >
                {TREATMENT_OPTIONS.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Minimum one-year price</Label>
              <Input
                className="h-9 w-32"
                placeholder="799"
                disabled={
                  newFloorTreatment !== 'Premium floor' && newFloorTreatment !== 'Premium EV floor'
                }
                value={newFloorPrice}
                onChange={e => setNewFloorPrice(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={addFloor}>
              Add vehicle
            </Button>
            {newFloorVehicle.trim() && (
              <p className="w-full text-xs text-muted-foreground">
                {newFloorMatch
                  ? `Already covered by an existing rule: ${describeFloorMatch(newFloorMatch)}`
                  : 'No existing rule covers this name yet — adding it creates a new rule.'}
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-md border border-dashed p-3">
            <Label className="text-xs">Check a vehicle name against these rules</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-9 w-72"
                placeholder="e.g. Tesla Model X, TeslaX tesla, BMW M3"
                value={checkText}
                onChange={e => setCheckText(e.target.value)}
              />
              {checkText.trim() && (
                <Badge variant={checkMatch ? (checkMatch.floor.covered ? 'secondary' : 'destructive') : 'outline'}>
                  {checkMatch ? (checkMatch.floor.covered ? 'Floor applies' : 'Blocked') : 'No rule'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {checkText.trim()
                ? describeFloorMatch(checkMatch)
                : 'Matching ignores capitals, punctuation, word order and joined-up words, so “TeslaX tesla” still finds the Tesla rule. The make word must match, and the most specific rule wins.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              Vehicles set to a “Not covered” treatment never get an automatic quote — they show the
              manual referral message instead. Saving here applies these rules straight away on the
              Quotes &amp; Orders page and on the customer journey (Step 3 → Step 4).
            </p>
            <div className="flex items-center gap-2">
              <Badge variant={dirty ? 'destructive' : 'secondary'}>
                {dirty ? 'Unsaved changes' : 'Saved'}
              </Badge>
              <Button size="sm" onClick={handlePublishFloors} disabled={busy}>
                <Save className="mr-1 h-4 w-4" /> Save &amp; apply floors
              </Button>
            </div>
          </div>


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
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">£</span>
                        <Input
                          className="h-9 w-24"
                          type="number"
                          step="5"
                          min="0"
                          value={l.rate}
                          onChange={e => setLabourRateValue(l.key, e.target.value)}
                        />
                        <span className="text-muted-foreground">/hour</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-9 w-24"
                        type="number"
                        step="0.01"
                        value={l.factor}
                        onChange={e => setLabourRateFactor(l.key, e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-9 min-w-[200px]"
                        value={l.uxPosition}
                        onChange={e => setLabourRateUxPosition(l.key, e.target.value)}
                      />
                    </td>
                    <td className="p-3">£{Math.round(499 * l.factor).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Excess pricing — flat £/mo differences</p>
          <p className="text-xs text-muted-foreground">
            Excess is no longer a multiplier. Every surface (Step 3, Step 4 and Quotes &amp; Orders)
            prices it as a flat monthly difference vs the £100 “Balanced” baseline, so the same choice
            costs the same on every vehicle. 24 and 36 month columns are stored ready for when those
            instalment plans launch — today all cover is billed over 12 instalments.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Excess</th>
                  <th className="p-3 font-semibold">Customer label</th>
                  <th className="p-3 font-semibold">12 mo</th>
                  <th className="p-3 font-semibold">24 mo (future)</th>
                  <th className="p-3 font-semibold">36 mo (future)</th>
                  <th className="p-3 font-semibold">Available from</th>
                </tr>
              </thead>
              <tbody>
                {JOURNEY_EXCESS_OPTIONS.map(e => {
                  const fmt = (d: number) => (d === 0 ? 'baseline' : `${d > 0 ? '+' : '−'}£${Math.abs(d)}/mo`);
                  return (
                    <tr key={e.value} className="border-t">
                      <td className="p-3 font-medium">£{e.value}</td>
                      <td className="p-3 text-muted-foreground">{e.label}</td>
                      <td className="p-3">{fmt(getExcessMonthlyDelta('12months', e.value))}</td>
                      <td className="p-3 text-muted-foreground">{fmt(getExcessMonthlyDelta('24months', e.value))}</td>
                      <td className="p-3 text-muted-foreground">{fmt(getExcessMonthlyDelta('36months', e.value))}</td>
                      <td className="p-3 text-muted-foreground">
                        {e.value >= 250 ? 'Warranties £500+' : 'All prices'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Availability is price-bracket driven: under £500 shows £0–£150 only; £500 and above adds
            £250 and £500. Claim limit no longer restricts the excess ladder.
          </p>
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
