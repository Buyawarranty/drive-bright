import { describe, expect, it } from 'vitest';
import { canReadCompanySalesValues } from '../../supabase/functions/_shared/companySalesPrivacy';

describe('Assistant company financial tools', () => {
  it('refuses sales agents regardless of grants', () => {
    expect(canReadCompanySalesValues('sales')).toBe(false);
  });
  it('refuses sales leads regardless of grants', () => {
    expect(canReadCompanySalesValues('sales_lead')).toBe(false);
  });
  it('fails closed without a verified staff role', () => {
    expect(canReadCompanySalesValues(undefined)).toBe(false);
    expect(canReadCompanySalesValues(null)).toBe(false);
  });
  it('preserves management financial tools', () => {
    expect(canReadCompanySalesValues('admin')).toBe(true);
    expect(canReadCompanySalesValues('super_admin')).toBe(true);
    expect(canReadCompanySalesValues('sales_manager')).toBe(true);
  });
});