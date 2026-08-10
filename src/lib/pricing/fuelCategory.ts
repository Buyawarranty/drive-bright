/**
 * FUEL / POWERTRAIN CATEGORIES
 * ---------------------------------------------------------------------------
 * Single place that turns the free-text `fuelType` we get back from DVLA (and
 * the MOT-history cache) into the five categories pricing works with.
 * Used by the risk-band editor and the £5,000 claim-limit blocklist so a rule
 * can target, say, "all diesel Range Rovers" without touching the live engine.
 */

export type FuelCategory = 'petrol' | 'diesel' | 'hev' | 'phev' | 'ev';

/** 'any' = the rule ignores fuel type (previous behaviour). */
export type FuelFilter = 'any' | FuelCategory;

export const FUEL_FILTER_OPTIONS: { value: FuelFilter; label: string }[] = [
  { value: 'any', label: 'Any fuel' },
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'hev', label: 'Full hybrid (HEV)' },
  { value: 'phev', label: 'Plug-in hybrid (PHEV)' },
  { value: 'ev', label: 'Electric (EV)' },
];

export const FUEL_LABEL: Record<FuelFilter, string> = {
  any: 'Any fuel',
  petrol: 'Petrol',
  diesel: 'Diesel',
  hev: 'Full hybrid',
  phev: 'Plug-in hybrid',
  ev: 'Electric',
};

/** Normalise DVLA free text to a category. Returns null when unknown/blank. */
export function normalizeFuelCategory(fuelType?: string | null): FuelCategory | null {
  const f = String(fuelType || '').toLowerCase().trim();
  if (!f) return null;
  if (f.includes('plug') || f.includes('phev')) return 'phev';
  if (f.includes('electric') || f === 'ev' || f.includes('bev')) return 'ev';
  if (f.includes('hybrid') || f.includes('hev')) return 'hev';
  if (f.includes('diesel')) return 'diesel';
  if (f.includes('petrol') || f.includes('gasoline') || f.includes('hybrid electric')) return 'petrol';
  return 'petrol';
}

/** Coerce stored values (possibly legacy/blank) to a valid filter. */
export function normalizeFuelFilter(value?: string | null): FuelFilter {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'petrol' || v === 'diesel' || v === 'hev' || v === 'phev' || v === 'ev') return v;
  return 'any';
}

/**
 * Does a rule's fuel filter apply to this vehicle?
 * Unknown vehicle fuel only matches 'any' rules, so a fuel-specific rule can
 * never fire on a vehicle we have no fuel data for.
 */
export function fuelFilterMatches(filter: FuelFilter | undefined, fuelType?: string | null): boolean {
  const f = normalizeFuelFilter(filter);
  if (f === 'any') return true;
  const category = normalizeFuelCategory(fuelType);
  if (!category) return false;
  return category === f;
}
