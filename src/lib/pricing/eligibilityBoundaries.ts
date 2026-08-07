/**
 * SHARED ELIGIBILITY BOUNDARIES (Phase 3 — draft only)
 * ---------------------------------------------------------------------------
 * One place that answers "can we quote this vehicle?" with explicit, testable
 * boundary rules. Nothing here is wired into the live customer journey yet: it
 * is exercised from Admin → Price updates → Pricing engine (draft) so the
 * boundaries can be verified against real registrations before adoption.
 *
 * Rules
 *  - Age is measured from the FIRST REGISTRATION DATE when we have it, falling
 *    back to 1 January of the year of manufacture.
 *  - 15 years exactly is still eligible. 15 years + 1 day is not.
 *  - 150,000 miles exactly is still eligible. 150,001 is not.
 *  - Missing age or mileage is never a silent pass: it returns a polite
 *    referral so an agent can confirm on 0330 229 5040.
 */

import { getExclusionReason, EXCLUSION_MESSAGE } from '@/lib/vehicleExclusions';

export const MAX_VEHICLE_AGE_YEARS = 15;
export const MAX_VEHICLE_MILEAGE = 150000;
export const REFERRAL_PHONE = '0330 229 5040';

export const REFERRAL_MESSAGE =
  `We just need to check a couple of details on this vehicle before we can quote. ` +
  `Please call us on ${REFERRAL_PHONE} and we will confirm cover straight away.`;

export type BoundaryInput = {
  /** ISO date or parseable date string of first registration. */
  registrationDate?: string | null;
  /** Fallback when no registration date is known. */
  yearOfManufacture?: string | number | null;
  mileage?: string | number | null;
  /** Make and model — checked against the excluded vehicle matrix. */
  make?: string | null;
  model?: string | null;
  /** Quote date — defaults to now. Passed in for reproducible tests. */
  asOf?: Date;
};

export type BoundaryOutcome = 'eligible' | 'declined' | 'referral';

export type BoundaryResult = {
  outcome: BoundaryOutcome;
  /** Customer-safe message for declined / referral. */
  message?: string;
  ageYears: number | null;
  ageSource: 'registration_date' | 'year_of_manufacture' | 'unknown';
  mileage: number | null;
  reasons: string[];
  /**
   * True when the excluded vehicle matrix bars this make/model. This is a hard
   * stop that NO override (including admin skipAgeCheck) can unlock.
   */
  excluded: boolean;
  /** e.g. "BMW M-Series" — why the matrix excluded it. */
  exclusionReason?: string;
};

function parseMileage(value: BoundaryInput['mileage']): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** Exact age in years including the fractional part (day-accurate). */
export function exactAgeYears(from: Date, asOf: Date): number {
  const ms = asOf.getTime() - from.getTime();
  if (!Number.isFinite(ms)) return NaN;
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

export function resolveVehicleAge(
  input: BoundaryInput
): { ageYears: number | null; ageSource: BoundaryResult['ageSource'] } {
  const asOf = input.asOf ?? new Date();

  if (input.registrationDate) {
    const reg = new Date(input.registrationDate);
    if (!Number.isNaN(reg.getTime())) {
      return { ageYears: exactAgeYears(reg, asOf), ageSource: 'registration_date' };
    }
  }

  const year = input.yearOfManufacture ? Number(input.yearOfManufacture) : NaN;
  if (Number.isFinite(year) && year >= 1950 && year <= asOf.getUTCFullYear() + 1) {
    const jan1 = new Date(Date.UTC(year, 0, 1));
    return { ageYears: exactAgeYears(jan1, asOf), ageSource: 'year_of_manufacture' };
  }

  return { ageYears: null, ageSource: 'unknown' };
}

export function evaluateBoundaries(input: BoundaryInput): BoundaryResult {
  const { ageYears, ageSource } = resolveVehicleAge(input);
  const mileage = parseMileage(input.mileage);
  const reasons: string[] = [];

  // Excluded vehicle matrix FIRST — an excluded make/model can never be priced,
  // whatever its age or mileage, and no override unlocks it.
  const exclusionReason = getExclusionReason(input.make, input.model);
  if (exclusionReason) {
    return {
      outcome: 'declined',
      message: EXCLUSION_MESSAGE,
      ageYears,
      ageSource,
      mileage,
      reasons: [`Excluded vehicle: ${exclusionReason}`],
      excluded: true,
      exclusionReason,
    };
  }

  // Hard declines next — a clearly over-limit vehicle is never a referral.
  if (ageYears !== null && ageYears > MAX_VEHICLE_AGE_YEARS) {
    reasons.push(`Age ${ageYears.toFixed(2)}y exceeds ${MAX_VEHICLE_AGE_YEARS}y`);
  }
  if (mileage !== null && mileage > MAX_VEHICLE_MILEAGE) {
    reasons.push(`Mileage ${mileage.toLocaleString()} exceeds ${MAX_VEHICLE_MILEAGE.toLocaleString()}`);
  }
  if (reasons.length > 0) {
    return {
      outcome: 'declined',
      message: 'Sorry, we only cover vehicles under 150,000 miles and less than 15 years old',
      ageYears,
      ageSource,
      mileage,
      reasons,
      excluded: false,
    };
  }

  if (ageYears === null) reasons.push('Vehicle age unknown');
  if (mileage === null) reasons.push('Mileage unknown');
  if (reasons.length > 0) {
    return {
      outcome: 'referral',
      message: REFERRAL_MESSAGE,
      ageYears,
      ageSource,
      mileage,
      reasons,
      excluded: false,
    };
  }

  return { outcome: 'eligible', ageYears, ageSource, mileage, reasons: [], excluded: false };
}
