/**
 * Single source of truth for how old a vehicle is.
 *
 * Age drives the 15-year eligibility boundary and the age-band pricing, so every
 * surface (Quotes & Orders, Step 3/4, the homepage reg entry) must measure it the
 * same way:
 *
 *   1. First registration date — what the DVLA/MOT record asserts, and what
 *      underwriters use. Preferred whenever we have it.
 *   2. Manufacture date — close, but can be up to a year before registration.
 *   3. Year of manufacture only — treated as 1 January, the worst case, which is
 *      why it is the last resort: it can age a car by up to 12 months.
 *
 * No pricing calculations live here — this is date arithmetic only.
 */

export type VehicleAgeSource =
  | 'registration_date'
  | 'manufacture_date'
  | 'year_of_manufacture'
  | 'unknown';

export type VehicleAgeInput = {
  registrationDate?: string | null;
  manufactureDate?: string | null;
  /** Year of manufacture, e.g. "2015" or 2015. */
  year?: string | number | null;
  /** Override "now" in tests. */
  asOf?: Date;
};

export type VehicleAgeResult = {
  /** Exact age in years, e.g. 14.83. Null when we have no usable date. */
  ageYears: number | null;
  /** Whole years, for display. */
  ageWholeYears: number | null;
  source: VehicleAgeSource;
};

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function exactYearsSince(value: string, asOf: Date): number | null {
  const from = new Date(value);
  if (Number.isNaN(from.getTime())) return null;
  const ms = asOf.getTime() - from.getTime();
  if (!Number.isFinite(ms)) return null;
  return ms / MS_PER_YEAR;
}

export function getVehicleAge(input: VehicleAgeInput): VehicleAgeResult {
  const asOf = input.asOf ?? new Date();

  const ordered: Array<[VehicleAgeSource, string | null | undefined]> = [
    ['registration_date', input.registrationDate],
    ['manufacture_date', input.manufactureDate],
  ];

  for (const [source, value] of ordered) {
    if (!value) continue;
    const ageYears = exactYearsSince(String(value), asOf);
    if (ageYears !== null) {
      return { ageYears, ageWholeYears: Math.floor(ageYears), source };
    }
  }

  const year = input.year !== null && input.year !== undefined ? Number(input.year) : NaN;
  if (Number.isFinite(year) && year >= 1950 && year <= asOf.getFullYear() + 1) {
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const ageYears = (asOf.getTime() - jan1.getTime()) / MS_PER_YEAR;
    return {
      ageYears,
      ageWholeYears: Math.max(0, asOf.getFullYear() - year),
      source: 'year_of_manufacture',
    };
  }

  return { ageYears: null, ageWholeYears: null, source: 'unknown' };
}

/** Convenience: exact age in years, or null when unknown. */
export function preciseVehicleAgeYears(input: VehicleAgeInput): number | null {
  return getVehicleAge(input).ageYears;
}

/** True when the vehicle is past the 15-year cover boundary. */
export function isOverMaxVehicleAge(input: VehicleAgeInput, maxYears = 15): boolean {
  const { ageYears } = getVehicleAge(input);
  return ageYears !== null && ageYears > maxYears;
}
