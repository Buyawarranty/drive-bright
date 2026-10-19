import { describe, expect, it } from 'vitest';
import { conversationInRange } from './chatConversationRange';

const NOW = Date.UTC(2026, 9, 19, 12, 0, 0); // 19 Oct 2026 noon UTC

describe('conversationInRange', () => {
  it('keeps a conversation created today inside an explicit from/to range', () => {
    expect(
      conversationInRange('2026-10-19T09:00:00Z', {
        fromIso: '2026-10-01T00:00:00Z',
        toIso: '2026-10-19T23:59:59Z',
      }),
    ).toBe(true);
  });

  it('excludes an old August conversation from an October range', () => {
    expect(
      conversationInRange('2026-08-14T10:00:00Z', {
        fromIso: '2026-10-01T00:00:00Z',
        toIso: '2026-10-19T23:59:59Z',
      }),
    ).toBe(false);
  });

  it('excludes conversations after the range end', () => {
    expect(
      conversationInRange('2026-10-20T10:00:00Z', {
        fromIso: '2026-10-01T00:00:00Z',
        toIso: '2026-10-19T23:59:59Z',
      }),
    ).toBe(false);
  });

  it('falls back to rangeDays when no explicit range is given', () => {
    expect(
      conversationInRange('2026-10-18T00:00:00Z', { rangeDays: 7, nowMs: NOW }),
    ).toBe(true);
    expect(
      conversationInRange('2026-08-14T00:00:00Z', { rangeDays: 7, nowMs: NOW }),
    ).toBe(false);
  });

  it('shows everything when the range is all with no bounds', () => {
    expect(conversationInRange('2026-08-14T00:00:00Z', { rangeDays: 'all', nowMs: NOW })).toBe(true);
    expect(conversationInRange('2026-08-14T00:00:00Z', {})).toBe(true);
  });
});
