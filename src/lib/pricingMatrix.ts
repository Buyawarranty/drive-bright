/**
 * Centralized pricing matrix and utilities for warranty pricing.
 * 
 * PRICING RULES (UPDATED JAN 2026):
 * - BASE prices are from CURRENT_PRICE_JAN_2026.xlsx at £70/hr labour rate (DEFAULT), £100 excess, £1250 claim limit
 * - Labour rate £50/hr = -£5/month for duration (BELOW base)
 * - Labour rate £70/hr = base price (no adjustment) - DEFAULT
 * - Labour rate £100/hr = +£8/month for duration
 * - Labour rate £200/hr = +£24/month for duration
 * - Boost claim limit (+£1000) = +£5/month × 12 payments = £60 total (same for all durations)
 * - All payments are ALWAYS 12 monthly installments
 * - Monthly = Math.ceil(total / 12) - ALWAYS round UP to a whole pound (no decimals anywhere)
 * - "Was" price = total + marketing savings (£100 for 2yr, £200 for 3yr) - display only
 * - Pay in full = exact Excel total price
 * - Transfer Cover = +£19 one-off (not monthly)
 */

import { getVehicleRuleMinPrice } from './pricing/vehicleRules';

// Base pricing matrix - 3% INCREASE applied (Jun 2026), floored to whole numbers
// Previous baseline was the May 2026 +12% matrix; all values multiplied by 1.03 and floored.
// These are the base prices at £70/hr labour rate (DEFAULT)
// NOTE: Admin Quotes & Orders pages apply an additional +10% markup on top via
// calculateAdminQuoteWarrantyPrice (see below). Customer website Steps 1–4 use this
// matrix unchanged.
export const BASE_PRICING_MATRIX = {
  // +5% uplift applied (Jul 2026) to 12 months ONLY — 2yr/3yr unchanged.
  '12months': {
    0: { 750: 486, 1250: 516, 2000: 613 },
    50: { 750: 454, 1250: 475, 2000: 569 },
    100: { 750: 402, 1250: 433, 2000: 529 },
    150: { 750: 357, 1250: 402, 2000: 497 },
    250: { 750: 277, 1250: 326, 2000: 417 },
    500: { 750: 177, 1250: 200, 2000: 247 }
  },
  // +20% uplift applied (Jul 2026) to 2yr and 3yr only — 12 months unchanged.
  '24months': {
    0: { 750: 1071, 1250: 1119, 2000: 1226 },
    50: { 750: 988, 1250: 1047, 2000: 1142 },
    100: { 750: 879, 1250: 939, 2000: 1047 },
    150: { 750: 831, 1250: 879, 2000: 988 },
    250: { 750: 650, 1250: 718, 2000: 829 },
    500: { 750: 415, 1250: 469, 2000: 562 }
  },
  '36months': {
    0: { 750: 1609, 1250: 1669, 2000: 1789 },
    50: { 750: 1490, 1250: 1549, 2000: 1669 },
    100: { 750: 1309, 1250: 1407, 2000: 1527 },
    150: { 750: 1250, 1250: 1309, 2000: 1429 },
    250: { 750: 1010, 1250: 1052, 2000: 1167 },
    500: { 750: 802, 1250: 844, 2000: 960 }
  }
} as const;

// Marketing savings display (NOT actual discounts - just for "Was £X" display)
export const MARKETING_SAVINGS: Record<string, number> = {
  '12months': 0,
  '24months': 100,
  '36months': 200
};

// Duration in months for each payment period
export const DURATION_MONTHS = {
  '12months': 12,
  '24months': 24,
  '36months': 36
} as const;

/**
 * Labour-rate FACTORS, applied multiplicatively to the (floored) base price.

 * £70/hour is the reference option at factor 1.00, so the factor scales with the
 * vehicle price instead of being a flat £/month add-on.
 *   £50/hr  0.84 — budget garage option
 *   £70/hr  1.00 — most popular / reference
 *   £100/hr 1.18 — broader garage choice
 *   £150/hr 1.80 — premium / specialist repairers (was £200/hr)
 *
 * These are the code defaults. Admin → Price updates can publish a live set of
 * factors that overrides these without changing code.
 */
export const LABOUR_RATE_FACTOR: Record<number, number> = {
  50: 0.84,
  70: 1.00,
  100: 1.18,
  150: 1.80,
  // Legacy premium tier — kept so existing quotes/policies saved at £200/hr still price.
  200: 1.80,
};

/** Live override for labour-rate factors, set from the published pricing version. */
let LIVE_LABOUR_RATE_FACTORS: Record<number, number> | null = null;

export interface LabourRateOption {
  rate: number;
  factor: number;
  /** Customer-facing description, editable in Admin → Price updates. */
  label?: string | null;
}

/** Ordered live labour-rate options (rate + factor + label), when published. */
let LIVE_LABOUR_RATE_OPTIONS: LabourRateOption[] | null = null;

/** Event name fired whenever live pricing (matrix, labour rates) changes at runtime. */
export const PRICING_UPDATED_EVENT = 'bw:pricing-updated';

function notifyPricingUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PRICING_UPDATED_EVENT));
  }
}

/** Built-in options used when no live pricing version publishes labour rates. */
export const DEFAULT_LABOUR_RATE_OPTIONS: LabourRateOption[] = [
  { rate: 50, factor: 0.84, label: 'Local Garages' },
  { rate: 70, factor: 1.00, label: 'Independent Garages' },
  { rate: 100, factor: 1.18, label: 'Approved Garages' },
  { rate: 150, factor: 1.80, label: 'Specialist garages' },
];

export function setLiveLabourRateFactors(
  factors: { rate: number; factor: number; label?: string | null }[] | Record<number, number> | null
): void {
  if (!factors) {
    LIVE_LABOUR_RATE_FACTORS = null;
    LIVE_LABOUR_RATE_OPTIONS = null;
    notifyPricingUpdated();
    return;
  }
  if (Array.isArray(factors)) {
    const map: Record<number, number> = {};
    const options: LabourRateOption[] = [];
    for (const f of factors) {
      if (Number.isFinite(Number(f.rate)) && Number.isFinite(Number(f.factor)) && Number(f.factor) > 0) {
        map[Number(f.rate)] = Number(f.factor);
        options.push({ rate: Number(f.rate), factor: Number(f.factor), label: f.label ?? null });
      }
    }
    LIVE_LABOUR_RATE_FACTORS = map;
    LIVE_LABOUR_RATE_OPTIONS = options.length ? options.sort((a, b) => a.rate - b.rate) : null;
  } else {
    LIVE_LABOUR_RATE_FACTORS = { ...factors };
    LIVE_LABOUR_RATE_OPTIONS = Object.keys(factors)
      .map(k => ({ rate: Number(k), factor: (factors as Record<number, number>)[Number(k)], label: null }))
      .sort((a, b) => a.rate - b.rate);
  }
  notifyPricingUpdated();
}

export function getLiveLabourRateFactors(): Record<number, number> | null {
  return LIVE_LABOUR_RATE_FACTORS;
}

/**
 * The labour-rate options that should be shown to agents/customers.
 * Uses the published pricing version when available, otherwise code defaults.
 */
export function getLabourRateOptions(): LabourRateOption[] {
  return LIVE_LABOUR_RATE_OPTIONS && LIVE_LABOUR_RATE_OPTIONS.length
    ? LIVE_LABOUR_RATE_OPTIONS
    : DEFAULT_LABOUR_RATE_OPTIONS;
}

export function hasLiveLabourRateFactorsOverride(): boolean {
  return LIVE_LABOUR_RATE_FACTORS !== null;
}


/** Read the factor for a labour rate, using the live override if one exists. */
export function getLabourRateFactor(labourRate: number): number {
  if (LIVE_LABOUR_RATE_FACTORS && Number.isFinite(LIVE_LABOUR_RATE_FACTORS[labourRate])) {
    return LIVE_LABOUR_RATE_FACTORS[labourRate];
  }
  return LABOUR_RATE_FACTOR[labourRate] ?? LABOUR_RATE_FACTOR[DEFAULT_LABOUR_RATE] ?? 1;
}

// Legacy flat £/month table — kept only for the admin reference tables that still
// display a per-month figure. Pricing itself uses LABOUR_RATE_FACTOR above.
export const LABOUR_RATE_MONTHLY_ADJUSTMENT: Record<number, number> = {
  50: -5,
  70: 0,
  100: 8,
  150: 24,
  200: 24
};


// Default labour rate is now £70/hr
export const DEFAULT_LABOUR_RATE = 70;


// Default excess is £100
export const DEFAULT_EXCESS = 100;

// Default claim limit is £1250
export const DEFAULT_CLAIM_LIMIT = 1250;

// Boost claim limit adds £5/month
export const BOOST_CLAIM_LIMIT_MONTHLY = 5;

// Transfer Cover one-off price (not monthly)
export const TRANSFER_COVER_PRICE = 19;

export type PaymentPeriod = keyof typeof BASE_PRICING_MATRIX;
export type ExcessAmount = keyof typeof BASE_PRICING_MATRIX['12months'];
export type ClaimLimit = keyof typeof BASE_PRICING_MATRIX['12months'][0];

/**
 * Per-duration minimum BASE price (after vehicle adjustment, before labour/boost/add-ons).
 * The £500-excess tier sits at the absolute floor; the £250-excess tier sits one step above
 * so it is always strictly more expensive than £500. Lower excess tiers (£0–£150) are not
 * bumped — the matrix already prices them above the floor.
 * Labour-rate, boost, and add-ons always charge their full incremental amount on top.
 */
export const MIN_BASE_PRICE_BY_PERIOD: Record<PaymentPeriod, number> = {
  '12months': 294,
  '24months': 672,
  '36months': 1008,
};

// Minimum gap between the £250-excess tier and the £500-excess tier so £500 stays cheaper.
export const EXCESS_TIER_STEP_BY_PERIOD: Record<PaymentPeriod, number> = {
  '12months': 21,
  '24months': 48,
  '36months': 72,
};

/**
 * The floor is SHAPED by the selected excess and claim limit, anchored on the
 * £150 excess / £2,000 claim limit tier (= 1.00 = MIN_BASE_PRICE_BY_PERIOD).
 * Without this, whenever the published grid sits at or below the floor every
 * excess and claim limit collapses to the same price and Step 3 looks broken.
 * Ratios come from the reference grid so the steps feel the same as the matrix.
 */
export const EXCESS_FLOOR_MULTIPLIER: Record<number, number> = {
  0: 1.0,
  50: 1.0,
  100: 1.0,
  150: 1.0,
  250: 1.0,
  500: 1.0,
};

/**
 * The excess a price is quoted at before any excess adjustment is applied.
 * £100 = "Balanced" = £0 difference.
 */
export const EXCESS_BASELINE = 100;

/**
 * Voluntary excess price difference, expressed as £ per monthly instalment
 * (instalments are always 12, so the total adjustment is delta × 12).
 * Positive = costs more (lower excess), negative = saving (higher excess).
 */
export const EXCESS_MONTHLY_DELTA: Record<PaymentPeriod, Record<number, number>> = {
  '12months': { 0: 5, 50: 3, 100: 0, 150: -2, 250: -5, 500: -9 },
  '24months': { 0: 3, 50: 2, 100: 0, 150: -1, 250: -3, 500: -5 },
  '36months': { 0: 2, 50: 1, 100: 0, 150: -1, 250: -2, 500: -3 },
};

/** £ per month difference vs the £100 baseline for the given term + excess. */
export function getExcessMonthlyDelta(paymentPeriod: PaymentPeriod, excess: number): number {
  const table = EXCESS_MONTHLY_DELTA[paymentPeriod] ?? EXCESS_MONTHLY_DELTA['12months'];
  if (table[excess] !== undefined) return table[excess];
  const keys = Object.keys(table).map(Number);
  const nearest = keys.reduce((best, k) =>
    Math.abs(k - excess) < Math.abs(best - excess) ? k : best, keys[0]);
  return table[nearest] ?? 0;
}

/** Total (whole-term) price difference vs the £100 baseline. */
export function getExcessTotalAdjustment(paymentPeriod: PaymentPeriod, excess: number): number {
  return getExcessMonthlyDelta(paymentPeriod, excess) * 12;
}


export const CLAIM_LIMIT_FLOOR_MULTIPLIER: Record<number, number> = {
  750: 0.89,
  1000: 0.89,
  1250: 1.0,
  2000: 1.0,
  3000: 1.13,
  5000: 1.13,
};

/** Nearest defined multiplier so unusual values never fall back to a flat 1. */
function nearestMultiplier(table: Record<number, number>, value?: number): number {
  if (value === undefined || value === null || !Number.isFinite(value)) return 1;
  const keys = Object.keys(table).map(Number);
  const nearest = keys.reduce((best, k) =>
    Math.abs(k - value) < Math.abs(best - value) ? k : best, keys[0]);
  return table[nearest] ?? 1;
}


/**
 * Motorbikes are priced at 50% of the equivalent standard vehicle price.
 * This applies to the base matrix price AND to the minimum base price floor,
 * so the half price is never clawed back by the car floor.
 */
export const MOTORBIKE_PRICE_MULTIPLIER = 0.5;

/**
 * Customer journey (Step 3 → Step 4) only uplift: +10% on the base price and the
 * base price floor, rounded to whole pounds. Admin Quotes & Orders pricing is
 * NOT affected (it reads the same grid with surface = 'admin').
 * Dealer portal has its own engine and is unaffected.
 */
export const CUSTOMER_JOURNEY_PRICE_MULTIPLIER = 1.10;

export function applyCustomerJourneyUplift(price: number, surface: PricingSurface = 'customer'): number {
  if (surface === 'admin') return price;
  return Math.ceil(price * CUSTOMER_JOURNEY_PRICE_MULTIPLIER);
}

export function applyBasePriceFloor(
  adjustedBasePrice: number,
  paymentPeriod: PaymentPeriod,
  voluntaryExcess?: number,
  isMotorbike?: boolean,
  surface: PricingSurface = 'customer',
  /**
   * Optional vehicle name ("TESLA MODEL 3"). When a model-specific minimum price is
   * set in Admin → Price updates, it lifts the floor on BOTH the admin Quotes & Orders
   * page and the customer journey (Steps 3 → 4).
   */
  vehicleName?: string | null,
  /** Selected claim limit, so the floor steps with the cover level too. */
  claimLimit?: number
): number {
  const minBase = MIN_BASE_PRICE_BY_PERIOD[paymentPeriod] ?? 0;
  // Shape the floor by excess and claim limit so the customer always sees the
  // price move when they change an option, even if the published grid is flat.
  const rawFloor = Math.round(
    minBase *
      nearestMultiplier(EXCESS_FLOOR_MULTIPLIER, voluntaryExcess) *
      nearestMultiplier(CLAIM_LIMIT_FLOOR_MULTIPLIER, claimLimit)
  );
  const upliftedFloor = applyCustomerJourneyUplift(rawFloor, surface);
  const effectiveFloor = isMotorbike
    ? Math.ceil(upliftedFloor * MOTORBIKE_PRICE_MULTIPLIER)
    : upliftedFloor;
  // Model-specific minimum (never halved for motorbikes — it is an absolute minimum).
  const ruleFloor = getVehicleRuleMinPrice(vehicleName, paymentPeriod) ?? 0;
  return Math.max(adjustedBasePrice, effectiveFloor, ruleFloor);
}





/**
 * Reliable-brand base price discount.
 * Non-EV vehicles from these makes get a fixed 20% discount on the BASE matrix price
 * (before vehicle adjustments, labour, boost, and add-ons; the standard base floor still
 * applies as a safety net afterwards).
 *
 * Applies uniformly to both the customer website Steps 1–4 pricing AND the admin
 * Quotes & Orders pricing so the two pages never diverge.
 * Dealer portal has its own separate pricing engine and is intentionally excluded.
 */
export const RELIABLE_BRAND_DISCOUNT_PCT = 0.20;

export const RELIABLE_BRAND_DISCOUNT_MAKES: readonly string[] = [
  'lexus',
  'toyota',
  'honda',
  'suzuki',
  'hyundai',
  'kia',
  'mazda',
];

export function isEVFuelType(fuelType?: string | null): boolean {
  if (!fuelType) return false;
  const f = String(fuelType).toLowerCase().trim();
  // Treat pure electric / BEV as EV. Hybrids and PHEVs still qualify as non-EV.
  return f === 'electric' || f === 'electricity' || f === 'ev' || f === 'bev';
}

export function qualifiesForReliableBrandDiscount(
  make?: string | null,
  fuelType?: string | null
): boolean {
  if (!make) return false;
  if (isEVFuelType(fuelType)) return false;
  const normalized = String(make).toLowerCase().replace(/dvla/gi, '').trim();
  // Match "hyundai / kia" style variants and exact matches.
  return RELIABLE_BRAND_DISCOUNT_MAKES.some(
    m => normalized === m || normalized.startsWith(`${m} `) || normalized.endsWith(` ${m}`)
  );
}

/**
 * Apply the reliable-brand base price discount if the vehicle qualifies.
 * Safe no-op when make/fuelType are missing or the vehicle is an EV.
 */
export function applyReliableBrandDiscount(
  basePrice: number,
  make?: string | null,
  fuelType?: string | null
): number {
  if (!qualifiesForReliableBrandDiscount(make, fuelType)) return basePrice;
  return Math.ceil(basePrice * (1 - RELIABLE_BRAND_DISCOUNT_PCT));
}

/* =========================================================================
 * LIVE PRICING OVERRIDE (managed from Admin → Price updates)
 * -------------------------------------------------------------------------
 * The admin "Price updates" section stores a Quotes & Orders (admin) price
 * grid. When a version is published live, that grid becomes the source of
 * truth: admin surfaces use it as-is, and the customer journey (Steps 1–4)
 * uses it minus the configured discount (default 10%), rounded to whole £.
 * With no live version, everything falls back to BASE_PRICING_MATRIX and the
 * legacy ADMIN_QUOTE_PRICE_MULTIPLIER behaviour below.
 * ========================================================================= */

export type PricingMatrixShape = Record<string, Record<string, Record<string, number>>>;

export type PricingSurface = 'customer' | 'admin';

let LIVE_ADMIN_MATRIX: PricingMatrixShape | null = null;
let LIVE_STEP3_DISCOUNT_PCT = 10;

export function setLivePricingOverride(
  adminMatrix: PricingMatrixShape | null,
  step3DiscountPct = 10
): void {
  LIVE_ADMIN_MATRIX = adminMatrix;
  LIVE_STEP3_DISCOUNT_PCT = step3DiscountPct;
  notifyPricingUpdated();
}

export function hasLivePricingOverride(): boolean {
  return LIVE_ADMIN_MATRIX !== null;
}

export function getLiveStep3DiscountPct(): number {
  return LIVE_STEP3_DISCOUNT_PCT;
}

/** Snapshot the current override so a temporary preview can restore it later. */
export function getLivePricingOverride(): {
  adminMatrix: PricingMatrixShape | null;
  step3DiscountPct: number;
} {
  return { adminMatrix: LIVE_ADMIN_MATRIX, step3DiscountPct: LIVE_STEP3_DISCOUNT_PCT };
}


/**
 * Hard cap on how much cheaper the online (website) price may be than the admin
 * Quotes & Orders grid price. The web price is never allowed to undercut the grid
 * by more than this percentage.
 */
export const MAX_WEB_DISCOUNT_VS_GRID_PCT = 10;

/** Clamp any requested web discount to the 0–10% band. */
export function clampWebDiscountPct(discountPct: number): number {
  if (!Number.isFinite(discountPct) || discountPct <= 0) return 0;
  return Math.min(discountPct, MAX_WEB_DISCOUNT_VS_GRID_PCT);
}

/** Derive the customer (Step 3) price from an admin Quotes & Orders price. */
export function deriveCustomerPriceFromAdmin(adminPrice: number, discountPct = 10): number {
  return Math.ceil(adminPrice * (1 - clampWebDiscountPct(discountPct) / 100));
}

/**
 * Reference web (online) price for a given admin grid total — used for the
 * "Web price" column/tooltip on the Quotes & Orders grid. Guaranteed to be at
 * most MAX_WEB_DISCOUNT_VS_GRID_PCT cheaper than the grid price.
 */
export function getWebReferencePrice(
  gridTotalPrice: number,
  discountPct: number = getLiveStep3DiscountPct()
): { price: number; discountPct: number; saving: number } {
  const pct = clampWebDiscountPct(discountPct);
  const floorPrice = Math.ceil(gridTotalPrice * (1 - MAX_WEB_DISCOUNT_VS_GRID_PCT / 100));
  const price = Math.max(floorPrice, Math.ceil(gridTotalPrice * (1 - pct / 100)));
  return { price, discountPct: pct, saving: Math.max(0, gridTotalPrice - price) };
}

/** Build a full customer matrix from an admin matrix (Step 3 = admin − discount%). */
export function deriveCustomerMatrix(
  adminMatrix: PricingMatrixShape,
  discountPct = 10
): PricingMatrixShape {
  const out: PricingMatrixShape = {};
  for (const period of Object.keys(adminMatrix)) {
    out[period] = {};
    for (const excess of Object.keys(adminMatrix[period])) {
      out[period][excess] = {};
      for (const limit of Object.keys(adminMatrix[period][excess])) {
        out[period][excess][limit] = deriveCustomerPriceFromAdmin(
          adminMatrix[period][excess][limit],
          discountPct
        );
      }
    }
  }
  return out;
}

/**
 * Get base price from the pricing matrix
 * PROMO: For 2yr/3yr plans with £2000 claim limit, use £1250 pricing
 * (customer gets £2000 coverage for the price of £1250)
 */
export function getBasePrice(
  paymentPeriod: PaymentPeriod,
  voluntaryExcess: number,
  claimLimit: number,
  surface: PricingSurface = 'customer',
  /**
   * Vehicle risk multiplier (age × mileage × powertrain × vehicle type) from the
   * published Age-based builder figures. 1 = the reference vehicle, i.e. exactly
   * the published grid price.
   */
  vehicleFactor = 1
): number {
  // PROMO LOGIC: For 2yr/3yr plans with £2000 claim limit, use £1250 pricing
  const isMultiYearPlan = paymentPeriod === '24months' || paymentPeriod === '36months';
  const pricingClaimLimit = (isMultiYearPlan && claimLimit === 2000) ? 1250 : claimLimit;
  const factor = Number.isFinite(vehicleFactor) && vehicleFactor > 0 ? vehicleFactor : 1;
  const withFactor = (price: number) => (factor === 1 ? price : Math.ceil(price * factor));

  if (LIVE_ADMIN_MATRIX) {
    const periodData = LIVE_ADMIN_MATRIX[paymentPeriod] || LIVE_ADMIN_MATRIX['12months'];
    // Excess is priced by an explicit £/mo difference (see EXCESS_MONTHLY_DELTA),
    // so the grid is always read at the £100 baseline column.
    const excessData = periodData?.[String(EXCESS_BASELINE)] || periodData?.[String(voluntaryExcess)] || periodData?.[String(DEFAULT_EXCESS)];
    const adminPrice =
      excessData?.[String(pricingClaimLimit)] ?? excessData?.[String(DEFAULT_CLAIM_LIMIT)];
    if (typeof adminPrice === 'number') {
      const adjusted = withFactor(adminPrice);
      return surface === 'admin'
        ? adjusted
        : applyCustomerJourneyUplift(
            deriveCustomerPriceFromAdmin(adjusted, LIVE_STEP3_DISCOUNT_PCT),
            surface
          );
    }
  }

  const periodData = BASE_PRICING_MATRIX[paymentPeriod] || BASE_PRICING_MATRIX['12months'];
  const excessData = periodData[EXCESS_BASELINE as ExcessAmount] || periodData[voluntaryExcess as ExcessAmount] || periodData[DEFAULT_EXCESS];

  const codePrice = excessData[pricingClaimLimit as ClaimLimit] || excessData[DEFAULT_CLAIM_LIMIT];
  return applyCustomerJourneyUplift(withFactor(codePrice), surface);
}




/**
 * Calculate the labour rate adjustment for the total price.
 *
 * The adjustment is MULTIPLICATIVE: the (floored) base price is scaled by the
 * labour-rate factor, so £200/hr costs proportionally more on an expensive
 * vehicle than on a cheap one. £70/hr is the reference (factor 1.00 → £0).
 *
 * @param labourRate The selected labour rate (50, 70, 100 or 200)
 * @param paymentPeriod The warranty duration
 * @param baseAmount The base price the factor applies to (after floors/vehicle adjustments)
 * @returns Total adjustment amount (negative for £50/hr)
 */
export function calculateLabourRateAdjustment(
  labourRate: number,
  paymentPeriod: PaymentPeriod,
  baseAmount?: number
): number {
  const factor = getLabourRateFactor(labourRate);
  if (typeof baseAmount === 'number' && baseAmount > 0) {
    return Math.round(baseAmount * (factor - 1));
  }
  // No base supplied (legacy reference tables): fall back to the £70/hr reference
  // grid so the figure shown is still representative.
  const referenceBase = getBasePrice(paymentPeriod, DEFAULT_EXCESS, DEFAULT_CLAIM_LIMIT);
  return Math.round(referenceBase * (factor - 1));
}


/**
 * Calculate boost claim limit adjustment (+£1000 claim limit for £5/month)
 * @param boost the 12months 2000: 584 → 642, 24months 2000: 1022 → 1124, 36months 2000: 1491 → 1640
 */
export function calculateBoostAdjustment(
  boostEnabled: boolean,
  paymentPeriod: PaymentPeriod
): number {
  if (!boostEnabled) return 0;
  // Always £5/month × 12 payments = £60 total, regardless of cover duration
  // All payments are made over 12 months, so boost cost is always the same
  return BOOST_CLAIM_LIMIT_MONTHLY * 12;
}

/**
 * Get the equivalent monthly price adjustment for a labour rate (display only).
 * Derived from the multiplicative factor, spread over the 12 instalments.
 */
export function getLabourRateMonthlyAdjustment(
  labourRate: number,
  baseAmount?: number,
  paymentPeriod: PaymentPeriod = '12months'
): number {
  const total = calculateLabourRateAdjustment(labourRate, paymentPeriod, baseAmount);
  return Math.ceil(total / 12);
}


/**
 * Calculate the full warranty price including all adjustments
 * IMPORTANT: This returns the EXACT total from Excel + adjustments
 * Monthly is always Math.ceil(total / 12) - rounded UP to a whole pound
 */
export function calculateTotalWarrantyPrice(params: {
  paymentPeriod: PaymentPeriod;
  voluntaryExcess: number;
  claimLimit: number;
  labourRate?: number;
  boostEnabled?: boolean;
  vehicleAdjustment?: number;
  addOnPrice?: number;
  /** Optional vehicle make — used to apply the reliable-brand 20% base discount. */
  make?: string | null;
  /** Optional fuel type — EVs are excluded from the reliable-brand discount. */
  fuelType?: string | null;
  /** Motorbikes are priced at 50% of the standard vehicle price (base + floor). */
  isMotorbike?: boolean;
  /**
   * Optional full vehicle name ("TESLA MODEL 3") — used to apply model-specific
   * minimum prices set in Admin → Price updates.
   */
  vehicleName?: string | null;
  /** Internal: which price grid to read when a live pricing override is published. */
  surface?: PricingSurface;
  /**
   * Vehicle risk multiplier from the published Age-based builder figures
   * (age × mileage × powertrain × vehicle type). 1 = reference vehicle.
   */
  vehicleFactor?: number;
}): { totalPrice: number; monthlyPrice: number; wasPrice: number; savings: number } {
  const {
    paymentPeriod,
    voluntaryExcess,
    claimLimit,
    labourRate = DEFAULT_LABOUR_RATE,
    boostEnabled = false,
    vehicleAdjustment = 0,
    addOnPrice = 0,
    make,
    fuelType,
    isMotorbike = false,
    vehicleName,
    surface = 'customer',
    vehicleFactor = 1,
  } = params;


  // 1. Get base price from matrix (EXACT Excel price at £70/hr default)
  const rawBasePrice = getBasePrice(paymentPeriod, voluntaryExcess, claimLimit, surface, vehicleFactor);


  // 1a. Apply reliable-brand -20% base discount for non-EV Lexus/Toyota/Honda/Suzuki/Hyundai/Kia/Mazda.
  const brandDiscountedBase = applyReliableBrandDiscount(rawBasePrice, make, fuelType);

  // 1b. Motorbikes: half the standard vehicle base price.
  const basePrice = isMotorbike
    ? Math.ceil(brandDiscountedBase * MOTORBIKE_PRICE_MULTIPLIER)
    : brandDiscountedBase;

  // 2. Apply vehicle adjustments (Range Rover, van, mileage, age).
  // Percentage-style adjustments (e.g. the legacy motorbike -0.5) are ignored here —
  // motorbike pricing is handled by the isMotorbike flag above.
  const fixedAdjustment =
    vehicleAdjustment > -1 && vehicleAdjustment < 0 ? 0 : vehicleAdjustment;
  const adjustedBasePrice = basePrice + fixedAdjustment;

  // 3. Enforce minimum BASE price floor (halved for motorbikes, +10% on the customer journey,
  //    lifted by any model-specific minimum for this vehicle)
  const flooredBase = applyBasePriceFloor(adjustedBasePrice, paymentPeriod, voluntaryExcess, isMotorbike, surface, vehicleName);




  // 4. Add labour rate adjustment (can be negative for £50/hr)
  const labourAdjustment = calculateLabourRateAdjustment(labourRate, paymentPeriod, flooredBase);

  // 5. Add boost claim limit adjustment
  const boostAdjustment = calculateBoostAdjustment(boostEnabled, paymentPeriod);

  // 6. Add protection add-ons (Transfer Cover is £19 one-off, handled by caller)
  // 5b. Voluntary excess difference (explicit £/mo table, £100 = £0)
  const excessAdjustment = getExcessTotalAdjustment(paymentPeriod, voluntaryExcess);

  const rawTotal = flooredBase + labourAdjustment + boostAdjustment + excessAdjustment + addOnPrice;
  // A model-specific minimum is absolute: a £50/hr labour discount can never take the
  // quote below it (add-ons are excluded from the comparison as they are extras).
  const ruleMin = getVehicleRuleMinPrice(vehicleName, paymentPeriod) ?? 0;
  const totalPrice = Math.ceil(Math.max(rawTotal, ruleMin + addOnPrice));

  
  // 6. Calculate monthly price (always 12 installments, always rounded UP to a whole pound)
  const monthlyPrice = Math.ceil(totalPrice / 12);
  
  // 7. Marketing savings (display only - NOT applied to actual price)
  const savings = MARKETING_SAVINGS[paymentPeriod] || 0;
  const wasPrice = totalPrice + savings;
  
  return {
    totalPrice,
    monthlyPrice,
    wasPrice,
    savings
  };
}

/**
 * Get marketing savings for display purposes only
 */
export function getMarketingSavings(paymentPeriod: PaymentPeriod): number {
  return MARKETING_SAVINGS[paymentPeriod] || 0;
}

/**
 * Admin-only markup applied on the Quotes & Orders admin pages.
 * Customer website Steps 1–4 are NOT affected by this multiplier.
 */
export const ADMIN_QUOTE_PRICE_MULTIPLIER = 1.10;

/**
 * Admin variant of calculateTotalWarrantyPrice.
 * - With a live pricing override published: reads the admin grid directly
 *   (Quotes & Orders is the source of truth, Step 3 is that minus 10%).
 * - Without one: legacy behaviour — customer price × ADMIN_QUOTE_PRICE_MULTIPLIER.
 * Use ONLY in the admin Quotes & Orders surfaces (GetQuoteTab,
 * ConfirmExternalPaymentTab, BulkPricingTab, DiscountsGivenTab).
 */
export function calculateAdminQuoteWarrantyPrice(
  params: Parameters<typeof calculateTotalWarrantyPrice>[0]
): ReturnType<typeof calculateTotalWarrantyPrice> {
  if (hasLivePricingOverride()) {
    return calculateTotalWarrantyPrice({ ...params, surface: 'admin' });
  }
  // Admin grid is unaffected by the customer-journey +10% uplift.
  const base = calculateTotalWarrantyPrice({ ...params, surface: 'admin' });

  const totalPrice = Math.ceil(base.totalPrice * ADMIN_QUOTE_PRICE_MULTIPLIER);
  const monthlyPrice = Math.ceil(totalPrice / 12);
  const savings = MARKETING_SAVINGS[params.paymentPeriod] || 0;
  const wasPrice = totalPrice + savings;
  return { totalPrice, monthlyPrice, wasPrice, savings };
}


/**
 * Format price for UK display (e.g., £1,069)
 */
export function formatGBP(amount: number, showPence = false): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: showPence ? 2 : 0
  }).format(amount);
}

/**
 * Minimum total warranty price required before the £500 excess tier is offered.
 * A £500 excess on a cheap policy is poor value for the customer, so it is only
 * shown once the warranty itself costs more than £500.
 */
export const EXCESS_500_MIN_WARRANTY_PRICE = 500;

/** Internal claim-limit values map to the figure the customer actually sees. */
const DISPLAY_CLAIM_LIMIT: Record<number, number> = { 750: 1000, 1250: 2000 };

/**
 * Determines whether a given excess value is allowed for a specific
 * payment term and claim limit combination.
 *
 * Rules (matched with PriceTestStep2 excessAllowed):
 * 1. No excess above 25% of the DISPLAYED claim limit (customer-value guardrail).
 *    Internal grid values (750 = £1,000, 1250 = £2,000) are normalised first, so
 *    £250 excess stays available on AutoCare Basic.
 * 2. No £500 excess when claim limit < £3,000.
 * 3. No £500 excess on 1-year (12-month) cover.
 * 4. No £500 excess when the total warranty price is £500 or less.
 */
export function isExcessAllowed(
  excess: number,
  paymentType: PaymentPeriod | string,
  claimLimit: number,
  /** Total warranty price for the current selection, when known. */
  warrantyPrice?: number | null,
): boolean {
  const displayLimit = DISPLAY_CLAIM_LIMIT[claimLimit] ?? claimLimit;
  if (excess > displayLimit * 0.25) return false;
  if (excess === 500 && displayLimit < 3000) return false;
  if (excess === 500 && paymentType === '12months') return false;
  if (
    excess === 500 &&
    typeof warrantyPrice === 'number' &&
    Number.isFinite(warrantyPrice) &&
    warrantyPrice > 0 &&
    warrantyPrice <= EXCESS_500_MIN_WARRANTY_PRICE
  ) {
    return false;
  }
  return true;
}

/**
 * Filters the standard excess options array [0, 50, 100, 150, 250, 500]
 * to only those allowed for the given term + claim limit (+ warranty price).
 */
export function getVisibleExcessOptions(
  paymentType: PaymentPeriod | string,
  claimLimit: number,
  warrantyPrice?: number | null,
): number[] {
  return [0, 50, 100, 150, 250, 500].filter((ex) =>
    isExcessAllowed(ex, paymentType, claimLimit, warrantyPrice),
  );
}

