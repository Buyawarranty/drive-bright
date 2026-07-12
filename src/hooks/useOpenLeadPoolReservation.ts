import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Lead } from '@/hooks/useLeads';

/**
 * Global (module-scope) reservation store for the Open Lead Pool.
 *
 * Two-phase lifecycle:
 *   1. `reserved` — agent has ~120s to START a call (or cancel).
 *   2. `calling`  — agent is on the phone; short countdown stops, an idle
 *                   guard takes over. Slot stays occupied until the agent
 *                   logs an outcome (or an idle nudge auto-releases it).
 */

export type OpenPoolReservation = {
  lead: Lead;
  lockedAt: number;             // epoch ms when the lead was reserved
  holdSeconds: number;          // reservation window from server settings
  phase: 'reserved' | 'calling';
  callStartedAt: number | null; // epoch ms when the agent clicked Call
  callingExtensionsMs: number;  // total ms added via "Still working"
} | null;

let state: OpenPoolReservation = null;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

/** Normalizes any legacy caller passing only lead/lockedAt/holdSeconds. */
export function setOpenPoolReservation(
  next:
    | (Omit<NonNullable<OpenPoolReservation>, 'phase' | 'callStartedAt' | 'callingExtensionsMs'> &
        Partial<Pick<NonNullable<OpenPoolReservation>, 'phase' | 'callStartedAt' | 'callingExtensionsMs'>>)
    | null,
) {
  if (!next) {
    state = null;
  } else {
    state = {
      lead: next.lead,
      lockedAt: next.lockedAt,
      holdSeconds: next.holdSeconds,
      phase: next.phase ?? 'reserved',
      callStartedAt: next.callStartedAt ?? null,
      callingExtensionsMs: next.callingExtensionsMs ?? 0,
    };
  }
  emit();
}

export function clearOpenPoolReservation() {
  state = null;
  emit();
}

export function getOpenPoolReservation(): OpenPoolReservation {
  return state;
}

/** Transition the current reservation into the `calling` phase. */
export function markCallStarted() {
  if (!state) return;
  if (state.phase === 'calling') return;
  state = { ...state, phase: 'calling', callStartedAt: Date.now() };
  emit();
}

/** Extend the idle guard's tolerated calling window by `ms`. */
export function extendCalling(ms: number) {
  if (!state) return;
  state = { ...state, callingExtensionsMs: state.callingExtensionsMs + ms };
  emit();
}

export function useOpenPoolReservation(): OpenPoolReservation {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => state,
    () => state,
  );
}

/**
 * Reserved-phase countdown. Returns seconds until the reservation lock
 * expires — always 0 once the agent has started a call.
 */
export function useReservationCountdown(reservation: OpenPoolReservation): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!reservation || reservation.phase !== 'reserved') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [reservation?.lead.id, reservation?.lockedAt, reservation?.phase]);

  if (!reservation || reservation.phase !== 'reserved') return 0;
  const elapsed = Math.floor((now - reservation.lockedAt) / 1000);
  return Math.max(0, reservation.holdSeconds - elapsed);
}

/** Seconds elapsed since the agent clicked Call (0 when not in calling phase). */
export function useCallingElapsed(reservation: OpenPoolReservation): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!reservation || reservation.phase !== 'calling' || !reservation.callStartedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [reservation?.lead.id, reservation?.phase, reservation?.callStartedAt]);

  if (!reservation || reservation.phase !== 'calling' || !reservation.callStartedAt) return 0;
  return Math.max(0, Math.floor((now - reservation.callStartedAt) / 1000));
}
