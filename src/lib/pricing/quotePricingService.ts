/**
 * SINGLE QUOTE PRICING SERVICE (Phase 2 — draft only)
 * ---------------------------------------------------------------------------
 * One function that turns (vehicle + cover options) into a full, auditable
 * price breakdown, composed from the existing engine primitives so the numbers
 * match today's live pages step for step.
 *
 * Draft status: nothing in the customer journey or Quotes & Orders imports this
 * yet. It is exercised from Admin → Price updates → Pricing engine (draft),
 * where its output is compared line by line against the current pages. Only
 * after parity is proven do the pages switch over to it.
 *
 * It also surfaces the double-charging risk explicitly: when a published
 * vehicle factor model is live, the legacy age/mileage surcharge is reported
 * separately as `legacySurcharge` so we can see exactly what would be removed.
 */

import {
  getBasePrice as getGridBasePrice,
  applyBasePriceFloor,
  applyReliableBrandDiscount,
  getLabourRateFactor,
  getWebReferencePrice,
  DEFAULT_LABOUR_RATE,
  DEFAULT_EXCESS,
  DEFAULT_CLAIM_LIMIT,
  DURATION_MONTHS,
  type PaymentPeriod,
  type PricingSurface,
} from '@/lib/pricingMatrix';
import {
  calculateVehiclePriceAdjustment,
  applyPriceAdjustment,
  isMotorbikeAdjustment,
} from '@/lib/vehicleValidation';
import { getVehiclePriceFactor, hasLiveVehicleFactorModel } from '@/lib/pricing/vehicleFactorModel';
import { evaluateBoundaries, type BoundaryResult } from '@/lib/pricing/eligibilityBoundaries';
import type { RoundingRule } from '@/lib/pricing/pricingVersionConfig';

/** Annual labour-rate uplift used by the live pages (£/year on top of base). */
const LABOUR_RATE_ANNUAL_UPLIFT: Record<number, number> = {
  50: 0,
  70: 4 * 12,
  100: 8 * 12,
  150: 24 * 12,
};

/** Boost (£60 claim-limit uplift) as charged today. */
export const BOOST_COST = 60;

/** Multi-year goodwill discounts applied on the customer journey today. */
const MULTI_YEAR_DISCOUNT: Partial<Record<PaymentPeriod, number>> = {
  '24months': 100,
  '36months': 200,
};

export type QuoteVehicle = {
  make?: string | null;
  model?: string | null;
  fuelType?: string | null;
  transmission?: string | null;
  vehicleType?: string | null;
  registrationDate?: string | null;
  yearOfManufacture?: string | number | null;
  mileage?: string | number | null;
  regNumber?: string | null;
};

export type QuotePricingInput = {
  vehicle: QuoteVehicle;
  paymentPeriod: PaymentPeriod;
  voluntaryExcess?: number;
  claimLimit?: number;
  labourRate?: number;
  boostAddon?: boolean;
  /** Recurring + one-off add-ons already totalled by the caller. */
  addOnTotal?: number;
  surface?: PricingSurface;
  /** Skip the boundary check (admin override, e.g. skipAgeCheck). */
  skipEligibility?: boolean;
  rounding?: RoundingRule;
  asOf?: Date;
};

export type QuotePriceLine = { label: string; amount: number; note?: string };

export type QuotePriceResult = {
  eligibility: BoundaryResult;
  /** True when the vehicle cannot be priced (declined / referral, no override). */
  blocked: boolean;
  gridBasePrice: number;
  vehicleFactor: number;
  reliableBrandDiscount: number;
  legacySurcharge: number;
  legacySurchargeDoubleCounts: boolean;
  multiYearDiscount: number;
  flooredBasePrice: number;
  floorApplied: boolean;
  labourUplift: number;
  boostCost: number;
  addOnTotal: number;
  total: number;
  monthlyEquivalent: number;
  webReferencePrice: number;
  lines: QuotePriceLine[];
};

function round(value: number, rule: RoundingRule = 'ceil_pound'): number {
  if (rule === 'floor_pound') return Math.floor(value);
  if (rule === 'round_pound') return Math.round(value);
  return Math.ceil(value);
}

export function calculateQuotePrice(input: QuotePricingInput): QuotePriceResult {
  const {
    vehicle,
    paymentPeriod,
    voluntaryExcess = DEFAULT_EXCESS,
    claimLimit = DEFAULT_CLAIM_LIMIT,
    labourRate = DEFAULT_LABOUR_RATE,
    boostAddon = false,
    addOnTotal = 0,
    surface = 'customer',
    skipEligibility = false,
    rounding = 'ceil_pound',
    asOf,
  } = input;

  const eligibility = evaluateBoundaries({
    registrationDate: vehicle.registrationDate,
    yearOfManufacture: vehicle.yearOfManufacture,
    mileage: vehicle.mileage,
    make: vehicle.make,
    model: vehicle.model,
    asOf,
  });
  // An excluded make/model is a hard stop: skipEligibility (admin skipAgeCheck)
  // only ever forgives age/mileage, never the excluded vehicle matrix.
  const blocked = eligibility.excluded || (!skipEligibility && eligibility.outcome !== 'eligible');

  const warrantyYears = (DURATION_MONTHS[paymentPeriod] ?? 12) / 12;
  const vehicleFactor = getVehiclePriceFactor(vehicle as never);

  const gridBasePrice = getGridBasePrice(
    paymentPeriod,
    voluntaryExcess,
    claimLimit,
    surface,
    vehicleFactor
  );

  const afterBrand = applyReliableBrandDiscount(gridBasePrice, vehicle.make, vehicle.fuelType);
  const reliableBrandDiscount = gridBasePrice - afterBrand;

  const adjustment = calculateVehiclePriceAdjustment(vehicle as never, warrantyYears);
  const afterLegacy = applyPriceAdjustment(afterBrand, adjustment);
  const legacySurcharge = afterLegacy - afterBrand;

  const multiYearDiscount =
    surface === 'customer' ? MULTI_YEAR_DISCOUNT[paymentPeriod] ?? 0 : 0;
  const discounted = afterLegacy - multiYearDiscount;

  const vehicleName = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const flooredBasePrice = applyBasePriceFloor(
    discounted,
    paymentPeriod,
    voluntaryExcess,
    isMotorbikeAdjustment(adjustment),
    surface,
    vehicleName || null,
    claimLimit
  );

  const labourUplift = Math.round(
    (LABOUR_RATE_ANNUAL_UPLIFT[labourRate] ?? 0) * warrantyYears
  );
  const boostCost = boostAddon ? BOOST_COST : 0;

  const total = round(flooredBasePrice + labourUplift + boostCost + addOnTotal, rounding);
  const months = DURATION_MONTHS[paymentPeriod] ?? 12;
  const monthlyEquivalent = Math.ceil(total / months);
  const webReferencePrice =
    surface === 'admin' ? getWebReferencePrice(total).price : total;

  const lines: QuotePriceLine[] = [
    {
      label: 'Grid base price',
      amount: gridBasePrice,
      note: vehicleFactor === 1 ? 'reference vehicle' : `vehicle factor ×${vehicleFactor.toFixed(3)}`,
    },
    ...(reliableBrandDiscount
      ? [{ label: 'Reliable-brand discount', amount: -reliableBrandDiscount }]
      : []),
    ...(legacySurcharge
      ? [
          {
            label: 'Legacy age / mileage surcharge',
            amount: legacySurcharge,
            note: hasLiveVehicleFactorModel()
              ? 'double-counts the factor model — candidate for removal'
              : undefined,
          },
        ]
      : []),
    ...(multiYearDiscount ? [{ label: 'Multi-year discount', amount: -multiYearDiscount }] : []),
    {
      label: 'Base after floor',
      amount: flooredBasePrice,
      note: flooredBasePrice > discounted ? 'floor applied' : undefined,
    },
    ...(labourUplift ? [{ label: `Labour rate £${labourRate}/hr`, amount: labourUplift }] : []),
    ...(boostCost ? [{ label: 'Claim-limit boost', amount: boostCost }] : []),
    ...(addOnTotal ? [{ label: 'Add-ons', amount: addOnTotal }] : []),
    { label: 'Total', amount: total },
  ];

  return {
    eligibility,
    blocked,
    gridBasePrice,
    vehicleFactor,
    reliableBrandDiscount,
    legacySurcharge,
    legacySurchargeDoubleCounts: legacySurcharge > 0 && hasLiveVehicleFactorModel(),
    multiYearDiscount,
    flooredBasePrice,
    floorApplied: flooredBasePrice > discounted,
    labourUplift,
    boostCost,
    addOnTotal,
    total,
    monthlyEquivalent,
    webReferencePrice,
    lines,
  };
}

/** Labour-rate factor kept accessible for callers that display the multiplier. */
export { getLabourRateFactor };
