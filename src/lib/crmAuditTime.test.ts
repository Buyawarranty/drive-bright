import { expect, it } from 'vitest';
import { formatCrmAuditTime } from './crmAuditTime';

it('keeps GMT timestamps at UTC even during British summer time', () => {
  expect(formatCrmAuditTime('2026-07-01T09:15:30Z')).toBe('01 Jul 2026, 09:15:30');
  expect(formatCrmAuditTime('2026-07-01T09:15:30Z', 'Europe/London')).toBe('01 Jul 2026, 10:15:30');
});
it('shows full dates for historical sign-ins and handles missing timestamps', () => {
  expect(formatCrmAuditTime('2026-10-26T22:28:00Z')).toBe('26 Oct 2026, 22:28:00');
  expect(formatCrmAuditTime(null)).toBe('—');
});