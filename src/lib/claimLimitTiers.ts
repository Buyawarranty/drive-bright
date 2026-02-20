/**
 * Claim limit tier configuration and surcharge utilities.
 * 
 * TIER STRUCTURE:
 * - AutoCare Basic: £1,000 per claim (internal value: 750, display: £1,000)
 * - AutoCare Essential: £2,000 per claim (MOST POPULAR)
 * - AutoCare Elite: £3,000 per claim (internally: £2000 base + elite surcharge)
 * - AutoCare Premium: £5,000 per claim (internally: £2000 base + elite surcharge + premium step)
 * 
 * SURCHARGE RULES:
 * - £2000→£3000 (Elite): same price step as £1000→£2000 (matrix diff: col 2000 - col 750)
 * - £3000→£5000 (Premium): +£8/mo (1yr), +£9/mo (2yr), +£10/mo (3yr)
 * 
 * £5000 is NOT available for premium vehicles: Tesla, Jaguar, Land Rover, Porsche
 */

import { getBasePrice as getMatrixBasePrice, type PaymentPeriod } from './pricingMatrix';

export const CLAIM_LIMIT_TIERS = [
  { value: 750, displayValue: 1000, name: 'AutoCare Basic', shortName: 'Basic', popular: false },
  { value: 2000, displayValue: 2000, name: 'AutoCare Essential', shortName: 'Essential', popular: true },
  { value: 3000, displayValue: 3000, name: 'AutoCare Elite', shortName: 'Elite', popular: false },
  { value: 5000, displayValue: 5000, name: 'AutoCare Premium', shortName: 'Premium', popular: false },
] as const;

/**
 * £3000→£5000 step: flat monthly surcharge ON TOP of the elite surcharge.
 * These are TOTAL surcharges (monthly × 12 payments).
 */
export const PREMIUM_STEP_SURCHARGE: Record<string, number> = {
  '12months': 8 * 12,  // £96 total (£8/mo × 12)
  '24months': 9 * 12,  // £108 total (£9/mo × 12)
  '36months': 10 * 12, // £120 total (£10/mo × 12)
};

/** Monthly display amount for £3000→£5000 step */
export const PREMIUM_STEP_MONTHLY: Record<string, number> = {
  '12months': 8,
  '24months': 9,
  '36months': 10,
};

// Keep legacy exports for backward compatibility
export const PREMIUM_CLAIM_SURCHARGE = PREMIUM_STEP_SURCHARGE;
export const PREMIUM_CLAIM_MONTHLY = PREMIUM_STEP_MONTHLY;

/** Vehicles excluded from £5000 claim limit */
const PREMIUM_VEHICLE_MAKES = ['tesla', 'jaguar', 'land rover', 'porsche'];

/** Check if a vehicle make is a premium brand (excluded from £5000) */
export function isPremiumVehicle(make?: string): boolean {
  const m = (make || '').toLowerCase().trim();
  return PREMIUM_VEHICLE_MAKES.some(p => m.includes(p));
}

/**
 * Get the elite surcharge (£2000→£3000 step).
 * This equals the matrix difference between £2000 and £750 columns
 * (i.e., same step as £1000→£2000).
 */
export function getEliteSurcharge(paymentPeriod: string, voluntaryExcess: number): number {
  const price2000 = getMatrixBasePrice(paymentPeriod as PaymentPeriod, voluntaryExcess, 2000);
  const price750 = getMatrixBasePrice(paymentPeriod as PaymentPeriod, voluntaryExcess, 750);
  return price2000 - price750;
}

/**
 * Get the total claim limit surcharge for £3000 or £5000 tiers.
 * - £3000: elite surcharge only (same step as £1000→£2000)
 * - £5000: elite surcharge + premium step (£8/£9/£10 per month)
 * - All others: 0
 */
export function getClaimLimitSurcharge(claimLimit: number, paymentPeriod: string, voluntaryExcess: number): number {
  if (claimLimit < 3000) return 0;
  const elite = getEliteSurcharge(paymentPeriod, voluntaryExcess);
  if (claimLimit === 3000) return elite;
  // £5000 = elite + premium step
  return elite + (PREMIUM_STEP_SURCHARGE[paymentPeriod] || 0);
}

/**
 * Get monthly display amount for the surcharge of a given claim limit.
 * Used for "Just Xp/day more" or "+£X/mo" display text.
 */
export function getClaimLimitSurchargeMonthly(claimLimit: number, paymentPeriod: string, voluntaryExcess: number): number {
  const totalSurcharge = getClaimLimitSurcharge(claimLimit, paymentPeriod, voluntaryExcess);
  return Math.floor(totalSurcharge / 12);
}

/** @deprecated Use getClaimLimitSurcharge instead */
export function getPremiumClaimSurcharge(paymentPeriod: string): number {
  return PREMIUM_CLAIM_SURCHARGE[paymentPeriod] || 0;
}

/** Get the effective base claim limit for pricing matrix lookup */
export function getBaseClaimLimit(claimLimit: number): number {
  // £5000 and £3000 both use £2000 base in the pricing matrix
  if (claimLimit === 5000 || claimLimit === 3000) return 2000;
  return claimLimit;
}

/** Get tier name for a claim limit value */
export function getClaimLimitTierName(claimLimit: number): string {
  const tier = CLAIM_LIMIT_TIERS.find(t => t.value === claimLimit);
  return tier?.name || `£${claimLimit.toLocaleString()}`;
}

/** Format claim limit for display (maps internal 750 → £1,000) */
export function getDisplayClaimLimit(claimLimit: number): string {
  const tier = CLAIM_LIMIT_TIERS.find(t => t.value === claimLimit);
  const displayVal = tier?.displayValue ?? claimLimit;
  return `£${displayVal.toLocaleString()}`;
}

/** Get display value number for a claim limit (maps 750 → 1000) */
export function getDisplayClaimLimitValue(claimLimit: number): number {
  const tier = CLAIM_LIMIT_TIERS.find(t => t.value === claimLimit);
  return tier?.displayValue ?? claimLimit;
}
