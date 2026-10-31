export type StaffGateState = 'loading' | 'ready' | 'expired' | 'error' | 'device';

/**
 * Outcome of one staff access check.
 * - 'transient': timeout, network blip or server hiccup — not a real answer.
 * - the rest are definitive answers from the server.
 */
export type StaffGateOutcome = 'ready' | 'expired' | 'device' | 'transient';

/**
 * Background rechecks (every minute / on window focus) must never lock a
 * signed-in staff member out just because a check could not finish.
 * Only definitive server answers change an already-open dashboard; the
 * server keeps enforcing password expiry and device approval regardless.
 */
export function nextStaffGateState(prev: StaffGateState, outcome: StaffGateOutcome): StaffGateState {
  if (outcome !== 'transient') return outcome;
  return prev === 'ready' ? 'ready' : 'error';
}

/**
 * Background "is this login still alive?" check. Only a definitive refusal
 * (401/403) or a missing user counts as an ended login. Network errors and
 * timeouts (no status) never sign anyone out.
 */
export function sessionCheckLooksEnded(error: unknown, user: unknown): boolean {
  if (error) {
    const status = (error as { status?: number } | null)?.status;
    return status === 401 || status === 403;
  }
  return !user;
}
