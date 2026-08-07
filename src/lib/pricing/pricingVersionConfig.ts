/**
 * SELF-CONTAINED PRICING VERSION CONFIG
 * -------------------------------------------------------------------------
 * A published pricing version must be reproducible on its own: the grid alone
 * is not enough, because floors, caps, rounding and the reference vehicle all
 * change the final number. Everything needed to recompute a historical quote
 * therefore travels with the version record.
 *
 * Nothing here changes a live price. When a field is missing the code defaults
 * below are used, which are the values already hardcoded in pricingMatrix.ts.
 */

import type { VehicleFactorModel, VehicleFactorInput } from './vehicleFactorModel';

export type RoundingRule = 'ceil_pound' | 'round_pound' | 'floor_pound';

export type TermKey = '12months' | '24months' | '36months';

export type PriceFloors = Partial<Record<TermKey, number>>;
export type PriceCaps = Partial<Record<TermKey, number>>;

/** The vehicle the grid was generated for. Factors are measured relative to it. */
export type ReferenceVehicle = VehicleFactorInput & {
  /** Free-text note, e.g. "2019 1.0 petrol hatchback, 45,000 miles". */
  description?: string | null;
};

/** Multiplier of the reference vehicle on each dimension (all 1.00 by default). */
export type ReferenceFactors = {
  age?: number | null;
  mileage?: number | null;
  powertrain?: number | null;
  vehicleType?: number | null;
};

export type PricingVersionConfig = {
  reference_vehicle?: ReferenceVehicle | null;
  /**
   * How much cheaper the website (Step 3/4) price is than the admin Quotes &
   * Orders grid price, in percent. Stored on the version so the gap can be
   * tuned (e.g. 5% or 7%) without a code change, and so a historical quote can
   * always be reproduced with the gap that was live at the time.
   */
  web_discount_pct?: number | null;
  reference_factors?: ReferenceFactors | null;
  price_floors?: PriceFloors | null;
  price_caps?: PriceCaps | null;
  rounding_rule?: RoundingRule | null;
  effective_date?: string | null;
  model_version?: number | null;
  config_checksum?: string | null;
};

/** The floors currently hardcoded in the pricing engine (£399 / £659 / £938). */
export const CODE_PRICE_FLOORS: PriceFloors = {
  '12months': 399,
  '24months': 659,
  '36months': 938,
};

/** The web gap currently hardcoded in the pricing engine (10% below the grid). */
export const CODE_WEB_DISCOUNT_PCT = 10;

/** Hard ceiling on the web gap — the website may never undercut the grid by more. */
export const MAX_WEB_DISCOUNT_PCT = 10;

/** The engine rounds every contract total up to the whole pound. */
export const CODE_ROUNDING_RULE: RoundingRule = 'ceil_pound';

export const NEUTRAL_REFERENCE_FACTORS: ReferenceFactors = {
  age: 1,
  mileage: 1,
  powertrain: 1,
  vehicleType: 1,
};

export function resolvePriceFloors(config?: PricingVersionConfig | null): PriceFloors {
  const floors = config?.price_floors;
  if (!floors || typeof floors !== 'object') return CODE_PRICE_FLOORS;
  const out: PriceFloors = { ...CODE_PRICE_FLOORS };
  (Object.keys(CODE_PRICE_FLOORS) as TermKey[]).forEach(term => {
    const v = Number((floors as any)[term]);
    if (Number.isFinite(v) && v > 0) out[term] = v;
  });
  return out;
}

export function resolveWebDiscountPct(config?: PricingVersionConfig | null): number {
  const raw = Number(config?.web_discount_pct);
  if (!Number.isFinite(raw) || raw <= 0) return CODE_WEB_DISCOUNT_PCT;
  return Math.min(raw, MAX_WEB_DISCOUNT_PCT);
}

export function resolveRoundingRule(config?: PricingVersionConfig | null): RoundingRule {
  const rule = config?.rounding_rule;
  return rule === 'round_pound' || rule === 'floor_pound' || rule === 'ceil_pound'
    ? rule
    : CODE_ROUNDING_RULE;
}

export function applyRounding(value: number, rule: RoundingRule = CODE_ROUNDING_RULE): number {
  if (!Number.isFinite(value)) return 0;
  if (rule === 'floor_pound') return Math.floor(value);
  if (rule === 'round_pound') return Math.round(value);
  return Math.ceil(value);
}

/**
 * Stable checksum of everything that can move a price. Two versions with the
 * same checksum must produce the same quote for the same vehicle, so a stored
 * quote can be verified against the version it claims to have used.
 */
export function computeConfigChecksum(input: {
  admin_matrix?: unknown;
  step3_discount_pct?: number | null;
  web_discount_pct?: number | null;
  claim_limit_factors?: unknown;
  labour_rate_factors?: unknown;
  vehicle_factor_model?: VehicleFactorModel | null;
  reference_vehicle?: ReferenceVehicle | null;
  reference_factors?: ReferenceFactors | null;
  price_floors?: PriceFloors | null;
  price_caps?: PriceCaps | null;
  rounding_rule?: RoundingRule | null;
}): string {
  const canonical = stableStringify({
    m: input.admin_matrix ?? null,
    d: input.step3_discount_pct ?? null,
    w: input.web_discount_pct ?? null,
    c: input.claim_limit_factors ?? null,
    l: input.labour_rate_factors ?? null,
    v: input.vehicle_factor_model ?? null,
    rv: input.reference_vehicle ?? null,
    rf: input.reference_factors ?? null,
    fl: input.price_floors ?? null,
    cp: input.price_caps ?? null,
    r: input.rounding_rule ?? null,
  });
  // FNV-1a — deterministic, dependency-free, plenty for change detection.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i);
    h1 = ((h1 ^ ch) * 0x01000193) >>> 0;
    h2 = ((h2 + ch) * 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
