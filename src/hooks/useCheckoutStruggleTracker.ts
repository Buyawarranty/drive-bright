import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { detectDeviceType } from '@/utils/deviceDetection';

type SignalType =
  | 'idle_timeout'
  | 'long_dwell'
  | 'payment_failed'
  | 'multi_attempt'
  | 'method_thrash'
  | 'bumper_cancelled'
  | 'exit_intent';

interface TrackerInput {
  enabled: boolean;
  customer: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  vehicleReg?: string;
  paymentType?: string; // monthly / full / etc
  planName?: string;
  amount?: number;
  paymentMethod?: 'stripe' | 'bumper' | null; // current selected
}

/** Tunable thresholds — change here to optimise conversion later. */
export const STRUGGLE_THRESHOLDS = {
  IDLE_MS: 60_000, // 60s with no interaction
  CUMULATIVE_MS: 150_000, // 150s visible checkout time…
  WINDOW_MS: 10 * 60_000, // …within a rolling 10-minute window, across visits
  SWITCHES: 2, // monthly ↔ pay-in-full / payment method switches
  HESITATION_FOR_EXIT_MS: 30_000, // exit intent counts once they've hesitated 30s+
  COOLDOWN_MS: 10 * 60_000, // at most one alert per customer every 10 minutes
};
const IDLE_MS = STRUGGLE_THRESHOLDS.IDLE_MS;

// Cumulative checkout time survives leaving/returning and refreshes (localStorage),
// and is shared across tabs (only the visible tab adds time, so no double counting).
const CUM_KEY = 'csa_checkout_cumulative';
interface CumState { windowStart: number; ms: number; visits: number; lastActive: number; sessionKey?: string }
const readCum = (): CumState | null => {
  try { return JSON.parse(localStorage.getItem(CUM_KEY) || 'null'); } catch { return null; }
};
const writeCum = (s: CumState) => { try { localStorage.setItem(CUM_KEY, JSON.stringify(s)); } catch { /* ignore */ } };

/** Timestamp (ms) of the last struggle alert this browser raised — drives the 10-minute cooldown. */
const COOLDOWN_KEY = 'csa_last_alert_at';
const readLastAlertAt = (): number => {
  try { return Number(localStorage.getItem(COOLDOWN_KEY)) || 0; } catch { return 0; }
};

/**
 * Fires a struggle alert row into checkout_struggle_alerts.
 * One row per (session_key, signal_type) thanks to the unique constraint —
 * we use upsert with ignoreDuplicates so repeat firings don't error.
 */
const SESSION_KEY = (() => {
  try {
    const cum = JSON.parse(localStorage.getItem('csa_checkout_cumulative') || 'null');
    if (cum?.sessionKey && Date.now() - cum.windowStart < 10 * 60_000) {
      sessionStorage.setItem('csa_session_key', cum.sessionKey);
      return cum.sessionKey as string;
    }
    const existing = sessionStorage.getItem('csa_session_key');
    if (existing) return existing;
    const k = `csa_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('csa_session_key', k);
    return k;
  } catch {
    return `csa_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
})();

export function useCheckoutStruggleTracker(input: TrackerInput) {
  const { enabled, customer, vehicleReg, paymentType, planName, amount, paymentMethod } = input;

  // keep latest values for handlers without re-arming timers on every keystroke
  const latest = useRef(input);
  latest.current = input;

  const firedRef = useRef<Set<SignalType>>(new Set());
  const methodToggleCountRef = useRef(0);
  const lastMethodRef = useRef<string | null>(null);
  const attemptCountRef = useRef(0);

  const fire = async (signal: SignalType, extraDetails: Record<string, any> = {}) => {
    if (firedRef.current.has(signal)) return;

    const c = latest.current;
    const name = [c.customer.first_name, c.customer.last_name].filter(Boolean).join(' ').trim();
    if (!name && !c.customer.email && !c.customer.phone) return; // no identifying info → useless alert

    // 10-minute cooldown: one alert per customer per 10 minutes, whatever the
    // reason. Signals suppressed here stay armed — if the customer is still
    // struggling when the cooldown ends, they raise a fresh alert.
    if (Date.now() - readLastAlertAt() < STRUGGLE_THRESHOLDS.COOLDOWN_MS) return;

    firedRef.current.add(signal);

    try {
      // Plain INSERT — never upsert. PostgREST treats an upsert as INSERT+UPDATE,
      // and the UPDATE policy on this table is staff-only, so an upsert from a
      // real (anonymous) website visitor is refused by RLS and no alert is ever
      // recorded. Duplicates are already prevented by firedRef, and the unique
      // constraint below is tolerated silently.
      const { error } = await supabase.from('checkout_struggle_alerts').insert({
        session_key: SESSION_KEY,
        signal_type: signal,
        customer_name: name || null,
        customer_email: c.customer.email?.trim() || null,
        customer_phone: c.customer.phone?.trim() || null,
        vehicle_reg: c.vehicleReg || null,
        device_type: detectDeviceType(),
        payment_method: c.paymentMethod || null,
        plan_name: c.planName || null,
        amount: c.amount ?? null,
        details: {
          payment_type: c.paymentType || null,
          url: typeof window !== 'undefined' ? window.location.href : null,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          // every reason this customer has tripped so far, so the dashboard can
          // show them together ("60s inactive + switched twice")
          reasons: Array.from(firedRef.current),
          ...extraDetails,
        },
        status: 'active',
      });
      // 23505 = duplicate for this session/signal, which is fine.
      if (!error || error.code === '23505') {
        try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch { /* ignore */ }
      } else if (error) {
        console.warn('[StruggleTracker] failed to insert alert', error);
      }
    } catch (err) {
      console.warn('[StruggleTracker] failed to insert alert', err);
    }
  };

  // Idle + cumulative-time + exit-intent tracking
  useEffect(() => {
    if (!enabled) return;
    const T = STRUGGLE_THRESHOLDS;

    // Start / continue the rolling window and count this visit.
    const now = Date.now();
    let cum = readCum();
    if (!cum || now - cum.windowStart > T.WINDOW_MS) {
      cum = { windowStart: now, ms: 0, visits: 0, lastActive: now, sessionKey: SESSION_KEY };
    }
    cum.visits += 1;
    cum.sessionKey = cum.sessionKey || SESSION_KEY;
    writeCum(cum);
    const visitStart = now;

    let idleTimer: number | undefined;
    const resetIdle = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      if (document.visibilityState !== 'visible') return; // away (e.g. 3D Secure / Bumper tab) is not idling
      idleTimer = window.setTimeout(() => {
        const c = readCum();
        fire('idle_timeout', { idle_ms: IDLE_MS, cumulative_ms: c?.ms ?? null, visits: c?.visits ?? null, priority: 'high' });
      }, IDLE_MS);
    };

    // Tick once a second; add time only while this tab is visible.
    let lastTick = Date.now();
    const tick = window.setInterval(() => {
      const t = Date.now();
      const delta = Math.min(t - lastTick, 2000);
      lastTick = t;
      if (document.visibilityState !== 'visible') return;
      let c = readCum();
      if (!c || t - c.windowStart > T.WINDOW_MS) {
        c = { windowStart: t, ms: 0, visits: 1, lastActive: t, sessionKey: SESSION_KEY };
      }
      c.ms += delta;
      c.lastActive = t;
      writeCum(c);
      if (c.ms >= T.CUMULATIVE_MS) {
        fire('long_dwell', { dwell_ms: c.ms, cumulative_ms: c.ms, visits: c.visits, window_ms: T.WINDOW_MS, priority: 'medium' });
      }
    }, 1000);

    const onVisibility = () => { lastTick = Date.now(); resetIdle(); };
    const onExit = (e: MouseEvent) => {
      if (e.clientY > 0 || e.relatedTarget) return; // only when the pointer leaves through the top
      const c = readCum();
      const hesitated = (c?.ms ?? 0) >= T.HESITATION_FOR_EXIT_MS || Date.now() - visitStart >= T.HESITATION_FOR_EXIT_MS;
      if (hesitated) fire('exit_intent', { cumulative_ms: c?.ms ?? null, visits: c?.visits ?? null, priority: 'high' });
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click', 'input'];
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('mouseout', onExit);
    resetIdle();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle));
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('mouseout', onExit);
      if (idleTimer) window.clearTimeout(idleTimer);
      window.clearInterval(tick);
    };
  }, [enabled]);

  // Monthly / pay-in-full (= payment method) switching
  useEffect(() => {
    if (!enabled || !paymentType) return;
    if (lastMethodRef.current && lastMethodRef.current !== paymentType) {
      methodToggleCountRef.current += 1;
      if (methodToggleCountRef.current >= STRUGGLE_THRESHOLDS.SWITCHES) {
        fire('method_thrash', { toggles: methodToggleCountRef.current, priority: 'high' });
      }
    }
    lastMethodRef.current = paymentType;
  }, [paymentType, enabled]);

  // Detect Bumper cancellation via URL param (?bumper=cancelled or ?cancel=1 after return)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('bumper_cancelled') || url.searchParams.get('cancelled') === '1') {
      fire('bumper_cancelled', { from_url: true });
    }
  }, [enabled]);

  // Exposed callbacks for parent to report payment events
  const reportPaymentAttempt = (method: 'stripe' | 'bumper') => {
    attemptCountRef.current += 1;
    if (attemptCountRef.current >= 2) {
      fire('multi_attempt', { attempts: attemptCountRef.current, method });
    }
  };

  const reportPaymentFailed = (method: 'stripe' | 'bumper', message?: string) => {
    // Clear the dedupe so a fresh failure still fires (one alert per session is enough)
    fire('payment_failed', { method, message: message || null, priority: 'critical' });
  };

  return { reportPaymentAttempt, reportPaymentFailed };
}
