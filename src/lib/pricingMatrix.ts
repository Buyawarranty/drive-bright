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
 * - Monthly = Math.floor(total / 12) - always round DOWN
 * - "Was" price = total + marketing savings (£100 for 2yr, £200 for 3yr) - display only
 * - Pay in full = exact Excel total price
 * - Transfer Cover = +£19 one-off (not monthly)
 */

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

// Labour rate adjustment per month (relative to £70/hr base - DEFAULT)
// £70/hr is now the default base rate
export const LABOUR_RATE_MONTHLY_ADJUSTMENT: Record<number, number> = {
  50: -5,  // £5 LESS per month (below base)
  70: 0,   // Base rate, no adjustment (DEFAULT)
  100: 8,  // £8 more per month
  200: 24  // £24 more per month (for main dealers and specialists)
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
 * Motorbikes are priced at 50% of the equivalent standard vehicle price.
 * This applies to the base matrix price AND to the minimum base price floor,
 * so the half price is never clawed back by the car floor.
 */
export const MOTORBIKE_PRICE_MULTIPLIER = 0.5;

export function applyBasePriceFloor(
  adjustedBasePrice: number,
  paymentPeriod: PaymentPeriod,
  voluntaryExcess?: number,
  isMotorbike?: boolean
): number {
  const minBase = MIN_BASE_PRICE_BY_PERIOD[paymentPeriod] ?? 0;
  const step = EXCESS_TIER_STEP_BY_PERIOD[paymentPeriod] ?? 0;
  // £250 tier must stay above £500 tier; lower excess tiers use the absolute floor
  // (which the matrix already exceeds, so they are unaffected in practice).
  const rawFloor =
    voluntaryExcess !== undefined && voluntaryExcess >= 250 && voluntaryExcess < 500
      ? minBase + step
      : minBase;
  const effectiveFloor = isMotorbike
    ? Math.floor(rawFloor * MOTORBIKE_PRICE_MULTIPLIER)
    : rawFloor;
  return Math.max(adjustedBasePrice, effectiveFloor);
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
  return Math.floor(basePrice * (1 - RELIABLE_BRAND_DISCOUNT_PCT));
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


/** Derive the customer (Step 3) price from an admin Quotes & Orders price. */
export function deriveCustomerPriceFromAdmin(adminPrice: number, discountPct = 10): number {
  return Math.round(adminPrice * (1 - discountPct / 100));
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
  surface: PricingSurface = 'customer'
): number {
  // PROMO LOGIC: For 2yr/3yr plans with £2000 claim limit, use £1250 pricing
  const isMultiYearPlan = paymentPeriod === '24months' || paymentPeriod === '36months';
  const pricingClaimLimit = (isMultiYearPlan && claimLimit === 2000) ? 1250 : claimLimit;

  if (LIVE_ADMIN_MATRIX) {
    const periodData = LIVE_ADMIN_MATRIX[paymentPeriod] || LIVE_ADMIN_MATRIX['12months'];
    const excessData = periodData?.[String(voluntaryExcess)] || periodData?.[String(DEFAULT_EXCESS)];
    const adminPrice =
      excessData?.[String(pricingClaimLimit)] ?? excessData?.[String(DEFAULT_CLAIM_LIMIT)];
    if (typeof adminPrice === 'number') {
      return surface === 'admin'
        ? adminPrice
        : deriveCustomerPriceFromAdmin(adminPrice, LIVE_STEP3_DISCOUNT_PCT);
    }
  }

  const periodData = BASE_PRICING_MATRIX[paymentPeriod] || BASE_PRICING_MATRIX['12months'];
  const excessData = periodData[voluntaryExcess as ExcessAmount] || periodData[DEFAULT_EXCESS];

  return excessData[pricingClaimLimit as ClaimLimit] || excessData[DEFAULT_CLAIM_LIMIT];
}


/**
 * Calculate labour rate adjustment for the total price
 * @param labourRate The selected labour rate (50, 70, 100, or 200)
 * @param paymentPeriod The warranty duration
 * @returns Total adjustment amount (can be negative for £50/hr)
 */
export function calculateLabourRateAdjustment(
  labourRate: number,
  paymentPeriod: PaymentPeriod
): number {
  const monthlyAdjustment = LABOUR_RATE_MONTHLY_ADJUSTMENT[labourRate] ?? LABOUR_RATE_MONTHLY_ADJUSTMENT[DEFAULT_LABOUR_RATE];
  const durationMonths = DURATION_MONTHS[paymentPeriod];
  return monthlyAdjustment * durationMonths;
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
 * Get the monthly price adjustment for labour rate
 */
export function getLabourRateMonthlyAdjustment(labourRate: number): number {
  return LABOUR_RATE_MONTHLY_ADJUSTMENT[labourRate] ?? LABOUR_RATE_MONTHLY_ADJUSTMENT[DEFAULT_LABOUR_RATE];
}

/**
 * Calculate the full warranty price including all adjustments
 * IMPORTANT: This returns the EXACT total from Excel + adjustments
 * Monthly is always Math.floor(total / 12) - rounded DOWN
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
  /** Internal: which price grid to read when a live pricing override is published. */
  surface?: PricingSurface;
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
    surface = 'customer',
  } = params;

  // 1. Get base price from matrix (EXACT Excel price at £70/hr default)
  const rawBasePrice = getBasePrice(paymentPeriod, voluntaryExcess, claimLimit, surface);

  // 1a. Apply reliable-brand -20% base discount for non-EV Lexus/Toyota/Honda/Suzuki/Hyundai/Kia/Mazda.
  const brandDiscountedBase = applyReliableBrandDiscount(rawBasePrice, make, fuelType);

  // 1b. Motorbikes: half the standard vehicle base price.
  const basePrice = isMotorbike
    ? Math.floor(brandDiscountedBase * MOTORBIKE_PRICE_MULTIPLIER)
    : brandDiscountedBase;

  // 2. Apply vehicle adjustments (Range Rover, van, mileage, age).
  // Percentage-style adjustments (e.g. the legacy motorbike -0.5) are ignored here —
  // motorbike pricing is handled by the isMotorbike flag above.
  const fixedAdjustment =
    vehicleAdjustment > -1 && vehicleAdjustment < 0 ? 0 : vehicleAdjustment;
  const adjustedBasePrice = basePrice + fixedAdjustment;

  // 3. Enforce minimum BASE price floor (halved for motorbikes)
  const flooredBase = applyBasePriceFloor(adjustedBasePrice, paymentPeriod, voluntaryExcess, isMotorbike);


  // 4. Add labour rate adjustment (can be negative for £50/hr)
  const labourAdjustment = calculateLabourRateAdjustment(labourRate, paymentPeriod);

  // 5. Add boost claim limit adjustment
  const boostAdjustment = calculateBoostAdjustment(boostEnabled, paymentPeriod);

  // 6. Add protection add-ons (Transfer Cover is £19 one-off, handled by caller)
  const totalPrice = flooredBase + labourAdjustment + boostAdjustment + addOnPrice;
  
  // 6. Calculate monthly price (always 12 installments, FLOOR not round)
  const monthlyPrice = Math.floor(totalPrice / 12);
  
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
  const base = calculateTotalWarrantyPrice(params);
  const totalPrice = Math.floor(base.totalPrice * ADMIN_QUOTE_PRICE_MULTIPLIER);
  const monthlyPrice = Math.floor(totalPrice / 12);
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
 * Determines whether a given excess value is allowed for a specific
 * payment term and claim limit combination.
 *
 * Rules (matched with PriceTestStep2 excessAllowed):
 * 1. No excess above 25% of the claim limit (customer-value guardrail).
 * 2. No £500 excess when claim limit < £3,000.
 * 3. No £500 excess on 1-year (12-month) cover.
 */
export function isExcessAllowed(
  excess: number,
  paymentType: PaymentPeriod | string,
  claimLimit: number,
): boolean {
  if (excess > claimLimit * 0.25) return false;
  if (excess === 500 && claimLimit < 3000) return false;
  if (excess === 500 && paymentType === '12months') return false;
  return true;
}

/**
 * Filters the standard excess options array [0, 50, 100, 150, 250, 500]
 * to only those allowed for the given term + claim limit.
 */
export function getVisibleExcessOptions(
  paymentType: PaymentPeriod | string,
  claimLimit: number,
): number[] {
  return [0, 50, 100, 150, 250, 500].filter((ex) => isExcessAllowed(ex, paymentType, claimLimit));
}
