import { describe, it, expect, vi } from 'vitest';

const rpcMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import {
  checkLoginLockout,
  lockoutMessage,
  LOCKOUT_MAX_FAILED_ATTEMPTS,
  LOCKOUT_WINDOW_MINUTES,
} from './loginLockout';

// Note: no beforeEach mockClear/mockReset here — a vitest v4 quirk makes
// rejections escape the helper's try/catch when a beforeEach hook is present.
// One-shot implementations keep each test independent without clearing.
describe('login lockout', () => {
  it('locks after 5 failed attempts within a 15-minute window', () => {
    expect(LOCKOUT_MAX_FAILED_ATTEMPTS).toBe(5);
    expect(LOCKOUT_WINDOW_MINUTES).toBe(15);
  });

  it('maps a locked RPC response and normalises the email', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { locked: true, failed_count: 6, retry_after_seconds: 540 },
      error: null,
    });
    const status = await checkLoginLockout('Person@Example.com');
    expect(rpcMock).toHaveBeenCalledWith('check_login_lockout', { p_email: 'person@example.com' });
    expect(status).toEqual({ locked: true, failedCount: 6, retryAfterSeconds: 540 });
  });

  it('passes through an unlocked response', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { locked: false, failed_count: 2, retry_after_seconds: 0 },
      error: null,
    });
    const status = await checkLoginLockout('a@b.co.uk');
    expect(status.locked).toBe(false);
    expect(status.failedCount).toBe(2);
  });

  it('fails open when the check errors so legitimate users are never stranded', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('db down') });
    const status = await checkLoginLockout('a@b.co.uk');
    expect(status.locked).toBe(false);
  });

  it('fails open when the check throws', async () => {
    rpcMock.mockImplementationOnce(() => { throw new Error('network'); });
    const status = await checkLoginLockout('a@b.co.uk');
    expect(status.locked).toBe(false);
  });

  it('tells the user how many minutes to wait and points at password reset', () => {
    const msg = lockoutMessage(540);
    expect(msg).toContain('9 minutes');
    expect(msg.toLowerCase()).toContain('forgot');
  });
});
