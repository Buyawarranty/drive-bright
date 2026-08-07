/**
 * Customer-facing claim limit tiers for the code-base pricing sandboxes.
 *
 * The July 2026 matrix stores three internal columns (750 / 1250 / 2000), but
 * agents and customers only ever see the four published tiers:
 *   £1,000 (Basic) · £2,000 (Essential) · £3,000 (Elite) · £5,000 (Premium)
 *
 * £3,000 repeats the £1,000→£2,000 step on top of £2,000, and £5,000 adds the
 * flat premium step — exactly as src/lib/claimLimitTiers.ts does live.
 */
import { PREMIUM_STEP_SURCHARGE } from '@/lib/claimLimitTiers';

export type CodeBaseClaimTier = { key: string; limit: number; factor: number };

export function buildCodeBaseClaimTiers(
  matrix: any,
  ref: number,
  period: '12months' | '24months' | '36months' = '12months',
  excess = 150
): CodeBaseClaimTier[] {
  const col = (limit: number) => Number(matrix[period][excess][limit]);
  const p1000 = col(750);
  const p2000 = col(2000);
  const elite = p2000 - p1000;
  const p3000 = p2000 + elite;
  const p5000 = p3000 + (PREMIUM_STEP_SURCHARGE[period] || 0);

  const price: Record<number, number> = { 1000: p1000, 2000: p2000, 3000: p3000, 5000: p5000 };

  return [1000, 2000, 3000, 5000].map(limit => ({
    key: `cl-${limit}`,
    limit,
    factor: ref > 0 ? Math.round((price[limit] / ref) * 100) / 100 : 1,
  }));
}
