/**
 * WEB PRICE GAP (draft only — nothing live imports this yet)
 * ---------------------------------------------------------------------------
 * The admin Quotes & Orders grid is the source of truth. The website (Step 3/4)
 * price is that grid price minus a configurable gap (10% today), which exists to
 * give agents negotiating headroom and to reward self-serve completion.
 *
 * Two rules this module enforces that the current inline `getWebReferencePrice`
 * does not:
 *  1. The gap is read from the published pricing version (`web_discount_pct`),
 *     clamped to 0–10%, so it can be tuned without a code change.
 *  2. The minimum price floor binds on the WEB price, not just the grid price.
 *     A 10% gap must never take a quote below £399 / £659 / £938 (halved for
 *     motorbikes), and promo codes stack on top of an already-floored number.
 */

import {
  MOTORBIKE_PRICE_MULTIPLIER,
  type PaymentPeriod,
} from '@/lib/pricingMatrix';
import {
  MAX_WEB_DISCOUNT_PCT,
  resolvePriceFloors,
  resolveWebDiscountPct,
  type PricingVersionConfig,
  type TermKey,
} from '@/lib/pricing/pricingVersionConfig';

export type WebPriceInput = {
  /** Admin Quotes & Orders total for this vehicle and cover options. */
  gridTotal: number;
  paymentPeriod: PaymentPeriod;
  /** Published pricing version config; falls back to the code defaults. */
  config?: PricingVersionConfig | null;
  isMotorbike?: boolean;
  /** Extras that sit outside the floor comparison (add-ons, boost, labour). */
  extras?: number;
  /** Promo / voucher amount applied after the web gap, in pounds. */
  promoDiscount?: number;
};

export type WebPriceResult = {
  /** Gap actually used, in percent (0–10). */
  gapPct: number;
  /** Price after the gap, before the floor and promo. */
  rawWebPrice: number;
  /** Floor that applies to this term and vehicle. */
  floor: number;
  /** Final web price the customer sees. */
  webPrice: number;
  /** Saving versus the grid price. */
  saving: number;
  /** True when the floor (not the gap) decided the price. */
  floorBinding: boolean;
  /** True when the promo was trimmed because it would breach the floor. */
  promoTrimmed: boolean;
  promoApplied: number;
};

export function resolveWebPrice(input: WebPriceInput): WebPriceResult {
  const {
    gridTotal,
    paymentPeriod,
    config,
    isMotorbike = false,
    extras = 0,
    promoDiscount = 0,
  } = input;

  const gapPct = Math.min(resolveWebDiscountPct(config), MAX_WEB_DISCOUNT_PCT);
  const floors = resolvePriceFloors(config);
  const baseFloor = floors[paymentPeriod as TermKey] ?? 0;
  const floor =
    (isMotorbike ? Math.ceil(baseFloor * MOTORBIKE_PRICE_MULTIPLIER) : baseFloor) + Math.max(0, extras);

  const rawWebPrice = Math.ceil(gridTotal * (1 - gapPct / 100));
  const afterFloor = Math.max(rawWebPrice, floor);
  const floorBinding = afterFloor > rawWebPrice;

  // Promo codes stack on the already-floored web price and are trimmed so they
  // can never take the quote below the floor.
  const requestedPromo = Math.max(0, Math.round(promoDiscount));
  const allowedPromo = Math.max(0, Math.min(requestedPromo, afterFloor - floor));
  const webPrice = Math.ceil(afterFloor - allowedPromo);

  return {
    gapPct,
    rawWebPrice,
    floor,
    webPrice,
    saving: Math.max(0, gridTotal - webPrice),
    floorBinding,
    promoTrimmed: allowedPromo < requestedPromo,
    promoApplied: allowedPromo,
  };
}
