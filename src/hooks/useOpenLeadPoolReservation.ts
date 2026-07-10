import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Lead } from '@/hooks/useLeads';

/**
 * Global (module-scope) reservation store for the Open Lead Pool.
 * A single agent can only hold one reserved lead at a time. The record
 * is written by the compact `OpenLeadPoolBar` on "Take Next Lead" and
 * consumed by `NewLeadsTab` so the reserved lead can be pinned as the
 * first row of the existing leads table.
 */

export type OpenPoolReservation = {
  lead: Lead;
  lockedAt: number;      // epoch ms
  holdSeconds: number;   // lock window from server settings
} | null;

let state: OpenPoolReservation = null;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export function setOpenPoolReservation(next: OpenPoolReservation) {
  state = next;
  emit();
}

export function clearOpenPoolReservation() {
  state = null;
  emit();
}

export function getOpenPoolReservation(): OpenPoolReservation {
  return state;
}

export function useOpenPoolReservation(): OpenPoolReservation {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => state,
    () => state,
  );
}

/** Tick every second while a reservation is live; returns remaining seconds (>=0). */
export function useReservationCountdown(reservation: OpenPoolReservation): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!reservation) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [reservation?.lead.id, reservation?.lockedAt]);

  if (!reservation) return 0;
  const elapsed = Math.floor((now - reservation.lockedAt) / 1000);
  return Math.max(0, reservation.holdSeconds - elapsed);
}
