import type { PricingMatrixShape } from '@/lib/pricingMatrix';

export function adjustPriceMatrix(matrix: PricingMatrixShape, percentage: number): PricingMatrixShape {
  if (!Number.isFinite(percentage) || percentage === 0 || percentage <= -100 || percentage > 200) {
    throw new Error('Choose an increase up to 200%, or a decrease below 100%.');
  }
  const next: PricingMatrixShape = {};
  for (const [period, excesses] of Object.entries(matrix)) {
    next[period] = {};
    for (const [excess, limits] of Object.entries(excesses)) {
      next[period][excess] = {};
      for (const [limit, price] of Object.entries(limits)) {
        const adjusted = Math.round(price * (1 + percentage / 100));
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(adjusted) || adjusted <= 0) {
          throw new Error('This adjustment creates an invalid price. Choose a smaller decrease.');
        }
        next[period][excess][limit] = adjusted;
      }
    }
  }
  return next;
}