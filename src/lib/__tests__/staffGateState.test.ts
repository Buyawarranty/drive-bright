import { describe, it, expect } from 'vitest';
import { nextStaffGateState } from '../staffGateState';

describe('nextStaffGateState', () => {
  it('keeps an open dashboard open when a background check fails transiently', () => {
    expect(nextStaffGateState('ready', 'transient')).toBe('ready');
  });
  it('shows the retry screen when the first check cannot finish', () => {
    expect(nextStaffGateState('loading', 'transient')).toBe('error');
  });
  it('still locks the dashboard when the server says the password expired', () => {
    expect(nextStaffGateState('ready', 'expired')).toBe('expired');
  });
  it('still locks the dashboard when the server says the device is not approved', () => {
    expect(nextStaffGateState('ready', 'device')).toBe('device');
  });
  it('recovers from the retry screen once a check succeeds', () => {
    expect(nextStaffGateState('error', 'ready')).toBe('ready');
  });
});
