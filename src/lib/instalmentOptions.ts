// Instalment plan options for admin quoting surfaces (Quotes & Orders / Get Quote
// and Confirm External Payment ONLY — the public checkout Step 3/4 is untouched).
//
// Cover duration and instalment plan are separate choices:
//   1-Year Cover  -> 12 instalments
//   2-Year Cover  -> 12 or 24 instalments
//   3-Year Cover  -> 12 or 36 instalments
//
// PRICING RULE (locked Sep 2026) — the 1-YEAR PRICE IS THE BASE for longer plans.
// Spreading payments over 24 or 36 months costs us more, so the plan total is set
// directly off the 1-year price for the SAME excess / claim limit / labour rate:
//   24 instalments (2-year cover) = 2.22 x the 1-year price
//   36 instalments (3-year cover) = 3.51 x the 1-year price
// The 12-instalment prices come straight from the live pricing matrix and are NOT
// touched by this rule, so future Price Updates pushes flow through automatically:
// change the 1-year grid and the longer plans re-price themselves.
//
// Implementation note: callers pass the term total they are displaying plus
// `oneYearRatio` = (undiscounted 1-year total) / (undiscounted term total). That way
// any discount applied to the term price is carried into the longer plan
// proportionally, while the anchor stays the 1-year price. With no ratio supplied we
// fall back to the historic assumption (2-year = 1.65x, 3-year = 2.35x of 1 year).
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

/** Config key holding the manager-editable longer-plan multiples. */
export const LONG_PLAN_MULTIPLES_CONFIG_KEY = 'long_instalment_plan_multiples';

/** Code defaults, used until a saved value is loaded. */
export const LONG_PLAN_MULTIPLE_DEFAULTS: Record<InstalmentCount, number> = {
  12: 1,
  24: 2.22,
  36: 3.51,
};

/**
 * THE RULE: longer-plan total as a multiple of the 1-year price.
 * Editable by management on Price updates → Excluded vehicles & tools → Longer plans.
 */
export const LONG_PLAN_MULTIPLE_OF_ONE_YEAR: Record<InstalmentCount, number> = {
  ...LONG_PLAN_MULTIPLE_DEFAULTS,
};

/** Sensible guard rails so a typo cannot produce an absurd plan price. */
export const LONG_PLAN_MULTIPLE_LIMITS: Record<24 | 36, { min: number; max: number }> = {
  24: { min: 1.5, max: 4 },
  36: { min: 2, max: 6 },
};

export function clampLongPlanMultiple(count: 24 | 36, value: number): number {
  const { min, max } = LONG_PLAN_MULTIPLE_LIMITS[count];
  const n = Number(value);
  if (!Number.isFinite(n)) return LONG_PLAN_MULTIPLE_DEFAULTS[count];
  return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
}

/** Applies saved multiples app-wide (called on app start and after a save). */
export function setLongPlanMultiples(next: { 24?: number; 36?: number } | null | undefined): void {
  LONG_PLAN_MULTIPLE_OF_ONE_YEAR[24] =
    next?.[24] != null ? clampLongPlanMultiple(24, next[24]) : LONG_PLAN_MULTIPLE_DEFAULTS[24];
  LONG_PLAN_MULTIPLE_OF_ONE_YEAR[36] =
    next?.[36] != null ? clampLongPlanMultiple(36, next[36]) : LONG_PLAN_MULTIPLE_DEFAULTS[36];
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('long-plan-multiples-changed'));
  }
}

/** Reads whatever value is currently in force. */
export function getLongPlanMultiples(): { 24: number; 36: number } {
  return { 24: LONG_PLAN_MULTIPLE_OF_ONE_YEAR[24], 36: LONG_PLAN_MULTIPLE_OF_ONE_YEAR[36] };
}

/** Fallback term ladder used only when the 1-year price is unavailable. */
const ASSUMED_TERM_MULTIPLE_OF_ONE_YEAR: Record<InstalmentCount, number> = {
  12: 1,
  24: 1.65,
  36: 2.35,
};

/** Uplift on the 12-instalment total, kept for display fallbacks. */
export const INSTALMENT_TOTAL_UPLIFT: Record<InstalmentCount, number> = {
  12: 1,
  24: 1.345,
  36: 1.494,
};

/**
 * `oneYearRatio` for a term: undiscounted 1-year total ÷ undiscounted term total.
 * Returns undefined when either figure is missing, so the caller falls back safely.
 */
export function oneYearRatio(oneYearTotal?: number | null, termTotal?: number | null): number | undefined {
  const oneYear = Number(oneYearTotal) || 0;
  const term = Number(termTotal) || 0;
  if (oneYear <= 0 || term <= 0) return undefined;
  return oneYear / term;
}

/** Factor applied to the displayed term total to reach the longer-plan total. */
export function longPlanFactor(count: InstalmentCount, ratio?: number): number {
  if (count === 12) return 1;
  const multiple = LONG_PLAN_MULTIPLE_OF_ONE_YEAR[count] ?? 1;
  const effectiveRatio =
    ratio && Number.isFinite(ratio) && ratio > 0
      ? ratio
      : 1 / (ASSUMED_TERM_MULTIPLE_OF_ONE_YEAR[count] ?? 1);
  return multiple * effectiveRatio;
}

/**
 * Total payable on the chosen instalment plan. Whole pounds only — no pence.
 * For 24/36 the figure is anchored to the 1-year price (see rule above).
 */
export function instalmentPlanTotal(totalPrice: number, count: InstalmentCount, ratio?: number): number {
  const total = Number(totalPrice) || 0;
  if (total <= 0) return 0;
  return Math.round(total * longPlanFactor(count, ratio));
}

/** Monthly amount for the chosen plan (whole pounds, rounded up). */
export function instalmentAmount(totalPrice: number, count: InstalmentCount, ratio?: number): number {
  const total = instalmentPlanTotal(totalPrice, count, ratio);
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
