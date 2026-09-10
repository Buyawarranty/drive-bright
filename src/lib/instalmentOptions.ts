// Instalment plan options for admin quoting surfaces (Quotes & Orders / Get Quote
// and Confirm External Payment ONLY — the public checkout Step 3/4 is untouched).
//
// Cover duration and instalment plan are separate choices:
//   1-Year Cover  -> 12 instalments
//   2-Year Cover  -> 12 or 24 instalments
//   3-Year Cover  -> 12 or 36 instalments
//
// PRICING (Sep 2026): spreading the payments over 24 or 36 months costs MORE
// than the 12-instalment plan. The agreed ladder, expressed against the 1-year
// price, is:
//   1 year  · 12 instalments = 1.00x
//   2 years · 12 instalments = 1.65x   ->  24 instalments = 2.22x
//   3 years · 12 instalments = 2.35x   ->  36 instalments = 3.51x
// So a longer plan is the term's 12-instalment total multiplied by:
//   24 instalments = 2.22 / 1.65 = 1.345
//   36 instalments = 3.51 / 2.35 = 1.494
// Longer plans can only ever be taken on Bumper (the 24/36-month Bumper plan).

export type InstalmentCount = 12 | 24 | 36;

export function getInstalmentOptions(paymentType: string): InstalmentCount[] {
  if (paymentType === '24months') return [12, 24];
  if (paymentType === '36months') return [12, 36];
  return [12];
}

export function isInstalmentAllowed(paymentType: string, count: number): boolean {
  return getInstalmentOptions(paymentType).includes(count as InstalmentCount);
}

/** Uplift applied to the 12-instalment total when the payments are spread longer. */
export const INSTALMENT_TOTAL_UPLIFT: Record<InstalmentCount, number> = {
  12: 1,
  24: 1.345,
  36: 1.494,
};

/**
 * Total payable on the chosen instalment plan. Whole pounds only — no pence.
 */
export function instalmentPlanTotal(totalPrice: number, count: InstalmentCount): number {
  const total = Number(totalPrice) || 0;
  if (total <= 0) return 0;
  const uplift = INSTALMENT_TOTAL_UPLIFT[count] ?? 1;
  return Math.round(total * uplift);
}

/** Monthly amount for the chosen plan (whole pounds, rounded up). */
export function instalmentAmount(totalPrice: number, count: InstalmentCount): number {
  const total = instalmentPlanTotal(totalPrice, count);
  if (total <= 0) return 0;
  return Math.ceil(total / count);
}

export function instalmentLabel(count: InstalmentCount): string {
  return `${count} instalments`;
}

/** Instalment plans that are visible but not selectable yet. */
export function isInstalmentComingSoon(_count: InstalmentCount): boolean {
  return false;
}

/** Wording shown wherever a 24 or 36 instalment plan is quoted. */
export const BUMPER_LONG_PLAN_NOTE =
  'Payment must be taken on Bumper on the matching longer plan (24 or 36 months) — it cannot be taken on the 12-month plan or by card.';
