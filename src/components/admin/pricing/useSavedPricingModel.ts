import { useEffect, useMemo, useState } from 'react';
import {
  AGE_BAND_PRICING_STORAGE_KEY,
  PROPOSED_AGE_BANDS,
  PROPOSED_MILEAGE_BANDS,
  PROPOSED_POWERTRAIN_FACTORS,
  PROPOSED_VEHICLE_TYPE_FACTORS,
  PROPOSED_MODEL_RISK_FACTORS,
  PROPOSED_MODEL_FLOORS,
  PROPOSED_CLAIM_LIMIT_FACTORS,
  PROPOSED_LABOUR_RATE_FACTORS,
  PROPOSED_EXCESS_FACTORS,
} from './AgeBandPricingPreview';
import { PRICING_MODEL_SAVED_EVENT } from './pricingModelEvents';
import { loadVehicleSurchargeDraft } from './VehicleSurchargeEditor';
import { getLiveVehicleFactorModel } from '@/lib/pricing/vehicleFactorModel';


export { PRICING_MODEL_SAVED_EVENT } from './pricingModelEvents';

/**
 * Reads the figures saved by the Price updates editor so the Step 2 replica
 * always previews the variables currently being tested (labour rates, excesses,
 * claim limits, bands…) instead of the hardcoded proposed defaults.
 */
/**
 * Labour rates added in the vehicle surcharge editor (e.g. a new £150/hr option)
 * appear in the replica too. Their factor is interpolated from the rates that
 * already have one, so a new rate never changes the existing prices.
 */
function mergeSurchargeLabourRates(base: any[]): any[] {
  const extra = loadVehicleSurchargeDraft()?.labourRates ?? [];
  const labels = loadVehicleSurchargeDraft()?.labourRateLabels ?? {};
  const merged = [...base];
  for (const rate of extra) {
    if (merged.some(l => l.rate === rate)) continue;
    const sorted = [...base].sort((a, b) => a.rate - b.rate);
    const below = [...sorted].reverse().find(l => l.rate <= rate);
    const above = sorted.find(l => l.rate >= rate);
    let factor = below?.factor ?? above?.factor ?? 1;
    if (below && above && above.rate !== below.rate) {
      const t = (rate - below.rate) / (above.rate - below.rate);
      factor = below.factor + (above.factor - below.factor) * t;
    }
    merged.push({
      key: `lr-${rate}`,
      rate,
      factor: Math.round(factor * 100) / 100,
      uxPosition: labels?.[rate] ?? 'Added in vehicle surcharges',
    });
  }
  return merged.sort((a, b) => a.rate - b.rate);
}

export function useSavedPricingModel(opts?: { preferLive?: boolean }) {
  const preferLive = opts?.preferLive === true;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener(PRICING_MODEL_SAVED_EVENT, bump);
    window.addEventListener('storage', bump);
    window.addEventListener('bw:pricing-updated', bump);
    return () => {
      window.removeEventListener(PRICING_MODEL_SAVED_EVENT, bump);
      window.removeEventListener('storage', bump);
      window.removeEventListener('bw:pricing-updated', bump);
    };
  }, []);

  return useMemo(() => {
    let saved: any = {};
    try {
      saved = JSON.parse(localStorage.getItem(AGE_BAND_PRICING_STORAGE_KEY) || '{}') || {};
    } catch {
      saved = {};
    }
    /**
     * Quotes & Orders must quote from the figures a manager PUSHED LIVE, not the
     * draft sitting in that agent's browser — otherwise the same car quotes a
     * different price per machine and disagrees with the pricing sandboxes.
     */
    if (preferLive) {
      const live: any = getLiveVehicleFactorModel();
      if (live && Array.isArray(live.bands) && live.bands.length) {
        saved = {
          ...saved,
          bands: live.bands,
          refBandKey: live.refBandKey,
          mileageBands: live.mileageBands,
          powertrains: live.powertrains,
          vehicleTypes: live.vehicleTypes,
          ...(live.modelRisks ? { modelRisks: live.modelRisks } : {}),
          ...(live.modelFloors ? { modelFloors: live.modelFloors } : {}),
          ...(live.claimLimits ? { claimLimits: live.claimLimits } : {}),
          ...(live.labourRates ? { labourRates: live.labourRates } : {}),
          ...(live.excessFactors ? { excessFactors: live.excessFactors } : {}),
          ...(live.twoYearMult !== undefined ? { twoYearMult: live.twoYearMult } : {}),
          ...(live.threeYearMult !== undefined ? { threeYearMult: live.threeYearMult } : {}),
          ...(live.payInFullFactor !== undefined ? { payInFullFactor: live.payInFullFactor } : {}),
        };
      }
    }
    const pick = <T,>(value: T[] | undefined, fallback: T[]) =>
      Array.isArray(value) && value.length ? value : fallback;


    return {
      ageBands: pick(saved.bands, PROPOSED_AGE_BANDS),
      mileageBands: pick(saved.mileageBands, PROPOSED_MILEAGE_BANDS),
      powertrains: pick(saved.powertrains, PROPOSED_POWERTRAIN_FACTORS),
      vehicleTypes: pick(saved.vehicleTypes, PROPOSED_VEHICLE_TYPE_FACTORS),
      modelRisks: pick(saved.modelRisks, PROPOSED_MODEL_RISK_FACTORS),
      modelFloors: pick(saved.modelFloors, PROPOSED_MODEL_FLOORS),
      claimLimits: pick(saved.claimLimits, PROPOSED_CLAIM_LIMIT_FACTORS),
      labourRateFactors: mergeSurchargeLabourRates(
        pick(saved.labourRates, PROPOSED_LABOUR_RATE_FACTORS)
      ),
      excessFactors: pick(saved.excessFactors, PROPOSED_EXCESS_FACTORS),
      twoYearMult: Number(saved.twoYearMult ?? 1.65),
      threeYearMult: Number(saved.threeYearMult ?? 2.35),
      payInFullFactor: Number(saved.payInFullFactor ?? 0.9),
      /** Changes whenever the saved figures are re-read — handy as a render key. */
      revision: tick,
    };
  }, [tick]);
}
