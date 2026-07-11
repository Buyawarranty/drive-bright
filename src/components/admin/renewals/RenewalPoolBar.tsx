import { useCallback, useEffect, useState } from 'react';
import { Repeat, Loader2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useSharkTankSettings } from '@/hooks/useSharkTank';
import {
  clearRenewalReservation,
  setRenewalReservation,
  useRenewalReservation,
  useRenewalReservationCountdown,
} from '@/hooks/useRenewalPoolReservation';
import { toast } from 'sonner';

/**
 * Compact one-row Renewal Pool control that sits above the renewals table.
 * "Take Next Renewal" reserves an eligible policy for the calling agent for
 * a short window (default 2 minutes). The reserved policy is pinned as the
 * first row of the existing renewals table with a mint highlight.
 */
export function RenewalPoolBar({
  onReserved,
}: {
  /** Called with the reserved policy id so the table can pin/highlight it. */
  onReserved?: (policyId: string) => void;
}) {
  const adminId = useCurrentAdminId();
  const { settings } = useSharkTankSettings();
  const reservation = useRenewalReservation();
  const remaining = useRenewalReservationCountdown(reservation);
  const [taking, setTaking] = useState(false);

  const renewalEnabled = (settings as any).renewal_enabled === true;
  const holdSeconds = Number((settings as any).renewal_hold_seconds ?? 120);

  // Auto-release UI-side when the timer runs out.
  useEffect(() => {
    if (!reservation) return;
    if (remaining === 0) {
      clearRenewalReservation();
      toast('Renewal returned to the pool.', { duration: 3500 });
    }
  }, [remaining, reservation]);

  const takeNext = useCallback(async () => {
    if (!adminId || taking || reservation) return;
    setTaking(true);
    try {
      const { data, error } = await (supabase as any).rpc('renewal_pool_get_next', { _agent: adminId });
      if (error) throw error;
      const id: string | undefined = data?.[0]?.policy_id;
      if (!id) {
        toast.info('No renewals available in the Renewal Pool right now.');
        return;
      }
      setRenewalReservation({ policyId: id, lockedAt: Date.now(), holdSeconds });
      onReserved?.(id);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not take a renewal');
    } finally {
      setTaking(false);
    }
  }, [adminId, taking, reservation, holdSeconds, onReserved]);

  if (!renewalEnabled) return null;

  const hasRes = !!reservation;
  const timerTone = remaining <= 15 ? 'text-amber-700' : 'text-slate-500';
  const timerLabel = hasRes
    ? remaining <= 15 ? `Releasing soon · ${remaining}s` : `Reserved to you · ${remaining}s`
    : '';

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Repeat className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
        <span className="text-sm font-semibold text-emerald-900">Renewal Pool</span>
        <span className="hidden sm:inline text-xs text-slate-600">
          Unowned or long-untouched renewals, one at a time.
        </span>
        {hasRes && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${timerTone}`}>
            <Clock className="h-3 w-3" />
            {timerLabel}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={takeNext}
        disabled={taking || hasRes || !adminId}
        className="inline-flex items-center gap-2 h-8 px-3 rounded-md text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {taking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {hasRes ? 'Working a renewal' : taking ? 'Getting…' : 'Take Next Renewal'}
      </button>
    </div>
  );
}
