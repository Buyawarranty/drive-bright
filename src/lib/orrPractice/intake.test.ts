import { describe, it, expect } from 'vitest';
import {
  eligibleMinutesBetween,
  inUkWindow,
  isPresent,
  makeOvernightBatch,
  presentAgents,
  queueViews,
  runIntakeTick,
} from './intake';
import { allocateQueued, applyJourneyEvent } from './engine';
import { openClaimCards } from './openClaim';
import { canAttemptContact } from './contactSafety';
import { DEFAULT_ORR_PRACTICE_SETTINGS } from './settings';
import { makeSyntheticAgents } from './syntheticLeads';

const MIN = 60_000;
const S = DEFAULT_ORR_PRACTICE_SETTINGS;
// Thursday 29 Oct 2026 02:00 UK (GMT), overnight.
const NIGHT = Date.UTC(2026, 9, 29, 2, 0);

describe('Phase 2 intake and recycling', () => {
  it('queues 50 overnight enquiries with nobody on shift and shows them as overnight', () => {
    const batch = makeOvernightBatch(50, NIGHT);
    const tick = runIntakeTick(batch, S, NIGHT + 2 * MIN, { lastTickAt: 0 });
    const views = queueViews(tick.leads, S);
    expect(views.overnight).toHaveLength(50);
    const none = allocateQueued(tick.leads, presentAgents(makeSyntheticAgents(), {}, NIGHT + 2 * MIN), S, NIGHT + 2 * MIN);
    expect(none.leads.filter(l => l.stage === 'reserved')).toHaveLength(0);
  });

  it('blocks a telephone approach overnight even though the lead is in the pool', () => {
    const tick = runIntakeTick(makeOvernightBatch(1, NIGHT), S, NIGHT + 2 * MIN, { lastTickAt: 0 });
    expect(canAttemptContact(tick.leads[0], S, NIGHT + 2 * MIN).allowed).toBe(false);
  });

  it('runs the same tick twice without changing anything', () => {
    const first = runIntakeTick(makeOvernightBatch(3, NIGHT), S, NIGHT + 2 * MIN, { lastTickAt: 0 });
    const again = runIntakeTick(first.leads, S, NIGHT + 2 * MIN, first.state);
    expect(again.leads).toBe(first.leads);
  });

  it('counts only calling-hours minutes towards waiting time', () => {
    // 02:00 to 10:00 UK on a Thursday: only 09:00 to 10:00 counts.
    expect(eligibleMinutesBetween(S, NIGHT, NIGHT + 8 * 60 * MIN)).toBe(60);
  });

  it('uses UK time across the clocks changing: 09:30 BST is 08:30 UTC', () => {
    const bstMorning = Date.UTC(2026, 6, 16, 8, 30); // Thursday 16 July 2026
    expect(inUkWindow(S, bstMorning)).toBe(true);
    const gmtSameUtc = Date.UTC(2026, 10, 19, 8, 30); // Thursday 19 Nov, 08:30 GMT
    expect(inUkWindow(S, gmtSameUtc)).toBe(false);
  });

  it('treats an agent as away two minutes after their last heartbeat', () => {
    expect(isPresent({ a: NIGHT }, 'a', NIGHT + 1 * MIN)).toBe(true);
    expect(isPresent({ a: NIGHT }, 'a', NIGHT + 2 * MIN)).toBe(false);
  });

  it('keeps a call-back request out of the pool until the time asked for', () => {
    const [lead] = makeOvernightBatch(1, NIGHT);
    const cb = applyJourneyEvent(lead, { kind: 'callback_requested', at: NIGHT, callbackAt: NIGHT + 8 * 60 * MIN });
    const tick = runIntakeTick([cb], S, NIGHT + 5 * MIN, { lastTickAt: 0 });
    expect(queueViews(tick.leads, S).callbacks).toHaveLength(1);
  });

  it('shows the oldest enquiry first so recycled leads are never starved', () => {
    const early = makeOvernightBatch(1, NIGHT, 1)[0];
    const late = makeOvernightBatch(1, NIGHT + MIN, 2)[0];
    let leads = runIntakeTick([late, early], S, NIGHT + 10 * MIN, { lastTickAt: 0 }).leads;
    leads = leads.map(l => (l.id === early.id ? { ...l, releaseCount: 3, lastStageChangeAt: NIGHT + 9 * MIN } : l));
    expect(openClaimCards(leads, NIGHT + 10 * MIN)[0].leadId).toBe(early.id);
  });
});
