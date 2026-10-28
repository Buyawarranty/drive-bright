import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { revokeOtherStaffSessions } from './revoke-others.ts';

function fixture(options: { invalidToken?: boolean; staff?: unknown; lookupError?: boolean; revokeError?: boolean } = {}) {
  const calls: unknown[][] = [];
  const db = {
    auth: {
      getUser: async () => ({ data: { user: options.invalidToken ? null : { id: 'verified-user' } }, error: options.invalidToken ? new Error('invalid') : null }),
      admin: { signOut: async (...args: unknown[]) => { calls.push(args); return { error: options.revokeError ? new Error('unavailable') : null }; } },
    },
    from: (table: string) => {
      assertEquals(table, 'admin_users'); // Any device-table access fails this test.
      return { select: () => ({ eq: (_column: string, id: string) => {
        assertEquals(id, 'verified-user');
        return { maybeSingle: async () => ({ data: 'staff' in options ? options.staff : { is_active: true }, error: options.lookupError ? new Error('unavailable') : null }) };
      } }) };
    },
    rpc: () => { throw new Error('Device approval RPC must not run'); },
  } as unknown as Parameters<typeof revokeOtherStaffSessions>[0];
  return { db, calls };
}

Deno.test('active staff revokes only other sessions without device approval', async () => {
  const { db, calls } = fixture();
  assertEquals(await revokeOtherStaffSessions(db, 'issued-token'), { status: 200, body: { revoked: true } });
  assertEquals(calls, [['issued-token', 'others']]);
});
Deno.test('customer tokens never revoke sessions', async () => {
  const { db, calls } = fixture({ staff: null });
  assertEquals((await revokeOtherStaffSessions(db, 'customer-token')).status, 403);
  assertEquals(calls, []);
});
Deno.test('invalid tokens never revoke sessions', async () => {
  const { db, calls } = fixture({ invalidToken: true });
  assertEquals((await revokeOtherStaffSessions(db, 'invalid-token')).status, 401);
  assertEquals(calls, []);
});
Deno.test('inactive archived expired staff and lookup errors fail closed', async () => {
  for (const options of [{ staff: { is_active: false } }, { staff: { is_active: true, archived_at: '2026-01-01' } }, { staff: { is_active: true, access_expires_at: '2020-01-01' } }, { lookupError: true }]) {
    const { db, calls } = fixture(options);
    assertEquals((await revokeOtherStaffSessions(db, 'issued-token')).status, 'lookupError' in options ? 503 : 403);
    assertEquals(calls, []);
  }
});
Deno.test('revocation failure cannot report success', async () => {
  const { db } = fixture({ revokeError: true });
  assertEquals((await revokeOtherStaffSessions(db, 'issued-token')).status, 503);
});