// Manager-only test promo codes (e.g. 99% off) used for QA of the checkout flow.
// The client lowers its display floor for these codes; the server still gates the
// real bypass to a manager JWT in supabase/functions/_shared/price-floor.ts.

const TEST_BYPASS_CODES = new Set(['SAVE99GOLDEN']);

/** £1 floor for manager test codes (Stripe minimum is £0.30). */
export const TEST_MINIMUM_PRICE = 1;

/** Standard hard floor mirroring ABSOLUTE_MIN_GBP on the server. */
export const STANDARD_MINIMUM_PRICE = 120;

export function isTestBypassCode(code?: string | null): boolean {
  if (!code) return false;
  const c = code.trim().toUpperCase();
  if (!c) return false;
  return c.startsWith('TEST') || TEST_BYPASS_CODES.has(c);
}

/** Returns the price floor to apply given the currently applied promo codes. */
export function minimumPriceForCodes(codes: Array<{ code: string }> = []): number {
  return codes.some((c) => isTestBypassCode(c?.code)) ? TEST_MINIMUM_PRICE : STANDARD_MINIMUM_PRICE;
}
