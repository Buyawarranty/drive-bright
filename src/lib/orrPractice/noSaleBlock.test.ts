import { describe, expect, it } from 'vitest';
import {
  noSaleBlockedIds,
  noSaleBlockStatus,
  saleFreeWorkingDaysBetween,
} from './noSaleBlock';

// 2026-11-02 is a Monday (GMT, so UK date keys match UTC dates here).
const MON = Date.parse('2026-11-02T12:00:00Z');
const TUE = Date.parse('2026-11-03T12:00:00Z');
const WED = Date.parse('2026-11-04T12:00:00Z');
const THU = Date.parse('2026-11-05T12:00:00Z');
const FRI = Date.parse('2026-11-06T12:00:00Z');
const NEXT_MON = Date.parse('2026-11-09T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const agent = (over: Partial<Parameters<typeof noSaleBlockStatus>[0]> = {}) => ({
  id: 'a1',
  startedAt: Date.parse('2025-01-06T09:00:00Z'), // long past any grace period
  lastSaleAt: null,
  ...over,
});

describe('ORR no-sale block ladder', () => {
  it('counts working days only — Sunday never counts', () => {
    // Sold Friday lunch; by next Monday lunch Saturday and Monday count, Sunday is skipped.
    expect(saleFreeWorkingDaysBetween(FRI, NEXT_MON)).toBe(2);
  });

  it('skips recorded days off', () => {
    expect(saleFreeWorkingDaysBetween(MON, THU, ['2026-11-04'])).toBe(2);
  });

  it('1 sale-free day = 1 day out, 2 = 2, 3 = 3', () => {
    expect(noSaleBlockStatus(agent({ lastSaleAt: MON }), TUE).blockedDays).toBe(1);
    expect(noSaleBlockStatus(agent({ lastSaleAt: MON }), WED).blockedDays).toBe(2);
    expect(noSaleBlockStatus(agent({ lastSaleAt: MON }), THU).blockedDays).toBe(3);
  });

  it('caps at 3 days and flags management review instead of growing', () => {
    const r = noSaleBlockStatus(agent({ lastSaleAt: MON }), NEXT_MON);
    expect(r.blockedDays).toBe(3);
    expect(r.saleFreeWorkingDays).toBe(6);
    expect(r.needsManagementReview).toBe(true);
  });

  it('any confirmed sale resets the count to zero', () => {
    const r = noSaleBlockStatus(agent({ lastSaleAt: NEXT_MON }), NEXT_MON + 2 * 60 * 60 * 1000);
    expect(r.blockedDays).toBe(0);
    expect(r.needsManagementReview).toBe(false);
  });

  it('new starters are exempt for their first 14 calendar days', () => {
    const started = Date.parse('2026-11-02T09:00:00Z');
    const inside = noSaleBlockStatus(agent({ startedAt: started }), started + 10 * DAY);
    expect(inside.inGracePeriod).toBe(true);
    expect(inside.blockedDays).toBe(0);
  });

  it('after the grace period a never-sold starter joins the ladder', () => {
    const started = Date.parse('2026-10-19T09:00:00Z'); // grace ends Mon 2026-11-02
    const r = noSaleBlockStatus(agent({ startedAt: started }), THU);
    expect(r.inGracePeriod).toBe(false);
    expect(r.blockedDays).toBe(3);
  });

  it('can be switched off entirely', () => {
    const r = noSaleBlockStatus(agent({ lastSaleAt: MON }), NEXT_MON, { noSaleBlockEnabled: false });
    expect(r.blockedDays).toBe(0);
  });

  it('clamps a manager-set cap above 7 back to 7', () => {
    const r = noSaleBlockStatus(agent({ lastSaleAt: MON }), MON + 20 * DAY, { maxNoSaleBlockDays: 99 });
    expect(r.blockedDays).toBe(7);
  });

  it('noSaleBlockedIds lists only held-out agents', () => {
    const ids = noSaleBlockedIds(
      [
        agent({ id: 'cold', lastSaleAt: MON }),
        agent({ id: 'hot', lastSaleAt: THU }),
        agent({ id: 'rookie', startedAt: WED }),
      ],
      THU,
    );
    expect(ids).toEqual(['cold']);
  });
});
