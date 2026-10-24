import { afterEach, describe, expect, it } from 'vitest';
import { applyLivePricingVersion } from './applyLivePricingVersion';
import { applyWebsiteSellFloor } from './netFloor';
import { deriveCustomerPriceFromAdmin, getBasePrice, getLivePricingOverride, setLivePricingOverride } from '../pricingMatrix';
import { discountedWebsiteTotal, normalizeWebsiteDiscount, readWebsiteDiscountDraft } from './websiteDiscount';

const cheap = { voluntaryExcess: 500, claimLimit: 1000, labourRate: 50 };
const grid = {
  '12months': { '100': { '1000': 1000 } },
  '24months': { '100': { '1000': 2000 } },
  '36months': { '100': { '1000': 3000 } },
};
afterEach(() => setLivePricingOverride(null, 10));

describe('single website discount', () => {
  it('allows a website price 10% more expensive without changing agent prices', () => {
    setLivePricingOverride(grid, -10, true);
    expect(normalizeWebsiteDiscount(-10)).toBe(-10);
    expect(discountedWebsiteTotal(1000, -10, 399)).toBe(1100);
    expect(deriveCustomerPriceFromAdmin(1000, -10)).toBe(1100);
    expect(applyWebsiteSellFloor(2000, { paymentPeriod: '24months', ...cheap })).toBe(2200);
    expect(getBasePrice('24months', 100, 1000, 'admin')).toBe(2000);
  });
  it('starts at the chosen 10% without a saved browser draft', () => {
    expect(readWebsiteDiscountDraft()).toBe(10);
  });
  it('applies 10% once to all cover lengths and leaves the agent grid unchanged', () => {
    applyLivePricingVersion({ status: 'live', admin_matrix: grid, step3_discount_pct: 10, vehicle_factor_model: { bands: [], refBandKey: '', mileageBands: [], powertrains: [], vehicleTypes: [], websiteDiscountMode: 'single' } });
    expect(getBasePrice('12months', 100, 1000, 'customer')).toBe(1000);
    expect(getBasePrice('12months', 100, 1000, 'admin')).toBe(1000);
    expect(applyWebsiteSellFloor(1000, { paymentPeriod: '12months', ...cheap })).toBe(900);
    expect(applyWebsiteSellFloor(2000, { paymentPeriod: '24months', ...cheap })).toBe(1800);
    expect(applyWebsiteSellFloor(3000, { paymentPeriod: '36months', ...cheap })).toBe(2700);
  });
  it('changing the one percentage above 10% changes every term without stacking 18%', () => {
    setLivePricingOverride(grid, 18, true);
    expect(applyWebsiteSellFloor(1000, { paymentPeriod: '12months', ...cheap })).toBe(820);
    expect(applyWebsiteSellFloor(2000, { paymentPeriod: '24months', ...cheap })).toBe(1640);
    expect(applyWebsiteSellFloor(3000, { paymentPeriod: '36months', ...cheap })).toBe(2460);
    expect(getBasePrice('24months', 100, 1000, 'admin')).toBe(2000);
  });
  it('preserves the existing website minimums without blocking', () => {
    setLivePricingOverride(grid, 50, true);
    expect(applyWebsiteSellFloor(500, { paymentPeriod: '12months', ...cheap })).toBe(399);
    expect(applyWebsiteSellFloor(1000, { paymentPeriod: '24months', ...cheap })).toBe(700);
    expect(applyWebsiteSellFloor(1500, { paymentPeriod: '36months', ...cheap })).toBe(1000);
  });
  it('allows zero rather than silently applying the default again', () => {
    expect(normalizeWebsiteDiscount(0)).toBe(0);
    expect(discountedWebsiteTotal(1000, 0, 399)).toBe(1000);
  });
  it('does not apply draft versions to customer pricing', () => {
    setLivePricingOverride(grid, 10, false);
    const before = getLivePricingOverride();
    expect(applyLivePricingVersion({ status: 'draft', admin_matrix: grid, step3_discount_pct: 18 })).toEqual({ applied: false, reason: 'blocked-status:draft' });
    expect(getLivePricingOverride()).toEqual(before);
  });
});