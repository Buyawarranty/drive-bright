import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { isAlertsMuted } from '@/lib/alertSoundPreference';

// Business-hours gate — pop-ups AND beeps only fire 09:00–18:00 Europe/London.
// Outside this window nothing appears: overnight assignments are picked up
// naturally when agents start the day, they don't need a stale queue of
// pop-ups waiting for them.
const londonMinutes = (d: Date): number => {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    return h * 60 + m;
  } catch {
    return -1;
  }
};

const WORK_START_MIN = 8 * 60;    // 08:00 London
const WORK_END_MIN = 20 * 60;     // 20:00 London


export const isBeepBusinessHours = (): boolean => {
  const mins = londonMinutes(new Date());
  if (mins < 0) return true;
  return mins >= WORK_START_MIN && mins < WORK_END_MIN;
};

export const isPopupBusinessHours = isBeepBusinessHours;

// Was the given timestamp itself within 09:00–18:00 London? Used to suppress
// pop-ups for leads that landed overnight — agents just review those in the
// list rather than closing 50 stacked cards when they arrive at 09:00.
const isAssignedDuringWorkHours = (iso: string | null): boolean => {
  if (!iso) return false;
  const mins = londonMinutes(new Date(iso));
  if (mins < 0) return false;
  return mins >= WORK_START_MIN && mins < WORK_END_MIN;
};

// Short attention beep — synthesised at runtime so we don't ship an audio asset.
let _audioCtx: AudioContext | null = null;
export const playNewLeadBeep = () => {
  if (isAlertsMuted()) return;
  if (!isBeepBusinessHours()) return;
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
  // ORR (Open Round Robin) context — when the lead was released via ORR the
  // agent has `orr_first_call_deadline` (typically ~2 minutes) to start the
  // call before it passes to the next eligible Team Blue agent. Presence of
  // a future deadline flips the pop-up to the blue ORR theme + countdown.
  orr_first_call_deadline: string | null;
  orr_attempt_count: number | null;
  // Offered ORR — when set to 'offered', the lead is a 120s Accept/Pass offer
  // (not yet locked to this agent). Pass → reoffers to next ORR agent.
  pool_status: string | null;
  orr_offer_expires_at: string | null;
}



// Alert only fires while the lead is still in its default "new" state.
// Any other status the agent picks from the dropdown silences the banner.
const ACTIVE_ALERT_STATUSES = ['new', '', 'null'];
// Hard timeout — only pop up leads assigned in the last 12 hours so a lead
// from days ago can never resurrect. Within business hours (08:30–18:30) any
// assignment inside this window keeps beeping until the agent dismisses it.
const MAX_ALERT_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * Returns a queue of leads assigned to the current agent that haven't been
 * actioned (no note/call by the agent) AND haven't been dismissed via the
 * pop-up X button. Also returns the freshest one (for the top banner).
 *
 * Refetches every 20s + realtime. Beeping cadence is driven by the consumer
 * component so it can keep chirping until every card is dismissed.
 */
// Only lead-working roles ever see new-lead pop-ups. Claims agents/managers
// (and any other non-sales role) are HARD excluded — they don't work leads and
// the cards were covering their claims screens.
const LEAD_ALERT_ROLES = ['sales', 'sales_lead', 'sales_manager'];

export const useNewLeadAlert = () => {
  const adminId = useCurrentAdminId();
  const [alertsAllowed, setAlertsAllowed] = useState<boolean | null>(null);
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

  // Resolve the viewing agent's role once — non-sales roles (e.g. claims
  // agents like claims@) never get a queue at all.
  useEffect(() => {
    let cancelled = false;
    if (!adminId) {
      setAlertsAllowed(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('role')
        .eq('id', adminId)
        .maybeSingle();
      if (cancelled) return;
      setAlertsAllowed(LEAD_ALERT_ROLES.includes(String((data as any)?.role || '')));
    })();
    return () => { cancelled = true; };
  }, [adminId]);

  const load = useCallback(async () => {
    if (!adminId) {
      setQueue([]);
      return;
    }
    // Role gate — claims (and any other non-lead-working role) get nothing.
    if (alertsAllowed !== true) {
      setQueue([]);
      return;
    }

    // Hard business-hours gate — no pop-ups at all outside 08:30–18:30 London.
    if (!isPopupBusinessHours()) {
      setQueue([]);
      return;
    }
    const { data, error } = await supabase
      .from('sales_leads')
      .select('id, first_name, last_name, phone, email, created_at, assigned_at, status, is_paid, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage, lead_source, orr_first_call_deadline, orr_attempt_count, pool_status, orr_offer_expires_at')
      .eq('assigned_to', adminId)
      .eq('is_paid', false)
      .order('assigned_at', { ascending: false, nullsFirst: false })
      .limit(50);


    if (error || !data) {
      setQueue([]);
      return;
    }

    // Only alert on genuinely fresh assignments: must have an assigned_at
    // stamp AND that stamp must be within MAX_ALERT_AGE_MS. This kills the
    // overnight queue of 200h+ old leads bubbling up first thing in the
    // morning — those go to Recontact/Unworked instead.
    // Every lead assigned to this agent within the age window pops for them
    // — regardless of how it was assigned (auto round-robin, manual allocate,
    // recontact claim, bulk move). The pop-up stays visible with the beep
    // until the agent clicks X to dismiss it themselves. Notes/calls from
    // other agents no longer silence it — only this agent's own dismissal
    // (persisted in localStorage) removes the card from their view.
    const actionable = (data as any[]).filter((l) => {
      const status = (l.status || 'new').toLowerCase();
      if (!ACTIVE_ALERT_STATUSES.includes(status)) return false;
      if (!l.assigned_at) return false;
      const assignedTs = new Date(l.assigned_at).getTime();
      const ageMs = Date.now() - assignedTs;
      if (ageMs > MAX_ALERT_AGE_MS) return false;
      // Leads assigned overnight / before 09:00 still pop — but only once the
      // agent is inside business hours (the gate above already enforces that).
      // The 12h age cap keeps stale leads out.
      return true;
    }) as NewLeadAlertData[];

    // HARD RULE: never pop up a lead a HUMAN agent has already worked. A lead
    // is "touched" if it has an agent-written note (created_by set) or a call
    // log. System-generated notes (arrival timestamps, status stamps, routing
    // audit rows) do NOT count — they exist on every lead and were silently
    // suppressing every pop-up.
    if (actionable.length > 0) {
      // Offered ORR leads always pop — they're brand new offers to THIS
      // agent, even if the lead was previously offered to (and passed by)
      // other ORR agents. Only filter the "touched" rule against
      // non-offered leads.
      const offered = actionable.filter((l: any) => l.pool_status === 'offered');
      const nonOffered = actionable.filter((l: any) => l.pool_status !== 'offered');
      let clean: NewLeadAlertData[] = offered;
      if (nonOffered.length > 0) {
        const ids = nonOffered.map((l) => l.id);
        const [notesRes, callsRes] = await Promise.all([
          supabase.from('lead_quick_notes').select('lead_id, created_by').in('lead_id', ids),
          supabase.from('lead_call_logs').select('lead_id').in('lead_id', ids),
        ]);
        const touched = new Set<string>();
        (notesRes.data as any[] | null)?.forEach((r) => {
          if (r?.lead_id && r.created_by) touched.add(r.lead_id);
        });
        (callsRes.data as any[] | null)?.forEach((r) => r?.lead_id && touched.add(r.lead_id));
        clean = [...offered, ...nonOffered.filter((l) => !touched.has(l.id))];
      }
      setQueue(clean);
      return;
    }

    setQueue(actionable);
  }, [adminId, alertsAllowed]);


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
    if (!adminId || alertsAllowed !== true) return;
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
        (payload) => {
          const leadId = (payload.new as any)?.lead_id;
          if (leadId) dismissLead(leadId);
          load();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lead_call_logs', filter: `agent_id=eq.${adminId}` },
        (payload) => {
          // Any call this agent logs for a lead silences that lead's pop-up
          // — they've clearly seen it and are actioning it.
          const leadId = (payload.new as any)?.lead_id;
          if (leadId) dismissLead(leadId);
          load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId, alertsAllowed, load]);

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
