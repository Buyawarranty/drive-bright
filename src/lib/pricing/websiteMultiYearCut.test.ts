import { describe, it, expect } from 'vitest';
import { applyWebsiteSellFloor, getWebsiteNetFloor, getNetPayableFloor } from './netFloor';

const cheap = { voluntaryExcess: 500, claimLimit: 1000, labourRate: 50 };

describe('website 2/3-year 18% cut', () => {
  it('cuts 2-year website price by 18%', () => {
    expect(applyWebsiteSellFloor(1000, { paymentPeriod: '24months', ...cheap })).toBe(820);
  });
  it('leaves 1-year website price unchanged', () => {
    expect(applyWebsiteSellFloor(500, { paymentPeriod: '12months', ...cheap })).toBe(500);
  });
  it('website minimums are £565 / £810 at the cheapest combo', () => {
    expect(getWebsiteNetFloor({ paymentPeriod: '24months', ...cheap })).toBe(565);
    expect(getWebsiteNetFloor({ paymentPeriod: '36months', ...cheap })).toBe(810);
  });
  it('Quotes & Orders minimums stay £769 / £1,099', () => {
    expect(getNetPayableFloor({ paymentPeriod: '24months', ...cheap, surface: 'admin' })).toBe(769);
    expect(getNetPayableFloor({ paymentPeriod: '36months', ...cheap, surface: 'admin' })).toBe(1099);
  });
});
