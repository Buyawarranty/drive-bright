import type {
  ContactOutcome,
  EngineResult,
  JourneyEvent,
  PracticeAgent,
  PracticeLead,
} from './types';
import type { OrrPracticeSettings } from './settings';

/**
 * The Open Round Robin practice engine.
 *
 * Pure functions over made-up leads. Nothing in this file imports a Supabase
 * client, fires a request, or reads browser storage, so a rehearsal cannot
 * reach a customer, a real lead, a text, a WhatsApp message or the phone system.
 *
 * The five stages management asked to keep separate are enforced here:
 * eligibility, assignment, first contact attempt, contact outcome and follow-up
 * scheduling are each their own step, and no step dials anybody.
 */

const MINUTE = 60_000;

const withNote = (lead: PracticeLead, at: number, text: string): PracticeLead => ({
  ...lead,
  history: [...lead.history, `${new Date(at).toISOString()} ${text}`],
});

const isTerminal = (lead: PracticeLead) => lead.suppressed || lead.stage === 'closed';

/** True when the practice customer has done the named journey step. */
export const hasEvent = (lead: PracticeLead, kind: JourneyEvent['kind']) =>
  lead.events.some(e => e.kind === kind);

/** One person moving between pages stays one lead. */
export const findLeadByPersonKey = (leads: PracticeLead[], personKey: string) =>
  leads.find(l => l.personKey === personKey) ?? null;

/**
 * Records what the practice customer did.
 *
 * Anonymous browsing never becomes a telephone lead: the record exists so the
 * journey can be rehearsed, but it stays `anonymous` until details are given.
 */
export const applyJourneyEvent = (
  lead: PracticeLead,
  event: JourneyEvent,
): PracticeLead => {
  const at = event.at;
  const next: PracticeLead = {
    ...lead,
    events: [...lead.events, event],
    lastActivityAt: Math.max(lead.lastActivityAt, at),
  };
  // Browsing again never discards an established owner or a current exclusive hold.
  if ((lead.ownerAgentId || lead.stage === 'reserved') && event.kind !== 'purchase_completed') {
    return withNote(next, at, `Customer journey event recorded: ${event.kind}`);
  }

  switch (event.kind) {
    case 'pricing_page_entered': {
      next.activeSession = true;
      if (!isTerminal(next)) {
        next.stage = next.identified ? 'active_session' : 'anonymous';
        next.lastStageChangeAt = at;
      }
      return withNote(next, at, 'Pricing page entered');
    }
    case 'quote_details_submitted': {
      next.identified = true;
      next.activeSession = true;
      if (!isTerminal(next)) {
        next.stage = 'active_session';
        next.lastStageChangeAt = at;
      }
      return withNote(next, at, 'Quote details submitted, so this is now an identifiable lead');
    }
    case 'checkout_entered': {
      next.identified = true;
      next.activeSession = true;
      if (!isTerminal(next)) {
        next.stage = 'active_session';
        next.lastStageChangeAt = at;
      }
      return withNote(next, at, 'Checkout entered');
    }
    case 'activity': {
      next.activeSession = true;
      if (!isTerminal(next) && (next.stage === 'awaiting_release' || next.stage === 'queued')) {
        next.stage = 'active_session';
        next.lastStageChangeAt = at;
        next.reReleaseDueAt = null;
        return withNote(next, at, 'Customer came back, so proactive calling is paused again');
      }
      return withNote(next, at, 'Customer activity recorded');
    }
    case 'checkout_abandoned': {
      next.activeSession = false;
      if (!isTerminal(next) && next.identified) {
        next.stage = 'awaiting_release';
        next.lastStageChangeAt = at;
      }
      return withNote(next, at, 'Checkout abandoned, so the lead is ready for release review');
    }
    case 'callback_requested': {
      next.identified = true;
      next.callbackRequestedAt = at;
      next.callbackTime = event.callbackAt ?? null;
      next.activeSession = false;
      if (!isTerminal(next)) {
        next.stage = 'awaiting_release';
        next.lastStageChangeAt = at;
      }
      return withNote(
        next,
        at,
        event.callbackAt
          ? `Call-back requested for ${new Date(event.callbackAt).toISOString()}`
          : 'Call-back requested',
      );
    }
    case 'purchase_completed': {
      next.purchased = true;
      next.value = event.amount ?? 0;
      next.activeSession = false;
      next.ownerAgentId = next.ownerAgentId ?? next.reservedAgentId;
      next.reservedAgentId = null;
      next.reservedAt = null;
      next.reservedExpiresAt = null;
      next.reReleaseDueAt = null;
      next.stage = 'closed';
      next.lastStageChangeAt = at;
      return withNote(
        next,
        at,
        `Purchase completed for £${(event.amount ?? 0).toFixed(2)}, so sales outreach has stopped`,
      );
    }
  }
};

/** Put an identifiable lead into the pool and arm the next review. */
const releaseToPool = (
  lead: PracticeLead,
  at: number,
  settings: OrrPracticeSettings,
  text: string,
): PracticeLead =>
  withNote(
    {
      ...lead,
      stage: 'queued',
      activeSession: false,
      lastStageChangeAt: at,
      reReleaseDueAt: at + settings.reReleaseIntervalMinutes * MINUTE,
    },
    at,
    text,
  );

/** How long the customer has been quiet, in milliseconds. */
const quietFor = (lead: PracticeLead, at: number) => at - lead.lastActivityAt;

/** The threshold that applies to this lead right now, in milliseconds. */
const releaseThreshold = (lead: PracticeLead, settings: OrrPracticeSettings) =>
  (hasEvent(lead, 'checkout_entered')
    ? settings.checkoutAbandonmentMinutes
    : settings.pricingInactivityMinutes) * MINUTE;

/**
 * One clock tick. Moves leads between stages without ever dialling anybody:
 * an expired claim returns first, then quiet sessions are released, then
 * waiting leads are released, then unworked leads are reviewed again.
 */
export const evaluateStages = (
  leads: PracticeLead[],
  settings: OrrPracticeSettings,
  at: number,
): EngineResult => {
  const notes: string[] = [];

  const moved = leads.map(lead => {
    if (isTerminal(lead)) return lead;

    // A claim that ran out goes back immediately, not on the next review tick.
    if (lead.stage === 'reserved' && lead.reservedExpiresAt !== null && at >= lead.reservedExpiresAt) {
      const mins = settings.claimExpiryMinutes;
      notes.push(`${lead.name}: claim ran out after ${mins} minutes, back in the pool`);
      return withNote(
        {
          ...lead,
          stage: 'queued',
          reservedAgentId: null,
          reservedAt: null,
          reservedExpiresAt: null,
          reReleaseDueAt: at + settings.reReleaseIntervalMinutes * MINUTE,
          lastStageChangeAt: at,
        },
        at,
        `Claim expired after ${mins} minutes and the lead returned to the pool`,
      );
    }

    // A customer who asked for a call-back waits for the time they asked for.
    if (lead.stage === 'awaiting_release' && lead.callbackTime !== null && at < lead.callbackTime) {
      return lead;
    }

    // A session that has gone quiet is released. Anonymous browsing is never
    // turned into a telephone lead, so it stays where it is.
    if (lead.stage === 'active_session' || lead.stage === 'awaiting_release') {
      if (!lead.identified) return lead;
      const threshold = releaseThreshold(lead, settings);
      const quiet = quietFor(lead, at);
      if (lead.activeSession && quiet >= threshold) {
        const quietMinutes = Math.round(quiet / MINUTE);
        notes.push(`${lead.name}: quiet for ${quietMinutes} minutes, released to the pool`);
        return releaseToPool(
          lead,
          at,
          settings,
          `Quiet for ${quietMinutes} minutes, so the lead was released into the pool`,
        );
      }
      // A lead that already waited for its call-back is released once due.
      if (lead.stage === 'awaiting_release' && !lead.activeSession && quiet >= threshold) {
        notes.push(`${lead.name}: released to the pool`);
        return releaseToPool(lead, at, settings, 'Released into the Open Round Robin pool');
      }
      return lead;
    }

    if (lead.stage === 'anonymous') {
      // Nobody has given details, so there is nothing to telephone.
      return lead;
    }

    // An unworked lead in the pool is reviewed again. There is no attempt cap
    // unless a manager sets one, so nothing is dropped for being unpopular.
    if (lead.stage === 'queued' && lead.reReleaseDueAt !== null && at >= lead.reReleaseDueAt) {
      const reviewMinutes = settings.reReleaseIntervalMinutes;
      let next: PracticeLead = { ...lead, reReleaseDueAt: at + reviewMinutes * MINUTE };
      notes.push(
        `${lead.name}: reviewed after ${reviewMinutes} minutes and stays eligible (handed ${lead.releaseCount} time${lead.releaseCount === 1 ? '' : 's'})`,
      );
      next = withNote(next, at, `Reviewed after ${reviewMinutes} minutes and stays eligible`);

      if (lead.releaseCount >= settings.escalationPriorityAfterReleases) {
        notes.push(`${lead.name}: flagged for a manager after ${lead.releaseCount} hand-offs`);
        next = withNote(next, at, `Flagged for a manager after ${lead.releaseCount} hand-offs`);
      }

      if (
        settings.permanentSuppressionAfterReleases > 0 &&
        lead.releaseCount >= settings.permanentSuppressionAfterReleases
      ) {
        notes.push(`${lead.name}: closed after ${lead.releaseCount} hand-offs`);
        next = withNote(
          { ...next, suppressed: true, stage: 'closed', reReleaseDueAt: null, lastStageChangeAt: at },
          at,
          `Closed after ${lead.releaseCount} hand-offs under the manager's suppression rule`,
        );
      }
      return next;
    }

    return lead;
  });

  return { leads: moved, notes };
};

/** Can this practice agent take another lead right now? */
const hasCapacity = (agent: PracticeAgent) =>
  agent.available && agent.dailyCap > 0 && agent.usedToday < agent.dailyCap;

/** How long an agent may hold a lead before it returns to the pool. */
export const claimExpiryAt = (at: number, settings: OrrPracticeSettings) =>
  at + settings.claimExpiryMinutes * MINUTE;

export interface ClaimResult {
  leads: PracticeLead[];
  agents: PracticeAgent[];
  notes: string[];
}

/**
 * An agent takes a lead. This is a temporary exclusive hold, not ownership:
 * only a confirmed conversation with the customer makes it theirs.
 */
export const claimLead = (
  leads: PracticeLead[],
  agents: PracticeAgent[],
  leadId: string,
  agentId: string,
  settings: OrrPracticeSettings,
  at: number,
): ClaimResult => {
  const lead = leads.find(l => l.id === leadId);
  const agent = agents.find(a => a.id === agentId);
  if (!lead || !agent) return { leads, agents, notes: ['That practice lead or agent no longer exists'] };
  if (lead.stage !== 'queued' || lead.ownerAgentId || lead.purchased || lead.suppressed) {
    return { leads, agents, notes: [`${lead.name} is not in the pool right now, so it cannot be taken`] };
  }
  if (!hasCapacity(agent)) {
    return {
      leads,
      agents,
      notes: [`${agent.name} has no spare capacity, so ${lead.name} stays in the pool`],
    };
  }

  const expiresAt = claimExpiryAt(at, settings);
  const notes = [
    `${agent.name} is holding ${lead.name} for ${settings.claimExpiryMinutes} minutes`,
  ];
  return {
    leads: leads.map(l =>
      l.id === leadId
        ? withNote(
            {
              ...l,
              stage: 'reserved',
              reservedAgentId: agentId,
              reservedAt: at,
              reservedExpiresAt: expiresAt,
              releaseCount: l.releaseCount + 1,
              reReleaseDueAt: expiresAt,
              lastStageChangeAt: at,
            },
            at,
            `Held by ${agent.name} for ${settings.claimExpiryMinutes} minutes`,
          )
        : l,
    ),
    agents: agents.map(a => (a.id === agentId ? { ...a, usedToday: a.usedToday + 1 } : a)),
    notes,
  };
};

/**
 * Hands queued leads to available agents as soon as there is capacity, rather
 * than making them wait for the next review tick. Rotation keeps going round so
 * one seat is never fed ahead of the others.
 */
export const allocateQueued = (
  leads: PracticeLead[],
  agents: PracticeAgent[],
  settings: OrrPracticeSettings,
  at: number,
  startIndex = 0,
): ClaimResult & { nextIndex: number } => {
  const eligibleAgents = agents.filter(hasCapacity);
  if (!eligibleAgents.length) {
    return { leads, agents, notes: ['No practice agent has spare capacity right now'], nextIndex: startIndex };
  }

  let working = leads;
  let workingAgents = agents;
  const notes: string[] = [];
  let cursor = ((startIndex % eligibleAgents.length) + eligibleAgents.length) % eligibleAgents.length;

  const ordered = [...leads]
    .filter(l => l.stage === 'queued')
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const lead of ordered) {
    // Walk the rotation until a seat with room is found, so one agent is never
    // fed ahead of the others and a full seat is simply stepped past.
    let placed = false;
    for (let step = 0; step < eligibleAgents.length; step += 1) {
      const agent = eligibleAgents[cursor % eligibleAgents.length];
      cursor += 1;
      const fresh = workingAgents.find(a => a.id === agent.id);
      if (!fresh || !hasCapacity(fresh)) continue;
      const result = claimLead(working, workingAgents, lead.id, agent.id, settings, at);
      working = result.leads;
      workingAgents = result.agents;
      notes.push(...result.notes);
      placed = true;
      break;
    }
    // Every seat is full, so the rest wait for the next review rather than
    // being pushed at somebody who cannot take them.
    if (!placed) break;
  }

  return { leads: working, agents: workingAgents, notes, nextIndex: cursor };
};

/**
 * Records how an attempt ended. Only a real conversation creates ownership, and
 * a voicemail is disregarded however long it ran, exactly as management asked.
 */
export const recordContactOutcome = (
  leads: PracticeLead[],
  leadId: string,
  outcome: ContactOutcome,
  settings: OrrPracticeSettings,
): EngineResult => {
  const lead = leads.find(l => l.id === leadId);
  if (!lead) return { leads, notes: ['That practice lead no longer exists'] };

  const at = outcome.at;
  const withOutcome: PracticeLead = {
    ...lead,
    outcomes: [...lead.outcomes, outcome],
    firstAttemptLeadMinutes:
      lead.firstAttemptLeadMinutes === null
        ? Math.max(0, Math.round(((at - lead.lastActivityAt) / MINUTE) * 10) / 10)
        : lead.firstAttemptLeadMinutes,
  };

  const backToPool = (text: string): PracticeLead =>
    withNote(
      {
        ...withOutcome,
        stage: 'queued',
        reservedAgentId: null,
        reservedAt: null,
        reservedExpiresAt: null,
        reReleaseDueAt: at + settings.reReleaseIntervalMinutes * MINUTE,
        lastStageChangeAt: at,
      },
      at,
      text,
    );

  if (outcome.result === 'spoke' && outcome.durationSeconds > 0) {
    return {
      leads: leads.map(l =>
        l.id === leadId
          ? withNote(
              {
                ...withOutcome,
                stage: 'owned',
                ownerAgentId: outcome.agentId,
                reservedAgentId: null,
                reservedAt: null,
                reservedExpiresAt: null,
                reReleaseDueAt: null,
                lastStageChangeAt: at,
              },
              at,
              `Spoke to the customer for ${outcome.durationSeconds} seconds via ${outcome.source}, so the lead is now theirs`,
            )
          : l,
      ),
      notes: [`${lead.name}: spoken to, so it belongs to the agent who spoke`],
    };
  }

  if (outcome.result === 'voicemail') {
    return {
      leads: leads.map(l =>
        l.id === leadId ? backToPool('Voicemail left, which does not create ownership') : l,
      ),
      notes: [`${lead.name}: voicemail disregarded for ownership`],
    };
  }

  if (outcome.result === 'opt_out' || outcome.result === 'complaint') {
    return {
      leads: leads.map(l =>
        l.id === leadId
          ? withNote(
              {
                ...withOutcome,
                stage: 'closed',
                suppressed: true,
                reservedAgentId: null,
                reservedAt: null,
                reservedExpiresAt: null,
                reReleaseDueAt: null,
                lastStageChangeAt: at,
              },
              at,
              outcome.result === 'opt_out'
                ? 'Customer opted out, so no further outreach'
                : 'Complaint recorded, so no further outreach',
            )
          : l,
      ),
      notes: [
        `${lead.name}: ${outcome.result === 'opt_out' ? 'opted out' : 'complaint raised'}, so outreach has stopped`,
      ],
    };
  }

  if (outcome.result === 'wrong_number') {
    return {
      leads: leads.map(l =>
        l.id === leadId
          ? withNote(
              { ...withOutcome, stage: 'closed', reReleaseDueAt: null, lastStageChangeAt: at },
              at,
              'Wrong number, so the practice lead is closed',
            )
          : l,
      ),
      notes: [`${lead.name}: wrong number, so it is closed`],
    };
  }

  return {
    leads: leads.map(l =>
      l.id === leadId ? backToPool('No conversation, so it went back to the pool') : l,
    ),
    notes: [`${lead.name}: no conversation, so it returned to the pool`],
  };
};
