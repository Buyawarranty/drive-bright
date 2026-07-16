import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleDot, X, Loader2, Volume2, VolumeX } from 'lucide-react';

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
 * Independent of the global Shark Tank enabled switch — as long as the
 * agent is on Open Pool, they must be prompted when work is waiting.
 *
 * Behaviour:
 * - Polls `sales_leads` for unclaimed pool leads + subscribes to realtime.
 * - Beeps immediately on new arrivals and every 10s while a card is up.
 * - "Take lead" calls the same open_pool_get_next RPC used by the bar,
 *   then hands off to OpenLeadPoolBar's reservation state so the existing
 *   call / cancel / idle-guard flow takes over.
 * - X button snoozes the popup for 60s (queue count is still visible in
 *   the top-of-page pool bar).
 */
export function OpenPoolLeadAlert() {
  const currentAdminId = useCurrentAdminId();
  const { adminId, isOpenPoolAgent } = useAgentOpenPoolMode(currentAdminId);
  const { settings } = useSharkTankSettings();
  const reservation = useOpenPoolReservation();
  const [poolCount, setPoolCount] = useState(0);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [taking, setTaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const prevCountRef = useRef<number | null>(null);


  // Count unclaimed leads currently sitting in the Open Pool.
  const loadCount = useCallback(async () => {
    if (!isOpenPoolAgent) { setPoolCount(0); return; }
    const { count } = await (supabase as any)
      .from('sales_leads')
      .select('id', { count: 'exact', head: true })
      .eq('queue', 'live_open_pool')
      .is('assigned_to', null)
      .is('owner_agent', null)
      .not('status', 'in', '(lost,converted,fake_lead,archived)');
    setPoolCount(count ?? 0);
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

  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = poolCount;
    if (!showing) return;
    // Beep whenever the count grows OR on first show — unless muted.
    if (!muted && (prev === null || poolCount > (prev ?? 0))) {
      playNewLeadBeep();
    }
    if (muted) return;
    const t = setInterval(playNewLeadBeep, 10000);
    return () => clearInterval(t);
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

  if (!showing) return null;

  return (
    <div className="fixed top-20 right-4 z-[99] w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border-2 border-emerald-500 bg-white shadow-2xl overflow-hidden animate-in slide-in-from-right-4">
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white">
        <CircleDot className="w-4 h-4 animate-pulse" />
        <span className="font-bold text-sm tracking-wide">Open Lead Pool</span>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="ml-auto p-1 rounded hover:bg-white/20"
          aria-label={muted ? 'Unmute alert sound' : 'Mute alert sound'}
          title={muted ? 'Unmute' : 'Mute beep'}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={snooze}
          className="p-1 rounded hover:bg-white/20"
          aria-label="Snooze for 1 minute"
          title="Snooze 1 min"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3">
        <p className="text-sm text-slate-800">
          <span className="font-extrabold text-emerald-700 text-lg">{poolCount}</span>{' '}
          new {poolCount === 1 ? 'lead has' : 'leads have'} been added to the Open Pool. Claim any leads you're available to contact now.
        </p>
        <button
          type="button"
          disabled={taking}
          onClick={takeLead}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-bold shadow disabled:opacity-60"
        >
          {taking ? <><Loader2 className="h-4 w-4 animate-spin" /> Claiming…</> : 'Claim a lead'}
        </button>
      </div>
    </div>
  );
}
