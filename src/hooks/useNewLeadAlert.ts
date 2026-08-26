import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAdminId, useRealAdminId } from '@/hooks/useCurrentAdminId';
import { useViewAs } from '@/contexts/ViewAsContext';
import { isAlertsMuted } from '@/lib/alertSoundPreference';
import { setVisibleInterval } from '@/lib/visibilityInterval';
import { fetchByIdsInBatches } from '@/utils/batchedIn';
import { isHeavyTabBusy } from '@/lib/heavyTabBusy';
import { withBackgroundPriority } from '@/lib/requestQueue';


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

// PERFORMANCE: this hook is mounted by several components at once (sidebar,
// top banner, alert stack, open-pool alert). Each instance used to run its own
// 15s poll, so a single agent fired 4 identical `sales_leads` reads every 15s —
// by far the heaviest query in the database. All instances now share one
// in-flight request with a short TTL cache, so the DB sees one read per cycle.
//
// Measured follow-up: even shared, this read was the single most expensive
// statement in the database (988k calls, >12 hours of DB time) because the poll
// ran every 30s in every open tab. Realtime on `sales_leads` (filtered to this
// agent, below) is the real delivery path and invalidates the cache instantly,
// so the poll is now only a dropped-socket safety net and the TTL is long
// enough that four mounts plus a wake event cost one read, not five.
const ALERT_CACHE_TTL_MS = 45_000;
const _alertCache = new Map<string, { at: number; rows: any[]; inflight?: Promise<any[]> }>();
// Agent role, resolved once per session per agent (shared by all hook mounts).
const _roleCache = new Map<string, string>();
// Fully-computed pop-up queue (leads + own-note/own-call filtering), shared so
// four mounted consumers cost one set of reads instead of four.
const _queueCache = new Map<
  string,
  { at: number; rows: any[]; inflight?: Promise<any[]> }
>();
const QUEUE_CACHE_TTL_MS = 45_000;


const fetchAgentAlertLeads = (adminId: string): Promise<any[]> => {
  const entry = _alertCache.get(adminId);
  const now = Date.now();
  if (entry) {
    if (entry.inflight) return entry.inflight;
    if (now - entry.at < ALERT_CACHE_TTL_MS) return Promise.resolve(entry.rows);
  }
  const inflight = (async () => {
    const { data, error } = await withBackgroundPriority(() => supabase
      .from('sales_leads')
      .select('id, first_name, last_name, phone, email, created_at, assigned_at, status, is_paid, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage, lead_source, orr_first_call_deadline, orr_attempt_count, pool_status, orr_offer_expires_at')
      .eq('assigned_to', adminId)
      .eq('is_paid', false)
      .order('assigned_at', { ascending: false, nullsFirst: false })
      .limit(50));
    const rows = error || !data ? [] : (data as any[]);
    _alertCache.set(adminId, { at: Date.now(), rows });
    return rows;
  })();
  _alertCache.set(adminId, { at: entry?.at ?? 0, rows: entry?.rows ?? [], inflight });
  return inflight;
};

/** Drop the shared caches so the next load hits the database (realtime push). */
const invalidateAgentAlertCache = (adminId: string) => {
  _alertCache.delete(adminId);
  _queueCache.delete(adminId);
};

/**
 * Full pop-up queue for one agent — leads plus the "already worked by me"
 * filtering. Shared and TTL-cached so the four mounted consumers (sidebar,
 * top banner, alert stack, open-pool alert) cost ONE set of reads per cycle.
 */
const computeAgentQueue = (adminId: string): Promise<any[]> => {
  const entry = _queueCache.get(adminId);
  const now = Date.now();
  if (entry) {
    if (entry.inflight) return entry.inflight;
    if (now - entry.at < QUEUE_CACHE_TTL_MS) return Promise.resolve(entry.rows);
  }
  const inflight = (async () => {
    const data = await fetchAgentAlertLeads(adminId);
    let rows: any[] = [];
    if (data && data.length > 0) {
      // Only alert on genuinely fresh assignments: an assigned_at stamp inside
      // MAX_ALERT_AGE_MS. Keeps overnight/stale leads out of the pop-up stack.
      const actionable = data.filter((l: any) => {
        const status = (l.status || 'new').toLowerCase();
        if (!ACTIVE_ALERT_STATUSES.includes(status)) return false;
        if (!l.assigned_at) return false;
        if (Date.now() - new Date(l.assigned_at).getTime() > MAX_ALERT_AGE_MS) return false;
        return true;
      });

      // HARD RULE: never pop up a lead THIS agent has already worked (own note
      // or own call). Work by a previous owner must not silence it.
      const offered = actionable.filter((l: any) => l.pool_status === 'offered');
      const nonOffered = actionable.filter((l: any) => l.pool_status !== 'offered');
      rows = offered;
      if (nonOffered.length > 0) {
        const ids = nonOffered.map((l: any) => l.id);
        const [noteRows, callRows] = await withBackgroundPriority(() => Promise.all([
          fetchByIdsInBatches<any>(ids, (batch) =>
            supabase.from('lead_quick_notes').select('lead_id, created_by').in('lead_id', batch).eq('created_by', adminId),
            { label: 'new lead alert notes' }),
          fetchByIdsInBatches<any>(ids, (batch) =>
            supabase.from('lead_call_logs').select('lead_id').in('lead_id', batch).eq('agent_id', adminId),
            { label: 'new lead alert calls' }),
        ]));
        const touched = new Set<string>();
        noteRows.forEach((r) => { if (r?.lead_id && r.created_by) touched.add(r.lead_id); });
        callRows.forEach((r) => { if (r?.lead_id) touched.add(r.lead_id); });
        rows = [...offered, ...nonOffered.filter((l: any) => !touched.has(l.id))];
      }
    }
    _queueCache.set(adminId, { at: Date.now(), rows });
    return rows;
  })();
  _queueCache.set(adminId, { at: entry?.at ?? 0, rows: entry?.rows ?? [], inflight });
  return inflight;
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
// Only sales agents who actually work leads ever see new-lead pop-ups.
// Claims agents/managers and every other non-sales role are HARD excluded —
// they don't work leads and the cards were covering their claims screens.
const LEAD_ALERT_ROLES = ['sales', 'sales_lead', 'sales_manager', 'admin', 'super_admin'];

export const useNewLeadAlert = () => {
  // HARD RULE: pop-ups only ever show leads assigned to the SIGNED-IN agent.
  // `useCurrentAdminId` swaps to the impersonated agent under "View As", which
  // made a manager simulating an agent see that agent's leads pop up on their
  // own screen. Alerts therefore use the real account and are switched off
  // entirely while impersonating (read-only simulation must not beep).
  const viewedAdminId = useCurrentAdminId();
  const { isImpersonating } = useViewAs();
  const realAdminId = useRealAdminId();
  const adminId = isImpersonating ? null : (realAdminId || viewedAdminId);
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

  // Resolve the viewing agent's role — non-sales roles (e.g. claims agents
  // like claims@) never get a queue at all.
  // IMPORTANT: a failed/blocked read must NOT latch `false`, otherwise one
  // transient network blip permanently kills pop-ups until a hard reload —
  // that was the main "it works then stops" cause. On failure we retry.
  useEffect(() => {
    let cancelled = false;
    if (!adminId) {
      setAlertsAllowed(null);
      return;
    }
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const resolve = async () => {
      // Shared across every mount of this hook (sidebar, top banner, alert
      // stack, open-pool alert) — four identical admin_users reads per agent
      // per session was pure waste.
      const cached = _roleCache.get(adminId);
      if (cached !== undefined) {
        setAlertsAllowed(LEAD_ALERT_ROLES.includes(cached));
        return;
      }
      const { data, error } = await supabase
        .from('admin_users')
        .select('role')
        .eq('id', adminId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        // Unknown, not "denied" — retry with backoff (capped at 30s).
        attempt += 1;
        timer = setTimeout(resolve, Math.min(30000, 2000 * attempt));
        return;
      }
      attempt = 0;
      const role = String((data as any).role || '');
      _roleCache.set(adminId, role);
      setAlertsAllowed(LEAD_ALERT_ROLES.includes(role));
    };


    resolve();
    // Re-resolve when the agent comes back to the tab (session may have been
    // refreshed while the laptop was asleep).
    const onFocus = () => { if (!cancelled) resolve(); };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
    };
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
    setQueue(await computeAgentQueue(adminId));
  }, [adminId, alertsAllowed]);


  // Keep a stable ref to the latest loader so the realtime channel is created
  // ONCE per agent and never torn down/rebuilt on every state change.
  const loadRef = useRef(load);
  loadRef.current = load;

  // Polling safety net. 30s, plus an immediate refetch whenever the tab
  // becomes visible again or the network comes back — timers are frozen while
  // a laptop sleeps, which is why the queue used to look "stuck".
  // While a heavy screen (Quotes & Orders) is booting we skip the cycle so the
  // agent's own polling can't queue in front of the screen they're waiting on.
  useEffect(() => {
    load();
    // Safety-net poll only — realtime (filtered to this agent) is what actually
    // delivers new leads and it invalidates the shared cache on every push.
    // Was 30s per tab, which made this the heaviest query in the database.
    const stopPoll = setVisibleInterval(() => {
      if (isHeavyTabBusy()) return;
      loadRef.current();
    }, 150000);
    const wake = () => {
      if (document.visibilityState === 'visible' && !isHeavyTabBusy()) loadRef.current();
    };

    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    return () => {
      stopPoll();
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
    };
  }, [load]);

  const hasQueue = queue.length > 0;
  useEffect(() => {
    // Elapsed-time ticker only matters while a pop-up is on screen.
    if (!hasQueue) return;
    const t = setInterval(() => { if (document.hidden) return; setNow(Date.now()); }, 1000);
    return () => clearInterval(t);
  }, [hasQueue]);

  // Realtime push. Only `sales_leads` is in the realtime publication —
  // binding to lead_quick_notes / lead_call_logs (which are NOT published)
  // made the whole channel error out, silently killing live pop-ups until the
  // next poll. Own-note/own-call dismissal is handled by the loader instead.
  useEffect(() => {
    if (!adminId || alertsAllowed !== true) return;
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      channel = supabase
        .channel(`new-lead-alert-${adminId}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sales_leads', filter: `assigned_to=eq.${adminId}` },
          () => {
            invalidateAgentAlertCache(adminId);
            loadRef.current();
          }
        )

        .subscribe((status) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            attempt = 0;
            loadRef.current();
            return;
          }
          // A dropped socket (sleep, wifi change, expired token) must
          // reconnect — otherwise alerts stop for the rest of the session.
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            attempt += 1;
            const ch = channel;
            channel = null;
            if (ch) supabase.removeChannel(ch);
            retry = setTimeout(connect, Math.min(30000, 2000 * attempt));
          }
        });
    };

    connect();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      if (channel) supabase.removeChannel(channel);
    };
  }, [adminId, alertsAllowed]);

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
