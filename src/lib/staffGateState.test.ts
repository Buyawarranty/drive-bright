import { describe, it, expect } from 'vitest';
import { nextStaffGateState, sessionCheckLooksEnded } from './staffGateState';

describe('nextStaffGateState', () => {
  it('keeps an open dashboard open on a transient failure', () => {
    expect(nextStaffGateState('ready', 'transient')).toBe('ready');
  });
  it('applies a definitive expiry', () => {
    expect(nextStaffGateState('ready', 'expired')).toBe('expired');
  });
});

describe('sessionCheckLooksEnded', () => {
  it('treats a network error with no status as still signed in', () => {
    expect(sessionCheckLooksEnded({ message: 'Failed to fetch' }, null)).toBe(false);
  });
  it('treats a server 500 as still signed in', () => {
    expect(sessionCheckLooksEnded({ status: 500 }, null)).toBe(false);
  });
  it('treats 401 and 403 as ended', () => {
    expect(sessionCheckLooksEnded({ status: 401 }, null)).toBe(true);
    expect(sessionCheckLooksEnded({ status: 403 }, null)).toBe(true);
  });
  it('treats a valid user as signed in', () => {
    expect(sessionCheckLooksEnded(null, { id: 'u1' })).toBe(false);
  });
});
