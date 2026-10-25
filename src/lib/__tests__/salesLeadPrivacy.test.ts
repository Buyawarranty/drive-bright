import { describe, expect, it } from 'vitest';
import { canSelectQuoteLead, showPersonalAttendanceBar } from '../salesLeadPrivacy';

describe.each(['sales', 'sales_lead'])('%s privacy', role => {
  it('imports only own assigned leads', () => {
    expect(canSelectQuoteLead(role, 'self', { id: 'lead', assigned_to: 'self' })).toBe(true);
    expect(canSelectQuoteLead(role, 'self', { id: 'lead', assigned_to: 'other' })).toBe(false);
  });
  it('rejects unassigned leads and missing identity', () => {
    expect(canSelectQuoteLead(role, 'self', { id: 'lead', assigned_to: null })).toBe(false);
    expect(canSelectQuoteLead(role, null, { id: 'lead', assigned_to: 'self' })).toBe(false);
  });
  it('does not import customer/cart shortcuts', () => {
    expect(canSelectQuoteLead(role, 'self', { id: 'cart:1', assigned_to: 'self' })).toBe(false);
    expect(canSelectQuoteLead(role, 'self', { id: 'customer:1', assigned_to: 'self' })).toBe(false);
  });
  it('defaults attendance bar off and honours individual on/off', () => {
    expect(showPersonalAttendanceBar(role)).toBe(false);
    expect(showPersonalAttendanceBar(role, false)).toBe(false);
    expect(showPersonalAttendanceBar(role, true)).toBe(true);
  });
});
it('preserves management import and bar visibility', () => {
  for (const role of ['admin', 'super_admin', 'sales_manager']) {
    expect(canSelectQuoteLead(role, 'self', { id: 'lead', assigned_to: 'other' })).toBe(true);
    expect(showPersonalAttendanceBar(role, false)).toBe(true);
  }
});
it('fails closed while role is unresolved', () => {
  expect(canSelectQuoteLead(null, 'self', { id: 'lead', assigned_to: 'self' })).toBe(false);
  expect(showPersonalAttendanceBar(null, true)).toBe(false);
});