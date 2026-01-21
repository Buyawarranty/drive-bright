/**
 * Centralized pricing matrix and utilities for warranty pricing.
 * 
 * PRICING RULES (UPDATED JAN 2026):
 * - BASE prices are from CURRENT_PRICE_JAN_2026.xlsx at £70/hr labour rate (DEFAULT), £100 excess, £1000 claim limit
 * - Claim limits: £1,000 (£0/mo), £2,000 (+£6/mo), £3,000 (+£10/mo)
 * - Boost: +£500 extra cover for +£3/mo (disabled at £3,000)
 * - Labour rate £50/hr = -£5/month (BELOW base)
 * - Labour rate £70/hr = base price (no adjustment) - DEFAULT
 * - Labour rate £100/hr = +£4/month
 * - Labour rate £200/hr = +£24/month
 * - Excess: £0 (+£6/mo), £100 (£0/mo default), £250 (-£4/mo), £500 (-£8/mo)
 * - All payments are ALWAYS 12 monthly installments
 * - Monthly = Math.floor(total / 12) - always round DOWN
 * - "Was" price = total + marketing savings (£100 for 2yr, £200 for 3yr) - display only
 * - Pay in full = exact Excel total price
 * - Transfer Cover = +£19 one-off (not monthly)
 */

// Base pricing matrix from CURRENT_PRICE_DEC_2025 (ORIGINAL PRICING)
// These are the base prices at £70/hr labour rate (DEFAULT)
// Updated to use new claim limits: 1000, 2000, 3000
export const BASE_PRICING_MATRIX = {
  '12months': {
    0: { 1000: 497, 2000: 569, 3000: 617 },
    100: { 1000: 417, 2000: 489, 3000: 537 },
    250: { 1000: 369, 2000: 441, 3000: 489 },
    500: { 1000: 321, 2000: 393, 3000: 441 }
  },
  '24months': {
    0: { 1000: 937, 2000: 1081, 3000: 1177 },
    100: { 1000: 787, 2000: 931, 3000: 1027 },
    250: { 1000: 691, 2000: 835, 3000: 931 },
    500: { 1000: 595, 2000: 739, 3000: 835 }
  },
  '36months': {
    0: { 1000: 1397, 2000: 1613, 3000: 1757 },
    100: { 1000: 1177, 2000: 1393, 3000: 1537 },
    250: { 1000: 1033, 2000: 1249, 3000: 1393 },
    500: { 1000: 889, 2000: 1105, 3000: 1249 }
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

// Claim limit options and their monthly adjustments (relative to base £1000)
export const CLAIM_LIMIT_OPTIONS = [1000, 2000, 3000] as const;
export const CLAIM_LIMIT_MONTHLY_ADJUSTMENT: Record<number, number> = {
  1000: 0,   // Base (default)
  2000: 6,   // +£6/month
  3000: 10   // +£10/month
};

// Labour rate adjustment per month (relative to £70/hr base - DEFAULT)
// £70/hr is now the default base rate
export const LABOUR_RATE_MONTHLY_ADJUSTMENT: Record<number, number> = {
  50: -5,   // £5 LESS per month (below base)
  70: 0,    // Base rate, no adjustment (DEFAULT)
  100: 4,   // £4 more per month
  200: 24   // £24 more per month (for main dealers and specialists)
};

// Excess options and their monthly adjustments (relative to £100 default)
export const EXCESS_OPTIONS = [0, 100, 250, 500] as const;
export const EXCESS_MONTHLY_ADJUSTMENT: Record<number, number> = {
  0: 6,     // +£6/month (premium, worry-free)
  100: 0,   // Default - no adjustment
  250: -4,  // -£4/month
  500: -8   // -£8/month
};

// Default values
export const DEFAULT_LABOUR_RATE = 70;
export const DEFAULT_EXCESS = 100;
export const DEFAULT_CLAIM_LIMIT = 1000;

// Boost claim limit adds £3/month and +£500 to claim limit
export const BOOST_CLAIM_LIMIT_MONTHLY = 3;
export const BOOST_CLAIM_LIMIT_AMOUNT = 500;

// Transfer Cover one-off price (not monthly)
export const TRANSFER_COVER_PRICE = 19;

export type PaymentPeriod = keyof typeof BASE_PRICING_MATRIX;
export type ExcessAmount = keyof typeof BASE_PRICING_MATRIX['12months'];
export type ClaimLimit = keyof typeof BASE_PRICING_MATRIX['12months'][0];

/**
 * Get base price from the pricing matrix
 */
export function getBasePrice(
  paymentPeriod: PaymentPeriod,
  voluntaryExcess: number,
  claimLimit: number
): number {
  const periodData = BASE_PRICING_MATRIX[paymentPeriod] || BASE_PRICING_MATRIX['12months'];
  const excessData = periodData[voluntaryExcess as ExcessAmount] || periodData[DEFAULT_EXCESS];
  return excessData[claimLimit as ClaimLimit] || excessData[DEFAULT_CLAIM_LIMIT];
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
 * Calculate boost claim limit adjustment (+£500 claim limit for £3/month)
 * @param boostEnabled Whether boost is enabled
 * @param paymentPeriod The warranty duration
 * @returns Total boost cost
 */
export function calculateBoostAdjustment(
  boostEnabled: boolean,
  paymentPeriod: PaymentPeriod
): number {
  if (!boostEnabled) return 0;
  const durationMonths = DURATION_MONTHS[paymentPeriod];
  return BOOST_CLAIM_LIMIT_MONTHLY * durationMonths;
}

/**
 * Get the monthly price adjustment for labour rate
 */
export function getLabourRateMonthlyAdjustment(labourRate: number): number {
  return LABOUR_RATE_MONTHLY_ADJUSTMENT[labourRate] ?? LABOUR_RATE_MONTHLY_ADJUSTMENT[DEFAULT_LABOUR_RATE];
}

/**
 * Get the monthly price adjustment for claim limit
 */
export function getClaimLimitMonthlyAdjustment(claimLimit: number): number {
  return CLAIM_LIMIT_MONTHLY_ADJUSTMENT[claimLimit] ?? 0;
}

/**
 * Get the monthly price adjustment for excess
 */
export function getExcessMonthlyAdjustment(excess: number): number {
  return EXCESS_MONTHLY_ADJUSTMENT[excess] ?? 0;
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
 * Get effective claim limit (base + boost if enabled)
 */
export function getEffectiveClaimLimit(claimLimit: number, boostEnabled: boolean): number {
  return boostEnabled ? claimLimit + BOOST_CLAIM_LIMIT_AMOUNT : claimLimit;
}

/**
 * Calculate equivalent cost per month of cover (total / coverage months)
 */
export function getCostPerCoverMonth(totalPrice: number, paymentPeriod: PaymentPeriod): number {
  const coverageMonths = DURATION_MONTHS[paymentPeriod];
  return Math.floor(totalPrice / coverageMonths);
}

/**
 * Calculate cost per year for multi-year plans
 */
export function getCostPerYear(totalPrice: number, paymentPeriod: PaymentPeriod): number {
  const years = paymentPeriod === '12months' ? 1 : paymentPeriod === '24months' ? 2 : 3;
  return Math.floor(totalPrice / years);
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