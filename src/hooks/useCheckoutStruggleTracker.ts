import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { detectDeviceType } from '@/utils/deviceDetection';

type SignalType =
  | 'idle_timeout'
  | 'long_dwell'
  | 'payment_failed'
  | 'multi_attempt'
  | 'method_thrash'
  | 'bumper_cancelled';

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

const IDLE_MS = 90_000; // 90s with no interaction
const DWELL_MS = 180_000; // 3 min total on page

/**
 * Fires a struggle alert row into checkout_struggle_alerts.
 * One row per (session_key, signal_type) thanks to the unique constraint —
 * we use upsert with ignoreDuplicates so repeat firings don't error.
 */
const SESSION_KEY = (() => {
  try {
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
    firedRef.current.add(signal);

    const c = latest.current;
    const name = [c.customer.first_name, c.customer.last_name].filter(Boolean).join(' ').trim();
    if (!name && !c.customer.email && !c.customer.phone) {
      // No identifying info → useless alert, skip
      firedRef.current.delete(signal);
      return;
    }

    try {
      await supabase.from('checkout_struggle_alerts').upsert({
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
          ...extraDetails,
        },
        status: 'active',
      }, { onConflict: 'session_key,signal_type', ignoreDuplicates: true });
    } catch (err) {
      console.warn('[StruggleTracker] failed to insert alert', err);
    }
  };

  // Idle + dwell timers
  useEffect(() => {
    if (!enabled) return;

    let idleTimer: number | undefined;
    let dwellTimer: number | undefined;

    const resetIdle = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => fire('idle_timeout', { idle_ms: IDLE_MS }), IDLE_MS);
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();

    dwellTimer = window.setTimeout(() => fire('long_dwell', { dwell_ms: DWELL_MS }), DWELL_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle));
      if (idleTimer) window.clearTimeout(idleTimer);
      if (dwellTimer) window.clearTimeout(dwellTimer);
    };
  }, [enabled]);

  // Payment-method toggle thrash
  useEffect(() => {
    if (!enabled || !paymentType) return;
    if (lastMethodRef.current && lastMethodRef.current !== paymentType) {
      methodToggleCountRef.current += 1;
      if (methodToggleCountRef.current >= 3) {
        fire('method_thrash', { toggles: methodToggleCountRef.current });
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
    fire('payment_failed', { method, message: message || null });
  };

  return { reportPaymentAttempt, reportPaymentFailed };
}
