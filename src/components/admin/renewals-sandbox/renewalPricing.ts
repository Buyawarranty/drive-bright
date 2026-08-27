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
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';
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

export const daysToExpiry = (end: string | null | undefined): number | null => {
  if (!end) return null;
  const e = new Date(end); e.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((e.getTime() - t.getTime()) / 86400000);
};

export function getLifecycle(row: SandboxRow): RenewalLifecycle {
  const outcome = (row.retention_outcome || '').toLowerCase();
  if (RENEWED.has(outcome)) return 'renewed';
  if (INELIGIBLE.has(outcome)) return 'ineligible';
  const d = daysToExpiry(row.policy_end_date);
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
 *  Renewals are currently offered as 12-month policies only — even if the
 *  existing policy was 24 or 36 months, the renewal quote is rebuilt as 1 year.
 */
export function toPaymentPeriod(_paymentType: string | null | undefined): PaymentPeriod {
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
