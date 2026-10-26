import { describe, expect, it } from 'vitest';
import { dayBoundary, sessionOutcome, splitDailySessions, type CrmSession } from './crmSessionTimeline';
const session: CrmSession = { id: 'one', admin_user_id: 'agent', started_at: '2026-10-25T23:30:00Z', last_seen_at: '2026-10-26T01:00:00Z', ended_at: null, end_reason: null, first_activity_at: null, last_activity_at: null, current_tab: null, visible: true };
describe('every daily CRM session', () => {
  it('splits a saved-login session across both days without requiring another sign-in', () => {
    const rows = splitDailySessions([session], '2026-10-25', '2026-10-26', Date.parse('2026-10-26T02:00:00Z'), 'UTC');
    expect(rows.map(row => row.day)).toEqual(['2026-10-26', '2026-10-25']);
    expect(rows[0].continued).toBe(true);
    expect(rows[0].end).toBe(Date.parse('2026-10-26T01:00:00Z'));
  });
  it('retains every repeat session within a day', () => {
    const repeated = { ...session, id: 'two', started_at: '2026-10-26T09:00:00Z', last_seen_at: '2026-10-26T10:00:00Z' };
    expect(splitDailySessions([session, repeated], '2026-10-26', '2026-10-26', Date.parse('2026-10-26T12:00:00Z'), 'UTC').map(row => row.session.id)).toEqual(['one', 'two']);
  });
  it('does not invent a computer lock or sign-out from a stale saved login', () => {
    expect(sessionOutcome(session, Date.parse('2026-10-26T02:00:00Z'))).toBe('Connection lost / paused (last seen)');
    expect(sessionOutcome({ ...session, end_reason: 'logout', ended_at: session.last_seen_at }, Date.parse(session.last_seen_at))).toBe('Signed out');
  });
  it('accounts for the 25-hour UK clock-change day', () => {
    expect(dayBoundary('2026-10-26', 'Europe/London') - dayBoundary('2026-10-25', 'Europe/London')).toBe(25 * 3600000);
  });
  it('does not include sessions outside the selected dates', () => {
    expect(splitDailySessions([session], '2026-10-27', '2026-10-27', Date.parse('2026-10-28T00:00:00Z'), 'UTC')).toEqual([]);
  });
});