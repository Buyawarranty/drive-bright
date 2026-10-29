import { describe, it, expect } from 'vitest';
import { acceptOffer, declineOffer, initialRoundRobin, makeOffers, switchMode } from './autoRoundRobin';
import { makeOvernightBatch, runIntakeTick } from './intake';
import { DEFAULT_ORR_PRACTICE_SETTINGS } from './settings';
import type { PracticeAgent } from './types';

const S = DEFAULT_ORR_PRACTICE_SETTINGS;
const T = Date.UTC(2026, 9, 29, 10, 0);
const agents: PracticeAgent[] = ['a', 'b', 'c'].map(id => ({ id, name: id.toUpperCase(), dailyCap: 10, usedToday: 0, available: true }));
const pool = (n: number) => runIntakeTick(makeOvernightBatch(n, T), S, T + 120_000, { lastTickAt: 0 }).leads;
const NOW = T + 180_000;
const auto = switchMode(initialRoundRobin(), 'auto');

describe('Phase 3 automatic round robin', () => {
  it('offers nothing while in Open Claim mode', () => {
    expect(makeOffers(pool(3), agents, initialRoundRobin(), NOW).state.offers).toHaveLength(0);
  });

  it('offers each lead to one agent in turn, one offer per agent', () => {
    const { state } = makeOffers(pool(4), agents, auto, NOW);
    expect(state.offers.map(o => o.agentId)).toEqual(['a', 'b', 'c']);
  });

  it('carries the rotation on from the last agent offered', () => {
    const leads = pool(4);
    const first = makeOffers(leads, agents, auto, NOW).state;
    const declined = declineOffer(first, first.offers[0].leadId, 'a', NOW + 1000);
    const next = makeOffers(leads, agents, declined, NOW + 1000).state;
    const newest = next.offers.filter(o => o.status === 'open' && o.offeredAt === NOW + 1000);
    expect(newest.map(o => o.agentId)).toEqual(['a']);
    expect(newest[0].leadId).not.toBe(first.offers[0].leadId);
  });

  it('lapses an offer after 20 seconds and moves it to the next agent', () => {
    const leads = pool(1);
    const first = makeOffers(leads, agents, auto, NOW).state;
    expect(first.offers[0].agentId).toBe('a');
    const later = makeOffers(leads, agents, first, NOW + 20_000).state;
    expect(later.offers[0].status).toBe('timed_out');
    expect(later.offers[1].agentId).toBe('b');
  });

  it('refuses a late acceptance after 20 seconds', () => {
    const leads = pool(1);
    const s = makeOffers(leads, agents, auto, NOW).state;
    const r = acceptOffer(leads, agents, s, leads[0].id, 'a', S, NOW + 20_000);
    expect(r.leads[0].stage).toBe('queued');
  });

  it('turns an accepted offer into the usual 3-minute hold', () => {
    const leads = pool(1);
    const s = makeOffers(leads, agents, auto, NOW).state;
    const r = acceptOffer(leads, agents, s, leads[0].id, 'a', S, NOW + 5000);
    expect(r.leads[0].reservedAgentId).toBe('a');
    expect(r.leads[0].reservedExpiresAt).toBe(NOW + 5000 + 3 * 60_000);
  });

  it('never offers a lead to an agent who already declined it', () => {
    const leads = pool(1);
    let s = makeOffers(leads, agents, auto, NOW).state;
    for (const id of ['a', 'b', 'c']) {
      s = declineOffer(s, leads[0].id, id, NOW);
      s = makeOffers(leads, agents, s, NOW).state;
    }
    expect(s.offers.filter(o => o.status === 'open')).toHaveLength(0);
  });

  it('cancels open offers when switching back to Open Claim', () => {
    const s = makeOffers(pool(2), agents, auto, NOW).state;
    expect(switchMode(s, 'open_claim').offers.every(o => o.status === 'cancelled')).toBe(true);
  });

  it('never offers an owned lead', () => {
    const leads = pool(1).map(l => ({ ...l, ownerAgentId: 'b' }));
    expect(makeOffers(leads, agents, auto, NOW).state.offers).toHaveLength(0);
  });
});
