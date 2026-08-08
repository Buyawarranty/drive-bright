/**
 * Claim limit tier configuration and surcharge utilities.
 * 
 * TIER STRUCTURE:
 * - AutoCare Basic: £1,000 per claim (wire value 750 on stored records, shown as £1,000)
 * - AutoCare Essential: £2,000 per claim (MOST POPULAR)
 * - AutoCare Elite: £3,000 per claim (internally: £2000 base + elite surcharge)
 * - AutoCare Premium: £5,000 per claim (internally: £2000 base + elite surcharge + premium step)
 * 
 * SURCHARGE RULES:
 * - £2000→£3000 (Elite): same price step as £1000→£2000 (grid diff: £3,000 col − £1,000 col)
 * - £3000→£5000 (Premium): +£8/mo (1yr), +£9/mo (2yr), +£10/mo (3yr)
 * 
 * £5000 is NOT available for premium vehicles: Tesla, Jaguar, Land Rover, Porsche
 */

import { getBasePrice as getMatrixBasePrice, type PaymentPeriod } from './pricingMatrix';

export const CLAIM_LIMIT_TIERS = [
  // 750 is the historic wire value for £1,000 cover — kept because it is written on
  // live policies, Stripe metadata and the Warranties Register feed. Shown as £1,000.
  { value: 750, displayValue: 1000, name: 'AutoCare Basic', shortName: 'Basic', popular: false },
  { value: 2000, displayValue: 2000, name: 'AutoCare Essential', shortName: 'Essential', popular: false },
  { value: 3000, displayValue: 3000, name: 'AutoCare Elite', shortName: 'Elite', popular: true },
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

/** Default vehicles excluded from £5000 claim limit (code fallback) */
/**
 * £5,000 cover is no longer blocked for any vehicle (management decision), so the
 * default blocklist is intentionally empty. Model risk is priced instead — see
 * src/lib/pricing/modelRiskRules.ts.
 */
export const DEFAULT_CLAIM_5K_BLOCKED_MAKES: string[] = [];
const PREMIUM_VEHICLE_MAKES = DEFAULT_CLAIM_5K_BLOCKED_MAKES;

/**
 * Managed £5,000 blocklist, editable on the Price updates page.
 * Each entry blocks a make, optionally narrowed to a model, and can be
 * switched off (unblocked) without deleting it.
 */
export type Claim5kBlockRule = {
  id?: string;
  make: string;
  model?: string | null;
  blocked: boolean;
};

let liveClaim5kBlocklist: Claim5kBlockRule[] | null = null;

export function setLiveClaim5kBlocklist(rules: Claim5kBlockRule[] | null | undefined) {
  const clean = (rules || [])
    .filter(r => (r?.make || '').trim())
    .map(r => ({
      id: r.id,
      make: String(r.make).toLowerCase().trim(),
      model: r.model ? String(r.model).toLowerCase().trim() : null,
      blocked: r.blocked !== false,
    }));
  liveClaim5kBlocklist = clean.length ? clean : null;
}

export function getLiveClaim5kBlocklist(): Claim5kBlockRule[] | null {
  return liveClaim5kBlocklist;
}

/**
 * Check whether a vehicle is blocked from the £5,000 claim limit.
 * Uses the managed blocklist when present, otherwise the code defaults.
 */
export function isPremiumVehicle(make?: string, model?: string): boolean {
  const m = (make || '').toLowerCase().trim();
  if (!m) return false;

  if (liveClaim5kBlocklist) {
    const mo = (model || '').toLowerCase().trim();
    return liveClaim5kBlocklist.some(r => {
      if (!r.blocked) return false;
      if (!m.includes(r.make)) return false;
      if (!r.model) return true;
      return mo.includes(r.model);
    });
  }

  return PREMIUM_VEHICLE_MAKES.some(p => m.includes(p));
}

/**
 * Get the elite surcharge (£2000→£3000 step).
 * This equals the grid difference between the £3,000 and £1,000 columns
 * (i.e., same step as £1000→£2000).
 */
export function getEliteSurcharge(paymentPeriod: string, voluntaryExcess: number): number {
  const topColumn = getMatrixBasePrice(paymentPeriod as PaymentPeriod, voluntaryExcess, 3000);
  const basicColumn = getMatrixBasePrice(paymentPeriod as PaymentPeriod, voluntaryExcess, 1000);
  return topColumn - basicColumn;
}

/**
 * Claim limit factors published from the Price updates page ("Push live").
 * When present these drive the £3,000 / £5,000 steps instead of the built-in
 * elite + premium-step figures, so Quotes & Orders and Steps 3/4 follow the
 * factors management last pushed live.
 */
export type LiveClaimLimitFactor = { limit: number; factor: number };
let liveClaimLimitFactors: LiveClaimLimitFactor[] | null = null;

export function setLiveClaimLimitFactors(factors: LiveClaimLimitFactor[] | null | undefined) {
  const clean = (factors || [])
    .map(f => ({ limit: Number(f.limit), factor: Number(f.factor) }))
    .filter(f => Number.isFinite(f.limit) && Number.isFinite(f.factor) && f.factor > 0);
  liveClaimLimitFactors = clean.length ? clean : null;
}

function liveFactorFor(limit: number): number | null {
  if (!liveClaimLimitFactors) return null;
  const found = liveClaimLimitFactors.find(f => f.limit === limit);
  return found ? found.factor : null;
}

/**
 * Get the total claim limit surcharge for £3000 or £5000 tiers.
 * - £3000: elite surcharge only (same step as £1000→£2000)
 * - £5000: elite surcharge + premium step (£8/£9/£10 per month)
 * - All others: 0
 */
export function getClaimLimitSurcharge(claimLimit: number, paymentPeriod: string, voluntaryExcess: number): number {
  if (claimLimit < 3000) return 0;

  // Published factors take priority: the step is the £2,000 reference price
  // scaled by the ratio between the tier factor and the £2,000 factor.
  const ref = liveFactorFor(2000);
  const tier = liveFactorFor(claimLimit);
  if (ref && tier) {
    const price2000 = getMatrixBasePrice(paymentPeriod as PaymentPeriod, voluntaryExcess, 2000);
    return Math.max(0, Math.round(price2000 * (tier / ref - 1)));
  }

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
  return Math.ceil(totalSurcharge / 12);
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

/**
 * Legacy stored claim limits → the tier they were sold as.
 * We never rewrite what is stored on old policies (that would re-value them),
 * we only stop showing retired numbers on screen:
 *   750  → £1,000 (retired Basic wire value)
 *   1250 → £2,000 (retired Essential wire value)
 */
export const LEGACY_CLAIM_LIMIT_DISPLAY: Record<number, number> = {
  750: 1000,
  1250: 2000,
};

/** Format claim limit for display (maps retired 750 → £1,000, 1250 → £2,000) */
export function getDisplayClaimLimit(claimLimit: number): string {
  return `£${getDisplayClaimLimitValue(claimLimit).toLocaleString()}`;
}

/** Get display value number for a claim limit (maps 750 → 1000, 1250 → 2000) */
export function getDisplayClaimLimitValue(claimLimit: number): number {
  const tier = CLAIM_LIMIT_TIERS.find(t => t.value === claimLimit);
  return tier?.displayValue ?? LEGACY_CLAIM_LIMIT_DISPLAY[claimLimit] ?? claimLimit;
}

