import { describe, it, expect } from 'vitest';
import { payInFullTotal, payInFullSaving, twelvePaymentTotal } from '@/lib/pricing/payInFull';

describe('pay in full pricing', () => {
  it('is the 12-payment total minus 10%', () => {
    expect(twelvePaymentTotal(84)).toBe(1008);
    expect(payInFullSaving(84)).toBe(100);
    expect(payInFullTotal(84)).toBe(908);
  });

  it('never drops to an impossible fraction of the monthly total', () => {
    for (const monthly of [20, 35, 49, 60, 84, 120, 199]) {
      const total = twelvePaymentTotal(monthly);
      const full = payInFullTotal(monthly);
      expect(full).toBeGreaterThan(total * 0.85);
      expect(full).toBeLessThanOrEqual(total);
    }
  });

  it('is always cheaper than paying monthly, never more', () => {
    expect(payInFullTotal(60)).toBeLessThan(twelvePaymentTotal(60));
  });
});
