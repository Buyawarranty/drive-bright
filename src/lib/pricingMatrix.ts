/**
 * Centralized pricing matrix and utilities for warranty pricing.
 * 
 * PRICING RULES:
 * - BASE prices are from CURRENT_PRICE_DEC_2025.xlsx at £50/hr labour rate, £100 excess, £1250 claim limit
 * - Labour rate £40/hr = -£5/month for duration
 * - Labour rate £50/hr = base price (no adjustment)
 * - Labour rate £70/hr = +£4/month for duration
 * - Labour rate £100/hr = +£8/month for duration
 * - Boost claim limit (+£1000) = +£5/month for duration
 * - All payments are ALWAYS 12 monthly installments
 * - Monthly = Math.floor(total / 12) - always round DOWN
 * - "Was" price = total + marketing savings (£100 for 2yr, £200 for 3yr) - display only
 * - Pay in full = exact Excel total price
 */

// Base pricing matrix from CURRENT_PRICE_DEC_2025.xlsx
// These are the base prices at £50/hr labour rate
export const BASE_PRICING_MATRIX = {
  '12months': {
    0: { 750: 567, 1250: 597, 2000: 687 },
    50: { 750: 537, 1250: 557, 2000: 647 },
    100: { 750: 487, 1250: 517, 2000: 607 },
    150: { 750: 467, 1250: 487, 2000: 577 }
  },
  '24months': {
    0: { 750: 897, 1250: 937, 2000: 1027 },
    50: { 750: 827, 1250: 877, 2000: 957 },
    100: { 750: 737, 1250: 787, 2000: 877 },
    150: { 750: 697, 1250: 737, 2000: 827 }
  },
  '36months': {
    0: { 750: 1347, 1250: 1397, 2000: 1497 },
    50: { 750: 1247, 1250: 1297, 2000: 1397 },
    100: { 750: 1097, 1250: 1177, 2000: 1277 },
    150: { 750: 1047, 1250: 1097, 2000: 1197 }
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

// Labour rate adjustment per month (relative to £50/hr base)
export const LABOUR_RATE_MONTHLY_ADJUSTMENT: Record<number, number> = {
  50: 0,   // Base rate, no adjustment
  70: 4,   // £4 more per month
  100: 8,  // £8 more per month
  200: 24  // £24 more per month (for main dealers and specialists)
};

// Boost claim limit adds £5/month
export const BOOST_CLAIM_LIMIT_MONTHLY = 5;

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
  const excessData = periodData[voluntaryExcess as ExcessAmount] || periodData[100];
  return excessData[claimLimit as ClaimLimit] || excessData[1250];
}

/**
 * Calculate labour rate adjustment for the total price
 * @param labourRate The selected labour rate (40, 50, 70, or 100)
 * @param paymentPeriod The warranty duration
 * @returns Total adjustment amount (can be negative)
 */
export function calculateLabourRateAdjustment(
  labourRate: number,
  paymentPeriod: PaymentPeriod
): number {
  const monthlyAdjustment = LABOUR_RATE_MONTHLY_ADJUSTMENT[labourRate] || 0;
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
  return LABOUR_RATE_MONTHLY_ADJUSTMENT[labourRate] || 0;
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
    labourRate = 50,
    boostEnabled = false,
    vehicleAdjustment = 0,
    addOnPrice = 0
  } = params;

  // 1. Get base price from matrix (EXACT Excel price)
  const basePrice = getBasePrice(paymentPeriod, voluntaryExcess, claimLimit);
  
  // 2. Apply vehicle adjustments (Range Rover, van, motorbike, mileage, age)
  const adjustedBasePrice = basePrice + vehicleAdjustment;
  
  // 3. Add labour rate adjustment
  const labourAdjustment = calculateLabourRateAdjustment(labourRate, paymentPeriod);
  
  // 4. Add boost claim limit adjustment
  const boostAdjustment = calculateBoostAdjustment(boostEnabled, paymentPeriod);
  
  // 5. Add protection add-ons
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
