import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleDot, X, Loader2, Volume2, VolumeX, Clock, BadgeCheck, Lock, UserPlus, Zap, ShieldCheck, History } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useAgentOpenPoolMode } from '@/hooks/useAgentOpenPoolMode';
import { useSharkTankSettings } from '@/hooks/useSharkTank';
import {
  setOpenPoolReservation,
  useOpenPoolReservation,
} from '@/hooks/useOpenLeadPoolReservation';
import type { Lead } from '@/hooks/useLeads';
import { toast } from 'sonner';
import { playNewLeadBeep } from '@/hooks/useNewLeadAlert';

/**
 * Persistent "New lead in the Open Pool → Take lead" popup.
 * Shows ONLY for agents whose distribution mode is 'open_pool'.
 *
 * ONLY counts leads that are genuinely brand-new to the sales pipeline:
 *   - original_assigned_to IS NULL (never assigned to any agent)
 *   - pool_recycle_count = 0 (never returned from round-robin)
 * Recycled / previously-owned leads are excluded from the alert count —
 * agents should only be nudged for fresh work.
 */
/**
 * KILL SWITCH — Open Round Robin pop-ups are NOT authorised.
 * Nobody sees this pop-up (no role, no manager, no test account) while this
 * is false. The wording and behaviour must be signed off by the business
 * owner before this is flipped back to true. Do not change without an
 * explicit instruction from the owner.
 */
const ORR_POPUP_AUTHORISED = false;

export function OpenPoolLeadAlert() {
  if (!ORR_POPUP_AUTHORISED) return null;
  return <OpenPoolLeadAlertInner />;
}

function OpenPoolLeadAlertInner() {

  const currentAdminId = useCurrentAdminId();
  const { adminId, isOpenPoolAgent } = useAgentOpenPoolMode(currentAdminId);
  const { settings } = useSharkTankSettings();
  const reservation = useOpenPoolReservation();
  const [poolCount, setPoolCount] = useState(0);
  const [baselineCount, setBaselineCount] = useState<number | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [taking, setTaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const prevCountRef = useRef<number | null>(null);


  // Count unclaimed leads currently sitting in the Open Pool.
  // Fresh-only: never assigned to anyone, never recycled from RR, never
  // contacted (no call attempts logged, pool_status still 'new'), and the
  // lifecycle status is still 'new' — anything moved to quote_sent /
  // contacted / callback / etc. has already been worked and must not
  // resurface as a "new" pool alert.
  const loadCount = useCallback(async () => {
    if (!isOpenPoolAgent) { setPoolCount(0); return; }
    const { count } = await (supabase as any)
      .from('sales_leads')
      .select('id', { count: 'exact', head: true })
      .eq('queue', 'live_open_pool')
      .eq('status', 'new')
      .is('assigned_to', null)
      .is('owner_agent', null)
      .is('original_assigned_to', null)
      .is('last_contacted_at', null)
      .or('call_count.is.null,call_count.eq.0')
      .or('pool_recycle_count.is.null,pool_recycle_count.eq.0')
      .or('pool_status.is.null,pool_status.eq.new');
    setPoolCount(count ?? 0);
    setBaselineCount((prev) => (prev === null ? (count ?? 0) : prev));
  }, [isOpenPoolAgent]);

  useEffect(() => {
    loadCount();
    const t = setInterval(loadCount, 15000);
    return () => clearInterval(t);
  }, [loadCount]);

  // Realtime — any pool row change refreshes the count.
  useEffect(() => {
    if (!isOpenPoolAgent) return;
    const ch = supabase
      .channel(`open-pool-alert-${adminId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sales_leads', filter: 'queue=eq.live_open_pool' },
        () => loadCount()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [adminId, isOpenPoolAgent, loadCount]);

  // Beep on arrival + every 10s while the popup is visible.
  const showing =
    isOpenPoolAgent &&
    poolCount > 0 &&
    !reservation &&
    Date.now() >= snoozedUntil;

  // Beep for the first 15 seconds after the popup appears (or after a fresh
  // arrival grows the count). Mute stops it immediately.
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = poolCount;
    if (!showing || muted) return;
    const isFreshArrival = prev === null || poolCount > (prev ?? 0);
    if (!isFreshArrival) return;

    playNewLeadBeep();
    const startedAt = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - startedAt >= 15000) {
        clearInterval(interval);
        return;
      }
      playNewLeadBeep();
    }, 2000);
    return () => clearInterval(interval);
  }, [showing, poolCount, muted]);

  // Auto-dismiss (snooze) after 20 seconds.
  useEffect(() => {
    if (!showing) return;
    const t = setTimeout(() => {
      setSnoozedUntil(Date.now() + 60 * 1000);
    }, 20000);
    return () => clearTimeout(t);
  }, [showing, poolCount]);


  const HOLD_SECONDS = Number((settings as any)?.hold_seconds ?? 60);

  const takeLead = useCallback(async () => {
    if (!adminId || taking) return;
    setTaking(true);
    try {
      const { data, error } = await (supabase as any).rpc('open_pool_get_next', { _agent: adminId });
      if (error) throw error;
      const id = data?.[0]?.lead_id;
      if (!id) {
        toast.info('No leads available right now.');
        loadCount();
        return;
      }
      const { data: row } = await supabase
        .from('sales_leads').select('*').eq('id', id).maybeSingle();
      if (!row) return;
      setOpenPoolReservation({
        lead: row as unknown as Lead,
        lockedAt: Date.now(),
        holdSeconds: HOLD_SECONDS,
      });
      toast.success('Lead reserved — call within the hold window.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not take a lead');
    } finally {
      setTaking(false);
    }
  }, [adminId, taking, HOLD_SECONDS, loadCount]);

  const snooze = () => {
    setSnoozedUntil(Date.now() + 60 * 1000);
    toast('Popup snoozed 1 min', { duration: 1500 });
  };

  const justAdded = Math.max(0, poolCount - (baselineCount ?? poolCount));

  if (!showing) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-2xl overflow-hidden animate-in slide-in-from-right-4 border border-emerald-100">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 bg-emerald-700 text-white">
        <div className="h-7 w-7 rounded-full border-2 border-white/80 flex items-center justify-center">
          <CircleDot className="w-3.5 h-3.5 animate-pulse" />
        </div>
        <span className="font-bold text-base tracking-tight">Open Round Robin</span>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="ml-auto p-1.5 rounded hover:bg-white/15"
          aria-label={muted ? 'Unmute alert sound' : 'Mute alert sound'}
          title={muted ? 'Unmute' : 'Mute beep'}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={snooze}
          className="p-1.5 rounded hover:bg-white/15"
          aria-label="Snooze for 1 minute"
          title="Snooze 1 min"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start gap-4">
          {/* Just-added chip — only show when there are genuinely new arrivals
              since the popup opened. Prevents the confusing "0 new / 1 available" state. */}
          {justAdded > 0 && (
            <div className="shrink-0 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-center w-[110px]">
              <UserPlus className="h-5 w-5 mx-auto text-emerald-700" strokeWidth={2.25} />
              <div className="mt-1 text-4xl font-extrabold text-emerald-700 leading-none">
                {justAdded}
              </div>
              <div className="mt-1 text-[10px] font-bold tracking-wide text-emerald-700 leading-tight">
                JUST<br />ADDED
              </div>

            </div>
          )}

          {/* Headline */}
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="text-2xl font-extrabold leading-tight text-slate-900">
              <span className="text-emerald-700">{poolCount}</span>{' '}
              {poolCount === 1 ? 'never-contacted lead' : 'never-contacted leads'} waiting
            </h3>
            <p className="mt-1.5 text-sm text-slate-600">
              Take the next one and start the first call within 120 seconds to keep it.
            </p>
          </div>
        </div>

        {/* Feature strip */}
        <div className="mt-4 rounded-xl bg-emerald-50/60 border border-emerald-100 px-4 py-3 grid grid-cols-3 gap-3 text-[11px]">
          <div className="flex gap-2">
            <Clock className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-800">One at a time</div>
              <div className="text-slate-600 leading-snug">You get one lead, not a pile.</div>
            </div>
          </div>
          <div className="flex gap-2 border-l border-emerald-200/70 pl-3">
            <BadgeCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-800">120s to dial</div>
              <div className="text-slate-600 leading-snug">Start the first call within 2 min.</div>
            </div>
          </div>
          <div className="flex gap-2 border-l border-emerald-200/70 pl-3">
            <Lock className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-800">Yours to keep</div>
              <div className="text-slate-600 leading-snug">Call in time and the lead stays with you.</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          disabled={taking}
          onClick={takeLead}
          className="claim-next-btn mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-3 text-base font-bold disabled:opacity-60 transition-colors"
        >
          {taking ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Claiming…</>
          ) : (
            <><Zap className="h-5 w-5" strokeWidth={2.5} /> Take next lead</>
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2 text-[11px] text-slate-600 min-w-0">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <span className="truncate">Only take a lead if you can call it right now.</span>
        </div>
      </div>
    </div>
  );
}
