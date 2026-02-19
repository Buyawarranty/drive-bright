/**
 * Claim limit tier configuration and £5000 premium surcharge utilities.
 * 
 * TIER STRUCTURE:
 * - AutoCare Basic: £1,000 per claim (internal value: 750, display: £1,000)
 * - AutoCare Essential: £2,000 per claim (MOST POPULAR)
 * - AutoCare Elite: £3,000 per claim (internally: £2000 base + boost)
 * - AutoCare Premium: £5,000 per claim (internally: £2000 base + flat surcharge)
 * 
 * £5000 is NOT available for premium vehicles: Tesla, Jaguar, Land Rover, Porsche
 */

export const CLAIM_LIMIT_TIERS = [
  { value: 750, displayValue: 1000, name: 'AutoCare Basic', shortName: 'Basic', popular: false },
  { value: 2000, displayValue: 2000, name: 'AutoCare Essential', shortName: 'Essential', popular: true },
  { value: 3000, displayValue: 3000, name: 'AutoCare Elite', shortName: 'Elite', popular: false },
  { value: 5000, displayValue: 5000, name: 'AutoCare Premium', shortName: 'Premium', popular: false },
] as const;

/**
 * £5000 claim limit flat monthly surcharge.
 * These are TOTAL surcharges (monthly × 12 payments).
 * NOT stacked per year - flat fee regardless of duration.
 */
export const PREMIUM_CLAIM_SURCHARGE: Record<string, number> = {
  '12months': 8 * 12,  // £96 total (£8/mo × 12)
  '24months': 9 * 12,  // £108 total (£9/mo × 12)
  '36months': 10 * 12, // £120 total (£10/mo × 12)
};

/** Monthly display amount for £5000 surcharge */
export const PREMIUM_CLAIM_MONTHLY: Record<string, number> = {
  '12months': 8,
  '24months': 9,
  '36months': 10,
};

/** Vehicles excluded from £5000 claim limit */
const PREMIUM_VEHICLE_MAKES = ['tesla', 'jaguar', 'land rover', 'porsche'];

/** Check if a vehicle make is a premium brand (excluded from £5000) */
export function isPremiumVehicle(make?: string): boolean {
  const m = (make || '').toLowerCase().trim();
  return PREMIUM_VEHICLE_MAKES.some(p => m.includes(p));
}

/** Get total surcharge for £5000 claim limit */
export function getPremiumClaimSurcharge(paymentPeriod: string): number {
  return PREMIUM_CLAIM_SURCHARGE[paymentPeriod] || 0;
}

/** Get the effective base claim limit for pricing matrix lookup */
export function getBaseClaimLimit(claimLimit: number): number {
  // £5000 and £3000 (via boost) both use £2000 base in the pricing matrix
  if (claimLimit === 5000) return 2000;
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
