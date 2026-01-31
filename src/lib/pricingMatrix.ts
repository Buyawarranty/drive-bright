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

// Base pricing matrix - 20% REDUCTION applied (Jan 2026)
// Original prices reduced by 20%, floored to whole numbers
// These are the base prices at £70/hr labour rate (DEFAULT)
export const BASE_PRICING_MATRIX = {
  '12months': {
    0: { 750: 373, 1250: 397, 2000: 469 },
    50: { 750: 349, 1250: 365, 2000: 437 },
    100: { 750: 309, 1250: 333, 2000: 405 },
    150: { 750: 293, 1250: 309, 2000: 381 }
  },
  '24months': {
    0: { 750: 717, 1250: 749, 2000: 821 },
    50: { 750: 661, 1250: 701, 2000: 765 },
    100: { 750: 589, 1250: 629, 2000: 701 },
    150: { 750: 557, 1250: 589, 2000: 661 }
  },
  '36months': {
    0: { 750: 1077, 1250: 1117, 2000: 1197 },
    50: { 750: 997, 1250: 1037, 2000: 1117 },
    100: { 750: 877, 1250: 941, 2000: 1021 },
    150: { 750: 837, 1250: 877, 2000: 957 }
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
 * Get base price from the pricing matrix
 * PROMO: For 2yr/3yr plans with £2000 claim limit, use £1250 pricing
 * (customer gets £2000 coverage for the price of £1250)
 */
export function getBasePrice(
  paymentPeriod: PaymentPeriod,
  voluntaryExcess: number,
  claimLimit: number
): number {
  const periodData = BASE_PRICING_MATRIX[paymentPeriod] || BASE_PRICING_MATRIX['12months'];
  const excessData = periodData[voluntaryExcess as ExcessAmount] || periodData[DEFAULT_EXCESS];
  
  // PROMO LOGIC: For 2yr/3yr plans with £2000 claim limit, use £1250 pricing
  const isMultiYearPlan = paymentPeriod === '24months' || paymentPeriod === '36months';
  const pricingClaimLimit = (isMultiYearPlan && claimLimit === 2000) ? 1250 : claimLimit;
  
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
 * @param boostEnabled Whether boost is enabled
 * @param paymentPeriod The warranty duration
 * @returns Total boost cost
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
}): { totalPrice: number; monthlyPrice: number; wasPrice: number; savings: number } {
  const {
    paymentPeriod,
    voluntaryExcess,
    claimLimit,
    labourRate = DEFAULT_LABOUR_RATE,
    boostEnabled = false,
    vehicleAdjustment = 0,
    addOnPrice = 0
  } = params;

  // 1. Get base price from matrix (EXACT Excel price at £70/hr default)
  const basePrice = getBasePrice(paymentPeriod, voluntaryExcess, claimLimit);
  
  // 2. Apply vehicle adjustments (Range Rover, van, motorbike, mileage, age)
  const adjustedBasePrice = basePrice + vehicleAdjustment;
  
  // 3. Add labour rate adjustment (can be negative for £50/hr)
  const labourAdjustment = calculateLabourRateAdjustment(labourRate, paymentPeriod);
  
  // 4. Add boost claim limit adjustment
  const boostAdjustment = calculateBoostAdjustment(boostEnabled, paymentPeriod);
  
  // 5. Add protection add-ons (Transfer Cover is £19 one-off, handled by caller)
  const totalPrice = adjustedBasePrice + labourAdjustment + boostAdjustment + addOnPrice;
  
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
 * Format price for UK display (e.g., £1,069)
 */
export function formatGBP(amount: number, showPence = false): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: showPence ? 2 : 0
  }).format(amount);
}
