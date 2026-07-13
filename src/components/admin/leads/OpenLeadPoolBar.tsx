import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleDot, Loader2, Clock, X, Phone, PhoneCall } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useSharkTankSettings, useSharkTankCounts } from '@/hooks/useSharkTank';
import {
  clearOpenPoolReservation,
  extendCalling,
  markCallStarted,
  setOpenPoolReservation,
  useCallingElapsed,
  useOpenPoolReservation,
  useReservationCountdown,
} from '@/hooks/useOpenLeadPoolReservation';
import type { Lead } from '@/hooks/useLeads';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface OpenLeadPoolBarProps {
  className?: string;
  showWhenOff?: boolean;
}

// Idle-guard thresholds (calling phase only)
const CALLING_NUDGE_AT_MS = 10 * 60 * 1000; // 10 min
const CALLING_PROMPT_AT_MS = 15 * 60 * 1000; // 15 min
const CALLING_AUTO_RELEASE_AFTER_PROMPT_MS = 60 * 1000; // +60s to respond
const CALLING_EXTENSION_MS = 10 * 60 * 1000; // "Still working" adds 10 min

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
  const callingElapsed = useCallingElapsed(reservation);
  const [taking, setTaking] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [justExpired, setJustExpired] = useState(false);
  const [idlePromptOpen, setIdlePromptOpen] = useState(false);
  const nudgedRef = useRef<string | null>(null);
  const promptedRef = useRef<string | null>(null);
  const promptOpenedAtRef = useRef<number | null>(null);

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

  // Auto-cancel when the reserved-phase timer runs out (no call started).
  useEffect(() => {
    if (!reservation || reservation.phase !== 'reserved') return;
    if (remaining === 0) {
      const leadId = reservation.lead.id;
      clearOpenPoolReservation();
      setJustExpired(true);
      supabase
        .from('sales_leads')
        .update({
          pool_status: 'queued',
          locked_by: null,
          locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .eq('locked_by', adminId as string)
        .then(() => {}, () => {});
      toast('Lead cancelled', {
        description: 'No call was started before the reservation expired. It has returned to the Open Pool.',
        id: `open-pool-expired-${leadId}`,
      });
      supabase.from('lead_activities').insert({
        lead_id: leadId,
        activity_type: 'system',
        description: 'Reservation expired — no call was started before the window closed.',
      }).then(() => {}, () => {});
      const t = setTimeout(() => setJustExpired(false), 8000);
      return () => clearTimeout(t);
    }
  }, [remaining, reservation, adminId]);

  // Calling-phase idle guard: nudge at 10m, prompt at 15m, auto-release +60s.
  useEffect(() => {
    if (!reservation || reservation.phase !== 'calling') {
      nudgedRef.current = null;
      promptedRef.current = null;
      promptOpenedAtRef.current = null;
      setIdlePromptOpen(false);
      return;
    }
    const key = `${reservation.lead.id}:${reservation.callStartedAt ?? 0}:${reservation.callingExtensionsMs}`;
    const effectiveMs = callingElapsed * 1000 - reservation.callingExtensionsMs;

    if (effectiveMs >= CALLING_NUDGE_AT_MS && nudgedRef.current !== key) {
      nudgedRef.current = key;
      toast('Outcome still required', {
        description: 'Log Spoken to or No answer when the call finishes.',
        id: `calling-nudge-${reservation.lead.id}`,
      });
    }
    if (effectiveMs >= CALLING_PROMPT_AT_MS && promptedRef.current !== key) {
      promptedRef.current = key;
      promptOpenedAtRef.current = Date.now();
      setIdlePromptOpen(true);
    }
    if (
      promptOpenedAtRef.current &&
      idlePromptOpen &&
      Date.now() - promptOpenedAtRef.current >= CALLING_AUTO_RELEASE_AFTER_PROMPT_MS
    ) {
      const leadId = reservation.lead.id;
      setIdlePromptOpen(false);
      promptOpenedAtRef.current = null;
      clearOpenPoolReservation();
      supabase
        .from('sales_leads')
        .update({
          pool_status: 'queued',
          locked_by: null,
          locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .eq('locked_by', adminId as string)
        .then(() => {}, () => {});
      supabase.from('lead_activities').insert({
        lead_id: leadId,
        activity_type: 'system',
        description: 'Automatically released — no outcome recorded.',
      }).then(() => {}, () => {});
      toast('Automatically released — no outcome recorded', {
        id: `calling-auto-release-${leadId}`,
      });
    }
  }, [callingElapsed, reservation, idlePromptOpen, adminId]);

  const takeNext = useCallback(async () => {
    if (!adminId || taking || reservation) return;
    setTaking(true);
    try {
      // Block if manager has applied an Open Pool restriction on this agent
      const { data: restricted } = await (supabase as any).rpc(
        'is_agent_open_pool_restricted',
        { _agent_id: adminId }
      );
      if (restricted === true) {
        const { data: r } = await supabase
          .from('open_pool_restrictions')
          .select('ends_at, reason')
          .eq('agent_id', adminId)
          .eq('status', 'active')
          .order('starts_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const endsMsg = r?.ends_at
          ? ` Access returns at ${new Date(r.ends_at).toLocaleString()}.`
          : '';
        toast.error(
          `Open Pool access is paused by your manager.${endsMsg}` +
          ' Existing leads, callbacks, quotes and emails still work as normal.'
        );
        return;
      }

      const { data, error } = await (supabase as any).rpc('open_pool_get_next', { _agent: adminId });
      if (error) throw error;
      const id = data?.[0]?.lead_id;
      if (!id) {
        toast.info('No leads available right now.');
        return;
      }
      // Note: we intentionally do NOT overwrite status here.
      // Previously this forced status='new', which silently reverted
      // paid/converted leads back to 'new' when an agent picked them up.
      // The RPC now excludes paid/converted leads, so no reset is needed.



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

  // Listen for external "take next" triggers (e.g., from a lead's notes panel)
  useEffect(() => {
    const handler = () => {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
      takeNext();
    };
    window.addEventListener('open-pool:take-next', handler as EventListener);
    return () => window.removeEventListener('open-pool:take-next', handler as EventListener);
  }, [takeNext]);

  const startCall = useCallback(() => {
    if (!reservation) return;
    markCallStarted();
    toast.success('Call in progress', {
      description: 'Take the time you need. Log the outcome when the call finishes.',
      id: `open-pool-call-${reservation.lead.id}`,
    });
    // Scroll to the pinned lead row so the quick-log panel is in view.
    const el = document.querySelector(`[data-lead-id="${reservation.lead.id}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-emerald-400');
      setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-400'), 1600);
    }
  }, [reservation]);

  const cancel = useCallback(async () => {
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
      toast.error(e?.message ?? 'Could not cancel lead');
    } finally {
      setReleasing(false);
    }
  }, [reservation, releasing]);

  const openLead = useCallback(() => {
    if (!reservation) return;
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
  const phase = reservation?.phase ?? 'reserved';

  // Tiered emphasis by remaining seconds (reserved phase only).
  const tier =
    phase !== 'reserved' ? 'calm' :
    remaining <= 30 ? 'warn' :
    remaining <= 60 ? 'soon' : 'calm';

  const barTone = !enabled
    ? 'border-slate-200 bg-slate-50/80'
    : dryRun
      ? 'border-amber-200 bg-amber-50/60'
      : hasReservation
        ? phase === 'calling'
          ? 'border-sky-300 bg-sky-50/70'
          : tier === 'warn'
            ? 'border-amber-400 bg-amber-50'
            : 'border-emerald-300 bg-emerald-50/60'
        : 'border-emerald-200 bg-emerald-50/50';

  const firstName =
    (reservation?.lead as any)?.first_name?.trim() ||
    (reservation?.lead as any)?.name?.trim()?.split(' ')?.[0] ||
    'this';

  return (
    <>
    <div className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors ${barTone} ${className}`}>
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <CircleDot className={`h-3.5 w-3.5 shrink-0 ${!enabled ? 'text-slate-500' : dryRun ? 'text-amber-700' : phase === 'calling' ? 'text-sky-700' : 'text-emerald-700'}`} />
        <span className={`text-sm font-semibold ${!enabled ? 'text-slate-700' : phase === 'calling' ? 'text-sky-900' : 'text-emerald-900'}`}>Open Lead Pool</span>

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
          <span className="text-xs text-slate-700">
            Lead cancelled — no call was started before the reservation expired.
          </span>
        )}

        {hasReservation && phase === 'reserved' && (
          <span className={`inline-flex items-center gap-1 text-xs ${tier === 'warn' ? 'text-amber-800 font-semibold' : 'text-emerald-900 font-medium'}`}>
            <Clock className="h-3 w-3" />
            Reserved for {firstName} — click Call when ready · {formatMmSs(remaining)} hold before it returns to the pool
          </span>
        )}

        {hasReservation && phase === 'calling' && (
          <span className="inline-flex items-center gap-1 text-xs text-sky-900 font-medium">
            <PhoneCall className="h-3 w-3" />
            Call in progress with {firstName} · working for {formatMmSs(callingElapsed)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {hasReservation ? (
          <>
            {phase === 'reserved' ? (
              <button
                type="button"
                onClick={startCall}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
                Call
              </button>
            ) : (
              <button
                type="button"
                onClick={openLead}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 transition-colors"
              >
                Open lead
              </button>
            )}
            <button
              type="button"
              onClick={cancel}
              disabled={releasing}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-sm font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              {releasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Cancel lead
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

    <AlertDialog open={idlePromptOpen} onOpenChange={setIdlePromptOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you still working this lead?</AlertDialogTitle>
          <AlertDialogDescription>
            You've been on this lead for {formatMmSs(callingElapsed)} without logging an outcome.
            If you're still on the call, choose <strong>Still working</strong> to add another 10 minutes.
            Otherwise log <strong>Spoken to</strong> or <strong>No answer</strong> below.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              promptOpenedAtRef.current = null;
              setIdlePromptOpen(false);
              openLead();
            }}
          >
            Log outcome
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              extendCalling(CALLING_EXTENSION_MS);
              promptedRef.current = null;
              nudgedRef.current = null;
              promptOpenedAtRef.current = null;
              setIdlePromptOpen(false);
            }}
          >
            Still working (+10 min)
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
