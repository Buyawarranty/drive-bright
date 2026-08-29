/**
 * Claim money helpers.
 *
 * The claims table carries three money columns and they mean very different things:
 *  - `claimed_amount`  — what the garage quoted / the customer asked for
 *  - `payment_amount`  — legacy column that mirrors the CLAIMED figure, and is filled in
 *                        on declined, appealed and complaint rows too. It is NOT a payout.
 *  - `paid_amount`     — what we actually settled, only ever present on approved/paid claims
 *
 * Cost analytics must use `paid_amount` on settled claims only. Using `payment_amount`
 * pulls in £26k garage quotes on appealed/declined claims and produces impossible
 * "average cost" figures.
 */

export interface ClaimMoney {
  status?: string;
  payment_amount?: number | null;
  claimed_amount?: number | null;
  paid_amount?: number | null;
}

/**
 * Statuses where money has genuinely left the business.
 * Includes partial approvals/payments and refunds — those are real payouts and
 * must show up in claim cost totals as soon as the status/amount is saved.
 */
export const SETTLED_STATUSES = [
  'approved',
  'claim_approved',
  'paid',
  'settled',
  'partially_approved',
  'partial_approved',
  'partial_approval',
  'partial',
  'partial_payment',
  'partially_paid',
  'refund',
  'refunded',
  'partial_refund',
  'partially_refunded',
];

/** Statuses that count as an approval (full or partial) for approval-rate metrics. */
export const APPROVED_STATUSES = [
  'approved',
  'claim_approved',
  'paid',
  'settled',
  'partially_approved',
  'partial_approved',
  'partial_approval',
  'partial',
  'partial_payment',
  'partially_paid',
];

const norm = (s?: string) => (s || '').toLowerCase().trim();

export const isSettledClaim = (c: ClaimMoney): boolean =>
  SETTLED_STATUSES.includes(norm(c.status)) && (c.paid_amount || 0) > 0;

export const isApprovedClaim = (c: ClaimMoney): boolean =>
  APPROVED_STATUSES.includes(norm(c.status));

/** What we actually paid out. Zero for anything not settled. */
export const settledCost = (c: ClaimMoney): number =>
  isSettledClaim(c) ? Number(c.paid_amount) || 0 : 0;

/** What was asked for — useful for exposure/severity, never for cost. */
export const claimedCost = (c: ClaimMoney): number =>
  Number(c.claimed_amount ?? c.payment_amount ?? 0) || 0;

