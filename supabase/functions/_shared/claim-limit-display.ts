/**
 * Retired claim-limit wire values → the cover level the customer actually bought.
 * We never rewrite stored values (that would re-value historic policies); we only
 * stop showing retired numbers to customers and staff:
 *   750  → £1,000 (retired Basic wire value)
 *   1250 → £2,000 (retired Essential wire value)
 */
const LEGACY_CLAIM_LIMIT_DISPLAY: Record<number, number> = {
  750: 1000,
  1250: 2000,
};

/** Numeric display value for a stored claim limit. */
export function displayClaimLimitValue(claimLimit: number | string | null | undefined): number {
  const raw = Number(claimLimit);
  if (!raw || Number.isNaN(raw)) return 0;
  return LEGACY_CLAIM_LIMIT_DISPLAY[raw] ?? raw;
}

/** Formatted "£1,000" string for a stored claim limit. */
export function formatClaimLimit(claimLimit: number | string | null | undefined): string {
  return `£${displayClaimLimitValue(claimLimit).toLocaleString('en-GB')}`;
}
