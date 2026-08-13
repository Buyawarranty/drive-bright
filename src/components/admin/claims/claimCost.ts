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

/** Statuses where money has genuinely left the business. */
export const SETTLED_STATUSES = ['approved', 'paid'];

export const isSettledClaim = (c: ClaimMoney): boolean =>
  SETTLED_STATUSES.includes((c.status || '').toLowerCase()) && (c.paid_amount || 0) > 0;

/** What we actually paid out. Zero for anything not settled. */
export const settledCost = (c: ClaimMoney): number =>
  isSettledClaim(c) ? Number(c.paid_amount) || 0 : 0;

/** What was asked for — useful for exposure/severity, never for cost. */
export const claimedCost = (c: ClaimMoney): number =>
  Number(c.claimed_amount ?? c.payment_amount ?? 0) || 0;
