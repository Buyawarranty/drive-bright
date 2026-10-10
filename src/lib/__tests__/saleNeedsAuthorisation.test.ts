import { describe, it, expect } from 'vitest';
import { saleFlagReasons, minimumForTerm } from '@/components/admin/SaleNeedsAuthorisationAlert';

describe('sale needs authorisation flag', () => {
  it('flags more than 30% under the quote (Garry: £324 vs £660)', () => {
    expect(saleFlagReasons(324, 660, 'yearly')[0]).toContain('51% under');
  });
  it('does not flag exactly 30% under the quote above the minimum', () => {
    expect(saleFlagReasons(462, 660, 'yearly')).toEqual([]);
  });
  it('flags a 3-year sale under £1,099 (Jamie: £636)', () => {
    expect(saleFlagReasons(636, 1260, '3-Year').length).toBe(2);
  });
  it('minimums are £399 / £769 / £1,099', () => {
    expect(minimumForTerm('yearly')).toBe(399);
    expect(minimumForTerm('2-Year')).toBe(769);
    expect(minimumForTerm('3-Year')).toBe(1099);
  });
});
