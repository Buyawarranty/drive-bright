/**
 * LIVE VEHICLE FACTOR MODEL
 * -------------------------------------------------------------------------
 * The published Quotes & Orders price grid (period × excess × claim limit) has
 * no vehicle dimension, so on its own EVERY car prices the same. The Age-based
 * builder holds the vehicle risk figures (age bands, mileage bands, powertrain,
 * vehicle type). Publishing now stores those figures alongside the grid and this
 * module turns them into a single multiplier applied to the grid base price, so
 * a 2-year-old 20k-mile petrol car and a 12-year-old 130k-mile diesel no longer
 * come out at the same number.
 *
 * The reference age band (the band the grid was built from) is factor 1.00, so a
 * model with no changes keeps the published grid prices exactly as they are.
 */

export type VehicleFactorModel = {
  /** Age bands, keyed '1-3' | '4-5' | '12' | '15+' with the 1-year base price. */
  bands: { key: string; oneYear: number | null }[];
  /** Which band the published grid represents (factor 1.00). */
  refBandKey: string;
  mileageBands: { min: number; max: number | null; factor: number | null }[];
  powertrains: { key: string; factor: number }[];
  vehicleTypes: { key: string; factor: number | null }[];
  /**
   * The rest of the age-band ("Aug hybrid") model travels with every publish too,
   * so Quotes & Orders can quote from the SAME figures a manager pushed live
   * instead of whatever draft happens to sit in that agent's browser.
   */
  modelRisks?: any[];
  modelFloors?: any[];
  claimLimits?: { limit: number; factor: number }[];
  labourRates?: { rate: number; factor: number; uxPosition?: string | null }[];
  excessFactors?: any[];
  twoYearMult?: number;
  threeYearMult?: number;
  payInFullFactor?: number;
};


export type VehicleFactorInput = {
  year?: string | number | null;
  manufactureDate?: string | null;
  mileage?: string | number | null;
  fuelType?: string | null;
  vehicleType?: string | null;
};

let LIVE_MODEL: VehicleFactorModel | null = null;

export function setLiveVehicleFactorModel(model: VehicleFactorModel | null): void {
  LIVE_MODEL = model && Array.isArray(model.bands) && model.bands.length ? model : null;
}

export function hasLiveVehicleFactorModel(): boolean {
  return LIVE_MODEL !== null;
}

export function getLiveVehicleFactorModel(): VehicleFactorModel | null {
  return LIVE_MODEL;
}

/**
 * The vehicle the published grid was built for. Factors are applied NORMALISED
 * against it (F_current / F_reference) so a grid generated for a car whose own
 * factors were not all 1.00 is never charged those factors twice.
 * With no reference vehicle set, behaviour is unchanged (divisor 1).
 */
let LIVE_REFERENCE_VEHICLE: VehicleFactorInput | null = null;

export function setLiveVehicleReferenceVehicle(vehicle: VehicleFactorInput | null): void {
  LIVE_REFERENCE_VEHICLE = vehicle && Object.keys(vehicle).length ? vehicle : null;
}

export function getLiveVehicleReferenceVehicle(): VehicleFactorInput | null {
  return LIVE_REFERENCE_VEHICLE;
}

/** '1-3' → [1,3]; '12' → [12,12]; '15+' → [15,null]. */
function bandRange(key: string): { min: number; max: number | null } {
  const k = String(key).trim();
  if (k.endsWith('+')) return { min: Number(k.slice(0, -1)) || 0, max: null };
  const parts = k.split('-');
  const min = Number(parts[0]);
  const max = parts.length > 1 ? Number(parts[1]) : min;
  return {
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : null,
  };
}

function parseNumber(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseInt(String(value).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export function getVehicleAgeYears(input: VehicleFactorInput): number | null {
  if (input.manufactureDate) {
    const d = new Date(input.manufactureDate);
    if (!isNaN(d.getTime())) {
      return (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    }
  }
  const year = parseNumber(input.year);
  if (year && year > 1900) return new Date().getFullYear() - year;
  return null;
}

function powertrainKey(fuelType?: string | null): string {
  const f = String(fuelType || '').toLowerCase();
  if (!f) return 'petrol';
  if (f.includes('plug') || f.includes('phev')) return 'phev';
  if (f.includes('electric') || f === 'ev' || f.includes('bev')) return 'ev';
  if (f.includes('hybrid') || f.includes('hev')) return 'hev';
  if (f.includes('diesel')) return 'diesel';
  return 'petrol';
}

/**
 * Multiplier for this vehicle relative to the published grid.
 * Returns 1 when nothing is published or the vehicle details are unknown, so the
 * grid price is always the fallback and pricing can never break.
 *
 * Motorbikes are intentionally NOT handled here — they are halved by the
 * isMotorbike flag in pricingMatrix so the floor halves with them.
 */
export function rawVehicleFactor(input?: VehicleFactorInput | null): number {
  const model = LIVE_MODEL;
  if (!model || !input) return 1;

  let factor = 1;

  // 1. Age band, relative to the reference band the grid was built from.
  const refBand =
    model.bands.find(b => b.key === model.refBandKey) ||
    model.bands.find(b => typeof b.oneYear === 'number');
  const refPrice = refBand && typeof refBand.oneYear === 'number' ? refBand.oneYear : null;
  const age = getVehicleAgeYears(input);
  if (refPrice && refPrice > 0 && age !== null) {
    const match = model.bands.find(b => {
      const { min, max } = bandRange(b.key);
      return age >= min && (max === null || age <= max + 0.9999);
    });
    // Over the top band (no automatic price) falls back to the dearest priced band.
    const priced =
      match && typeof match.oneYear === 'number'
        ? match.oneYear
        : [...model.bands]
            .filter(b => typeof b.oneYear === 'number')
            .sort((a, b) => (b.oneYear as number) - (a.oneYear as number))[0]?.oneYear ?? null;
    if (typeof priced === 'number' && priced > 0) factor *= priced / refPrice;
  }

  // 2. Mileage band.
  const mileage = parseNumber(input.mileage);
  if (mileage !== null && Array.isArray(model.mileageBands)) {
    const band = model.mileageBands.find(
      b => mileage >= (b.min ?? 0) && (b.max === null || b.max === undefined || mileage <= b.max)
    );
    // A "no automatic price" band (factor null) is a referral, not a discount —
    // price it at the dearest defined mileage factor rather than ignoring it.
    if (band) {
      const f =
        typeof band.factor === 'number'
          ? band.factor
          : Math.max(
              1,
              ...model.mileageBands
                .map(b => (typeof b.factor === 'number' ? b.factor : 0))
                .filter(n => n > 0)
            );
      if (f > 0) factor *= f;
    }
  }

  // 3. Powertrain.
  if (Array.isArray(model.powertrains)) {
    const pt = model.powertrains.find(p => p.key === powertrainKey(input.fuelType));
    if (pt && typeof pt.factor === 'number' && pt.factor > 0) factor *= pt.factor;
  }

  // 4. Vehicle type (van uplift; motorbikes handled elsewhere).
  const vt = String(input.vehicleType || '').toLowerCase();
  if (Array.isArray(model.vehicleTypes) && vt.includes('van')) {
    const van = model.vehicleTypes.find(t => t.key === 'van');
    if (van && typeof van.factor === 'number' && van.factor > 0) factor *= van.factor;
  }

  if (!Number.isFinite(factor) || factor <= 0) return 1;
  return factor;
}

/**
 * Normalised multiplier used by every live price read: the vehicle's raw factor
 * divided by the reference vehicle's raw factor. Identical to the raw factor
 * when no reference vehicle is published, so nothing moves until one is set.
 */
export function getVehiclePriceFactor(input?: VehicleFactorInput | null): number {
  const current = rawVehicleFactor(input);
  const ref = LIVE_REFERENCE_VEHICLE ? rawVehicleFactor(LIVE_REFERENCE_VEHICLE) : 1;
  if (!Number.isFinite(ref) || ref <= 0) return current;
  const normalised = current / ref;
  return Number.isFinite(normalised) && normalised > 0 ? normalised : 1;
}
