import type { PracticeAgent, PracticeLead } from './types';
import type { OrrPracticeSettings } from './settings';
import { claimLead, type ClaimResult } from './engine';

/**
 * Phase 1: Open Claim, rehearsed on made-up leads in the browser only.
 *
 * - An agent sees at most three cards from the pool, with minimal details.
 * - An agent may hold at most two leads that nobody has worked yet.
 * - Claims are exclusive: a lead someone else is holding cannot be taken.
 * - Only sales seats may claim; management can move a hold with a reason.
 * Every move is written into the lead's own history.
 */
export const OPEN_CLAIM_CARD_LIMIT = 3;
export const OPEN_CLAIM_UNWORKED_LIMIT = 2;

export type PracticeRole = 'sales' | 'sales_lead' | 'sales_manager' | 'admin' | 'super_admin' | 'viewer';

const CLAIM_ROLES: PracticeRole[] = ['sales', 'sales_lead'];
const MANAGEMENT_ROLES: PracticeRole[] = ['admin', 'super_admin', 'sales_manager'];

export const canClaim = (role: PracticeRole) => CLAIM_ROLES.includes(role);
export const canOverride = (role: PracticeRole) => MANAGEMENT_ROLES.includes(role);

export interface OpenClaimCard {
  leadId: string;
  firstName: string;
  stepReached: string;
  minutesWaiting: number;
}

const stepReached = (lead: PracticeLead) => {
  const kinds = new Set(lead.events.map(e => e.kind));
  if (kinds.has('callback_requested')) return 'Asked for a call back';
  if (kinds.has('checkout_abandoned') || kinds.has('checkout_entered')) return 'Reached checkout';
  if (kinds.has('quote_details_submitted')) return 'Quote details given';
  return 'Viewed prices';
};

/** Leads this agent is holding that have no call result logged since the hold began. */
export const unworkedHolds = (leads: PracticeLead[], agentId: string) =>
  leads.filter(
    l =>
      l.stage === 'reserved' &&
      l.reservedAgentId === agentId &&
      !l.outcomes.some(o => o.agentId === agentId && o.at >= (l.reservedAt ?? 0)),
  );

/** The three oldest pool leads, with no phone, email or registration shown. */
export const openClaimCards = (leads: PracticeLead[], at: number): OpenClaimCard[] =>
  leads
    .filter(l => l.stage === 'queued' && !l.suppressed && !l.purchased)
    .sort((a, b) => a.createdAt - b.createdAt || a.lastStageChangeAt - b.lastStageChangeAt)
    .slice(0, OPEN_CLAIM_CARD_LIMIT)
    .map(l => ({
      leadId: l.id,
      firstName: l.name.split(' ')[0],
      stepReached: stepReached(l),
      minutesWaiting: Math.max(0, Math.floor((at - l.lastStageChangeAt) / 60_000)),
    }));

export const openClaim = (
  leads: PracticeLead[],
  agents: PracticeAgent[],
  leadId: string,
  agentId: string,
  role: PracticeRole,
  settings: OrrPracticeSettings,
  at: number,
): ClaimResult => {
  if (!canClaim(role)) {
    return { leads, agents, notes: ['Only sales seats can take leads from the pool'] };
  }
  const visible = openClaimCards(leads, at).some(c => c.leadId === leadId);
  if (!visible) {
    return { leads, agents, notes: ['That lead is not one of the cards on offer, or someone already has it'] };
  }
  if (unworkedHolds(leads, agentId).length >= OPEN_CLAIM_UNWORKED_LIMIT) {
    return {
      leads,
      agents,
      notes: [`Work one of your ${OPEN_CLAIM_UNWORKED_LIMIT} held leads before taking another`],
    };
  }
  return claimLead(leads, agents, leadId, agentId, settings, at);
};

/** Management moves a held or pool lead to a named seat. A reason is required. */
export const managerMoveHold = (
  leads: PracticeLead[],
  agents: PracticeAgent[],
  leadId: string,
  toAgentId: string,
  role: PracticeRole,
  reason: string,
  settings: OrrPracticeSettings,
  at: number,
): ClaimResult => {
  if (!canOverride(role)) return { leads, agents, notes: ['Only management can move a held lead'] };
  if (!reason.trim()) return { leads, agents, notes: ['Give a reason before moving a held lead'] };
  const lead = leads.find(l => l.id === leadId);
  const agent = agents.find(a => a.id === toAgentId);
  if (!lead || !agent) return { leads, agents, notes: ['That practice lead or agent no longer exists'] };
  if (lead.stage !== 'reserved' && lead.stage !== 'queued') {
    return { leads, agents, notes: [`${lead.name} is not in the pool or held, so it cannot be moved`] };
  }
  const expiresAt = at + settings.claimExpiryMinutes * 60_000;
  const from = agents.find(a => a.id === lead.reservedAgentId)?.name ?? 'the pool';
  return {
    leads: leads.map(l =>
      l.id === leadId
        ? {
            ...l,
            stage: 'reserved',
            reservedAgentId: toAgentId,
            reservedAt: at,
            reservedExpiresAt: expiresAt,
            reReleaseDueAt: expiresAt,
            lastStageChangeAt: at,
            history: [
              ...l.history,
              `${new Date(at).toISOString()} Management moved from ${from} to ${agent.name}: ${reason.trim()}`,
            ],
          }
        : l,
    ),
    agents,
    notes: [`${lead.name} moved from ${from} to ${agent.name}`],
  };
};
