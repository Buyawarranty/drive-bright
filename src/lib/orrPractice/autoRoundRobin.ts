import type { PracticeAgent, PracticeLead } from './types';
import type { OrrPracticeSettings } from './settings';
import { claimLead } from './engine';
import { OPEN_CLAIM_UNWORKED_LIMIT, unworkedHolds } from './openClaim';

/**
 * Phase 3: Automatic Round Robin, rehearsed on made-up leads in the browser.
 * Each pool lead is offered to one agent at a time for 20 seconds. Accepting
 * creates the same 3-minute hold as Open Claim; declining or letting it lapse
 * moves the offer to the next agent in turn. Owned leads are never offered.
 */
export const OFFER_SECONDS = 20;

export type AllocationMode = 'open_claim' | 'auto';

export interface Offer {
  leadId: string;
  agentId: string;
  offeredAt: number;
  expiresAt: number;
  status: 'open' | 'accepted' | 'declined' | 'timed_out' | 'cancelled';
}

export interface RoundRobinState {
  mode: AllocationMode;
  /** Id of the last agent offered a lead; rotation resumes after them. */
  lastAgentId: string | null;
  offers: Offer[];
}

export const initialRoundRobin = (): RoundRobinState => ({ mode: 'open_claim', lastAgentId: null, offers: [] });

const canTakeOffer = (agent: PracticeAgent, leads: PracticeLead[]) =>
  agent.available &&
  agent.dailyCap > 0 &&
  agent.usedToday < agent.dailyCap &&
  unworkedHolds(leads, agent.id).length < OPEN_CLAIM_UNWORKED_LIMIT;

/** Lapses any open offer past its 20 seconds. */
export const expireOffers = (state: RoundRobinState, at: number): RoundRobinState => ({
  ...state,
  offers: state.offers.map(o => (o.status === 'open' && at >= o.expiresAt ? { ...o, status: 'timed_out' } : o)),
});

/** Switching mode cancels every open offer so nothing is left half-done. */
export const switchMode = (state: RoundRobinState, mode: AllocationMode): RoundRobinState => ({
  ...state,
  mode,
  offers: state.offers.map(o => (o.status === 'open' ? { ...o, status: 'cancelled' } : o)),
});

/**
 * Sends new offers. Rotation is by agent id order and carries on from the last
 * agent offered, so nobody is fed ahead of the others. An agent never sees two
 * offers at once, and is not re-offered a lead they already turned down.
 */
export const makeOffers = (
  leads: PracticeLead[],
  agents: PracticeAgent[],
  input: RoundRobinState,
  at: number,
): { state: RoundRobinState; notes: string[] } => {
  let state = expireOffers(input, at);
  if (state.mode !== 'auto') return { state, notes: [] };
  const ring = [...agents].sort((a, b) => a.id.localeCompare(b.id));
  if (!ring.length) return { state, notes: [] };
  const notes: string[] = [];
  const open = () => state.offers.filter(o => o.status === 'open');

  const pool = leads
    .filter(l => l.stage === 'queued' && !l.ownerAgentId && !l.suppressed && !l.purchased)
    .filter(l => !open().some(o => o.leadId === l.id))
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const lead of pool) {
    const refused = new Set(
      state.offers.filter(o => o.leadId === lead.id && o.offeredAt >= lead.lastStageChangeAt && o.status !== 'cancelled').map(o => o.agentId),
    );
    const startIdx = state.lastAgentId ? ring.findIndex(a => a.id === state.lastAgentId) + 1 : 0;
    let chosen: PracticeAgent | null = null;
    for (let step = 0; step < ring.length; step += 1) {
      const agent = ring[(startIdx + step) % ring.length];
      if (refused.has(agent.id)) continue;
      if (open().some(o => o.agentId === agent.id)) continue;
      if (!canTakeOffer(agent, leads)) continue;
      chosen = agent;
      break;
    }
    if (!chosen) continue;
    state = {
      ...state,
      lastAgentId: chosen.id,
      offers: [...state.offers, { leadId: lead.id, agentId: chosen.id, offeredAt: at, expiresAt: at + OFFER_SECONDS * 1000, status: 'open' }],
    };
    notes.push(`${lead.name.split(' ')[0]} offered to ${chosen.name} for ${OFFER_SECONDS} seconds`);
  }
  return { state, notes };
};

export const acceptOffer = (
  leads: PracticeLead[],
  agents: PracticeAgent[],
  input: RoundRobinState,
  leadId: string,
  agentId: string,
  settings: OrrPracticeSettings,
  at: number,
) => {
  const state = expireOffers(input, at);
  const offer = state.offers.find(o => o.leadId === leadId && o.agentId === agentId && o.status === 'open');
  if (!offer) return { leads, agents, state, notes: ['That offer has lapsed or belongs to someone else'] };
  const claim = claimLead(leads, agents, leadId, agentId, settings, at);
  return {
    ...claim,
    state: { ...state, offers: state.offers.map(o => (o === offer ? { ...o, status: 'accepted' as const } : o)) },
  };
};

export const declineOffer = (input: RoundRobinState, leadId: string, agentId: string, at: number) => {
  const state = expireOffers(input, at);
  return {
    ...state,
    offers: state.offers.map(o =>
      o.leadId === leadId && o.agentId === agentId && o.status === 'open' ? { ...o, status: 'declined' as const } : o,
    ),
  };
};
