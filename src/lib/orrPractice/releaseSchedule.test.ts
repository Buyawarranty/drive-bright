import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RELEASE_SCHEDULE,
  allowedOrrStaff,
  londonDateKey,
  maxReleases,
  nextReleaseAt,
  planNextRelease,
  releaseGuard,
} from './releaseSchedule';

const iso = (ms: number) => new Date(ms).toISOString();
const base = { contacted: false, converted: false, suppressed: false };

describe('ORR release schedule', () => {
  it('allows 32 releases by default (4 a day for 8 days)', () => {
    expect(maxReleases(DEFAULT_RELEASE_SCHEDULE)).toBe(32);
  });

  it('releases at 9:00, 12:00, 14:30 and 17:00 UK time in winter (GMT)', () => {
    const start = Date.parse('2026-11-02T08:00:00Z');
    const a = nextReleaseAt(start, DEFAULT_RELEASE_SCHEDULE);
    const b = nextReleaseAt(a, DEFAULT_RELEASE_SCHEDULE);
    const c = nextReleaseAt(b, DEFAULT_RELEASE_SCHEDULE);
    const d = nextReleaseAt(c, DEFAULT_RELEASE_SCHEDULE);
    const e = nextReleaseAt(d, DEFAULT_RELEASE_SCHEDULE);
    expect([a, b, c, d, e].map(iso)).toEqual([
      '2026-11-02T09:00:00.000Z',
      '2026-11-02T12:00:00.000Z',
      '2026-11-02T14:30:00.000Z',
      '2026-11-02T17:00:00.000Z',
      '2026-11-03T09:00:00.000Z',
    ]);
  });

  it('uses UK summer time (BST) correctly', () => {
    expect(iso(nextReleaseAt(Date.parse('2026-07-01T06:00:00Z'), DEFAULT_RELEASE_SCHEDULE))).toBe('2026-07-01T08:00:00.000Z');
  });

  it('stops after the 32nd release', () => {
    const r = planNextRelease({ ...base, chaseStartedAt: Date.now(), releasesUsed: 32 }, Date.now(), DEFAULT_RELEASE_SCHEDULE);
    expect(r).toEqual({ done: true, reason: 'limit_reached' });
  });

  it('stops after eight UK days even if releases remain', () => {
    const start = Date.parse('2026-11-02T09:00:00Z');
    const day8Evening = Date.parse('2026-11-09T17:30:00Z');
    const r = planNextRelease({ ...base, chaseStartedAt: start, releasesUsed: 5 }, day8Evening, DEFAULT_RELEASE_SCHEDULE);
    expect(r).toEqual({ done: true, reason: 'days_finished' });
    expect(londonDateKey(start)).toBe('2026-11-02');
  });

  it('stops immediately on contact, conversion or suppression', () => {
    const now = Date.now();
    expect(planNextRelease({ ...base, contacted: true, chaseStartedAt: now, releasesUsed: 1 }, now, DEFAULT_RELEASE_SCHEDULE)).toEqual({ done: true, reason: 'contacted' });
    expect(planNextRelease({ ...base, converted: true, chaseStartedAt: now, releasesUsed: 1 }, now, DEFAULT_RELEASE_SCHEDULE)).toEqual({ done: true, reason: 'converted' });
    expect(planNextRelease({ ...base, suppressed: true, chaseStartedAt: now, releasesUsed: 0 }, now, DEFAULT_RELEASE_SCHEDULE)).toEqual({ done: true, reason: 'suppressed' });
  });

  it('honours a manager-changed frequency', () => {
    const cfg = { releaseTimes: ['10:00', '15:00'], releaseDays: 3 };
    expect(maxReleases(cfg)).toBe(6);
    expect(iso(nextReleaseAt(Date.parse('2026-11-02T10:00:00Z'), cfg))).toBe('2026-11-02T15:00:00.000Z');
  });

  it('blocks a release that fails a safeguard', () => {
    expect(releaseGuard({ ...base, eligibleForAllocation: true, legallyCallable: false })).toEqual({ ok: false, reason: 'Not legally callable' });
    expect(releaseGuard({ ...base, eligibleForAllocation: true, legallyCallable: true })).toEqual({ ok: true });
  });

  it('leaves blocked staff out of the rotation', () => {
    expect(allowedOrrStaff([{ id: 'a' }, { id: 'b' }], ['b']).map(s => s.id)).toEqual(['a']);
  });
});
