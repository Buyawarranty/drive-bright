import { crmAttendanceStatus } from './crmAttendanceRules';
import type { CrmAuditZone } from './crmAuditTime';

export interface CrmSession {
  id: string; admin_user_id: string; started_at: string; last_seen_at: string;
  first_activity_at: string | null; last_activity_at: string | null;
  ended_at: string | null; end_reason: string | null; current_tab: string | null; visible: boolean;
}
export interface DailySession { session: CrmSession; day: string; start: number; end: number; dayStart: number; dayEnd: number; continued: boolean }
export function calendarDay(value: number, zone: CrmAuditZone): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}
export function dayBoundary(day: string, zone: CrmAuditZone): number {
  const target = Date.parse(`${day}T00:00:00Z`);
  if (zone === 'UTC') return target;
  let value = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(value);
    const get = (type: string) => parts.find(part => part.type === type)?.value || '00';
    const rendered = Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
    value += target - rendered;
  }
  return value;
}
export function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
}
export function sessionOutcome(session: CrmSession, now: number): string {
  if (session.end_reason === 'logout') return 'Signed out';
  if (session.ended_at) return 'Left CRM';
  if (crmAttendanceStatus(session, now) === 'offline') return 'Connection lost / paused (last seen)';
  return session.visible ? 'Online' : 'Tab hidden';
}
export function splitDailySessions(sessions: CrmSession[], from: string, to: string, now: number, zone: CrmAuditZone): DailySession[] {
  const result: DailySession[] = [];
  for (const session of sessions) {
    const start = Date.parse(session.started_at);
    // Never fill an unobserved gap or extend a stale session to the present.
    const end = Math.min(now, Date.parse(session.ended_at || session.last_seen_at));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    let day = calendarDay(start, zone);
    if (day < from) day = from;
    while (day <= to) {
      const dayStart = dayBoundary(day, zone);
      const dayEnd = dayBoundary(nextDay(day), zone);
      if (dayStart > end) break;
      if (start < dayEnd && end >= dayStart) result.push({ session, day, start: Math.max(start, dayStart), end: Math.min(end, dayEnd), dayStart, dayEnd, continued: start < dayStart });
      day = nextDay(day);
    }
  }
  return result.sort((a, b) => b.day.localeCompare(a.day) || a.start - b.start);
}