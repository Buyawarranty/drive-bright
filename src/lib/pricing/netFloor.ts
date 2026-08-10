/**
 * NET payable floor — the lowest amount a warranty may actually be SOLD for.
 *
 * Difference vs the grid/quote floor in `pricingMatrix.ts`:
 *   - the grid floor caps the *quoted* price (before any discount)
 *   - this net floor caps the *final payable* amount (after agent discounts,
 *     manual price overrides and manual/external payment confirmation)
 *
 * Agreed values (10/08/2026): £399 / £659 / £938 for 12 / 24 / 36 months,
 * halved for motorbikes, and shaped up when the customer picks a richer
 * claim limit / labour rate / lower excess than the reference combo.
 *
 * Exemptions:
 *   - Management (admin / super_admin / sales_manager) may go below, logged
 *     to `price_override_audit`.
 *   - Evidenced price matches (competitor quote uploaded) may go below.
 *   - Website promo codes (SAVE25, cart recovery, pay-in-full 10%) are allowed
 *     to breach it — marketing keeps full effect on the public journey.
 */
import { getAbsoluteMinimumTotal, type PaymentPeriod, type PricingSurface } from '@/lib/pricingMatrix';

/** Flat net floor by term, before option shaping and motorbike halving. */
export const NET_FLOOR_BY_PERIOD: Record<PaymentPeriod, number> = {
  '12months': 399,
  '24months': 659,
  '36months': 938,
};

export interface NetFloorParams {
  paymentPeriod: PaymentPeriod;
  voluntaryExcess?: number;
  claimLimit?: number;
  labourRate?: number;
  isMotorbike?: boolean;
  /** 'admin' = Quotes & Orders grid, 'customer' = website Steps 3/4. */
  surface?: PricingSurface;
}

/**
 * The lowest final payable total for this combination, on this surface.
 * Shares the shaped-floor maths with the quote engine so the net floor can
 * never sit above or below the quoted floor by accident.
 */
export function getNetPayableFloor(params: NetFloorParams): number {
  return getAbsoluteMinimumTotal({
    paymentPeriod: params.paymentPeriod,
    voluntaryExcess: params.voluntaryExcess,
    claimLimit: params.claimLimit,
    labourRate: params.labourRate,
    isMotorbike: params.isMotorbike,
    surface: params.surface ?? 'admin',
  });
}

/** True when `amount` is a real number that falls under the net floor. */
export function isUnderNetFloor(amount: unknown, params: NetFloorParams): boolean {
  const v = typeof amount === 'number'
    ? amount
    : parseFloat(String(amount ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(v) || v <= 0) return false;
  return v < getNetPayableFloor(params) - 0.01;
}
