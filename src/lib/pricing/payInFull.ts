/**
 * Single source of truth for the "Pay in full" price shown anywhere in the
 * customer journey (step 3 mobile + desktop, step 4 checkout, sticky bars).
 *
 * Rule: pay in full = the 12-payment total, minus the 10% pay-in-full discount.
 * The multi-year "you save £X" figure is MARKETING COPY ONLY and must never be
 * subtracted from a payable amount — doing that produced impossible totals
 * (e.g. £84/mo on a 2-year quote showing £360 to pay in full).
 */
export const PAY_IN_FULL_DISCOUNT_PCT = 10;

export const PAYMENTS_COUNT = 12;

/** Total of the 12 monthly payments. */
export function twelvePaymentTotal(monthlyPrice: number): number {
  return Math.max(0, Math.round(monthlyPrice)) * PAYMENTS_COUNT;
}

/** The 10% saving a customer gets by paying in full. */
export function payInFullSaving(monthlyPrice: number): number {
  return Math.floor((twelvePaymentTotal(monthlyPrice) * PAY_IN_FULL_DISCOUNT_PCT) / 100);
}

/** The one-off amount payable today. */
export function payInFullTotal(monthlyPrice: number): number {
  return twelvePaymentTotal(monthlyPrice) - payInFullSaving(monthlyPrice);
}
