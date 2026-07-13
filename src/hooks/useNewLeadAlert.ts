import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { toast } from 'sonner';

// Short attention beep — synthesised at runtime so we don't ship an audio asset.
let _audioCtx: AudioContext | null = null;
const playNewLeadBeep = () => {
  try {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Ctor) return;
    _audioCtx = _audioCtx || new Ctor();
    const ctx = _audioCtx;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    // Audio is a nice-to-have; never let it break the UI.
  }
};

const notifyNewLead = (lead: { id: string; first_name: string | null; last_name: string | null; phone: string | null }) => {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'New lead';
  playNewLeadBeep();
  toast('🔥 New lead assigned to you!', {
    description: `${name}${lead.phone ? ` — ${lead.phone}` : ''} — call now before it goes cold.`,
    duration: 10000,
    closeButton: true,
    className: '!bg-orange-500 !text-white !border-orange-600 !font-semibold',
  });
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      new Notification('🔥 New lead assigned', {
        body: `${name}${lead.phone ? ` — ${lead.phone}` : ''}`,
        tag: `new-lead-${lead.id}`,
      });
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  } catch {
    // Notifications API not available — toast + beep is enough.
  }
};

export interface NewLeadAlertData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
  assigned_at: string | null;
  status: string | null;
}

// Alert only fires while the lead is still in its default "new" state.
// Any other status the agent picks from the dropdown silences the banner.
const ACTIVE_ALERT_STATUSES = ['new', '', 'null'];
// Hard timeout — after 24h the alert auto-clears; uncontacted leads live in
// the Recontact / Unworked reports, not the top-of-page banner.
const MAX_ALERT_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Returns the newest lead assigned to the current agent that has NOT yet been
 * "actioned" by them (no note added by the agent AND no call log by the agent).
 * Refetches every 20s and via realtime; the elapsed clock ticks every second.
 */
export const useNewLeadAlert = () => {
  const adminId = useCurrentAdminId();
  const [lead, setLead] = useState<NewLeadAlertData | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [popupDismissedFor, setPopupDismissedFor] = useState<string | null>(null);
  const currentLeadIdRef = useRef<string | null>(null);
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedOnceRef = useRef(false);

  const load = useCallback(async () => {
    if (!adminId) {
      setLead(null);
      return;
    }
    const { data, error } = await supabase
      .from('sales_leads')
      .select('id, first_name, last_name, phone, created_at, assigned_at, status, is_paid')
      .eq('assigned_to', adminId)
      .eq('is_paid', false)
      .order('assigned_at', { ascending: false, nullsFirst: false })
      .limit(10);

    if (error || !data) {
      setLead(null);
      return;
    }

    const candidates = data.filter((l: any) => {
      const status = (l.status || 'new').toLowerCase();
      if (!ACTIVE_ALERT_STATUSES.includes(status)) return false;
      const ageMs = Date.now() - new Date(l.created_at).getTime();
      if (ageMs > MAX_ALERT_AGE_MS) return false;
      return true;
    });

    for (const l of candidates) {
      const [{ count: noteCount }, { count: callCount }] = await Promise.all([
        supabase
          .from('lead_quick_notes')
          .select('id', { count: 'exact', head: true })
          .eq('lead_id', l.id)
          .eq('created_by', adminId),
        supabase
          .from('lead_call_logs')
          .select('id', { count: 'exact', head: true })
          .eq('lead_id', l.id)
          .eq('agent_id', adminId),
      ]);
      if ((noteCount || 0) === 0 && (callCount || 0) === 0) {
        setLead(l as NewLeadAlertData);
        currentLeadIdRef.current = l.id;
        return;
      }
    }
    setLead(null);
    currentLeadIdRef.current = null;
  }, [adminId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel(`new-lead-alert-${adminId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_leads', filter: `assigned_to=eq.${adminId}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lead_quick_notes', filter: `created_by=eq.${adminId}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lead_call_logs', filter: `agent_id=eq.${adminId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminId, load]);

  const elapsedMs = lead ? now - new Date(lead.created_at).getTime() : 0;

  const dismissPopup = useCallback(() => {
    if (lead) setPopupDismissedFor(lead.id);
  }, [lead]);

  const popupDismissed = !!lead && popupDismissedFor === lead.id;

  return { lead, elapsedMs, dismissPopup, popupDismissed };
};

export const formatElapsed = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
