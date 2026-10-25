import { describe, expect, it } from 'vitest';
import { priceDifference } from './priceComparison';

describe('read-only pricing comparisons', () => {
  it('shows higher draft prices against live totals', () => {
    expect(priceDifference(550, 500)).toEqual({ amount: 50, percent: 10, direction: 'higher' });
  });
  it('shows lower draft prices against live totals', () => {
    expect(priceDifference(450, 500)).toEqual({ amount: -50, percent: -10, direction: 'lower' });
  });
  it('measures Quotes & Orders from the Step 3 price, not the other way round', () => {
    expect(priceDifference(500, 450)?.percent).toBeCloseTo(11.111111);
    expect(priceDifference(500, 550)?.direction).toBe('lower');
  });
  it('reports unchanged amounts and rejects missing baselines', () => {
    expect(priceDifference(500, 500)?.direction).toBe('same');
    expect(priceDifference(500, 0)).toBeNull();
  });
});