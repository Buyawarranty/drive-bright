/**
 * Open Round Robin — capacity-matched release (practice only).
 *
 * Rule from the 31 October 2026 design: at each release window (9:00, 12:00,
 * 2:30, 5:00 UK) the system counts available, eligible agents and their free
 * lead slots, and releases only enough leads to match that capacity — for
 * example 6 agents with up to 2 unworked leads each means at most 12 leads
 * enter the shared pool. As agents claim and free up capacity, more leads are
 * released from the overnight backlog; the rest wait for the next window or
 * until capacity opens. Pure module: no Supabase, no network.
 */

/** Default maximum unworked claimed leads one agent may hold. */
export const DEFAULT_MAX_UNWORKED_PER_AGENT = 2;
/** Hard ceiling so a manager typo cannot flood one agent. */
export const MAX_UNWORKED_HARD_CAP = 5;

export const sanitiseMaxUnworked = (value: unknown): number => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_MAX_UNWORKED_PER_AGENT;
  return Math.min(MAX_UNWORKED_HARD_CAP, Math.max(1, n));
};

export interface CapacityAgent {
  id: string;
  /**
   * Available and eligible to receive releases: on shift, not on a call,
   * not on break, not blocked by a manager and not held out by the
   * no-sale block ladder.
   */
  eligible: boolean;
  /** Unworked leads currently claimed or held by this agent. */
  unworkedClaimed: number;
}

export interface CapacityReleaseInput {
  /** Leads waiting to be released (overnight backlog or waiting pool). */
  backlog: number;
  agents: CapacityAgent[];
  maxUnworkedPerAgent?: number;
}

export interface CapacityReleasePlan {
  /** How many leads this release may put into the shared pool. */
  releaseCount: number;
  /** Leads that stay parked for the next window or a capacity top-up. */
  backlogAfter: number;
  /** Free slots across all eligible agents before this release. */
  freeSlotsBefore: number;
  /** Free slots per agent id before this release (0 for ineligible agents). */
  slotsByAgent: Record<string, number>;
}

/** Free slots for one agent; ineligible agents contribute none. */
export const freeSlotsFor = (agent: CapacityAgent, maxUnworked: number): number => {
  if (!agent.eligible) return 0;
  return Math.max(0, maxUnworked - Math.max(0, agent.unworkedClaimed));
};

/** Total free slots across the whole team. */
export const totalFreeSlots = (agents: CapacityAgent[], maxUnworked: number): number =>
  agents.reduce((sum, agent) => sum + freeSlotsFor(agent, maxUnworked), 0);

/**
 * Work out how many leads a release window may put into the shared pool.
 * Never more than the backlog, never more than the team's free slots.
 */
export const planCapacityRelease = (input: CapacityReleaseInput): CapacityReleasePlan => {
  const max = sanitiseMaxUnworked(input.maxUnworkedPerAgent);
  const backlog = Math.max(0, Math.round(Number(input.backlog) || 0));
  const slotsByAgent: Record<string, number> = {};
  for (const agent of input.agents) {
    slotsByAgent[agent.id] = freeSlotsFor(agent, max);
  }
  const freeSlotsBefore = Object.values(slotsByAgent).reduce((a, b) => a + b, 0);
  const releaseCount = Math.min(backlog, freeSlotsBefore);
  return {
    releaseCount,
    backlogAfter: backlog - releaseCount,
    freeSlotsBefore,
    slotsByAgent,
  };
};
