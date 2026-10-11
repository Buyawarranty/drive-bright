import { describe, it, expect } from 'vitest';
import { applyWebsitePayInFullFloor, applyWebsiteSellFloor, getWebsiteNetFloor, getNetPayableFloor } from './netFloor';

const cheap = { voluntaryExcess: 500, claimLimit: 1000, labourRate: 50 };

describe('website 2/3-year 18% cut', () => {
  it('cuts 2-year website price by 18%', () => {
    expect(applyWebsiteSellFloor(1000, { paymentPeriod: '24months', ...cheap })).toBe(820);
  });
  it('leaves 1-year website price unchanged', () => {
    expect(applyWebsiteSellFloor(500, { paymentPeriod: '12months', ...cheap })).toBe(500);
  });
  it('website minimums are £700 / £1,000 at the cheapest combo', () => {
    expect(getWebsiteNetFloor({ paymentPeriod: '24months', ...cheap })).toBe(700);
    expect(getWebsiteNetFloor({ paymentPeriod: '36months', ...cheap })).toBe(1000);
  });
  it('Quotes & Orders minimums stay £769 / £1,099', () => {
    expect(getNetPayableFloor({ paymentPeriod: '24months', ...cheap, surface: 'admin' })).toBe(769);
    expect(getNetPayableFloor({ paymentPeriod: '36months', ...cheap, surface: 'admin' })).toBe(1099);
  });
  it('pay-in-full 10% off never goes below the website minimum', () => {
    // £708 monthly total → 10% off = £638, but the 2-year floor is £700.
    expect(applyWebsitePayInFullFloor(638, { paymentPeriod: '24months', ...cheap })).toBe(700);
    expect(applyWebsitePayInFullFloor(900, { paymentPeriod: '36months', ...cheap })).toBe(1000);
    // Above the floor the full 10% saving is untouched.
    expect(applyWebsitePayInFullFloor(1080, { paymentPeriod: '24months', ...cheap })).toBe(1080);
  });
});
