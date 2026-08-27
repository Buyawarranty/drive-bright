import React, { useCallback, useEffect } from 'react';
import { Repeat, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  clearRenewalReservation,
  setRenewalReservation,
  useRenewalReservation,
  useRenewalReservationCountdown,
} from '@/hooks/useRenewalPoolReservation';
import type { SandboxRow } from './types';
import { evaluateOwnership } from './renewalOwnership';

/**
 * RENEWALS SANDBOX — queue reservation (Stage 4, Step 12)
 * "Take next renewal" picks the most urgent pool-eligible renewal from the rows
 * already loaded on screen and reserves it locally for a short hold window.
 * Purely client-side: no RPC, no assignment, no writes.
 */

const HOLD_SECONDS = 120;

export const RenewalSandboxQueueBar: React.FC<{
  rows: SandboxRow[];
  live: boolean;
  onTake: (row: SandboxRow) => void;
}> = ({ rows, live, onTake }) => {
  const reservation = useRenewalReservation();
  const remaining = useRenewalReservationCountdown(reservation);

  useEffect(() => {
    if (reservation && remaining === 0) {
      clearRenewalReservation();
      toast('Renewal returned to the sandbox pool.');
    }
  }, [reservation, remaining]);

  const available = rows.filter((r) => evaluateOwnership(r).poolEligible);

  const take = useCallback(() => {
    const next = available[0];
    if (!next) {
      toast.info('No pool-eligible renewals in this band right now.');
      return;
    }
    setRenewalReservation({ policyId: next.id, lockedAt: Date.now(), holdSeconds: HOLD_SECONDS });
    onTake(next);
  }, [available, onTake]);

  const hasRes = !!reservation;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Repeat className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
        <span className="text-sm font-semibold text-emerald-900">Renewal queue</span>
        <span className="text-xs text-slate-600">
          {available.length} unowned or SLA-missed renewal{available.length === 1 ? '' : 's'} in this band, one at a time.
        </span>
        {hasRes && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${remaining <= 15 ? 'text-amber-700' : 'text-slate-500'}`}>
            <Clock className="h-3 w-3" /> Reserved to you · {remaining}s
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={take}
        disabled={hasRes}
        className="inline-flex h-8 items-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {hasRes ? 'Working a renewal' : 'Take next renewal'}
      </button>
      {!live && (
        <span className="w-full text-xs text-muted-foreground">
          Sandbox — reserving here only highlights the row for you; nothing is assigned.
        </span>
      )}
    </div>
  );
};

export default RenewalSandboxQueueBar;
