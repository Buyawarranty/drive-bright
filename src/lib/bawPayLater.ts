// BAW PayLater — yearly collection for 2-year and 3-year cover.
//
// WHY IT EXISTS: customers who want smaller payments over 24 or 36 months can only
// do that on the Bumper long plan, which costs 29–43% more than the term price.
// BAW PayLater is the in-house alternative: the customer takes 2 or 3 year cover but
// pays ONE YEAR AT A TIME, on the anniversary of the policy.
//
// PRICING RULE (locked Sep 2026): the yearly amount is the term's per-year price
// plus a 10% uplift for collecting yearly. It is NOT the 24/36-instalment plan
// price. Change the grid and this re-prices itself automatically.
//
// SCOREBOARD RULE: because only the first year's money is collected, the agent is
// credited with the ONE-YEAR equivalent (the first yearly payment), never the full
// 2/3-year total. That happens naturally because the confirmed sale amount stored on
// the customer record is the first yearly payment.

/** Uplift applied to the per-year price for collecting yearly. */
export const BAW_PAYLATER_UPLIFT = 1.10;

export const BAW_PAYLATER_LABEL = 'BAW PayLater';

export const BAW_PAYLATER_NOTE =
  'BAW PayLater collects one year at a time on the policy anniversary. Only the first year is taken now — the remaining years sit in Payments pending for accounts to collect.';

/** Cover terms that can be sold on BAW PayLater. */
export function isPayLaterEligible(paymentType: string): boolean {
  return paymentType === '24months' || paymentType === '36months';
}

export function payLaterYears(paymentType: string): number {
  if (paymentType === '36months') return 3;
  if (paymentType === '24months') return 2;
  return 1;
}

/**
 * The amount collected each year: term total ÷ years, plus the 10% uplift.
 * Whole pounds only — no pence.
 */
export function payLaterYearlyAmount(termTotal: number, years: number): number {
  const total = Number(termTotal) || 0;
  const y = Math.max(1, Math.round(Number(years) || 1));
  if (total <= 0) return 0;
  return Math.round((total / y) * BAW_PAYLATER_UPLIFT);
}

/** Everything the customer will pay across the whole term on BAW PayLater. */
export function payLaterTermTotal(termTotal: number, years: number): number {
  return payLaterYearlyAmount(termTotal, years) * Math.max(1, Math.round(Number(years) || 1));
}

/** Extra cost versus paying the term price up front (or over 12 instalments). */
export function payLaterExtraVsTerm(termTotal: number, years: number): number {
  return Math.max(0, payLaterTermTotal(termTotal, years) - Math.round(Number(termTotal) || 0));
}

export interface PayLaterInstalmentRow {
  yearNumber: number;
  amount: number;
  dueDate: Date;
}

/**
 * The full yearly collection plan. Year 1 is due on the cover start date (taken at
 * the point of sale); later years fall on each anniversary.
 */
export function buildPayLaterSchedule(
  termTotal: number,
  years: number,
  startDate: Date,
): PayLaterInstalmentRow[] {
  const y = Math.max(1, Math.round(Number(years) || 1));
  const amount = payLaterYearlyAmount(termTotal, y);
  const rows: PayLaterInstalmentRow[] = [];
  for (let i = 0; i < y; i += 1) {
    const due = new Date(startDate.getTime());
    due.setFullYear(due.getFullYear() + i);
    rows.push({ yearNumber: i + 1, amount, dueDate: due });
  }
  return rows;
}
