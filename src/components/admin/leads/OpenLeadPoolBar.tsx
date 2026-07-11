import { useCallback, useEffect, useState } from 'react';
import { CircleDot, Loader2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useSharkTankSettings, useSharkTankCounts } from '@/hooks/useSharkTank';
import {
  clearOpenPoolReservation,
  setOpenPoolReservation,
  useOpenPoolReservation,
  useReservationCountdown,
} from '@/hooks/useOpenLeadPoolReservation';
import type { Lead } from '@/hooks/useLeads';
import { toast } from 'sonner';

interface OpenLeadPoolBarProps {
  className?: string;
  showWhenOff?: boolean;
}

/**
 * Compact, one-row-height Open Lead Pool control that sits directly above
 * the leads table. Clicking "Take Next Lead" locks a lead via the existing
 * `open_pool_get_next` RPC and stores it in the shared reservation store —
 * the leads page then pins that lead as a mint-highlighted row in the
 * regular table (no modal, no separate reveal step).
 */
export function OpenLeadPoolBar({ className = '', showWhenOff = false }: OpenLeadPoolBarProps) {
  const adminId = useCurrentAdminId();
  const { settings, loading } = useSharkTankSettings();
  const counts = useSharkTankCounts();
  const reservation = useOpenPoolReservation();
  const remaining = useReservationCountdown(reservation);
  const [taking, setTaking] = useState(false);

  // Restore any lock that already belongs to this agent (page refresh, tab switch).
  useEffect(() => {
    if (!adminId || reservation) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('sales_leads')
        .select('*')
        .eq('locked_by', adminId)
        .eq('pool_status', 'calling_locked')
        .order('locked_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      setOpenPoolReservation({
        lead: data as unknown as Lead,
        lockedAt: data.locked_at ? new Date(data.locked_at).getTime() : Date.now(),
        holdSeconds: (settings.hold_seconds || 60) * 7, // 7-minute soft window in existing copy
      });
    })();
    return () => { cancelled = true; };
  }, [adminId, reservation, settings.hold_seconds]);

  // Auto-release UI-side when the timer runs out.
  useEffect(() => {
    if (!reservation) return;
    if (remaining === 0) {
      clearOpenPoolReservation();
      toast('The lead was returned to the pool.', { duration: 3500 });
    }
  }, [remaining, reservation]);

  const takeNext = useCallback(async () => {
    if (!adminId || taking || reservation) return;
    setTaking(true);
    try {
      const { data, error } = await (supabase as any).rpc('open_pool_get_next', { _agent: adminId });
      if (error) throw error;
      const id = data?.[0]?.lead_id;
      if (!id) {
        toast.info('No leads available in the Open Lead Pool right now.');
        return;
      }
      const { data: row, error: rowErr } = await supabase
        .from('sales_leads')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (rowErr) throw rowErr;
      if (!row) return;
      setOpenPoolReservation({
        lead: row as unknown as Lead,
        lockedAt: Date.now(),
        holdSeconds: 120, // quiet 2-minute activity-based hold
      });
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not take a lead');
    } finally {
      setTaking(false);
    }
  }, [adminId, taking, reservation]);

  if (loading && !showWhenOff) return null;
  if (!settings.enabled && !showWhenOff) return null;

  const enabled = settings.enabled === true;
  const dryRun = enabled && settings.dry_run === true;
  const available = counts.queued;
  const hasReservation = !!reservation;
  const isActionDisabled = taking || hasReservation || !adminId || dryRun || !enabled;
  const timerTone =
    remaining <= 15
      ? 'text-amber-700'
      : 'text-slate-500';
  const timerLabel = hasReservation
    ? remaining <= 15
      ? `Releasing soon · ${remaining}s`
      : `Reserved for you · ${remaining}s`
    : `${available} available`;

  return (
    <div className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${!enabled ? 'border-slate-200 bg-slate-50/80' : dryRun ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/50'} ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        <CircleDot className={`h-3.5 w-3.5 shrink-0 ${!enabled ? 'text-slate-500' : dryRun ? 'text-amber-700' : 'text-emerald-700'}`} />
        <span className={`text-sm font-semibold ${!enabled ? 'text-slate-700' : dryRun ? 'text-amber-900' : 'text-emerald-900'}`}>Open Lead Pool</span>
        {!enabled && (
          <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
            Off
          </span>
        )}
        {dryRun && (
          <span className="text-[10px] uppercase tracking-wide font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5">
            Dry run
          </span>
        )}
        <span className="hidden sm:inline text-xs text-slate-600">
          {!enabled ? 'Open Lead Pool is currently switched off by management.' : dryRun ? 'Locking disabled — flip Mode to Live to take leads.' : 'Leads are assigned one at a time.'}
        </span>
        {!dryRun && hasReservation && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${timerTone}`}>
            <Clock className="h-3 w-3" />
            {timerLabel}
          </span>
        )}
        {!dryRun && !hasReservation && (
          <span className="text-xs text-slate-600">· {available} available</span>
        )}
      </div>

      <button
        type="button"
        onClick={takeNext}
        disabled={isActionDisabled}
        title={!enabled ? 'Open Lead Pool is switched off' : dryRun ? 'Pool is in Dry run — locking disabled' : undefined}
        className={`inline-flex items-center gap-2 h-8 px-3 rounded-md text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${!enabled ? 'bg-slate-500 hover:bg-slate-500' : dryRun ? 'bg-amber-600 hover:bg-amber-600' : 'bg-emerald-700 hover:bg-emerald-800'}`}
      >
        {taking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {hasReservation ? 'Working a lead' : taking ? 'Getting…' : 'Take Next Lead'}
      </button>
    </div>
  );
}
