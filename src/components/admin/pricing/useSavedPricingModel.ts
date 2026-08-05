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

export { PRICING_MODEL_SAVED_EVENT } from './pricingModelEvents';

/**
 * Reads the figures saved by the Price updates editor so the Step 2 replica
 * always previews the variables currently being tested (labour rates, excesses,
 * claim limits, bands…) instead of the hardcoded proposed defaults.
 */
export function useSavedPricingModel() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener(PRICING_MODEL_SAVED_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener(PRICING_MODEL_SAVED_EVENT, bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  return useMemo(() => {
    let saved: any = {};
    try {
      saved = JSON.parse(localStorage.getItem(AGE_BAND_PRICING_STORAGE_KEY) || '{}') || {};
    } catch {
      saved = {};
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
      labourRateFactors: pick(saved.labourRates, PROPOSED_LABOUR_RATE_FACTORS),
      excessFactors: pick(saved.excessFactors, PROPOSED_EXCESS_FACTORS),
      twoYearMult: Number(saved.twoYearMult ?? 1.65),
      threeYearMult: Number(saved.threeYearMult ?? 2.35),
      payInFullFactor: Number(saved.payInFullFactor ?? 0.9),
      /** Changes whenever the saved figures are re-read — handy as a render key. */
      revision: tick,
    };
  }, [tick]);
}
