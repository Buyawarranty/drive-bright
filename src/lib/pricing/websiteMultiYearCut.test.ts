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
  it('floored quotes keep the full "Save 10%" wording; shrunken savings show the £ amount only', () => {
    // When the floor binds (£708 total → £700) the saving (£8) is below the
    // standard 10% (£70), so the "Save 10%" label is switched off and only
    // the £ amount is shown.
    const total = 708;
    const saving = total - applyWebsitePayInFullFloor(total - Math.floor(total * 0.10), { paymentPeriod: '24months', ...cheap });
    expect(saving).toBe(8);
    expect(saving >= Math.floor(total * 0.10)).toBe(false);
    // Above the floor the saving meets the full 10%, so the wording stays.
    const tallTotal = 1080;
    const tallSaving = tallTotal - applyWebsitePayInFullFloor(tallTotal - Math.floor(tallTotal * 0.10), { paymentPeriod: '24months', ...cheap });
    expect(tallSaving).toBe(Math.floor(tallTotal * 0.10));
    expect(tallSaving >= Math.floor(tallTotal * 0.10)).toBe(true);
  });
});

import {
  setLiveWebsiteMultiYearCutPct,
  getWebsiteMultiYearCutFactor,
  getWebsiteMultiYearCutPct,
  WEBSITE_MULTI_YEAR_PRICE_FACTOR,
} from './netFloor';

describe('website multi-year cut — live manager override', () => {
  afterEach(() => setLiveWebsiteMultiYearCutPct(null));

  it('defaults to the agreed 18% when nothing is published', () => {
    expect(getWebsiteMultiYearCutFactor()).toBe(WEBSITE_MULTI_YEAR_PRICE_FACTOR);
    expect(getWebsiteMultiYearCutPct()).toBe(18);
  });

  it('a published value replaces the default and prices follow it', () => {
    setLiveWebsiteMultiYearCutPct(14);
    expect(getWebsiteMultiYearCutPct()).toBe(14);
    // £1,000 grid at 14% off = £860 (above the £700 floor, so no clamp).
    expect(applyWebsiteSellFloor(1000, { paymentPeriod: '24months', voluntaryExcess: 500, claimLimit: 1000, labourRate: 50 })).toBe(860);
  });

  it('rejecting nonsense values restores the default', () => {
    setLiveWebsiteMultiYearCutPct(80);
    expect(getWebsiteMultiYearCutPct()).toBe(18);
    setLiveWebsiteMultiYearCutPct(-5);
    expect(getWebsiteMultiYearCutPct()).toBe(18);
  });

  it('1-year cover is never cut, whatever is published', () => {
    setLiveWebsiteMultiYearCutPct(25);
    expect(applyWebsiteSellFloor(500, { paymentPeriod: '12months', voluntaryExcess: 500, claimLimit: 1000, labourRate: 50 })).toBe(500);
  });
});
