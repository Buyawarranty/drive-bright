import type { PracticeAgent, PracticeLead } from './types';
import type { OrrPracticeSettings } from './settings';
import { evaluateStages } from './engine';
import { applyJourneyEvent } from './engine';
import { makeSyntheticLead } from './syntheticLeads';
import { inUkWindow } from './ukTime';
export { inUkWindow, ukDayHour } from './ukTime';

/**
 * Phase 2: continuous intake and recycling, rehearsed in the browser only.
 * Made-up leads, no saving, no calls or messages.
 */

const MINUTE = 60_000;
/** Minutes waited that fell inside calling hours. Bounded to 14 days of checks. */
export const eligibleMinutesBetween = (settings: OrrPracticeSettings, from: number, to: number) => {
  if (to <= from) return 0;
  const end = Math.min(to, from + 14 * 24 * 60 * MINUTE);
  let count = 0;
  for (let t = from; t + MINUTE <= end; t += MINUTE) if (inUkWindow(settings, t)) count += 1;
  return count;
};

/** Agent presence expires unless a fresh heartbeat arrives. */
export const PRESENCE_TTL_MINUTES = 2;
export type PresenceMap = Record<string, number>;

export const isPresent = (presence: PresenceMap, agentId: string, at: number) => {
  const seen = presence[agentId];
  return seen !== undefined && at - seen < PRESENCE_TTL_MINUTES * MINUTE;
};

export const presentAgents = (agents: PracticeAgent[], presence: PresenceMap, at: number) =>
  agents.map(a => ({ ...a, available: a.available && isPresent(presence, a.id, at) }));

export interface QueueViews {
  pending: PracticeLead[];
  overnight: PracticeLead[];
  recycled: PracticeLead[];
  callbacks: PracticeLead[];
}

export const queueViews = (leads: PracticeLead[], settings: OrrPracticeSettings): QueueViews => ({
  pending: leads.filter(l => l.identified && (l.stage === 'active_session' || l.stage === 'awaiting_release') && !l.callbackTime),
  callbacks: leads.filter(l => l.stage === 'awaiting_release' && l.callbackTime !== null),
  overnight: leads.filter(l => l.stage === 'queued' && l.releaseCount === 0 && !inUkWindow(settings, l.lastStageChangeAt)),
  recycled: leads.filter(l => l.stage === 'queued' && l.releaseCount > 0),
});

/** Most processed per tick, so one pass can never run away. */
export const TICK_LIMIT = 500;

export interface TickState {
  lastTickAt: number;
}

/**
 * One review pass. Running it twice for the same moment changes nothing, and
 * a clock that goes backwards is ignored.
 */
export const runIntakeTick = (
  leads: PracticeLead[],
  settings: OrrPracticeSettings,
  at: number,
  state: TickState,
): { leads: PracticeLead[]; notes: string[]; state: TickState; deferred: number } => {
  if (at <= state.lastTickAt) return { leads, notes: [], state, deferred: 0 };
  const batch = leads.slice(0, TICK_LIMIT);
  const rest = leads.slice(TICK_LIMIT);
  const result = evaluateStages(batch, settings, at);
  return { leads: [...result.leads, ...rest], notes: result.notes, state: { lastTickAt: at }, deferred: rest.length };
};

/** Made-up enquiries that came in overnight and went quiet straight away. */
export const makeOvernightBatch = (count: number, at: number, seedStart = 1000): PracticeLead[] =>
  Array.from({ length: count }, (_, i) => ({
    ...applyJourneyEvent(makeSyntheticLead(at, seedStart + i), { kind: 'quote_details_submitted', at }),
    tpsClear: true,
    phoneConsent: true,
  }));
