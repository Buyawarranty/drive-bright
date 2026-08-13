/**
 * VEHICLE RISK BANDS (DRAFT / CONFIGURATION)
 * ---------------------------------------------------------------------------
 * Managers group makes + models into named risk bands instead of writing a
 * multiplier per model. Each band carries:
 *   - a price factor (multiplier on the grid base price), and
 *   - an optional minimum 1-year price (floor) for anything in that band.
 *
 * "Referral" bands produce no automatic price at all — the quote must go to
 * manual underwriting.
 *
 * Nothing here is imported by the live customer journey; it is edited from
 * Admin → Price updates and read by the draft pricing tools.
 */

import { normalizeVehicleText } from './modelFloorMatch';
import { fuelFilterMatches, normalizeFuelFilter, type FuelFilter } from './fuelCategory';

export const RISK_BAND_MIN_FACTOR = 0.5;

/** Polite, customer-facing decline used when a band is set to "not covered". */
export const DEFAULT_BLOCK_MESSAGE =
  "Thanks for your interest! Unfortunately we're not able to offer warranty cover for this vehicle. This is down to factors like specialist parts or limited access to suitable repair centres. We're sorry we can't help this time.";

export const RISK_BAND_MAX_FACTOR = 2.5;

export type RiskBand = {
  id: string;
  /** Manager-facing name, e.g. "Low risk", "Premium SUV". */
  name: string;
  /** Multiplier on the grid base price. Ignored when `referral` is true. */
  factor: number;
  /** Optional minimum 1-year price for vehicles in this band. */
  minOneYear: number | null;
  /** No automatic price — send to manual underwriting. */
  referral: boolean;
  /** Vehicles in this band are not covered at all — quote is declined politely. */
  blocked?: boolean;
  /** Customer-facing decline wording shown when `blocked` is true. */
  blockMessage?: string;
  /** Why the band exists / how to use it. Never shown to customers. */
  note?: string;
  /** Tailwind-friendly accent token for the badge. */
  tone: 'low' | 'normal' | 'high' | 'severe' | 'referral' | 'blocked';
};

export type RiskBandAssignment = {
  id: string;
  bandId: string;
  /** Make the entry applies to, e.g. "BMW". Required. */
  make: string;
  /** Model / trim text, e.g. "X5". Empty = whole make. */
  model: string;
  /** Restrict the rule to one powertrain. 'any' (or absent) = all fuels. */
  fuel?: FuelFilter;
  enabled: boolean;
};

export type VehicleTypeFactors = {
  /** Reference vehicle type — always 1. */
  car: number;
  /** Provisional commercial-vehicle uplift. */
  van: number;
  /** Motorbikes price at this share of standard (floors halve too). */
  motorbike: number;
};

export type RiskBandConfig = {
  bands: RiskBand[];
  assignments: RiskBandAssignment[];
  vehicleTypes: VehicleTypeFactors;
  /** Band applied when a vehicle matches nothing. */
  defaultBandId: string;
  /**
   * GLOBAL minimum total price (1-year equivalent). Applies to every pricing
   * model, every band and every surface. Staff see a warning in Quotes &
   * Orders when a quote lands on it; the website simply shows this price with
   * no warning at all on Steps 3–4.
   */
  globalMinTotal: number;
};

/** Fallback global floor when nothing has been configured yet. */
export const DEFAULT_GLOBAL_MIN_TOTAL = 399;

/** Global floor in force, with the motorbike half-price rule applied. */
export function globalMinTotalFor(
  config: RiskBandConfig,
  vehicleType: 'car' | 'van' | 'motorbike' = 'car'
): number {
  const base = Number(config.globalMinTotal) > 0 ? Number(config.globalMinTotal) : DEFAULT_GLOBAL_MIN_TOTAL;
  return vehicleType === 'motorbike' ? Math.ceil(base / 2) : Math.round(base);
}

export const DEFAULT_RISK_BANDS: RiskBand[] = [
  {
    id: 'low',
    name: 'Low model risk',
    factor: 0.92,
    minOneYear: null,
    referral: false,
    tone: 'low',
    note: 'Strong reliability, cheap and plentiful parts, low claim severity.',
  },
  {
    id: 'normal',
    name: 'Normal model risk',
    factor: 1,
    minOneYear: null,
    referral: false,
    tone: 'normal',
    note: 'Default band — mainstream cars with average claims experience.',
  },
  {
    id: 'high',
    name: 'High model risk',
    factor: 1.2,
    minOneYear: 499,
    referral: false,
    tone: 'high',
    note: 'Higher repair frequency or dearer parts and labour.',
  },
  {
    id: 'severe',
    name: 'Very high model risk',
    factor: 1.45,
    minOneYear: 749,
    referral: false,
    tone: 'severe',
    note: 'Materially higher expected cost — air suspension, complex electronics, premium SUVs.',
  },
  {
    id: 'blocked',
    name: 'Not covered — decline politely',
    factor: 1,
    minOneYear: null,
    referral: false,
    blocked: true,
    blockMessage: DEFAULT_BLOCK_MESSAGE,
    tone: 'blocked',
    note: 'No quote at all. Makes / models here are declined with the polite customer message.',
  },
  {
    id: 'referral',
    name: 'Referral — manual underwriting',
    factor: 1,
    minOneYear: null,
    referral: true,
    tone: 'referral',
    note: 'No automatic price. Agent must refer the quote for a manual decision.',
  },
];

export const DEFAULT_VEHICLE_TYPE_FACTORS: VehicleTypeFactors = {
  car: 1,
  van: 1.25,
  motorbike: 0.5,
};

/** Starter assignments — mirrors the model risk rules we already ship. */
export const DEFAULT_RISK_BAND_ASSIGNMENTS: RiskBandAssignment[] = [
  { id: 'a-fiesta', bandId: 'low', make: 'Ford', model: 'Fiesta', enabled: true },
  { id: 'a-focus', bandId: 'low', make: 'Ford', model: 'Focus', enabled: true },
  { id: 'a-golf', bandId: 'low', make: 'Volkswagen', model: 'Golf', enabled: true },
  { id: 'a-qashqai', bandId: 'low', make: 'Nissan', model: 'Qashqai', enabled: true },
  { id: 'a-118', bandId: 'low', make: 'BMW', model: '118', enabled: true },
  { id: 'a-320', bandId: 'normal', make: 'BMW', model: '320', enabled: true },
  { id: 'a-a3', bandId: 'normal', make: 'Audi', model: 'A3', enabled: true },
  { id: 'a-passat', bandId: 'normal', make: 'Volkswagen', model: 'Passat', enabled: true },
  { id: 'a-c220', bandId: 'normal', make: 'Mercedes', model: 'C220', enabled: true },
  { id: 'a-zafira', bandId: 'normal', make: 'Vauxhall', model: 'Zafira', enabled: true },
  { id: 'a-520', bandId: 'high', make: 'BMW', model: '520', enabled: true },
  { id: 'a-a6', bandId: 'high', make: 'Audi', model: 'A6', enabled: true },
  { id: 'a-x5', bandId: 'high', make: 'BMW', model: 'X5', enabled: true },
  { id: 'a-ml', bandId: 'high', make: 'Mercedes', model: 'ML', enabled: true },
  { id: 'a-evoque', bandId: 'high', make: 'Land Rover', model: 'Evoque', enabled: true },
  { id: 'a-disco-sport', bandId: 'high', make: 'Land Rover', model: 'Discovery Sport', enabled: true },
  { id: 'a-q7', bandId: 'severe', make: 'Audi', model: 'Q7', enabled: true },
  { id: 'a-rr-sport', bandId: 'severe', make: 'Land Rover', model: 'Range Rover Sport', enabled: true },
  { id: 'a-rr', bandId: 'severe', make: 'Land Rover', model: 'Range Rover', enabled: true },
  { id: 'a-tesla3', bandId: 'high', make: 'Tesla', model: 'Model 3', enabled: true },
  // Sport TRIMS (not performance derivatives) — always covered, always high risk.
  { id: 'a-bmw-msport', bandId: 'high', make: 'BMW', model: 'M Sport', enabled: true },
  { id: 'a-audi-sline', bandId: 'high', make: 'Audi', model: 'S Line', enabled: true },
  { id: 'a-merc-amgline', bandId: 'high', make: 'Mercedes', model: 'AMG Line', enabled: true },

  /**
   * PREMIUM PRELOAD — "premium" is not its own category; premium makes/models
   * live in the High / Very high bands so they pick up that band's factor and
   * its 1-year minimum (£499 / £749, halved for motorbikes). Whole-make rows
   * are used where the entire range is premium; model rows where only some
   * variants are.
   */
  // High model risk — premium mainstream / entry-premium
  { id: 'p-bmw', bandId: 'high', make: 'BMW', model: '', enabled: true },
  { id: 'p-audi', bandId: 'high', make: 'Audi', model: '', enabled: true },
  { id: 'p-mercedes', bandId: 'high', make: 'Mercedes-Benz', model: '', enabled: true },
  { id: 'p-volvo', bandId: 'high', make: 'Volvo', model: '', enabled: true },
  { id: 'p-lexus', bandId: 'high', make: 'Lexus', model: '', enabled: true },
  { id: 'p-jaguar', bandId: 'high', make: 'Jaguar', model: '', enabled: true },
  { id: 'p-mini', bandId: 'high', make: 'MINI', model: '', enabled: true },
  { id: 'p-alfa', bandId: 'high', make: 'Alfa Romeo', model: '', enabled: true },
  { id: 'p-ds', bandId: 'high', make: 'DS', model: '', enabled: true },
  { id: 'p-cupra', bandId: 'high', make: 'Cupra', model: '', enabled: true },
  { id: 'p-genesis', bandId: 'high', make: 'Genesis', model: '', enabled: true },
  { id: 'p-tesla', bandId: 'high', make: 'Tesla', model: '', enabled: true },
  { id: 'p-polestar', bandId: 'high', make: 'Polestar', model: '', enabled: true },

  // Very high model risk — air suspension, complex electronics, large premium SUVs
  { id: 'p-lr', bandId: 'severe', make: 'Land Rover', model: '', enabled: true },
  { id: 'p-rr', bandId: 'severe', make: 'Range Rover', model: '', enabled: true },
  { id: 'p-porsche', bandId: 'severe', make: 'Porsche', model: '', enabled: true },
  { id: 'p-bmw-x5', bandId: 'severe', make: 'BMW', model: 'X5', enabled: true },
  { id: 'p-bmw-x6', bandId: 'severe', make: 'BMW', model: 'X6', enabled: true },
  { id: 'p-bmw-x7', bandId: 'severe', make: 'BMW', model: 'X7', enabled: true },
  { id: 'p-bmw-7', bandId: 'severe', make: 'BMW', model: '7 Series', enabled: true },
  { id: 'p-bmw-i7', bandId: 'severe', make: 'BMW', model: 'i7', enabled: true },
  { id: 'p-bmw-ix', bandId: 'severe', make: 'BMW', model: 'iX', enabled: true },
  { id: 'p-audi-q7', bandId: 'severe', make: 'Audi', model: 'Q7', enabled: true },
  { id: 'p-audi-q8', bandId: 'severe', make: 'Audi', model: 'Q8', enabled: true },
  { id: 'p-audi-a8', bandId: 'severe', make: 'Audi', model: 'A8', enabled: true },
  { id: 'p-audi-etron', bandId: 'severe', make: 'Audi', model: 'e-tron', enabled: true },
  { id: 'p-merc-gle', bandId: 'severe', make: 'Mercedes-Benz', model: 'GLE', enabled: true },
  { id: 'p-merc-gls', bandId: 'severe', make: 'Mercedes-Benz', model: 'GLS', enabled: true },
  { id: 'p-merc-s', bandId: 'severe', make: 'Mercedes-Benz', model: 'S Class', enabled: true },
  { id: 'p-merc-eqs', bandId: 'severe', make: 'Mercedes-Benz', model: 'EQS', enabled: true },
  { id: 'p-merc-gclass', bandId: 'severe', make: 'Mercedes-Benz', model: 'G Class', enabled: true },
  { id: 'p-volvo-xc90', bandId: 'severe', make: 'Volvo', model: 'XC90', enabled: true },
  { id: 'p-jag-fpace', bandId: 'severe', make: 'Jaguar', model: 'F-Pace', enabled: true },
  { id: 'p-jag-xj', bandId: 'severe', make: 'Jaguar', model: 'XJ', enabled: true },
  { id: 'p-tesla-x', bandId: 'severe', make: 'Tesla', model: 'Model X', enabled: true },
  { id: 'p-tesla-s', bandId: 'severe', make: 'Tesla', model: 'Model S', enabled: true },
];


export const DEFAULT_RISK_BAND_CONFIG: RiskBandConfig = {
  bands: DEFAULT_RISK_BANDS,
  assignments: DEFAULT_RISK_BAND_ASSIGNMENTS,
  vehicleTypes: DEFAULT_VEHICLE_TYPE_FACTORS,
  defaultBandId: 'normal',
  globalMinTotal: DEFAULT_GLOBAL_MIN_TOTAL,
};

export function clampBandFactor(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(RISK_BAND_MAX_FACTOR, Math.max(RISK_BAND_MIN_FACTOR, value));
}

function tokens(text: string): string[] {
  return normalizeVehicleText(text).split(' ').filter(Boolean);
}

function containsAllTokens(haystack: string[], needle: string): boolean {
  const wanted = tokens(needle);
  if (!wanted.length) return false;
  return wanted.every(t => haystack.includes(t));
}

export type RiskBandMatch = {
  band: RiskBand;
  assignment: RiskBandAssignment | null;
  /** True when the band came from `defaultBandId` rather than a match. */
  isDefault: boolean;
};

/** Most specific enabled assignment wins ("Range Rover Sport" beats "Range Rover"). */
export function matchRiskBand(
  make: string | null | undefined,
  model: string | null | undefined,
  config: RiskBandConfig,
  fuelType?: string | null
): RiskBandMatch {
  const fallbackBand =
    config.bands.find(b => b.id === config.defaultBandId) || config.bands[0] || DEFAULT_RISK_BANDS[1];

  const makeTokens = tokens(`${make || ''}`);
  const fullTokens = tokens(`${make || ''} ${model || ''}`);
  if (!makeTokens.length && !fullTokens.length) return { band: fallbackBand, assignment: null, isDefault: true };

  let best: { assignment: RiskBandAssignment; specificity: number } | null = null;
  for (const a of config.assignments) {
    if (!a.enabled) continue;
    // Fuel-specific rules only fire on that powertrain.
    if (!fuelFilterMatches(a.fuel, fuelType)) continue;

    const assignmentMake = String(a.make || '').trim();
    const assignmentModel = String(a.model || '').trim();

    // Make-only rule: must match the make tokens.
    if (assignmentMake && !assignmentModel) {
      if (!containsAllTokens(makeTokens, assignmentMake) && !containsAllTokens(fullTokens, assignmentMake)) continue;
    }
    // Model-only rule: must match the model tokens somewhere in the vehicle name.
    else if (!assignmentMake && assignmentModel) {
      if (!containsAllTokens(fullTokens, assignmentModel)) continue;
    }
    // Make + model rule: both must match, and make must match first to avoid cross-make matches.
    else if (assignmentMake && assignmentModel) {
      if (!containsAllTokens(makeTokens, assignmentMake) && !containsAllTokens(fullTokens, assignmentMake)) continue;
      if (!containsAllTokens(fullTokens, assignmentModel)) continue;
    }
    // Empty assignment (shouldn't happen) — skip.
    else {
      continue;
    }

    const specificity =
      (assignmentMake ? tokens(assignmentMake).join('').length : 0) +
      (assignmentModel ? tokens(assignmentModel).join('').length + 10 : 0) +
      (normalizeFuelFilter(a.fuel) !== 'any' ? 5 : 0);
    if (!best || specificity > best.specificity) best = { assignment: a, specificity };
  }

  if (!best) return { band: fallbackBand, assignment: null, isDefault: true };
  const band = config.bands.find(b => b.id === best!.assignment.bandId) || fallbackBand;
  return { band, assignment: best.assignment, isDefault: false };
}


export type RiskBandPriceResult = {
  /** null when the band is a referral or blocked. */
  price: number | null;
  referral: boolean;
  /** True when the vehicle must not be quoted at all. */
  blocked: boolean;
  /** Polite customer-facing decline wording (only when `blocked`). */
  blockMessage: string | null;
  floorApplied: boolean;
  factorUsed: number;
  band: RiskBand;
};

/**
 * Apply a band (and the vehicle type factor) to a base price.
 * Order: base × band factor × vehicle type factor, then the band floor.
 * Motorbikes halve the floor too, matching the standing pricing rule.
 */
export function applyRiskBand(
  basePrice: number,
  match: RiskBandMatch,
  vehicleType: 'car' | 'van' | 'motorbike',
  config: RiskBandConfig
): RiskBandPriceResult {
  const band = match.band;
  if (band.blocked) {
    return {
      price: null,
      referral: false,
      blocked: true,
      blockMessage: band.blockMessage?.trim() || DEFAULT_BLOCK_MESSAGE,
      floorApplied: false,
      factorUsed: 1,
      band,
    };
  }
  if (band.referral) {
    return { price: null, referral: true, blocked: false, blockMessage: null, floorApplied: false, factorUsed: 1, band };
  }

  const typeFactor = config.vehicleTypes[vehicleType] ?? 1;
  const factorUsed = clampBandFactor(band.factor) * typeFactor;
  let price = Math.ceil(basePrice * factorUsed);

  let floorApplied = false;
  if (band.minOneYear && band.minOneYear > 0) {
    const floor = vehicleType === 'motorbike' ? Math.ceil(band.minOneYear / 2) : band.minOneYear;
    if (price < floor) {
      price = floor;
      floorApplied = true;
    }
  }

  // GLOBAL floor last — never below the global minimum on any model or surface.
  const globalFloor = globalMinTotalFor(config, vehicleType);
  if (price < globalFloor) {
    price = globalFloor;
    floorApplied = true;
  }

  return { price, referral: false, blocked: false, blockMessage: null, floorApplied, factorUsed, band };
}

const STORAGE_KEY = 'bw:pricing:vehicle-risk-bands';

export function loadRiskBandConfig(): RiskBandConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RISK_BAND_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.bands) || !parsed.bands.length) return DEFAULT_RISK_BAND_CONFIG;
    return {
      bands: parsed.bands.map((b: RiskBand, i: number) => ({
        id: b.id || `band-${i}`,
        name: String(b.name || `Band ${i + 1}`),
        factor: clampBandFactor(Number(b.factor)),
        minOneYear:
          Number.isFinite(Number(b.minOneYear)) && Number(b.minOneYear) > 0 ? Number(b.minOneYear) : null,
        referral: b.referral === true,
        blocked: b.blocked === true,
        blockMessage: b.blocked === true ? String(b.blockMessage || DEFAULT_BLOCK_MESSAGE) : b.blockMessage || undefined,
        note: b.note || undefined,
        tone: (['low', 'normal', 'high', 'severe', 'referral', 'blocked'] as const).includes(b.tone) ? b.tone : 'normal',
      })),
      assignments: Array.isArray(parsed.assignments)
        ? parsed.assignments
            .filter((a: RiskBandAssignment) => a && (String(a.make || '').trim() || String(a.model || '').trim()))
            .map((a: RiskBandAssignment, i: number) => ({
              id: a.id || `assign-${i}`,
              bandId: String(a.bandId || 'normal'),
              make: String(a.make || ''),
              model: String(a.model || ''),
              fuel: normalizeFuelFilter(a.fuel),
              enabled: a.enabled !== false,
            }))
        : [],
      vehicleTypes: {
        car: 1,
        van: clampBandFactor(Number(parsed?.vehicleTypes?.van ?? DEFAULT_VEHICLE_TYPE_FACTORS.van)),
        motorbike: clampBandFactor(
          Number(parsed?.vehicleTypes?.motorbike ?? DEFAULT_VEHICLE_TYPE_FACTORS.motorbike)
        ),
      },
      defaultBandId: String(parsed.defaultBandId || 'normal'),
      globalMinTotal:
        Number(parsed.globalMinTotal) > 0 ? Math.round(Number(parsed.globalMinTotal)) : DEFAULT_GLOBAL_MIN_TOTAL,
    };
  } catch {
    return DEFAULT_RISK_BAND_CONFIG;
  }
}

export function saveRiskBandConfig(config: RiskBandConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* configuration only — never break the page on a storage failure */
  }
}
