import { describe, expect, it } from 'vitest';
import { acceptOffer, initialRoundRobin, makeOffers, switchMode } from './autoRoundRobin';
import { applyJourneyEvent, claimLead, evaluateStages, recordContactOutcome } from './engine';
import { makeOvernightBatch, runIntakeTick } from './intake';
import { openClaim, openClaimCards } from './openClaim';
import { DEFAULT_ORR_PRACTICE_SETTINGS as S } from './settings';
import { makeSyntheticAgents } from './syntheticLeads';

const T = Date.UTC(2026, 9, 29, 10);
const MIN = 60_000;
const pool = (n = 1) => evaluateStages(makeOvernightBatch(n, T), S, T + 2 * MIN).leads;

describe('Phase 5 repeatable synthetic acceptance', () => {
  it('eventually processes every arrival above the 500-per-pass bound', () => {
    const first = runIntakeTick(makeOvernightBatch(501, T), S, T + 2 * MIN, { lastTickAt: 0 });
    expect(first.leads.filter(l => l.stage === 'queued')).toHaveLength(500);
    expect(first.deferred).toBe(1);
    const next = runIntakeTick(first.leads, S, T + 2 * MIN + 1, first.state);
    expect(next.leads.filter(l => l.stage === 'queued')).toHaveLength(501);
    expect(next.leads.map(l => l.id)).toEqual(first.leads.map(l => l.id));
  });

  it('rechecks the two-unworked-hold limit when an automatic offer is accepted', () => {
    const leads = pool(3);
    const agents = makeSyntheticAgents();
    const offered = makeOffers(leads, agents, switchMode(initialRoundRobin(), 'auto'), T + 2 * MIN).state;
    const offer = offered.offers[0];
    let current = { leads, agents, notes: [] as string[] };
    for (const lead of leads.filter(l => l.id !== offer.leadId)) {
      current = openClaim(current.leads, current.agents, lead.id, offer.agentId, 'sales', S, T + 2 * MIN);
    }
    const result = acceptOffer(current.leads, current.agents, offered, offer.leadId, offer.agentId, S, T + 2 * MIN + 1000);
    expect(result.leads.find(l => l.id === offer.leadId)?.stage).toBe('queued');
    expect(result.state.offers[0].status).not.toBe('accepted');
  });

  it('does not mark an offer accepted if the customer has already bought', () => {
    const leads = pool();
    const agents = makeSyntheticAgents();
    const offered = makeOffers(leads, agents, switchMode(initialRoundRobin(), 'auto'), T + 2 * MIN).state;
    const bought = applyJourneyEvent(leads[0], { kind: 'purchase_completed', at: T + 2 * MIN + 500, amount: 540 });
    const result = acceptOffer([bought], agents, offered, bought.id, offered.offers[0].agentId, S, T + 2 * MIN + 1000);
    expect(result.leads[0].stage).toBe('closed');
    expect(result.state.offers[0].status).toBe('cancelled');
    expect(result.agents).toEqual(agents);
  });

  it('preserves durable ownership when the same customer returns to pricing', () => {
    const lead = pool()[0];
    const held = claimLead([lead], makeSyntheticAgents(), lead.id, 'agent-a', S, T + 2 * MIN);
    const owned = recordContactOutcome(held.leads, lead.id, { at: T + 3 * MIN, agentId: 'agent-a', result: 'spoke', source: 'dial_nine', durationSeconds: 120 }, S).leads[0];
    const returned = applyJourneyEvent(owned, { kind: 'pricing_page_entered', at: T + 4 * MIN });
    const reviewed = evaluateStages([returned], S, T + 6 * MIN).leads;
    expect(reviewed[0].stage).toBe('owned');
    expect(reviewed[0].ownerAgentId).toBe('agent-a');
    expect(openClaimCards(reviewed, T + 6 * MIN)).toHaveLength(0);
  });

  it('preserves an exclusive claim when the customer enters checkout', () => {
    const lead = pool()[0];
    const held = claimLead([lead], makeSyntheticAgents(), lead.id, 'agent-a', S, T + 2 * MIN).leads[0];
    const returned = applyJourneyEvent(held, { kind: 'checkout_entered', at: T + 3 * MIN });
    expect(returned.stage).toBe('reserved');
    expect(returned.reservedAgentId).toBe('agent-a');
    expect(returned.reservedExpiresAt).toBe(T + 5 * MIN);
  });

  it('waits two minutes after abandonment even following a long checkout visit', () => {
    const entered = applyJourneyEvent(pool()[0], { kind: 'checkout_entered', at: T + 2 * MIN });
    const abandoned = applyJourneyEvent(entered, { kind: 'checkout_abandoned', at: T + 12 * MIN });
    expect(evaluateStages([abandoned], S, T + 13 * MIN).leads[0].stage).toBe('awaiting_release');
    expect(evaluateStages([abandoned], S, T + 14 * MIN).leads[0].stage).toBe('queued');
  });
});