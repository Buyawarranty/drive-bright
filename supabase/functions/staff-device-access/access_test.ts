import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { hashStaffDevice, staffDeviceAllowed } from '../_shared/staff-device.ts';

Deno.test('device IDs are not approval proof and invalid credentials are rejected', async () => {
  assertEquals(await hashStaffDevice('a-browser-id'), null);
  assertEquals((await hashStaffDevice('a'.repeat(64)))?.length, 64);
});
Deno.test('staff approval fails closed on an unavailable or denied server check', async () => {
  const request = new Request('https://example.com', { headers: { 'x-staff-device': 'a'.repeat(64) } });
  for (const result of [{ data: { allowed: false }, error: null }, { data: { allowed: true }, error: new Error('unavailable') }]) {
    const db = { rpc: async () => result } as unknown as Parameters<typeof staffDeviceAllowed>[0];
    assertEquals(await staffDeviceAllowed(db, request, 'user'), false);
  }
});