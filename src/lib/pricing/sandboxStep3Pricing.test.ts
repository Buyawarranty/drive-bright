import { describe, expect, it } from 'vitest';
import { quotesOrdersTotal, sandboxTermPrice } from './sandboxStep3Pricing';
import { payLaterYearlyAmount, BAW_PAYLATER_UPLIFT } from '@/lib/bawPayLater';

describe('Step 3 sandbox pricing', () => {
  const vehicle = { make: 'Ford', model: 'Focus', fuelType: 'Petrol', year: '2019', mileage: '45000' };
  const opts = { claimLimit: 2000, voluntaryExcess: 100, labourRate: 50 };

  it('prices the 1-year term with no PayLater figures', () => {
    const p = sandboxTermPrice(vehicle, '12months', opts);
    expect(p.years).toBe(1);
    expect(p.total).toBe(p.monthly * 12);
    expect(p.payLaterYearly).toBeNull();
    expect(p.payLaterTermTotal).toBeNull();
    expect(p.payLaterExtra).toBeNull();
  });

  it('shows PayLater yearly at per-year price +10% on the 2-year term', () => {
    const p = sandboxTermPrice(vehicle, '24months', opts);
    expect(p.years).toBe(2);
    expect(p.payLaterYearly).toBe(payLaterYearlyAmount(p.total, 2));
    expect(p.payLaterYearly).toBe(Math.round((p.total / 2) * BAW_PAYLATER_UPLIFT));
    expect(p.payLaterTermTotal).toBe((p.payLaterYearly ?? 0) * 2);
    expect(p.payLaterExtra).toBe((p.payLaterTermTotal ?? 0) - p.total);
  });

  it('shows PayLater yearly at per-year price +10% on the 3-year term', () => {
    const p = sandboxTermPrice(vehicle, '36months', opts);
    expect(p.years).toBe(3);
    expect(p.payLaterYearly).toBe(Math.round((p.total / 3) * BAW_PAYLATER_UPLIFT));
    expect(p.payLaterTermTotal).toBe((p.payLaterYearly ?? 0) * 3);
  });

  it('keeps the 12-instalment total as the lead price on every term', () => {
    for (const term of ['12months', '24months', '36months'] as const) {
      const p = sandboxTermPrice(vehicle, term, opts);
      expect(p.total).toBe(p.monthly * 12);
      expect(p.monthly).toBeGreaterThan(0);
    }
  });
});

describe('Quotes & Orders gap', () => {
  it('is always 10% above the website price, rounded up to whole pounds', () => {
    // £900 web → £1000 grid exactly
    expect(quotesOrdersTotal(900, 10)).toBe(1000);
    // £564 web → £626.67 → £627 (never below the true grid price)
    expect(quotesOrdersTotal(564, 10)).toBe(627);
  });

  it('never returns less than the website price', () => {
    expect(quotesOrdersTotal(564, 10)).toBeGreaterThan(564);
    expect(quotesOrdersTotal(564, 0)).toBe(564);
  });

  it('handles zero and nonsense input safely', () => {
    expect(quotesOrdersTotal(0, 10)).toBe(0);
    expect(quotesOrdersTotal(NaN, 10)).toBe(0);
  });
});
