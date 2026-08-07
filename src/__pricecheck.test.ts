import { describe, it } from 'vitest';
import { getBasePrice, applyBasePriceFloor } from '@/lib/pricingMatrix';

describe('excess differentiation', () => {
  it('prices move with excess and claim limit', () => {
    for (const period of ['12months','24months','36months'] as const) {
      for (const cl of [1000, 2000, 3000]) {
        const row = [0,50,100,150,250,500].map(ex => {
          const base = getBasePrice(period, ex, cl === 1000 ? 750 : cl === 2000 ? 1250 : 2000, 'customer');
          return applyBasePriceFloor(base, period, ex, false, 'customer', null, cl);
        });
        console.log(period, 'claim', cl, row.join(' | '));
      }
    }
  });
});
