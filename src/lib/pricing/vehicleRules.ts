/**
 * Shared model-specific pricing rules (minimum prices and "not covered" referrals).
 *
 * Managed in Admin → Price updates → "Model-specific floors and referrals", saved to
 * the `pricing_vehicle_rules` table and loaded once at app start, so the SAME rules
 * apply on the admin Quotes & Orders page and on the customer journey (Steps 3 → 4).
 *
 * Matching is text-based and handled by modelFloorMatch, so a rule still fires when
 * the DVLA/MOT lookup returns the make and model separately or in different wording.
 */

import { matchModelFloor, type MatchableFloor } from './modelFloorMatch';

export type VehiclePricingRule = MatchableFloor;

export const MANUAL_REFERRAL_MESSAGE =
  'We can still help with this vehicle, but it needs a quick manual review. Please call our sales line on 0330 229 5040 or request a callback and one of the team will come straight back to you.';

/**
 * Term scaling for a one-year minimum price. Mirrors the sellable minimums
 * (£399 / £659 / £938) so a 12-month floor lifts 24 and 36 months in proportion.
 */
const TERM_FLOOR_RATIO: Record<string, number> = {
  '12months': 1,
  '24months': 659 / 399,
  '36months': 938 / 399,
};

let VEHICLE_RULES: VehiclePricingRule[] = [];

/** Replace the live rule set (called by the loader and after an admin save). */
export function setVehiclePricingRules(rules: VehiclePricingRule[]): void {
  VEHICLE_RULES = Array.isArray(rules) ? rules : [];
}

export function getVehiclePricingRules(): VehiclePricingRule[] {
  return VEHICLE_RULES;
}

/** The rule that applies to a vehicle name ("TESLA MODEL 3 LONG RANGE"), if any. */
export function matchVehiclePricingRule(vehicleName?: string | null): VehiclePricingRule | null {
  if (!vehicleName || VEHICLE_RULES.length === 0) return null;
  return matchModelFloor(vehicleName, VEHICLE_RULES)?.floor ?? null;
}

/** True when a rule marks this vehicle as not covered (manual referral instead of a price). */
export function isVehicleBlockedByRules(vehicleName?: string | null): boolean {
  const rule = matchVehiclePricingRule(vehicleName);
  return !!rule && rule.covered === false;
}

/**
 * Minimum price this vehicle may be quoted at for the given term,
 * or null when no priced rule applies.
 */
export function getVehicleRuleMinPrice(
  vehicleName: string | null | undefined,
  paymentPeriod: string
): number | null {
  const rule = matchVehiclePricingRule(vehicleName);
  if (!rule || rule.covered === false) return null;
  const minOneYear = Number(rule.minOneYear);
  if (!Number.isFinite(minOneYear) || minOneYear <= 0) return null;
  const ratio = TERM_FLOOR_RATIO[paymentPeriod] ?? 1;
  return Math.round(minOneYear * ratio);
}
