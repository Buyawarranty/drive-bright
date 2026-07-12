import { useCallback, useEffect, useState } from 'react';
import { CircleDot, Loader2, Clock, X } from 'lucide-react';
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
 * Staff-facing Open Lead Pool control. Deliberately hides admin plumbing
 * (retry-window / chase-lock settings, save buttons, audit) — those live in
 * the management panel. Agents see plain-language state for the lead they
 * currently hold, with tiered visual emphasis as the timer approaches zero.
 */
function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function OpenLeadPoolBar({ className = '', showWhenOff = false }: OpenLeadPoolBarProps) {
  const adminId = useCurrentAdminId();
  const { settings, loading } = useSharkTankSettings();
  const counts = useSharkTankCounts();
  const reservation = useOpenPoolReservation();
  const remaining = useReservationCountdown(reservation);
  const [taking, setTaking] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [justExpired, setJustExpired] = useState(false);

  const HOLD_SECONDS = Number((settings as any)?.hold_seconds ?? 60);

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
        holdSeconds: HOLD_SECONDS,
      });
    })();
    return () => { cancelled = true; };
  }, [adminId, reservation]);

  // Auto-release UI-side when the timer runs out. Show a brief calm banner
  // ("Reservation released — no penalty") instead of a red toast.
  useEffect(() => {
    if (!reservation) return;
    if (remaining === 0) {
      const leadId = reservation.lead.id;
      const holdMins = Math.max(1, Math.round(HOLD_SECONDS / 60));
      clearOpenPoolReservation();
      setJustExpired(true);
      // Neutral, non-accusatory toast. The phone system isn't fully joined to the
      // CRM, so we never claim the agent "didn't call" — only what we can prove.
      toast('Lead released', {
        description: `No activity was recorded within ${holdMins} minute${holdMins === 1 ? '' : 's'}. It has returned to the Open Pool.`,
      });
      // Best-effort audit trail on the lead's own activity history.
      supabase.from('lead_activities').insert({
        lead_id: leadId,
        activity_type: 'system',
        description: 'Reservation expired — lead returned to pool (no activity recorded).',
      }).then(() => {}, () => {});
      const t = setTimeout(() => setJustExpired(false), 8000);
      return () => clearTimeout(t);
    }
  }, [remaining, reservation, HOLD_SECONDS]);

  const takeNext = useCallback(async () => {
    if (!adminId || taking || reservation) return;
    setTaking(true);
    try {
      const { data, error } = await (supabase as any).rpc('open_pool_get_next', { _agent: adminId });
      if (error) throw error;
      const id = data?.[0]?.lead_id;
      if (!id) {
        toast.info('No leads available right now.');
        return;
      }
      await supabase
        .from('sales_leads')
        .update({ status: 'new', updated_at: new Date().toISOString() })
        .eq('id', id);

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
        holdSeconds: HOLD_SECONDS,
      });
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not take a lead');
    } finally {
      setTaking(false);
    }
  }, [adminId, taking, reservation, HOLD_SECONDS]);

  const release = useCallback(async () => {
    if (!reservation || releasing) return;
    setReleasing(true);
    try {
      await supabase
        .from('sales_leads')
        .update({
          pool_status: 'queued',
          locked_by: null,
          locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservation.lead.id);
      clearOpenPoolReservation();
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not release lead');
    } finally {
      setReleasing(false);
    }
  }, [reservation, releasing]);

  const openLead = useCallback(() => {
    if (!reservation) return;
    // Highlighted row is pinned in the table below; scroll to it.
    const el = document.querySelector(`[data-lead-id="${reservation.lead.id}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-emerald-400');
      setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-400'), 1600);
    }
  }, [reservation]);

  if (loading && !showWhenOff) return null;
  if (!settings.enabled && !showWhenOff) return null;

  const enabled = settings.enabled === true;
  const dryRun = enabled && settings.dry_run === true;
  const available = counts.queued;
  const hasReservation = !!reservation;

  // Tiered emphasis by remaining seconds
  const tier =
    remaining <= 10 ? 'warn' :
    remaining <= 30 ? 'soon' : 'calm';

  const barTone = !enabled
    ? 'border-slate-200 bg-slate-50/80'
    : dryRun
      ? 'border-amber-200 bg-amber-50/60'
      : hasReservation
        ? tier === 'warn'
          ? 'border-rose-300 bg-rose-50'
          : tier === 'soon'
            ? 'border-amber-300 bg-amber-50/70'
            : 'border-emerald-300 bg-emerald-50/60'
        : 'border-emerald-200 bg-emerald-50/50';

  const timerText = hasReservation ? `Reserved for you · ${formatMmSs(remaining)} remaining` : null;
  const timerTone =
    tier === 'warn' ? 'text-rose-800 font-semibold'
    : tier === 'soon' ? 'text-amber-800 font-medium'
    : 'text-emerald-900';

  return (
    <div className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors ${barTone} ${className}`}>
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <CircleDot className={`h-3.5 w-3.5 shrink-0 ${!enabled ? 'text-slate-500' : dryRun ? 'text-amber-700' : 'text-emerald-700'}`} />
        <span className={`text-sm font-semibold ${!enabled ? 'text-slate-700' : 'text-emerald-900'}`}>Open Lead Pool</span>

        {!enabled && (
          <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
            Off
          </span>
        )}
        {dryRun && (
          <span className="text-[10px] uppercase tracking-wide font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5">
            Practice mode
          </span>
        )}

        {enabled && !hasReservation && !justExpired && (
          <span className="text-xs text-slate-600">
            One lead is assigned at a time · <span className="font-medium">{available} available</span>
          </span>
        )}

        {justExpired && (
          <span className="text-xs text-slate-700">Reservation released — no penalty.</span>
        )}

        {hasReservation && (
          <span className={`inline-flex items-center gap-1 text-xs ${timerTone}`}>
            <Clock className="h-3 w-3" />
            {timerText}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {hasReservation ? (
          <>
            <button
              type="button"
              onClick={openLead}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors"
            >
              Open lead
            </button>
            <button
              type="button"
              onClick={release}
              disabled={releasing}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-sm font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              {releasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Release
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={takeNext}
            disabled={taking || !adminId || dryRun || !enabled}
            title={!enabled ? 'Open Lead Pool is switched off' : dryRun ? 'Practice mode — no live leads assigned' : undefined}
            className={`inline-flex items-center gap-2 h-8 px-3 rounded-md text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${!enabled ? 'bg-slate-500 hover:bg-slate-500' : dryRun ? 'bg-amber-600 hover:bg-amber-600' : 'bg-emerald-700 hover:bg-emerald-800'}`}
          >
            {taking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {taking ? 'Getting…' : 'Take next lead'}
          </button>
        )}
      </div>
    </div>
  );
}
