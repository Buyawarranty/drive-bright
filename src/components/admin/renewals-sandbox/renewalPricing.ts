/**
 * RENEWALS SANDBOX — pricing + negotiation range (Stage 3, Steps 7–9)
 * ---------------------------------------------------------------------------
 * Read-only wrapper around the single quote pricing service so a renewal quote
 * is priced by exactly the same engine as the customer journey and Quotes &
 * Orders. Nothing here writes to the database or touches live pricing config.
 */

import { calculateQuotePrice, type QuotePriceResult } from '@/lib/pricing/quotePricingService';
import { getNetPayableFloor } from '@/lib/pricing/netFloor';
import { DEFAULT_CLAIM_LIMIT, DEFAULT_EXCESS, DEFAULT_LABOUR_RATE, type PaymentPeriod } from '@/lib/pricingMatrix';
import type { SandboxRow } from './types';

export type RenewalLifecycle =
  | 'not_due'
  | 'due_soon'
  | 'hot'
  | 'lapsed'
  | 'renewed'
  | 'ineligible';

const RENEWED = new Set(['renewed', 'upgraded', 'renewed_upgraded']);
const INELIGIBLE = new Set(['do_not_contact', 'vehicle_sold', 'bought_elsewhere']);

/** Original term of the policy in months, from the stored plan/payment type. */
export function getOriginalTermMonths(row: SandboxRow): number {
  const raw = `${row.payment_type || ''} ${row.plan_type || ''}`.toLowerCase();
  if (/36|three\s*year|3\s*year|threeyear/.test(raw)) return 36;
  if (/24|two\s*year|2\s*year|twoyear/.test(raw)) return 24;
  if (/12|one\s*year|1\s*year|yearly|annual/.test(raw)) return 12;
  // Fall back to the stored dates when the plan type is unclear.
  const start = row.policy_start_date ? new Date(row.policy_start_date) : null;
  const end = row.policy_end_date ? new Date(row.policy_end_date) : null;
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12
      + (end.getUTCMonth() - start.getUTCMonth());
    if (months >= 30) return 36;
    if (months >= 18) return 24;
  }
  return 12;
}

/**
 * True expiry date. Some legacy rows have a policy_end_date that was written as
 * start + 12 months even though the customer bought 2 or 3 years, which made
 * multi-year policies look like they were expiring now. We rebuild the end date
 * from the start date plus the original term so a 2-year policy sold this year
 * is only due next year.
 */
export function getEffectiveEndDate(row: SandboxRow): string | null {
  const term = getOriginalTermMonths(row);
  const start = row.policy_start_date ? new Date(row.policy_start_date) : null;
  if (!start || Number.isNaN(start.getTime())) return row.policy_end_date ?? null;
  const derived = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + term, start.getUTCDate()));
  const stored = row.policy_end_date ? new Date(row.policy_end_date) : null;
  if (!stored || Number.isNaN(stored.getTime())) return derived.toISOString().slice(0, 10);
  // Keep whichever is later — bonus months already added to the stored date stay.
  return (stored.getTime() >= derived.getTime() ? stored : derived).toISOString().slice(0, 10);
}

export const daysToExpiry = (end: string | null | undefined): number | null => {
  if (!end) return null;
  const e = new Date(end); e.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((e.getTime() - t.getTime()) / 86400000);
};

/** Days until the policy genuinely expires, term-corrected. */
export const daysToEffectiveExpiry = (row: SandboxRow): number | null =>
  daysToExpiry(getEffectiveEndDate(row));

export function getLifecycle(row: SandboxRow): RenewalLifecycle {
  const outcome = (row.retention_outcome || '').toLowerCase();
  if (RENEWED.has(outcome)) return 'renewed';
  if (INELIGIBLE.has(outcome)) return 'ineligible';
  const d = daysToEffectiveExpiry(row);
  if (d === null) return 'not_due';
  if (d < 0) return 'lapsed';
  if (d <= 7) return 'hot';
  if (d <= 60) return 'due_soon';
  return 'not_due';
}

export const LIFECYCLE_LABEL: Record<RenewalLifecycle, string> = {
  not_due: 'Not due yet',
  due_soon: 'Due soon',
  hot: 'Hot — call today',
  lapsed: 'Lapsed',
  renewed: 'Renewed',
  ineligible: 'Not eligible',
};

/** Maps a stored payment/plan type onto a pricing period the engine understands.
 *  A renewal is quoted like-for-like on the original term.
 */
export function toPaymentPeriod(paymentType: string | null | undefined): PaymentPeriod {
  const raw = (paymentType || '').toLowerCase();
  if (/36|three\s*year|3\s*year/.test(raw)) return '36months';
  if (/24|two\s*year|2\s*year/.test(raw)) return '24months';
  return '12months';
}


export interface RenewalQuote {
  paymentPeriod: PaymentPeriod;
  claimLimit: number;
  voluntaryExcess: number;
  labourRate: number;
  /** Straight like-for-like renewal price from the live engine. */
  standardPrice: number;
  /** Loyalty price we lead with (5% off, never below the floor). */
  loyaltyPrice: number;
  /** Lowest price an agent may agree without manager approval (10% off). */
  agentFloorPrice: number;
  /** Absolute lowest sellable price for this combination. */
  netFloor: number;
  /** What the customer paid last time, when we have it. */
  previousPrice: number | null;
  /** Difference between the loyalty price and what they paid last year. */
  deltaVsPrevious: number | null;
  blocked: boolean;
  blockReason: string | null;
  breakdown: QuotePriceResult;
}

const clamp = (value: number, floor: number) => Math.max(Math.round(value), Math.round(floor));

export function priceRenewal(row: SandboxRow): RenewalQuote {
  const c = row.customers || null;
  const paymentPeriod = toPaymentPeriod(row.payment_type || row.plan_type);
  const claimLimit = Number(row.claim_limit) || DEFAULT_CLAIM_LIMIT;
  const voluntaryExcess = Number(row.voluntary_excess ?? DEFAULT_EXCESS) || 0;
  const labourRate = DEFAULT_LABOUR_RATE;

  const breakdown = calculateQuotePrice({
    vehicle: {
      make: c?.vehicle_make ?? null,
      model: c?.vehicle_model ?? null,
      fuelType: c?.vehicle_fuel_type ?? null,
      transmission: c?.vehicle_transmission ?? null,
      yearOfManufacture: c?.vehicle_year ?? null,
      mileage: c?.mileage ?? null,
      regNumber: c?.registration_plate ?? null,
    },
    paymentPeriod,
    voluntaryExcess,
    claimLimit,
    labourRate,
    surface: 'admin',
  });

  const isMotorbike = breakdown.vehicleFactor > 0 && (c?.vehicle_make || '').toLowerCase().includes('motorbike');
  const netFloor = getNetPayableFloor({
    paymentPeriod,
    voluntaryExcess,
    claimLimit,
    labourRate,
    isMotorbike,
    surface: 'admin',
  });

  const standardPrice = clamp(breakdown.total, netFloor);
  const loyaltyPrice = clamp(standardPrice * 0.95, netFloor);
  const agentFloorPrice = clamp(standardPrice * 0.9, netFloor);

  const previousRaw = Number(row.payment_amount);
  const previousPrice = Number.isFinite(previousRaw) && previousRaw > 0 ? Math.round(previousRaw) : null;

  return {
    paymentPeriod,
    claimLimit,
    voluntaryExcess,
    labourRate,
    standardPrice,
    loyaltyPrice,
    agentFloorPrice,
    netFloor: Math.round(netFloor),
    previousPrice,
    deltaVsPrevious: previousPrice === null ? null : loyaltyPrice - previousPrice,
    blocked: breakdown.blocked,
    blockReason: breakdown.blocked
      ? breakdown.eligibility.reasons?.[0] || 'Vehicle is outside our cover limits'
      : null,
    breakdown,
  };
}
