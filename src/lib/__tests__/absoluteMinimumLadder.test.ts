import { describe, it, expect } from 'vitest';
import { getAbsoluteMinimumTotal } from '@/lib/pricingMatrix';

const admin = (claimLimit: number, labourRate: number, voluntaryExcess: number, paymentPeriod: any = '12months') =>
  getAbsoluteMinimumTotal({ paymentPeriod, claimLimit, labourRate, voluntaryExcess, surface: 'admin' });

describe('Quotes & Orders absolute minimum ladder', () => {
  it('cheapest combo is £399', () => {
    expect(admin(1000, 50, 500)).toBe(399);
  });

  it('claim limits £1,000 and £2,000 are different prices', () => {
    expect(admin(2000, 50, 500)).toBeGreaterThan(admin(1000, 50, 500));
  });

  it('every excess tier moves', () => {
    const tiers = [500, 250, 150, 100, 50, 0].map(e => admin(2000, 70, e));
    const unique = new Set(tiers);
    expect(unique.size).toBe(tiers.length);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
  });

  it('reference combo stays around the old £399 bottom', () => {
    expect(admin(2000, 70, 150)).toBeGreaterThanOrEqual(399);
  });

  it('term floors scale', () => {
    expect(admin(1000, 50, 500, '24months')).toBe(658);
    expect(admin(1000, 50, 500, '36months')).toBe(938);
  });

  it('motorbikes are half', () => {
    expect(
      getAbsoluteMinimumTotal({ paymentPeriod: '12months', claimLimit: 1000, labourRate: 50, voluntaryExcess: 500, isMotorbike: true, surface: 'admin' })
    ).toBe(200);
  });
});
