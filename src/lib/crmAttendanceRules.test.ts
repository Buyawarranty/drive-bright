import { describe, expect, it } from 'vitest';
import { canViewCrmAttendance, crmAttendanceStatus, isMeaningfulCrmEvent } from './crmAttendanceRules';

describe('meaningful CRM attendance', () => {
  it('never counts mouse movement, focus or opening a tab as work', () => {
    for (const type of ['mousemove', 'pointermove', 'focus', 'visibilitychange']) expect(isMeaningfulCrmEvent(type, true, true, true)).toBe(false);
  });
  it('counts real scrolling and CRM use', () => {
    for (const type of ['scroll', 'input', 'change', 'paste', 'click']) expect(isMeaningfulCrmEvent(type, true, true, true)).toBe(true);
  });
  it('rejects synthetic, hidden and irrelevant interactions', () => {
    expect(isMeaningfulCrmEvent('scroll', false, true, true)).toBe(false);
    expect(isMeaningfulCrmEvent('input', true, false, true)).toBe(false);
    expect(isMeaningfulCrmEvent('click', true, true, false)).toBe(false);
  });
  it('does not classify a heartbeat alone as active work', () => {
    expect(crmAttendanceStatus({ ended_at: null, last_seen_at: new Date(120000).toISOString(), last_activity_at: new Date(0).toISOString(), visible: true }, 120000)).toBe('idle');
  });
  it('signed-out sessions are offline even with recent use', () => {
    expect(crmAttendanceStatus({ ended_at: new Date(0).toISOString(), last_seen_at: new Date(0).toISOString(), last_activity_at: new Date(0).toISOString(), visible: true }, 1000)).toBe('offline');
  });
  it('limits all-staff reports to management, never sales or sales leads', () => {
    for (const role of ['sales', 'sales_lead', 'accounts', 'claims_agent', 'performance_manager']) expect(canViewCrmAttendance(role)).toBe(false);
    for (const role of ['admin', 'super_admin', 'sales_manager']) expect(canViewCrmAttendance(role)).toBe(true);
  });
});