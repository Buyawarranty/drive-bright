import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Global reservation store for the Renewal Pool.
 * Mirrors useOpenLeadPoolReservation but for a renewal (customer_policies row).
 * One reservation per agent at a time.
 */

export type RenewalReservation = {
  policyId: string;
  lockedAt: number;
  holdSeconds: number;
} | null;

let state: RenewalReservation = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setRenewalReservation(next: RenewalReservation) {
  state = next;
  emit();
}
export function clearRenewalReservation() {
  state = null;
  emit();
}
export function getRenewalReservation(): RenewalReservation {
  return state;
}

export function useRenewalReservation(): RenewalReservation {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => state,
    () => state,
  );
}

export function useRenewalReservationCountdown(res: RenewalReservation): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!res) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [res?.policyId, res?.lockedAt]);
  if (!res) return 0;
  const elapsed = Math.floor((now - res.lockedAt) / 1000);
  return Math.max(0, res.holdSeconds - elapsed);
}
