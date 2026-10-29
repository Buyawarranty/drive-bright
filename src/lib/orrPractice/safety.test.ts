import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  attemptsToday,
  canAttemptContact,
  cooldownRemainingMinutes,
  isWithinContactWindow,
} from './contactSafety';
import { applyJourneyEvent, evaluateStages } from './engine';
import { intervalReport, poolSummary } from './analytics';
import { DEFAULT_ORR_PRACTICE_SETTINGS } from './settings';
import { makeSyntheticLead } from './syntheticLeads';
import type { ContactOutcome, PracticeLead } from './types';

/**
 * Contact safety, the practice analytics and the isolation guarantee.
 */

const MIN = 60_000;
/** Thursday 29 October 2026, 10:00 local, inside the permitted calling hours. */
const T0 = new Date(2026, 9, 29, 10, 0, 0, 0).getTime();
const S = DEFAULT_ORR_PRACTICE_SETTINGS;

const quietLead = (over: Partial<PracticeLead> = {}): PracticeLead => {
  const base = makeSyntheticLead(T0, 1);
  const identified = applyJourneyEvent(base, { kind: 'quote_details_submitted', at: T0 });
  const released = evaluateStages([identified], S, T0 + 2 * MIN).leads[0];
  return { ...released, tpsClear: true, phoneConsent: true, ...over };
};

const attempt = (
  result: ContactOutcome['result'],
  at: number,
  durationSeconds = 0,
): ContactOutcome => ({
  at,
  agentId: 'agent-a',
  result,
  source: 'zoiper',
  durationSeconds,
});

describe('Permitted calling hours', () => {
  it('allow a weekday morning and a Saturday afternoon', () => {
    expect(isWithinContactWindow(S, T0)).toBe(true);
    const saturdayAfternoon = new Date(2026, 9, 31, 13, 0, 0, 0).getTime();
    expect(isWithinContactWindow(S, saturdayAfternoon)).toBe(true);
  });

  it('block the Saturday morning and an evening', () => {
    const saturdayMorning = new Date(2026, 9, 31, 10, 0, 0, 0).getTime();
    expect(isWithinContactWindow(S, saturdayMorning)).toBe(false);
    const evening = new Date(2026, 9, 29, 20, 0, 0, 0).getTime();
    expect(isWithinContactWindow(S, evening)).toBe(false);
  });

  it('refuse a call attempt outside the hours', () => {
    const evening = new Date(2026, 9, 29, 20, 0, 0, 0).getTime();
    const decision = canAttemptContact(quietLead(), S, evening);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Outside the permitted calling hours');
  });
});

describe('Contact safety gates', () => {
  it('clear a quiet, consenting, register-checked lead inside the hours', () => {
    const decision = canAttemptContact(quietLead(), S, T0 + 5 * MIN);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toContain('Cleared');
  });

  it('never call a number the register check rules out', () => {
    const decision = canAttemptContact(quietLead({ tpsClear: false }), S, T0 + 5 * MIN);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Register check');
  });

  it('never call without the customer agreeing to a phone call', () => {
    const decision = canAttemptContact(quietLead({ phoneConsent: false }), S, T0 + 5 * MIN);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('No phone consent');
  });

  it('never call after a purchase', () => {
    const bought = applyJourneyEvent(quietLead(), {
      kind: 'purchase_completed',
      at: T0 + 3 * MIN,
      amount: 540,
    });
    const decision = canAttemptContact(bought, S, T0 + 5 * MIN);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Purchase confirmed');
  });

  it('never call somebody who opted out', () => {
    const decision = canAttemptContact(quietLead({ suppressed: true }), S, T0 + 5 * MIN);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Suppressed');
  });

  it('stop once the daily attempt limit is used', () => {
    const used = quietLead({
      outcomes: [
        attempt('no_answer', T0 + 2 * MIN),
        attempt('no_answer', T0 + 20 * MIN),
        attempt('no_answer', T0 + 40 * MIN),
      ],
    });
    expect(attemptsToday(used, T0 + 60 * MIN)).toBe(3);
    const decision = canAttemptContact(used, S, T0 + 60 * MIN);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Daily attempt limit');
  });

  it('wait out the cooldown between attempts', () => {
    const cooling = quietLead({ outcomes: [attempt('no_answer', T0 + 2 * MIN)] });
    expect(cooldownRemainingMinutes(cooling, S, T0 + 7 * MIN)).toBe(10);
    const decision = canAttemptContact(cooling, S, T0 + 7 * MIN);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Cooling down for 10 more minutes');
  });

  it('hold off while the customer is still working on their quote', () => {
    const busy = quietLead({ activeSession: true });
    const decision = canAttemptContact(busy, S, T0 + 5 * MIN);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('actively completing');
  });
});

describe('Practice analytics', () => {
  const bought = (firstAttempt: number): PracticeLead => {
    let lead = applyJourneyEvent(quietLead(), { kind: 'checkout_entered', at: T0 });
    lead = applyJourneyEvent(lead, { kind: 'purchase_completed', at: T0 + MIN, amount: 540 });
    return {
      ...lead,
      firstAttemptLeadMinutes: firstAttempt,
      outcomes: [attempt('spoke', T0 + MIN, 200)],
    };
  };

  it('groups a four minute wait with the five minute interval', () => {
    const stats = intervalReport([bought(4)]);
    expect(stats.find(s => s.intervalMinutes === 5)?.leads).toBe(1);
    expect(stats.find(s => s.intervalMinutes === 2)?.leads).toBe(0);
  });

  it('reports contact rate, completion, money per lead and complaints', () => {
    const stats = intervalReport([bought(2)]);
    const two = stats.find(s => s.intervalMinutes === 2);
    expect(two?.leads).toBe(1);
    expect(two?.attempts).toBe(1);
    expect(two?.conversations).toBe(1);
    expect(two?.contactRate).toBe(1);
    expect(two?.quoteCompletion).toBe(1);
    expect(two?.checkoutCompletion).toBe(1);
    expect(two?.conversionRate).toBe(1);
    expect(two?.revenuePerLead).toBe(540);
    expect(two?.complaints).toBe(0);
    expect(two?.optOuts).toBe(0);
  });

  it('leaves leads with no attempt out of every interval', () => {
    const stats = intervalReport([quietLead()]);
    expect(stats.every(s => s.leads === 0)).toBe(true);
  });

  it('counts the queue stages separately', () => {
    const summary = poolSummary([quietLead(), quietLead({ stage: 'reserved' })]);
    expect(summary.queued).toBe(1);
    expect(summary.reserved).toBe(1);
  });
});

describe('Isolation', () => {
  const source = (relative: string) =>
    readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

  const files = [
    './engine.ts',
    './analytics.ts',
    './contactSafety.ts',
    './settings.ts',
    './syntheticLeads.ts',
    './types.ts',
    '../../components/admin/leads/OrrWebsiteTriggerPracticePanel.tsx',
  ];

  /** Comments explain the rules in plain words, so they are removed before checking. */
  const codeOnly = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  it.each(files)('%s reaches no database, network or browser storage', file => {
    const text = codeOnly(source(file));
    expect(text).not.toMatch(/supabase/i);
    expect(text).not.toMatch(/\bfetch\s*\(/);
    expect(text).not.toMatch(/XMLHttpRequest/);
    expect(text).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });

});
