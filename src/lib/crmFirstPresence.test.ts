import { describe, expect, it } from 'vitest';
import { firstCrmPresence } from './crmFirstPresence';
describe('earliest recorded CRM presence', () => {
  it('shows James at 09:06 rather than calling his 11:47 detailed session his start', () => {
    expect(firstCrmPresence([{ started_at: '2026-10-26T11:47:28Z' }], [{ first_seen_at: '2026-10-26T09:06:24Z' }])).toEqual({ at: '2026-10-26T09:06:24Z', source: 'CRM location observation' });
  });
  it('uses a session when it is earlier than the location observation', () => {
    expect(firstCrmPresence([{ started_at: '2026-10-26T08:00:00Z' }], [{ first_seen_at: '2026-10-26T09:06:24Z' }])?.at).toBe('2026-10-26T08:00:00Z');
  });
  it('does not invent a start time without evidence', () => {
    expect(firstCrmPresence([], [{ first_seen_at: 'invalid' }])).toBeUndefined();
  });
});