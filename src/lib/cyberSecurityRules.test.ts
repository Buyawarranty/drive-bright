import { describe, it, expect } from 'vitest';
import { canViewCyberSecurity, protectionState } from '../../supabase/functions/_shared/cyber-security-rules';
describe('Cyber security access', () => {
  it('allows admins and super admins only', () => {
    expect(canViewCyberSecurity('admin')).toBe(true);
    expect(canViewCyberSecurity('super_admin')).toBe(true);
    for (const role of ['sales_manager', 'sales', 'sales_lead', 'accounts', 'dev_tester', null]) expect(canViewCyberSecurity(role)).toBe(false);
  });
  it('never marks outstanding issues checked', () => {
    expect(protectionState(0)).toBe('checked');
    expect(protectionState(1)).toBe('attention');
    expect(protectionState(618)).toBe('attention');
  });
});