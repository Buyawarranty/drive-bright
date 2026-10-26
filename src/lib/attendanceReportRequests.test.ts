import { describe, expect, it } from 'vitest';
import { AttendanceReportRequests } from './attendanceReportRequests';
describe('historical attendance date changes', () => {
  it('loads yesterday immediately while today is still pending', () => {
    const requests = new AttendanceReportRequests();
    requests.select('2026-10-26');
    const today = requests.begin('2026-10-26');
    requests.select('2026-10-25');
    const yesterday = requests.begin('2026-10-25');
    expect(yesterday).toBeDefined();
    if (!today || !yesterday) throw new Error('Missing report request');
    expect(requests.isCurrent('2026-10-26', today)).toBe(false);
    expect(requests.isCurrent('2026-10-25', yesterday)).toBe(true);
  });
  it('deduplicates only the same selected range and allows another refresh afterwards', () => {
    const requests = new AttendanceReportRequests();
    const first = requests.begin('yesterday');
    expect(requests.begin('yesterday')).toBeUndefined();
    if (!first) throw new Error('Missing report request');
    requests.finish('yesterday', first);
    expect(requests.begin('yesterday')).toBeDefined();
  });
});