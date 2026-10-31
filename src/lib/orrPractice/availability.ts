/**
 * Open Round Robin — corrected inactivity & availability rules (practice only).
 *
 * Agreed by management on 31 October 2026, replacing any ignored-claim
 * penalty idea:
 *  1. Never penalise an agent for NOT claiming a lead — claiming is voluntary.
 *  2. The phone system sets Busy automatically: no new leads offered, claim
 *     timers pause, no inactivity strikes; the previous status returns when
 *     the call ends (unless they chose Break or Offline).
 *  3. On Break: no claim opportunities, no allocations, timers pause, and
 *     unworked claimed leads return to the queue after a grace period
 *     (default 60 minutes) with no penalty. Ownership and callbacks survive.
 *  4. An inactivity event is only recorded when the agent deliberately
 *     claimed the lead, was available to work it, did nothing in the allowed
 *     period, and was not on a call, break, legitimate exception or hit by a
 *     technical failure. One event recycles the lead — never an automatic
 *     block. Repeated verified neglect flags a manager review and can
 *     restrict new claims.
 *  5. Telephony is authoritative; when it is unavailable nobody is assumed
 *     idle — a manual Busy status and manager corrections are allowed.
 *
 * Pure functions only — no Supabase, no network, nothing live.
 */

export type AgentAvailability =
  /** Ready to be offered and claim leads. */
  | 'available'
  /** On a live call, set by the telephone system. */
  | 'busy_call'
  /** Manually logged Busy — allowed when telephony is unavailable. */
  | 'busy_manual'
  /** Chosen break: no offers, no allocations, timers paused. */
  | 'on_break'
  /** Signed off — nothing offered, nothing allocated. */
  | 'offline';

export const DEFAULT_BREAK_GRACE_MINUTES = 60;
/** Verified inactivity events inside the review window that flag a manager review. */
export const DEFAULT_INACTIVITY_REVIEW_THRESHOLD = 3;
/** Working days the review window looks back. */
export const INACTIVITY_REVIEW_WINDOW_DAYS = 5;

export interface AvailabilitySettings {
  breakGraceMinutes: number;
  inactivityReviewThreshold: number;
}

export const DEFAULT_AVAILABILITY_SETTINGS: AvailabilitySettings = {
  breakGraceMinutes: DEFAULT_BREAK_GRACE_MINUTES,
  inactivityReviewThreshold: DEFAULT_INACTIVITY_REVIEW_THRESHOLD,
};

export const sanitiseAvailabilitySettings = (input: Partial<AvailabilitySettings>): AvailabilitySettings => ({
  breakGraceMinutes: Math.min(480, Math.max(5, Math.round(Number(input.breakGraceMinutes ?? DEFAULT_BREAK_GRACE_MINUTES)))),
  inactivityReviewThreshold: Math.min(20, Math.max(2, Math.round(Number(input.inactivityReviewThreshold ?? DEFAULT_INACTIVITY_REVIEW_THRESHOLD)))),
});

export interface AvailabilityState {
  status: AgentAvailability;
  /** What to restore when a call ends (never busy_call itself). */
  previousStatus: Exclude<AgentAvailability, 'busy_call'>;
  /** When the current break began, for the grace-period recycle. */
  breakStartedAt: number | null;
}

export const AVAILABLE_STATE: AvailabilityState = {
  status: 'available',
  previousStatus: 'available',
  breakStartedAt: null,
};

/** Only available agents are offered or may claim new leads. */
export const canBeOfferedLeads = (s: AvailabilityState) => s.status === 'available';

/**
 * Telephony says a call started or ended. A call start sets Busy and pauses
 * claim timers; a call end restores the previous status — unless the agent
 * chose Break or Offline in the meantime, which always wins.
 */
export const applyTelephonyCallState = (s: AvailabilityState, callActive: boolean): AvailabilityState => {
  if (callActive) {
    if (s.status === 'busy_call') return s;
    return {
      status: 'busy_call',
      previousStatus: s.status === 'busy_call' ? s.previousStatus : s.status,
      breakStartedAt: s.breakStartedAt,
    };
  }
  if (s.status !== 'busy_call') return s;
  // Break or Offline chosen during the call is preserved.
  if (s.previousStatus === 'on_break' || s.previousStatus === 'offline') {
    return { ...s, status: s.previousStatus };
  }
  return { ...s, status: s.previousStatus, previousStatus: 'available' };
};

/** Agent chooses a status themselves (Break, Offline, manual Busy, back to Available). */
export const setManualStatus = (s: AvailabilityState, next: Exclude<AgentAvailability, 'busy_call'>, at: number): AvailabilityState => ({
  status: next,
  previousStatus: next === 'available' || next === 'busy_manual' ? next : s.previousStatus === 'busy_call' ? 'available' : s.previousStatus,
  breakStartedAt: next === 'on_break' ? (s.breakStartedAt ?? at) : null,
});

export interface InactivityContext {
  /** The agent deliberately claimed the lead (never true for unclaimed cards). */
  claimed: boolean;
  /** The agent was available and able to work it. */
  wasAvailable: boolean;
  /** No qualifying activity inside the allowed period. */
  noActivityInAllowedPeriod: boolean;
  /** On an active call, approved break or other legitimate exception. */
  onCallBreakOrException: boolean;
  /** A technical failure prevented the work. */
  technicalFailure: boolean;
}

/**
 * Rule 4: an inactivity event is recorded only when EVERY condition is met.
 * Anything less — including simply not claiming a lead — records nothing.
 */
export const qualifiesAsInactivity = (ctx: InactivityContext): boolean =>
  ctx.claimed &&
  ctx.wasAvailable &&
  ctx.noActivityInAllowedPeriod &&
  !ctx.onCallBreakOrException &&
  !ctx.technicalFailure;

export interface InactivityEvent {
  agentId: string;
  leadId: string;
  at: number;
}

export interface InactivityOutcome {
  /** The event to record, or null when the conditions are not all met. */
  event: InactivityEvent | null;
  /** A single event recycles the lead — never an automatic block. */
  recycleLead: boolean;
  /** True once verified events inside the window reach the review threshold. */
  managerReviewDue: boolean;
  /** True once a manager review is due — new claims can be restricted. */
  restrictNewClaims: boolean;
  reason: string;
}

/** Record one claimed-but-unworked event and decide what follows. */
export const recordInactivity = (
  agentId: string,
  leadId: string,
  at: number,
  ctx: InactivityContext,
  priorEvents: InactivityEvent[],
  settings: Partial<AvailabilitySettings> = {},
): InactivityOutcome => {
  const cfg = sanitiseAvailabilitySettings(settings);
  if (!qualifiesAsInactivity(ctx)) {
    return {
      event: null,
      recycleLead: false,
      managerReviewDue: false,
      restrictNewClaims: false,
      reason: 'No inactivity recorded — the conditions were not all met',
    };
  }
  const event: InactivityEvent = { agentId, leadId, at };
  const windowStart = at - INACTIVITY_REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentCount = priorEvents.filter(e => e.agentId === agentId && e.at >= windowStart).length + 1;
  const reviewDue = recentCount >= cfg.inactivityReviewThreshold;
  return {
    event,
    recycleLead: true,
    managerReviewDue: reviewDue,
    restrictNewClaims: reviewDue,
    reason: reviewDue
      ? `${recentCount} verified inactivity events in ${INACTIVITY_REVIEW_WINDOW_DAYS} days — manager review due, new claims restricted`
      : 'Lead recycled without penalty',
  };
};

/**
 * Rule 3: unworked leads claimed by an agent on break return to the queue
 * once the break has run past the grace period — with no penalty and no
 * inactivity event. Ownership and scheduled callbacks are untouched.
 */
export const breakRecycleDue = (s: AvailabilityState, now: number, settings: Partial<AvailabilitySettings> = {}): boolean => {
  if (s.status !== 'on_break' || s.breakStartedAt === null) return false;
  const cfg = sanitiseAvailabilitySettings(settings);
  return now - s.breakStartedAt >= cfg.breakGraceMinutes * 60_000;
};
