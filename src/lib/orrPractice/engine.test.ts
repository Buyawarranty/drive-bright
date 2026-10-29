import { describe, it, expect } from 'vitest';
import {
  allocateQueued,
  applyJourneyEvent,
  claimLead,
  evaluateStages,
  findLeadByPersonKey,
  recordContactOutcome,
} from './engine';
import { canAttemptContact } from './contactSafety';
import { DEFAULT_ORR_PRACTICE_SETTINGS, sanitiseSettings } from './settings';
import { makeSyntheticAgents, makeSyntheticLead } from './syntheticLeads';
import type { ContactOutcome, PracticeAgent, PracticeLead } from './types';

/**
 * Rules management set on 29 October 2026 for the Open Round Robin practice run.
 * Each check asserts one rule with concrete values.
 */

const MIN = 60_000;
/** Thursday 29 October 2026, 10:00 local, inside the permitted calling hours. */
const T0 = new Date(2026, 9, 29, 10, 0, 0, 0).getTime();
const S = DEFAULT_ORR_PRACTICE_SETTINGS;

/** An invented customer who has given their details on the pricing journey. */
const identified = (seed = 1): PracticeLead => {
  const base = makeSyntheticLead(T0, seed);
  const lead = applyJourneyEvent(base, { kind: 'quote_details_submitted', at: T0 });
  return { ...lead, tpsClear: true, phoneConsent: true };
};

/** The same customer after the quiet rule has released them into the pool. */
const queued = (seed = 1): PracticeLead =>
  evaluateStages([identified(seed)], S, T0 + 2 * MIN).leads[0];

const outcome = (
  agentId: string,
  result: ContactOutcome['result'],
  at: number,
  durationSeconds = 0,
  source: ContactOutcome['source'] = 'zoiper',
): ContactOutcome => ({ at, agentId, result, source, durationSeconds });

describe('Anonymous browsing', () => {
  it('never turns a browser who gave no details into a telephone lead', () => {
    const browsing = applyJourneyEvent(makeSyntheticLead(T0, 3), {
      kind: 'pricing_page_entered',
      at: T0,
    });
    expect(browsing.identified).toBe(false);

    const later = evaluateStages([browsing], S, T0 + 30 * MIN);
    expect(later.leads[0].stage).toBe('anonymous');
    const decision = canAttemptContact(later.leads[0], S, T0 + 30 * MIN);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Anonymous');
  });
});

describe('Two minutes of quiet', () => {
  it('holds the lead for the first minute and releases it at two', () => {
    const lead = identified();
    expect(evaluateStages([lead], S, T0 + 1 * MIN).leads[0].stage).toBe('active_session');

    const released = evaluateStages([lead], S, T0 + 2 * MIN);
    expect(released.leads[0].stage).toBe('queued');
    expect(released.leads[0].reReleaseDueAt).toBe(T0 + 2 * MIN + 120 * MIN);
  });

  it('uses the checkout threshold once the customer is in checkout', () => {
    const lead = applyJourneyEvent(identified(), { kind: 'checkout_entered', at: T0 });
    const rules = { ...S, pricingInactivityMinutes: 2, checkoutAbandonmentMinutes: 5 };
    expect(evaluateStages([lead], rules, T0 + 3 * MIN).leads[0].stage).toBe('active_session');
    expect(evaluateStages([lead], rules, T0 + 5 * MIN).leads[0].stage).toBe('queued');
  });

  it('pauses calling again when the customer comes back', () => {
    const released = queued();
    const back = applyJourneyEvent(released, { kind: 'activity', at: T0 + 3 * MIN });
    expect(back.stage).toBe('active_session');
    const decision = canAttemptContact(back, S, T0 + 3 * MIN);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('actively completing');
  });

  it('waits for the call-back time the customer asked for', () => {
    const lead = applyJourneyEvent(identified(), {
      kind: 'callback_requested',
      at: T0,
      callbackAt: T0 + 30 * MIN,
    });
    expect(lead.stage).toBe('awaiting_release');
    expect(evaluateStages([lead], S, T0 + 10 * MIN).leads[0].stage).toBe('awaiting_release');
    expect(evaluateStages([lead], S, T0 + 31 * MIN).leads[0].stage).toBe('queued');
  });

  it('stops sales outreach once the customer buys', () => {
    const bought = applyJourneyEvent(identified(), {
      kind: 'purchase_completed',
      at: T0 + MIN,
      amount: 540,
    });
    expect(bought.stage).toBe('closed');
    expect(bought.value).toBe(540);
    expect(canAttemptContact(bought, S, T0 + 10 * MIN).reason).toContain('Purchase confirmed');
    expect(evaluateStages([bought], S, T0 + 600 * MIN).leads[0].stage).toBe('closed');
  });
});

describe('Three minutes to start work', () => {
  it('holds a claimed lead for three minutes, then returns it to the pool', () => {
    const lead = queued();
    const agents = makeSyntheticAgents();
    const claimed = claimLead([lead], agents, lead.id, 'agent-a', S, T0 + 2 * MIN);

    expect(claimed.leads[0].stage).toBe('reserved');
    expect(claimed.leads[0].reservedExpiresAt).toBe(T0 + 5 * MIN);
    expect(claimed.agents.find(a => a.id === 'agent-a')?.usedToday).toBe(1);

    expect(evaluateStages(claimed.leads, S, T0 + 4 * MIN).leads[0].stage).toBe('reserved');

    const lapsed = evaluateStages(claimed.leads, S, T0 + 5 * MIN);
    expect(lapsed.leads[0].stage).toBe('queued');
    expect(lapsed.leads[0].reservedAgentId).toBeNull();
  });

  it('will not hand a lead to an agent with no allowance left', () => {
    const lead = queued();
    const agents: PracticeAgent[] = [
      { id: 'full', name: 'Full seat', dailyCap: 1, usedToday: 1, available: true },
    ];
    const result = claimLead([lead], agents, lead.id, 'full', S, T0 + 2 * MIN);
    expect(result.leads[0].stage).toBe('queued');
    expect(result.notes[0]).toContain('no spare capacity');
  });
});

describe('Ownership needs a real conversation', () => {
  it('disregards a voicemail however long it ran', () => {
    const held = claimLead([queued()], makeSyntheticAgents(), queued().id, 'agent-a', S, T0 + 2 * MIN)
      .leads[0];
    const voicemail = recordContactOutcome(
      [held],
      held.id,
      outcome('agent-a', 'voicemail', T0 + 3 * MIN, 400),
      S,
    );
    expect(voicemail.leads[0].ownerAgentId).toBeNull();
    expect(voicemail.leads[0].stage).toBe('queued');
  });

  it('gives the lead to the agent who spoke to the customer', () => {
    const agents = makeSyntheticAgents();
    const held = claimLead([queued()], agents, queued().id, 'agent-b', S, T0 + 2 * MIN).leads[0];
    const spoke = recordContactOutcome(
      [held],
      held.id,
      outcome('agent-b', 'spoke', T0 + 3 * MIN, 120, 'dial_nine'),
      S,
    );
    expect(spoke.leads[0].stage).toBe('owned');
    expect(spoke.leads[0].ownerAgentId).toBe('agent-b');
  });

  it('stops outreach after an opt-out and after a complaint', () => {
    const agents = makeSyntheticAgents();
    const held = claimLead([queued()], agents, queued().id, 'agent-a', S, T0 + 2 * MIN).leads[0];

    const opted = recordContactOutcome([held], held.id, outcome('agent-a', 'opt_out', T0 + 3 * MIN), S);
    expect(opted.leads[0].suppressed).toBe(true);
    expect(opted.leads[0].stage).toBe('closed');
    expect(canAttemptContact(opted.leads[0], S, T0 + 4 * MIN).reason).toContain('Suppressed');

    const heldAgain = claimLead([held], agents, held.id, 'agent-c', S, T0 + 2 * MIN).leads[0];
    const complained = recordContactOutcome(
      [heldAgain],
      heldAgain.id,
      outcome('agent-c', 'complaint', T0 + 3 * MIN),
      S,
    );
    expect(complained.leads[0].suppressed).toBe(true);
  });

  it('records how long after the customer went quiet the first attempt landed', () => {
    const held = claimLead([queued()], makeSyntheticAgents(), queued().id, 'agent-a', S, T0 + 2 * MIN)
      .leads[0];
    const logged = recordContactOutcome(
      [held],
      held.id,
      outcome('agent-a', 'no_answer', T0 + 4 * MIN),
      S,
    );
    expect(logged.leads[0].firstAttemptLeadMinutes).toBe(4);
  });
});

describe('Continuous re-release', () => {
  it('reviews an unworked lead every two hours with no attempt cap', () => {
    let lead = queued();
    for (let pass = 0; pass < 10; pass += 1) {
      const at = T0 + 2 * MIN + (pass + 1) * 120 * MIN;
      lead = evaluateStages([lead], S, at).leads[0];
      expect(lead.stage).toBe('queued');
      expect(lead.reReleaseDueAt).toBe(at + 120 * MIN);
    }
    expect(lead.suppressed).toBe(false);
    expect(lead.stage).toBe('queued');
  });

  it('flags for a manager once the hand-off count passes the limit', () => {
    const lead: PracticeLead = {
      ...queued(),
      releaseCount: 6,
      reReleaseDueAt: T0 + 122 * MIN,
    };
    const reviewed = evaluateStages([lead], S, T0 + 122 * MIN);
    expect(reviewed.notes.some(n => n.includes('flagged for a manager'))).toBe(true);
  });

  it('closes a lead after the hand-off count a manager chose', () => {
    const rules = { ...S, permanentSuppressionAfterReleases: 2 };
    const lead: PracticeLead = {
      ...queued(),
      releaseCount: 2,
      reReleaseDueAt: T0 + 122 * MIN,
    };
    const reviewed = evaluateStages([lead], rules, T0 + 122 * MIN);
    expect(reviewed.leads[0].suppressed).toBe(true);
    expect(reviewed.leads[0].stage).toBe('closed');
  });
});

describe('Handing out queued leads', () => {
  it('goes round the rotation and steps past seats with no room', () => {
    const leads = [1, 2, 3, 4, 5].map(seed => queued(seed));
    const agents: PracticeAgent[] = [
      { id: 'a', name: 'Seat A', dailyCap: 2, usedToday: 0, available: true },
      { id: 'b', name: 'Seat B', dailyCap: 2, usedToday: 0, available: true },
      { id: 'c', name: 'Seat C', dailyCap: 0, usedToday: 0, available: true },
      { id: 'd', name: 'Seat D', dailyCap: 5, usedToday: 0, available: false },
    ];
    const result = allocateQueued(leads, agents, S, T0 + 2 * MIN, 0);

    const holders = result.leads
      .filter(l => l.stage === 'reserved')
      .map(l => l.reservedAgentId);
    expect(holders).toEqual(['a', 'b', 'a', 'b']);
    expect(result.leads.filter(l => l.stage === 'queued')).toHaveLength(1);
  });

  it('says so when every seat is full', () => {
    const leads = [queued()];
    const agents: PracticeAgent[] = [
      { id: 'a', name: 'Seat A', dailyCap: 1, usedToday: 1, available: true },
    ];
    const result = allocateQueued(leads, agents, S, T0 + 2 * MIN, 0);
    expect(result.leads[0].stage).toBe('queued');
    expect(result.notes[0]).toContain('No practice agent has spare capacity');

  });
});

describe('One person, one lead', () => {
  it('finds the existing lead instead of starting a second one', () => {
    const lead = identified();
    expect(findLeadByPersonKey([lead], lead.personKey)?.id).toBe(lead.id);
    expect(findLeadByPersonKey([lead], 'nobody@example.com|07700900999')).toBeNull();
  });
});

describe('Manager-entered rules', () => {
  it('keeps every rule inside a safe range', () => {
    const rules = sanitiseSettings({
      claimExpiryMinutes: 999,
      reReleaseIntervalMinutes: -5,
      pricingInactivityMinutes: 0,
      permanentSuppressionAfterReleases: 0,
    });
    expect(rules.claimExpiryMinutes).toBe(60);
    expect(rules.reReleaseIntervalMinutes).toBe(5);
    expect(rules.pricingInactivityMinutes).toBe(1);
    expect(rules.permanentSuppressionAfterReleases).toBe(0);
  });

  it('defaults to two quiet minutes, a three minute hold and a two hour review', () => {
    expect(DEFAULT_ORR_PRACTICE_SETTINGS.pricingInactivityMinutes).toBe(2);
    expect(DEFAULT_ORR_PRACTICE_SETTINGS.checkoutAbandonmentMinutes).toBe(2);
    expect(DEFAULT_ORR_PRACTICE_SETTINGS.claimExpiryMinutes).toBe(3);
    expect(DEFAULT_ORR_PRACTICE_SETTINGS.reReleaseIntervalMinutes).toBe(120);
  });
});
