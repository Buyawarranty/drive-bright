/**
 * NET payable floor — the lowest amount a warranty may actually be SOLD for.
 *
 * Difference vs the grid/quote floor in `pricingMatrix.ts`:
 *   - the grid floor caps the *quoted* price (before any discount)
 *   - this net floor caps the *final payable* amount (after agent discounts,
 *     manual price overrides and manual/external payment confirmation)
 *
 * Agreed values (11/08/2026): £349 / £576 / £821 for 12 / 24 / 36 months at the
 * cheapest combo (£1,000 claim / £50 labour / £500 excess),
 * halved for motorbikes, and shaped up when the customer picks a richer
 * claim limit / labour rate / lower excess than that cheapest combo.
 *
 * Exemptions:
 *   - Management (admin / super_admin / sales_manager) may go below, logged
 *     to `price_override_audit`.
 *   - Evidenced price matches (competitor quote uploaded) may go below.
 *   - Website promo codes (SAVE25, cart recovery, pay-in-full 10%) are allowed
 *     to breach it — marketing keeps full effect on the public journey.
 */
import { getAbsoluteMinimumTotal, type PaymentPeriod, type PricingSurface } from '@/lib/pricingMatrix';

/**
 * GLOBAL absolute minimum (12/08/2026): no warranty plan, on any pricing model
 * or surface, may ever be sold for less than £399 in total. Halves for
 * motorbikes (£199.50) exactly like every other floor. The rest of each model's
 * pricing is untouched — this only lifts anything that lands beneath it.
 */
export const GLOBAL_ABSOLUTE_MIN_TOTAL = 399;

/** Flat net floor by term, before option shaping and motorbike halving. */
export const NET_FLOOR_BY_PERIOD: Record<PaymentPeriod, number> = {
  '12months': 349,
  '24months': 576,
  '36months': 821,
};


export interface NetFloorParams {
  paymentPeriod: PaymentPeriod;
  voluntaryExcess?: number;
  claimLimit?: number;
  labourRate?: number;
  isMotorbike?: boolean;
  /** 'admin' = Quotes & Orders grid, 'customer' = website Steps 3/4. */
  surface?: PricingSurface;
  /**
   * Per-model absolute minimum total (Aug hybrid = £399 on ANY warranty).
   * Applied as a hard bottom on top of the shaped floor; halves for motorbikes.
   */
  absoluteMinTotal?: number;
}

/**
 * The lowest final payable total for this combination, on this surface.
 * Shares the shaped-floor maths with the quote engine so the net floor can
 * never sit above or below the quoted floor by accident.
 */
export function getNetPayableFloor(params: NetFloorParams): number {
  const shaped = getAbsoluteMinimumTotal({
    paymentPeriod: params.paymentPeriod,
    voluntaryExcess: params.voluntaryExcess,
    claimLimit: params.claimLimit,
    labourRate: params.labourRate,
    isMotorbike: params.isMotorbike,
    surface: params.surface ?? 'admin',
  });
  const modelMin =
    Math.max(Number(params.absoluteMinTotal) || 0, GLOBAL_ABSOLUTE_MIN_TOTAL) *
    (params.isMotorbike ? 0.5 : 1);
  return Math.max(shaped, modelMin);
}


/** True when `amount` is a real number that falls under the net floor. */
export function isUnderNetFloor(amount: unknown, params: NetFloorParams): boolean {
  const v = typeof amount === 'number'
    ? amount
    : parseFloat(String(amount ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(v) || v <= 0) return false;
  return v < getNetPayableFloor(params) - 0.01;
}

/**
 * PERMANENT floor clamp for every pricing model shown on Price Updates.
 * Whatever the model (July 2026 code base, Aug 26 grid, Aug hybrid, live
 * published version, drafts) and whatever discount is layered on top, no price
 * may ever display or publish below the minimum sellable price for that term.
 * Whole pounds — Price Updates never shows pence.
 */
export function clampToNetFloor(amount: number, params: NetFloorParams): number {
  const floor = getNetPayableFloor(params);
  if (!Number.isFinite(amount) || amount <= 0) return Math.round(floor);
  return Math.round(Math.max(amount, floor));
}

/**
 * Same clamp for a customer/website price: the floor is the admin floor minus
 * the published Step 3 discount, so the web journey stays consistent with the
 * grid instead of being clamped to the (higher) admin number.
 */
export function clampWebToNetFloor(amount: number, params: NetFloorParams): number {
  return clampToNetFloor(amount, { ...params, surface: 'customer' });
}

