import { describe, expect, it } from 'vitest';
import { dailyStaffActivity, groupActivityByAgent, observedIdleSpans } from './crmDailyActivity';
import { splitDailySessions, type CrmSession } from './crmSessionTimeline';
const session: CrmSession = { id: 'a', admin_user_id: 'staff', started_at: '2026-10-26T09:00:00Z', last_seen_at: '2026-10-26T10:00:00Z', first_activity_at: '2026-10-26T09:01:00Z', last_activity_at: '2026-10-26T09:20:00Z', ended_at: null, end_reason: null, visible: true, current_tab: null };
const now = Date.parse('2026-10-26T12:00:00Z');
const split = (sessions: CrmSession[]) => splitDailySessions(sessions, '2026-10-26', '2026-10-26', now, 'UTC');
describe('daily recorded active and available idle evidence', () => {
  it('starts available idle after the existing 60-second activity window, stopping at last seen', () => {
    expect(observedIdleSpans(split([session]))).toEqual([{ start: Date.parse('2026-10-26T09:21:00Z'), end: Date.parse('2026-10-26T10:00:00Z') }]);
  });
  it('never invents idle for history without recorded interactions', () => {
    expect(observedIdleSpans(split([{ ...session, first_activity_at: null, last_activity_at: null }]))).toEqual([]);
  });
  it('does not count another overlapping session with unknown activity as idle', () => {
    const overlap = { ...session, id: 'b', started_at: '2026-10-26T09:30:00Z', last_seen_at: '2026-10-26T10:00:00Z', last_activity_at: null };
    expect(observedIdleSpans(split([session, overlap]))).toEqual([{ start: Date.parse('2026-10-26T09:21:00Z'), end: Date.parse('2026-10-26T09:30:00Z') }]);
  });
  it('merges repeated overlapping idle evidence without doubling duration', () => {
    const rows = dailyStaffActivity(['staff'], [session, { ...session, id: 'b' }], [{ admin_user_id: 'staff', day: '2026-10-26', active_seconds: 300 }], '2026-10-26', '2026-10-26', now, 'UTC');
    expect(rows[0].idleSeconds).toBe(39 * 60);
    expect(rows[0].activeSeconds).toBe(300);
  });
  it('includes every selected staff member on every selected day, including no-data days', () => {
    const rows = dailyStaffActivity(['staff', 'other'], [session], [], '2026-10-25', '2026-10-26', now, 'UTC');
    expect(rows).toHaveLength(4);
    expect(rows.find(row => row.staffId === 'other' && row.day === '2026-10-25')?.sessions).toEqual([]);
  });
});
describe('individual agent review', () => {
  const person = { ...session, admin_user_id: 'a' };
  const totals: ActivityDay[] = [{ admin_user_id: 'a', day: '2026-10-26', active_seconds: 600 }, { admin_user_id: 'b', day: '2026-10-26', active_seconds: 120 }];
  it('keeps every recorded day for one agent together under that agent', () => {
    const agents = groupActivityByAgent(dailyStaffActivity(['a', 'b'], [person], totals, '2026-10-25', '2026-10-26', now, 'UTC'));
    expect(agents.map(agent => agent.staffId)).toEqual(['a', 'b']);
    expect(agents[0].days.map(day => day.day)).toEqual(['2026-10-26', '2026-10-25']);
    expect(agents[0].activeSeconds).toBe(600);
    expect(agents[1].activeSeconds).toBe(120);
  });
  it('lists an agent with no recorded activity individually rather than hiding them', () => {
    const agents = groupActivityByAgent(dailyStaffActivity(['a', 'quiet'], [person], [], '2026-10-26', '2026-10-26', now, 'UTC'));
    expect(agents.map(agent => agent.staffId)).toEqual(['a', 'quiet']);
    expect(agents[0].sessionCount).toBe(1);
    expect(agents[1].sessionCount).toBe(0);
  });
});