/**
 * Centralized pricing matrix and utilities for warranty pricing.
 * 
 * PRICING RULES (UPDATED JAN 2026):
 * - BASE prices are from CURRENT_PRICE_JAN_2026.xlsx at £70/hr labour rate (DEFAULT), £100 excess, £1250 claim limit
 * - Labour rate £50/hr = -£5/month for duration (BELOW base)
 * - Labour rate £70/hr = base price (no adjustment) - DEFAULT
 * - Labour rate £100/hr = +£8/month for duration
 * - Labour rate £200/hr = +£24/month for duration
 * - Boost claim limit (+£1000) = +£5/month for duration
 * - All payments are ALWAYS 12 monthly installments
 * - Monthly = Math.floor(total / 12) - always round DOWN
 * - "Was" price = total + marketing savings (£100 for 2yr, £200 for 3yr) - display only
 * - Pay in full = exact Excel total price
 * - Transfer Cover = +£19 one-off (not monthly)
 */

// Base pricing matrix from CURRENT_PRICE_DEC_2025 (ORIGINAL PRICING)
// These are the base prices at £70/hr labour rate (DEFAULT)
// UPDATED JAN 2026: New claim limit keys 1000, 2000, 3000 (mapped from old 750, 1250, 2000 prices)
// UPDATED JAN 2026: New excess keys 0, 100, 250, 500
export const BASE_PRICING_MATRIX = {
  '12months': {
    0: { 1000: 467, 2000: 497, 3000: 587 },      // £0 excess (+£6/mo from £100 baseline)
    100: { 1000: 387, 2000: 417, 3000: 507 },    // £100 excess (default baseline)
    250: { 1000: 339, 2000: 369, 3000: 459 },    // £250 excess (-£4/mo = -£48/yr from baseline)
    500: { 1000: 291, 2000: 321, 3000: 411 }     // £500 excess (-£8/mo = -£96/yr from baseline)
  },
  '24months': {
    0: { 1000: 897, 2000: 937, 3000: 1027 },     // £0 excess (+£6/mo = +£144/2yr from baseline)
    100: { 1000: 737, 2000: 787, 3000: 877 },    // £100 excess (default baseline)
    250: { 1000: 641, 2000: 691, 3000: 781 },    // £250 excess (-£4/mo = -£96/2yr from baseline)
    500: { 1000: 545, 2000: 595, 3000: 685 }     // £500 excess (-£8/mo = -£192/2yr from baseline)
  },
  '36months': {
    0: { 1000: 1347, 2000: 1397, 3000: 1497 },   // £0 excess (+£6/mo = +£216/3yr from baseline)
    100: { 1000: 1097, 2000: 1177, 3000: 1277 }, // £100 excess (default baseline)
    250: { 1000: 953, 2000: 1033, 3000: 1133 },  // £250 excess (-£4/mo = -£144/3yr from baseline)
    500: { 1000: 809, 2000: 889, 3000: 989 }     // £500 excess (-£8/mo = -£288/3yr from baseline)
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
  100: 4,  // £4 more per month (UPDATED from £8)
  200: 24  // £24 more per month (for main dealers and specialists)
};

// Default labour rate is now £70/hr
export const DEFAULT_LABOUR_RATE = 70;

// Default excess is £100
export const DEFAULT_EXCESS = 100;

// Default claim limit is £1000 (updated Jan 2026)
export const DEFAULT_CLAIM_LIMIT = 1000;

// Boost claim limit adds +£500 to selected limit, costs £3/month (UPDATED from £5)
export const BOOST_CLAIM_LIMIT_MONTHLY = 3;
export const BOOST_CLAIM_LIMIT_AMOUNT = 500;

// Transfer Cover one-off price (not monthly)
export const TRANSFER_COVER_PRICE = 19;

// Excess monthly adjustment values (for UI display and calculations)
export const EXCESS_MONTHLY_ADJUSTMENT: Record<number, number> = {
  0: 6,     // +£6/month
  100: 0,   // Default (no adjustment)
  250: -4,  // -£4/month
  500: -8   // -£8/month
};

// Claim limit monthly adjustment values (for UI display and calculations)
export const CLAIM_LIMIT_MONTHLY_ADJUSTMENT: Record<number, number> = {
  1000: 0,  // Default (no adjustment)
  2000: 6,  // +£6/month
  3000: 10  // +£10/month
};

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
  // Map excess to nearest valid key
  const validExcess = [0, 100, 250, 500].includes(voluntaryExcess) ? voluntaryExcess : DEFAULT_EXCESS;
  const excessData = periodData[validExcess as ExcessAmount] || periodData[DEFAULT_EXCESS];
  // Map claim limit to nearest valid key
  const validClaimLimit = [1000, 2000, 3000].includes(claimLimit) ? claimLimit : DEFAULT_CLAIM_LIMIT;
  return excessData[validClaimLimit as ClaimLimit] || excessData[DEFAULT_CLAIM_LIMIT];
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
