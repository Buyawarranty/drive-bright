import { describe, expect, it } from 'vitest';
import { canViewPayLaterClaims, hasPayLaterClaim } from './payLaterClaims';

describe('PayLater claims visibility', () => {
  it.each(['admin', 'super_admin', 'accounts', 'accounts_manager', 'accounts_payroll'])('allows %s', role => {
    expect(canViewPayLaterClaims(role)).toBe(true);
  });
  it.each(['sales_manager', 'sales', 'sales_lead', 'claims_manager', 'lead_gen', undefined])('denies %s', role => {
    expect(canViewPayLaterClaims(role)).toBe(false);
  });
  it('only flags customers returned by the private claim lookup', () => {
    const ids = new Set(['claimed-paylater']);
    expect(hasPayLaterClaim('claimed-paylater', ids, 'accounts')).toBe(true);
    expect(hasPayLaterClaim('unclaimed-paylater', ids, 'accounts')).toBe(false);
    expect(hasPayLaterClaim('claimed-paylater', ids, 'sales_manager')).toBe(false);
  });
});