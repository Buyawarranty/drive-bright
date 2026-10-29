import { describe, it, expect } from 'vitest';
import { applyJourneyEvent, evaluateStages, recordContactOutcome } from './engine';
import { managerMoveHold, openClaim, openClaimCards } from './openClaim';
import { DEFAULT_ORR_PRACTICE_SETTINGS } from './settings';
import { makeSyntheticAgents, makeSyntheticLead } from './syntheticLeads';
import type { PracticeLead } from './types';

const MIN = 60_000;
const T0 = new Date(2026, 9, 29, 10, 0, 0, 0).getTime();
const S = DEFAULT_ORR_PRACTICE_SETTINGS;

const pool = (n: number): PracticeLead[] =>
  evaluateStages(
    Array.from({ length: n }, (_, i) => ({
      ...applyJourneyEvent(makeSyntheticLead(T0 + i, i + 1), { kind: 'quote_details_submitted', at: T0 }),
      tpsClear: true,
      phoneConsent: true,
    })),
    S,
    T0 + 2 * MIN,
  ).leads;

const NOW = T0 + 3 * MIN;

describe('Open Claim', () => {
  it('shows at most three cards with no phone, email or registration', () => {
    const cards = openClaimCards(pool(5), NOW);
    expect(cards).toHaveLength(3);
    const json = JSON.stringify(cards);
    pool(5).forEach(l => {
      expect(json).not.toContain(l.phone);
      expect(json).not.toContain(l.email);
    });
  });

  it('stops an agent taking a third lead while two are unworked', () => {
    const agents = makeSyntheticAgents();
    const a = agents[0].id;
    let leads = pool(5);
    let ag = agents;
    for (let i = 0; i < 2; i++) {
      const id = openClaimCards(leads, NOW)[0].leadId;
      ({ leads, agents: ag } = openClaim(leads, ag, id, a, 'sales', S, NOW));
    }
    const third = openClaim(leads, ag, openClaimCards(leads, NOW)[0].leadId, a, 'sales', S, NOW);
    expect(third.leads.filter(l => l.reservedAgentId === a)).toHaveLength(2);
    expect(third.notes[0]).toContain('Work one');
  });

  it('frees a slot once a call result is logged on a held lead', () => {
    const agents = makeSyntheticAgents();
    const a = agents[0].id;
    let leads = pool(5);
    let ag = agents;
    for (let i = 0; i < 2; i++) {
      ({ leads, agents: ag } = openClaim(leads, ag, openClaimCards(leads, NOW)[0].leadId, a, 'sales', S, NOW));
    }
    const held = leads.find(l => l.reservedAgentId === a)!;
    leads = recordContactOutcome(leads, held.id, { at: NOW, agentId: a, result: 'spoke', source: 'zoiper', durationSeconds: 60 }, S).leads;
    const next = openClaim(leads, ag, openClaimCards(leads, NOW)[0].leadId, a, 'sales', S, NOW);
    expect(next.leads.filter(l => l.stage === 'reserved' && l.reservedAgentId === a)).toHaveLength(2);
  });

  it('gives a contested lead to the first claimer only', () => {
    const agents = makeSyntheticAgents();
    const leads = pool(1);
    const id = leads[0].id;
    const first = openClaim(leads, agents, id, agents[0].id, 'sales', S, NOW);
    const second = openClaim(first.leads, first.agents, id, agents[1].id, 'sales', S, NOW);
    expect(second.leads[0].reservedAgentId).toBe(agents[0].id);
  });

  it('refuses claims from management and viewer seats', () => {
    const agents = makeSyntheticAgents();
    const leads = pool(1);
    const r = openClaim(leads, agents, leads[0].id, agents[0].id, 'viewer', S, NOW);
    expect(r.leads[0].stage).toBe('queued');
  });

  it('lets management move a hold only with a reason, and records it', () => {
    const agents = makeSyntheticAgents();
    const claimed = openClaim(pool(1), agents, pool(1)[0].id, agents[0].id, 'sales', S, NOW);
    const id = claimed.leads[0].id;
    expect(managerMoveHold(claimed.leads, agents, id, agents[1].id, 'sales', 'x', S, NOW).leads[0].reservedAgentId).toBe(agents[0].id);
    expect(managerMoveHold(claimed.leads, agents, id, agents[1].id, 'sales_manager', '', S, NOW).leads[0].reservedAgentId).toBe(agents[0].id);
    const moved = managerMoveHold(claimed.leads, agents, id, agents[1].id, 'sales_manager', 'Agent on break', S, NOW);
    expect(moved.leads[0].reservedAgentId).toBe(agents[1].id);
    expect(moved.leads[0].history.at(-1)).toContain('Agent on break');
  });
});
