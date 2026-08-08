/**
 * Customer-facing claim limit tiers for the code-base pricing sandboxes.
 *
 * The July 2026 matrix stores three internal columns (750 / 1250 / 2000). Agents
 * and customers only ever see the four published tiers:
 *   £1,000 (Basic)  → internal column 750
 *   £2,000 (Essential, the reference / ×1.00 column) → internal column 1250
 *   £3,000 (Elite)  → internal column 2000
 *   £5,000 (Premium) → internal column 2000 + the £5/mo boost
 *
 * Keeping this mapping in one place stops the sandboxes from mixing the internal
 * column numbers with the published limits (which showed a £1,250 tier and made
 * the ×1.00 reference land on a limit no customer can buy).
 */
import { BOOST_CLAIM_LIMIT_MONTHLY, DURATION_MONTHS } from '@/lib/pricingMatrix';

export type CodeBaseClaimTier = { key: string; limit: number; factor: number };

/** Published tier → internal matrix column. */
export const CODE_BASE_TIER_COLUMN: Record<number, number> = {
  1000: 1000,
  2000: 2000,
  3000: 3000,
  5000: 3000,
};

/** Internal matrix column → published tier (£5,000 sits on top of the 2000 column). */
export const CODE_BASE_COLUMN_TIER: Record<number, number> = {
  1000: 1000,
  2000: 2000,
  3000: 3000,
};

export const CODE_BASE_PUBLISHED_TIERS = [1000, 2000, 3000, 5000] as const;

/** The £3,000 → £5,000 step for a term, in whole pounds (£5/mo boost). */
export function codeBasePremiumStep(period: '12months' | '24months' | '36months'): number {
  return BOOST_CLAIM_LIMIT_MONTHLY * (DURATION_MONTHS[period] ?? 12);
}

/** Total code-base price for a published tier at a given term / excess. */
export function codeBaseTierPrice(
  matrix: any,
  limit: number,
  period: '12months' | '24months' | '36months' = '12months',
  excess = 150
): number {
  const column = CODE_BASE_TIER_COLUMN[limit] ?? limit;
  const price = Number(matrix?.[period]?.[excess]?.[column] ?? 0);
  return limit === 5000 ? price + codeBasePremiumStep(period) : price;
}

export function buildCodeBaseClaimTiers(
  matrix: any,
  ref: number,
  period: '12months' | '24months' | '36months' = '12months',
  excess = 150
): CodeBaseClaimTier[] {
  return CODE_BASE_PUBLISHED_TIERS.map(limit => {
    const price = codeBaseTierPrice(matrix, limit, period, excess);
    return {
      key: `cl-${limit}`,
      limit,
      factor: ref > 0 && price > 0 ? Math.round((price / ref) * 100) / 100 : 1,
    };
  });
}
