import { CRM_ACTIVE_WINDOW_MS } from './crmAttendanceRules';
import { nextDay, splitDailySessions, type CrmSession, type DailySession } from './crmSessionTimeline';
import type { CrmAuditZone } from './crmAuditTime';

export interface ActivityDay { admin_user_id: string; day: string; active_seconds: number }
export interface TimeSpan { start: number; end: number }
export interface StaffActivityDay {
  key: string; staffId: string; day: string; sessions: DailySession[];
  idle: TimeSpan[]; idleSeconds: number; activeSeconds: number;
}
export function mergeSpans(spans: TimeSpan[]): TimeSpan[] {
  const result: TimeSpan[] = [];
  for (const span of spans.filter(s => s.end > s.start).sort((a, b) => a.start - b.start)) {
    const last = result[result.length - 1];
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else result.push({ ...span });
  }
  return result;
}
// Only the tail after the final observed interaction is recoverable from legacy
// session endpoints. Interior activity/idle transitions were not retained.
export function observedIdleSpans(rows: DailySession[]): TimeSpan[] {
  const candidates: TimeSpan[] = [];
  const unknown: TimeSpan[] = [];
  for (const row of rows) {
    const last = row.session.last_activity_at ? Date.parse(row.session.last_activity_at) : NaN;
    if (!Number.isFinite(last)) { unknown.push({ start: row.start, end: row.end }); continue; }
    const idleStart = Math.max(row.start, last + CRM_ACTIVE_WINDOW_MS);
    unknown.push({ start: row.start, end: Math.min(idleStart, row.end) });
    if (idleStart < row.end) candidates.push({ start: idleStart, end: row.end });
  }
  let result = mergeSpans(candidates);
  // Another concurrent browser tab may have activity; never call that time idle.
  for (const block of mergeSpans(unknown)) result = result.flatMap(span => {
    if (block.end <= span.start || block.start >= span.end) return [span];
    return [{ start: span.start, end: Math.min(span.end, block.start) }, { start: Math.max(span.start, block.end), end: span.end }].filter(s => s.end > s.start);
  });
  return result;
}
export function dailyStaffActivity(staffIds: string[], sessions: CrmSession[], totals: ActivityDay[], from: string, to: string, now: number, zone: CrmAuditZone): StaffActivityDay[] {
  const daily = splitDailySessions(sessions, from, to, now, zone);
  const rows: StaffActivityDay[] = [];
  for (let day = from; day <= to; day = nextDay(day)) {
    for (const staffId of staffIds) {
      const entries = daily.filter(row => row.day === day && row.session.admin_user_id === staffId);
      const idle = observedIdleSpans(entries);
      rows.push({ key: `${day}:${staffId}`, staffId, day, sessions: entries, idle,
        idleSeconds: idle.reduce((sum, span) => sum + (span.end - span.start) / 1000, 0),
        activeSeconds: totals.filter(row => row.day === day && row.admin_user_id === staffId).reduce((sum, row) => sum + Math.max(0, row.active_seconds), 0) });
    }
  }
  return rows.sort((a, b) => b.day.localeCompare(a.day));
}
export function activityDuration(seconds: number): string {
  const value = Math.floor(Math.max(0, seconds));
  return `${Math.floor(value / 3600)}h ${Math.floor(value % 3600 / 60)}m ${value % 60}s`;
}