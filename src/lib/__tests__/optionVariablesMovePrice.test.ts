import { describe, it, expect } from 'vitest';
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
} from '@/components/admin/pricing/AgeBandPricingPreview';
import { priceFromPricingModel } from '@/components/admin/pricing/modelQuoteEngine';

/**
 * EVERY OPTION MUST MOVE THE PRICE.
 * Claim limit, labour rate and voluntary excess each have to change the quoted
 * total on Quotes & Orders / Steps 3-4 — including on floor-bound cheap cars,
 * where a flat clamp used to make every combination land on the same number.
 */

const CLAIM_LIMITS = [1000, 2000, 3000, 5000];
const LABOUR_RATES = [50, 70, 100, 150];
const EXCESSES = [0, 50, 100, 150, 250, 500];
const TERMS = ['12months', '24months', '36months'] as const;

/** Model scaled by `scale` so we can test a floor-bound car and a pricey one. */
const modelAt = (scale: number) => ({
  ageBands: PROPOSED_AGE_BANDS.map(b => ({
    ...b,
    oneYear: b.oneYear == null ? null : Math.round(b.oneYear * scale),
  })),
  mileageBands: PROPOSED_MILEAGE_BANDS,
  powertrains: PROPOSED_POWERTRAIN_FACTORS,
  vehicleTypes: PROPOSED_VEHICLE_TYPE_FACTORS,
  modelRisks: PROPOSED_MODEL_RISK_FACTORS,
  modelFloors: PROPOSED_MODEL_FLOORS,
  claimLimits: PROPOSED_CLAIM_LIMIT_FACTORS,
  labourRateFactors: PROPOSED_LABOUR_RATE_FACTORS,
  excessFactors: PROPOSED_EXCESS_FACTORS,
  twoYearMult: 1.8,
  threeYearMult: 2.52,
  payInFullFactor: 1,
});

const vehicle = { make: 'Ford', model: 'Focus', ageYears: 6, mileage: 60000, fuelType: 'Petrol', vehicleType: 'car' };

const price = (
  scale: number,
  claimLimit: number,
  labourRate: number,
  voluntaryExcess: number,
  paymentPeriod: (typeof TERMS)[number] = '12months'
) =>
  priceFromPricingModel(modelAt(scale) as any, vehicle as any, {
    paymentPeriod,
    claimLimit,
    labourRate,
    voluntaryExcess,
  } as any)!.totalPrice;

// 0.35 = deep floor-bound (worst case for collisions), 1 = normal, 2 = well above floors.
const SCALES = [0.35, 1, 2];

describe('option variables always change the quoted price', () => {
  for (const scale of SCALES) {
    for (const term of TERMS) {
      it(`claim limits are all distinct and rising (scale ${scale}, ${term})`, () => {
        const prices = CLAIM_LIMITS.map(c => price(scale, c, 70, 100, term));
        expect(new Set(prices).size).toBe(prices.length);
        expect(prices).toEqual([...prices].sort((a, b) => a - b));
      });

      it(`labour rates are all distinct and rising (scale ${scale}, ${term})`, () => {
        const prices = LABOUR_RATES.map(l => price(scale, 2000, l, 100, term));
        expect(new Set(prices).size).toBe(prices.length);
        expect(prices).toEqual([...prices].sort((a, b) => a - b));
      });

      it(`excess tiers are all distinct and fall as excess rises (scale ${scale}, ${term})`, () => {
        const prices = EXCESSES.map(e => price(scale, 2000, 70, e, term));
        expect(new Set(prices).size).toBe(prices.length);
        expect(prices).toEqual([...prices].sort((a, b) => b - a));
      });
    }
  }

  it('every one of the 96 combinations is reachable and no combination is free', () => {
    for (const scale of SCALES) {
      for (const c of CLAIM_LIMITS) {
        for (const l of LABOUR_RATES) {
          for (const e of EXCESSES) {
            expect(price(scale, c, l, e)).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('changing any single option away from the reference moves the price', () => {
    for (const scale of SCALES) {
      const ref = price(scale, 2000, 70, 100);
      expect(price(scale, 3000, 70, 100)).not.toBe(ref);
      expect(price(scale, 2000, 100, 100)).not.toBe(ref);
      expect(price(scale, 2000, 70, 250)).not.toBe(ref);
    }
  });
});
