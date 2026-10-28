import { expect, it, vi } from 'vitest';
const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } } }));
import { secureStaffSignIn } from './staffSingleSession';

it('sends the issued token to revoke-others with no device-approval action', async () => {
  invoke.mockResolvedValueOnce({ data: { revoked: true }, error: null });
  await secureStaffSignIn('issued-token');
  expect(invoke).toHaveBeenLastCalledWith('staff-device-access', {
    body: { action: 'revoke-others' }, headers: { Authorization: 'Bearer issued-token' },
  });
});
it('fails closed when revocation is unsuccessful or unconfirmed', async () => {
  for (const result of [{ data: null, error: new Error('unavailable') }, { data: { allowed: true }, error: null }]) {
    invoke.mockResolvedValueOnce(result);
    await expect(secureStaffSignIn('issued-token')).rejects.toThrow('Unable to secure your staff session');
  }
});