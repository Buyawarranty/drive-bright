import { describe, it, expect } from 'vitest';
import { canManageGateway, validGatewayPassword } from '../../supabase/functions/_shared/gateway-rules';

describe('Gateway password permissions', () => {
  it('allows active admins', () => expect(canManageGateway('admin', true)).toBe(true));
  it('allows active super admins', () => expect(canManageGateway('super_admin', true)).toBe(true));
  it('denies other staff including sales managers', () => {
    for (const role of ['sales_manager', 'sales_lead', 'sales', 'customer', 'accounts']) expect(canManageGateway(role, true)).toBe(false);
  });
  it('denies inactive admins', () => expect(canManageGateway('admin', false)).toBe(false));
  it('accepts secure-length passwords and rejects invalid lengths', () => {
    expect(validGatewayPassword('a'.repeat(12))).toBe(true);
    expect(validGatewayPassword('a'.repeat(11))).toBe(false);
    expect(validGatewayPassword('a'.repeat(129))).toBe(false);
  });
});