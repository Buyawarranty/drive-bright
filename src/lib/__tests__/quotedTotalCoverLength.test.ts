import { describe, it, expect } from 'vitest';
import { coverMonthsOf } from '@/lib/pricing/quotedTotalLookup';

describe('quoted price only matches the same cover length', () => {
  it('reads 1-year spellings as 12 months', () => {
    expect(coverMonthsOf('12months')).toBe(12);
    expect(coverMonthsOf('yearly')).toBe(12);
  });
  it('a 2-year quote is not a 1-year quote', () => {
    expect(coverMonthsOf('24months')).toBe(24);
    expect(coverMonthsOf('2-Year')).toBe(24);
    expect(coverMonthsOf('24months')).not.toBe(coverMonthsOf('12months'));
  });
  it('reads 3-year spellings as 36 months', () => {
    expect(coverMonthsOf('36months')).toBe(36);
    expect(coverMonthsOf('3-Year')).toBe(36);
  });
});
