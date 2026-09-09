// Instalment plan options for admin quoting surfaces (Quotes & Orders / Get Quote
// and Confirm External Payment ONLY — the public checkout Step 3/4 is untouched).
//
// Cover duration and instalment plan are separate choices:
//   1-Year Cover  -> 12 instalments
//   2-Year Cover  -> 12 or 24 instalments
//   3-Year Cover  -> 12 or 36 instalments
//
// Pricing logic (Sep 2026): the TOTAL price is the 1-year annual price multiplied
// by a fixed factor per term + instalment plan:
//   1-year cover, 12 instalments: 1.00× annual price
//   2-year cover, 12 instalments: 1.85× annual price
//   2-year cover, 24 instalments: 2.22× annual price
//   3-year cover, 12 instalments: 2.70× annual price
//   3-year cover, 36 instalments: 3.51× annual price

export type InstalmentCount = 12 | 24 | 36;

export function getInstalmentOptions(paymentType: string): InstalmentCount[] {
  if (paymentType === '24months') return [12, 24];
  if (paymentType === '36months') return [12, 36];
  return [12];
}

export function isInstalmentAllowed(paymentType: string, count: number): boolean {
  return getInstalmentOptions(paymentType).includes(count as InstalmentCount);
}

/** Total-price multiplier vs the 1-year annual price, per term + instalment plan. */
export function instalmentMultiplier(paymentType: string, count: InstalmentCount): number {
  if (paymentType === '24months') return count === 24 ? 2.22 : 1.85;
  if (paymentType === '36months') return count === 36 ? 3.51 : 2.70;
  return 1.0;
}

/**
 * Total price for a term + instalment plan, from the 1-year annual price.
 * Rounded up to a whole pound (no decimals anywhere in quoting).
 */
export function instalmentPlanTotal(annualPrice: number, paymentType: string, count: InstalmentCount): number {
  const annual = Number(annualPrice) || 0;
  if (annual <= 0) return 0;
  return Math.ceil(annual * instalmentMultiplier(paymentType, count));
}

/** Monthly amount for a total split over N instalments (rounded up to the penny-free pound). */
export function instalmentAmount(totalPrice: number, count: InstalmentCount): number {
  const total = Number(totalPrice) || 0;
  if (total <= 0) return 0;
  return Math.ceil(total / count);
}

export function instalmentLabel(count: InstalmentCount): string {
  return `${count} instalments`;
}

/**
 * Instalment plans that are visible but not selectable yet.
 * 24 (2-year cover) and 36 (3-year cover) are LIVE on the admin quoting surfaces.
 */
export function isInstalmentComingSoon(_count: InstalmentCount): boolean {
  return false;
}

/**
 * Long instalment plans (24/36) should nudge agents toward Subscription Pay,
 * which is usually the better option for the customer.
 */
export function isLongInstalmentPlan(count: InstalmentCount): boolean {
  return count === 24 || count === 36;
}

export const SUBSCRIPTION_PAY_HINT =
  'Better option: Subscription Pay — flexible monthly payments, usually cheaper for the customer than spreading over more instalments.';
