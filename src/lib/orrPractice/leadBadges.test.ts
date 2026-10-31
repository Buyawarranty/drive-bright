import { describe, expect, it } from 'vitest';
import { leadRefFor, leadTypeOf, nextLeadRef } from './leadBadges';

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
  it('hands out sequential BW refs', () => {
    const a = nextLeadRef();
    const b = nextLeadRef();
    expect(a).toMatch(/^BW-\d{5}$/);
    expect(Number(b.slice(3))).toBe(Number(a.slice(3)) + 1);
  });
  it('keeps an existing ref and derives a stable one from the id otherwise', () => {
    expect(leadRefFor('abc', 'BW-90001')).toBe('BW-90001');
    expect(leadRefFor('some-lead-id')).toBe(leadRefFor('some-lead-id'));
    expect(leadRefFor('some-lead-id')).toMatch(/^BW-\d{5}$/);
  });
});
