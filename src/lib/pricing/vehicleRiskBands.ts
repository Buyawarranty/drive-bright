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

export const RISK_BAND_MIN_FACTOR = 0.5;
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
  /** Why the band exists / how to use it. Never shown to customers. */
  note?: string;
  /** Tailwind-friendly accent token for the badge. */
  tone: 'low' | 'normal' | 'high' | 'severe' | 'referral';
};

export type RiskBandAssignment = {
  id: string;
  bandId: string;
  /** Make the entry applies to, e.g. "BMW". Required. */
  make: string;
  /** Model / trim text, e.g. "X5". Empty = whole make. */
  model: string;
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
};

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
    minOneYear: 599,
    referral: false,
    tone: 'high',
    note: 'Higher repair frequency or dearer parts and labour.',
  },
  {
    id: 'severe',
    name: 'Very high model risk',
    factor: 1.45,
    minOneYear: 849,
    referral: false,
    tone: 'severe',
    note: 'Materially higher expected cost — air suspension, complex electronics, premium SUVs.',
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
];

export const DEFAULT_RISK_BAND_CONFIG: RiskBandConfig = {
  bands: DEFAULT_RISK_BANDS,
  assignments: DEFAULT_RISK_BAND_ASSIGNMENTS,
  vehicleTypes: DEFAULT_VEHICLE_TYPE_FACTORS,
  defaultBandId: 'normal',
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
  config: RiskBandConfig
): RiskBandMatch {
  const fallbackBand =
    config.bands.find(b => b.id === config.defaultBandId) || config.bands[0] || DEFAULT_RISK_BANDS[1];

  const makeTokens = tokens(`${make || ''}`);
  const fullTokens = tokens(`${make || ''} ${model || ''}`);
  if (!makeTokens.length) return { band: fallbackBand, assignment: null, isDefault: true };

  let best: { assignment: RiskBandAssignment; specificity: number } | null = null;
  for (const a of config.assignments) {
    if (!a.enabled) continue;
    if (!containsAllTokens(makeTokens, a.make) && !containsAllTokens(fullTokens, a.make)) continue;
    const modelText = String(a.model || '').trim();
    if (modelText && !containsAllTokens(fullTokens, modelText)) continue;
    const specificity = modelText ? tokens(modelText).join('').length + 10 : 0;
    if (!best || specificity > best.specificity) best = { assignment: a, specificity };
  }

  if (!best) return { band: fallbackBand, assignment: null, isDefault: true };
  const band = config.bands.find(b => b.id === best!.assignment.bandId) || fallbackBand;
  return { band, assignment: best.assignment, isDefault: false };
}

export type RiskBandPriceResult = {
  /** null when the band is a referral. */
  price: number | null;
  referral: boolean;
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
  if (band.referral) {
    return { price: null, referral: true, floorApplied: false, factorUsed: 1, band };
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

  return { price, referral: false, floorApplied, factorUsed, band };
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
        note: b.note || undefined,
        tone: (['low', 'normal', 'high', 'severe', 'referral'] as const).includes(b.tone) ? b.tone : 'normal',
      })),
      assignments: Array.isArray(parsed.assignments)
        ? parsed.assignments
            .filter((a: RiskBandAssignment) => a && String(a.make || '').trim())
            .map((a: RiskBandAssignment, i: number) => ({
              id: a.id || `assign-${i}`,
              bandId: String(a.bandId || 'normal'),
              make: String(a.make),
              model: String(a.model || ''),
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
