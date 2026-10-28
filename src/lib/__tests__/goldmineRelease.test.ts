import { describe, expect, it } from 'vitest';
import { canReleaseGoldmineLeads, isValidGoldmineRelease } from '../goldmineRelease';

describe('Goldmine releases', () => {
  it('limits each release to 100, not 101 or fractional leads', () => {
    expect(isValidGoldmineRelease(100)).toBe(true);
    expect(isValidGoldmineRelease(101)).toBe(false);
    expect(isValidGoldmineRelease(0)).toBe(false);
    expect(isValidGoldmineRelease(1.5)).toBe(false);
  });
  it('allows only admins and super admins to release', () => {
    expect(canReleaseGoldmineLeads('admin')).toBe(true);
    expect(canReleaseGoldmineLeads('super_admin')).toBe(true);
    for (const role of ['sales_manager', 'sales_lead', 'sales', 'accounts', null]) {
      expect(canReleaseGoldmineLeads(role)).toBe(false);
    }
  });
});