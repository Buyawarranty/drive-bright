import { describe, expect, it } from 'vitest';
import { leadRefFor, leadTypeOf, nextPracticeReg } from './leadBadges';

describe('leadTypeOf', () => {
  it('marks callback statuses as Callback regardless of arrival time', () => {
    expect(leadTypeOf(new Date('2026-10-31T10:00:00').getTime(), 'callback_booked')).toBe('callback');
    expect(leadTypeOf(new Date('2026-10-31T10:00:00').getTime(), 'urgent_callback')).toBe('callback');
  });
  it('marks arrivals before 9am or from 6pm as Overnight', () => {
    expect(leadTypeOf(new Date('2026-10-31T07:30:00').getTime(), 'new')).toBe('overnight');
    expect(leadTypeOf(new Date('2026-10-31T21:15:00').getTime(), 'new')).toBe('overnight');
  });
  it('marks staffed-hours arrivals as Live', () => {
    expect(leadTypeOf(new Date('2026-10-31T11:00:00').getTime(), 'new')).toBe('live');
  });
});

describe('lead refs', () => {
  it('uses the registration plate that comes with the lead', () => {
    expect(leadRefFor('bv24 aaa')).toBe('BV24 AAA');
    expect(leadRefFor('  BV24 AAB  ')).toBe('BV24 AAB');
  });
  it('shows nothing when the lead arrived without a plate', () => {
    expect(leadRefFor('')).toBe('');
    expect(leadRefFor(undefined)).toBe('');
    expect(leadRefFor(null)).toBe('');
  });
  it('hands out a fresh, distinct practice plate for every made-up lead', () => {
    const a = nextPracticeReg();
    const b = nextPracticeReg();
    expect(a).toMatch(/^BW24 [A-Z]{3}$/);
    expect(b).toMatch(/^BW24 [A-Z]{3}$/);
    expect(a).not.toBe(b);
  });
});
