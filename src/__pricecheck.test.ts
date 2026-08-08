import { describe, it, expect } from 'vitest';
import { getBasePrice, toClaimLimitColumn, normalizeClaimColumnKeys } from '@/lib/pricingMatrix';

describe('claim limit column rename keeps prices identical', () => {
  it('12 months / £100 excess', () => {
    expect(getBasePrice('12months', 100, 750, 'admin')).toBe(402);
    expect(getBasePrice('12months', 100, 1250, 'admin')).toBe(433);
    expect(getBasePrice('12months', 100, 1000, 'admin')).toBe(402);
    expect(getBasePrice('12months', 100, 2000, 'admin')).toBe(529);
    expect(getBasePrice('12months', 100, 3000, 'admin')).toBe(529);
    expect(getBasePrice('12months', 100, 5000, 'admin')).toBe(529);
  });
  it('multi-year promo column', () => {
    expect(getBasePrice('24months', 100, 2000, 'admin')).toBe(939);
    expect(getBasePrice('36months', 100, 750, 'admin')).toBe(1309);
  });
  it('columns', () => {
    expect(toClaimLimitColumn(750)).toBe(1000);
    expect(toClaimLimitColumn(1250)).toBe(2000);
    expect(toClaimLimitColumn(3000)).toBe(3000);
  });
  it('normalizes retired saved grids', () => {
    const legacy = { '12months': { '100': { '750': 1, '1250': 2, '2000': 3 } } };
    expect(normalizeClaimColumnKeys(legacy as any)).toEqual({ '12months': { '100': { '1000': 1, '2000': 2, '3000': 3 } } });
    const modern = { '12months': { '100': { '1000': 1, '2000': 2, '3000': 3 } } };
    expect(normalizeClaimColumnKeys(modern as any)).toEqual(modern);
  });
});
