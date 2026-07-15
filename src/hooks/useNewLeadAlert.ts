import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';

// Short attention beep — synthesised at runtime so we don't ship an audio asset.
let _audioCtx: AudioContext | null = null;
export const playNewLeadBeep = () => {
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

export interface NewLeadAlertData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  assigned_at: string | null;
  status: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | number | null;
  mileage: string | number | null;
  lead_source: string | null;
}


// Alert only fires while the lead is still in its default "new" state.
// Any other status the agent picks from the dropdown silences the banner.
const ACTIVE_ALERT_STATUSES = ['new', '', 'null'];
// Hard timeout — after 24h the alert auto-clears; uncontacted leads live in
// the Recontact / Unworked reports, not the top-of-page banner.
const MAX_ALERT_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Returns a queue of leads assigned to the current agent that haven't been
 * actioned (no note/call by the agent) AND haven't been dismissed via the
 * pop-up X button. Also returns the freshest one (for the top banner).
 *
 * Refetches every 20s + realtime. Beeping cadence is driven by the consumer
 * component so it can keep chirping until every card is dismissed.
 */
export const useNewLeadAlert = () => {
  const adminId = useCurrentAdminId();
  const [queue, setQueue] = useState<NewLeadAlertData[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('new-lead-alert-dismissed');
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  });
  const [popupDismissedFor, setPopupDismissedFor] = useState<string | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem('new-lead-alert-snoozed');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const persistDismissed = useCallback((next: Set<string>) => {
    try {
      // Cap to 200 ids so localStorage stays tiny.
      const arr = Array.from(next).slice(-200);
      localStorage.setItem('new-lead-alert-dismissed', JSON.stringify(arr));
    } catch {
      // ignore quota errors
    }
  }, []);

  const persistSnoozed = useCallback((next: Record<string, number>) => {
    try {
      localStorage.setItem('new-lead-alert-snoozed', JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const snoozeLead = useCallback((leadId: string, minutes: number = 5) => {
    setSnoozedUntil((prev) => {
      const next = { ...prev, [leadId]: Date.now() + minutes * 60 * 1000 };
      persistSnoozed(next);
      return next;
    });
  }, [persistSnoozed]);

  const load = useCallback(async () => {
    if (!adminId) {
      setQueue([]);
      return;
    }
    const { data, error } = await supabase
      .from('sales_leads')
      .select('id, first_name, last_name, phone, email, created_at, assigned_at, status, is_paid')
      .eq('assigned_to', adminId)
      .eq('is_paid', false)
      .order('assigned_at', { ascending: false, nullsFirst: false })
      .limit(50);

    if (error || !data) {
      setQueue([]);
      return;
    }

    // Filter to leads still needing attention: "new"-ish status + within 24h.
    const candidates = (data as any[]).filter((l) => {
      const status = (l.status || 'new').toLowerCase();
      if (!ACTIVE_ALERT_STATUSES.includes(status)) return false;
      const ageMs = Date.now() - new Date(l.created_at).getTime();
      if (ageMs > MAX_ALERT_AGE_MS) return false;
      return true;
    });

    if (candidates.length === 0) {
      setQueue([]);
      return;
    }

    // Drop any that already have a note or call from this agent.
    const checks = await Promise.all(
      candidates.map(async (l) => {
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
        return (noteCount || 0) === 0 && (callCount || 0) === 0 ? l : null;
      })
    );

    const actionable = checks.filter(Boolean) as NewLeadAlertData[];
    setQueue(actionable);
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

  const dismissLead = useCallback((leadId: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(leadId);
      persistDismissed(next);
      return next;
    });
  }, [persistDismissed]);

  // Undismissed + not currently snoozed = visible. Once snooze expires, card
  // reappears and the beep fires again.
  const visibleQueue = queue.filter((l) => {
    if (dismissedIds.has(l.id)) return false;
    const until = snoozedUntil[l.id];
    if (until && until > now) return false;
    return true;
  });
  const lead = visibleQueue[0] || null;
  const elapsedMs = lead ? now - new Date(lead.created_at).getTime() : 0;

  const dismissPopup = useCallback(() => {
    if (lead) setPopupDismissedFor(lead.id);
  }, [lead]);

  const popupDismissed = !!lead && popupDismissedFor === lead.id;

  return {
    lead,
    elapsedMs,
    dismissPopup,
    popupDismissed,
    queue: visibleQueue,
    dismissLead,
    snoozeLead,
  };
};

export const formatElapsed = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
