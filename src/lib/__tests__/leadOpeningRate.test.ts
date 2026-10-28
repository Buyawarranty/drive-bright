import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPENING_THRESHOLD,
  describeActivity,
  isRapidOpening,
  phoneTail,
  summariseOpenings,
  type AccessEvent,
  type DialAttempt,
} from '../../../supabase/functions/_shared/leadOpeningRate';

const MINUTE = 60_000;
const ACTOR = '11111111-1111-4111-8111-111111111111';

const eventsFor = (count: number, startAt = 0): AccessEvent[] =>
  Array.from({ length: count }, (_, i) => ({
    actorId: ACTOR,
    leadId: `lead-${i}`,
    occurredAt: startAt + i * 1000,
  }));

const phonesFor = (count: number): Map<string, string> =>
  new Map(Array.from({ length: count }, (_, i) => [`lead-${i}`, `077009000${String(i).padStart(2, '0')}`]));

const dialsFor = (
  count: number,
  over: Partial<DialAttempt> = {},
): DialAttempt[] =>
  Array.from({ length: count }, (_, i) => ({
    actorId: ACTOR,
    leadId: `lead-${i}`,
    at: i * 1000 + 500,
    phone: `077009000${String(i).padStart(2, '0')}`,
    connected: false,
    ...over,
  }));

describe('rapid lead-opening alert', () => {
  it('never flags someone dialling, even when nobody answers', () => {
    const events = eventsFor(40);
    const activity = summariseOpenings(events, phonesFor(40), dialsFor(40, { connected: false }));
    const summary = activity.get(ACTOR)!;
    expect(summary.opened).toBe(40);
    expect(summary.withDial).toBe(40);
    expect(summary.connected).toBe(0);
    expect(summary.noDial).toBe(0);
    expect(isRapidOpening(summary)).toBe(false);
  });

  it('flags openings that no call followed', () => {
    const events = eventsFor(DEFAULT_OPENING_THRESHOLD);
    const summary = summariseOpenings(events, phonesFor(DEFAULT_OPENING_THRESHOLD), []).get(ACTOR)!;
    expect(summary.noDial).toBe(DEFAULT_OPENING_THRESHOLD);
    expect(isRapidOpening(summary)).toBe(true);
  });

  it('leaves one below the limit alone', () => {
    const events = eventsFor(DEFAULT_OPENING_THRESHOLD - 1);
    const summary = summariseOpenings(events, phonesFor(DEFAULT_OPENING_THRESHOLD - 1), []).get(ACTOR)!;
    expect(summary.noDial).toBe(DEFAULT_OPENING_THRESHOLD - 1);
    expect(isRapidOpening(summary)).toBe(false);
  });

  it('matches a dial written in another format to the lead it rang', () => {
    const events: AccessEvent[] = [{ actorId: ACTOR, leadId: 'lead-0', occurredAt: 0 }];
    const phones = new Map([['lead-0', '07960 123 456']]);
    const dials: DialAttempt[] = [
      { actorId: ACTOR, at: 8_000, phone: '+447960123456', connected: true },
    ];
    const summary = summariseOpenings(events, phones, dials).get(ACTOR)!;
    expect(summary.withDial).toBe(1);
    expect(summary.connected).toBe(1);
    expect(summary.noDial).toBe(0);
  });

  it('ignores a call made by someone else, or made long afterwards', () => {
    const events: AccessEvent[] = [{ actorId: ACTOR, leadId: 'lead-0', occurredAt: 0 }];
    const phones = new Map([['lead-0', '07960123456']]);
    const otherActor: DialAttempt[] = [
      { actorId: '22222222-2222-4222-8222-222222222222', leadId: 'lead-0', at: 1_000, connected: true },
    ];
    const muchLater: DialAttempt[] = [{ actorId: ACTOR, leadId: 'lead-0', at: 10 * MINUTE, connected: true }];
    expect(summariseOpenings(events, phones, otherActor).get(ACTOR)!.noDial).toBe(1);
    expect(summariseOpenings(events, phones, muchLater).get(ACTOR)!.noDial).toBe(1);
  });

  it('keeps the phone tail rule honest', () => {
    expect(phoneTail('07960 123 456')).toBe('960123456');
    expect(phoneTail('+44 7960 123456')).toBe('960123456');
    expect(phoneTail('020 7946 0958')).toBe('079460958');
    expect(phoneTail(null)).toBe('');
    expect(phoneTail('12345')).toBe('');
  });

  it('describes the activity the same way everywhere', () => {
    expect(describeActivity({ actorId: ACTOR, opened: 32, withDial: 1, connected: 0, noDial: 31 })).toEqual([
      'Opened or copied 32 leads',
      'Called 1 of them',
      'Reached 0',
      'No call made to 31',
    ]);
  });
});
