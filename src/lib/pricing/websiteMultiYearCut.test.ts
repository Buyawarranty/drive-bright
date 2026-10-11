import { describe, it, expect, afterEach } from 'vitest';
import { applyWebsitePayInFullFloor, payInFullFloorFromTermFloor, applyWebsiteSellFloor, getWebsiteNetFloor, getNetPayableFloor } from './netFloor';

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
  it('pay-in-full floor is 90% of the website minimum so the 10% discount always fits', () => {
    // £708 monthly total → 10% off = £638; the pay-in-full floor is 90% of
    // £700 = £630, so the full discount applies (no more "Save £1").
    expect(applyWebsitePayInFullFloor(638, { paymentPeriod: '24months', ...cheap })).toBe(638);
    expect(applyWebsitePayInFullFloor(900, { paymentPeriod: '36months', ...cheap })).toBe(900);
    // Below 90% of the floor the pay-in-full price is still clamped.
    expect(applyWebsitePayInFullFloor(600, { paymentPeriod: '24months', ...cheap })).toBe(630);
    expect(applyWebsitePayInFullFloor(800, { paymentPeriod: '36months', ...cheap })).toBe(900);
    // Above the floor the full 10% saving is untouched.
    expect(applyWebsitePayInFullFloor(1080, { paymentPeriod: '24months', ...cheap })).toBe(1080);
  });
  it('pay-in-full saving is always the full 10% once the total meets the website minimum', () => {
    // £708 total (at the £700 floor) → saving is the full £70, so the
    // "Save 10%" label stays on.
    const total = 708;
    const saving = total - applyWebsitePayInFullFloor(total - Math.floor(total * 0.10), { paymentPeriod: '24months', ...cheap });
    expect(saving).toBe(Math.floor(total * 0.10));
    // Above the floor the saving also meets the full 10%.
    const tallTotal = 1080;
    const tallSaving = tallTotal - applyWebsitePayInFullFloor(tallTotal - Math.floor(tallTotal * 0.10), { paymentPeriod: '24months', ...cheap });
    expect(tallSaving).toBe(Math.floor(tallTotal * 0.10));
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

describe('pay in full is a true 10% off the 12 payments (2/3-year)', () => {
  it('3-year £90/mo (£1,080) pays £972 in full, not clamped to the term minimum', () => {
    const termFloor = 1071; // shaped website minimum seen on the quote
    const stripe = Math.max(payInFullFloorFromTermFloor(termFloor, '36months'), 1080 - Math.floor(1080 * 0.1));
    expect(stripe).toBe(972);
  });
  it('1-year keeps the full £399 minimum', () => {
    expect(payInFullFloorFromTermFloor(399, '12months')).toBe(399);
  });
});
