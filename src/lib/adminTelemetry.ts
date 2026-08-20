/**
 * Admin dashboard telemetry.
 *
 * Records what staff actually do (and where things break) inside the CRM so we
 * can see why a page felt slow or blank for one agent but fine for everyone else.
 *
 * Events logged:
 *  - page_load  : dashboard/tab opened, with time-to-interactive
 *  - cta_click  : any button / link click, with its visible label
 *  - crash      : React error boundary caught a render failure
 *  - js_error   : uncaught window error or unhandled promise rejection
 *  - slow_load  : an operation exceeded its expected budget
 *
 * Never throws and never blocks the UI — writes are batched and fire-and-forget.
 */
import { supabase } from '@/integrations/supabase/client';

export type AdminUiEventType =
  | 'page_load'
  | 'tab_view'
  | 'cta_click'
  | 'crash'
  | 'js_error'
  | 'slow_load';

interface AdminUiEvent {
  event_type: AdminUiEventType;
  tab?: string | null;
  path?: string | null;
  label?: string | null;
  detail?: Record<string, unknown> | null;
  duration_ms?: number | null;
}

const SESSION_KEY = 'baw_admin_telemetry_session';
const FLUSH_MS = 4000;
const MAX_BATCH = 25;

let queue: Record<string, unknown>[] = [];
let flushTimer: number | null = null;
let identity: { admin_user_id: string | null; admin_email: string | null } | null = null;
let identityPromise: Promise<void> | null = null;
let initialised = false;

const getSessionId = (): string => {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
};

const resolveIdentity = (): Promise<void> => {
  if (identity) return Promise.resolve();
  if (identityPromise) return identityPromise;

  identityPromise = (async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) {
        identity = { admin_user_id: null, admin_email: null };
        return;
      }
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('id, email')
        .eq('user_id', user.id)
        .maybeSingle();

      identity = {
        admin_user_id: adminRow?.id ?? null,
        admin_email: adminRow?.email ?? user.email ?? null,
      };
    } catch {
      identity = { admin_user_id: null, admin_email: null };
    }
  })();

  return identityPromise;
};

const flush = async (immediate = false) => {
  if (flushTimer) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;

  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(MAX_BATCH);

  try {
    await resolveIdentity();
    const rows = batch.map((row) => ({ ...row, ...(identity || {}) })) as any[];
    const { error } = await supabase.from('admin_ui_events').insert(rows);
    if (error) {
      // Direct insert blocked (RLS, missing admin row, stale token) — fall back
      // to the edge function so crashes on sales accounts are never lost.
      console.warn('[admin-telemetry] insert failed, using edge fallback', error.message);
      const { error: fnError } = await supabase.functions.invoke('log-admin-ui-event', {
        body: { events: batch },
      });
      if (fnError) console.warn('[admin-telemetry] edge fallback failed', fnError.message);
    }
  } catch (e) {
    console.warn('[admin-telemetry] flush failed', e);
  }


  if (queue.length > 0 && !immediate) scheduleFlush();
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = window.setTimeout(() => void flush(), FLUSH_MS);
};

const currentTab = (): string | null => {
  try {
    return new URLSearchParams(window.location.search).get('tab');
  } catch {
    return null;
  }
};

/** Queue one admin UI event. Safe to call from anywhere, never throws. */
export const logAdminUiEvent = (event: AdminUiEvent): void => {
  try {
    if (typeof window === 'undefined') return;
    if (!window.location.pathname.includes('admin')) return;

    queue.push({
      event_type: event.event_type,
      tab: event.tab ?? currentTab(),
      path: event.path ?? window.location.pathname + window.location.search,
      label: event.label ? String(event.label).slice(0, 200) : null,
      detail: event.detail ?? null,
      duration_ms: typeof event.duration_ms === 'number' ? Math.round(event.duration_ms) : null,
      session_id: getSessionId(),
      user_agent: navigator.userAgent?.slice(0, 400) ?? null,
    });

    if (event.event_type === 'crash' || event.event_type === 'js_error') {
      void flush(true);
    } else if (queue.length >= MAX_BATCH) {
      void flush();
    } else {
      scheduleFlush();
    }
  } catch {
    /* telemetry must never break the dashboard */
  }
};

/** Convenience helper for button/link clicks that matter. */
export const logAdminCtaClick = (label: string, detail?: Record<string, unknown>) =>
  logAdminUiEvent({ event_type: 'cta_click', label, detail: detail ?? null });

/** Log an operation that took longer than its budget. */
export const logAdminSlowLoad = (label: string, durationMs: number, detail?: Record<string, unknown>) =>
  logAdminUiEvent({ event_type: 'slow_load', label, duration_ms: durationMs, detail: detail ?? null });

const labelFromElement = (el: HTMLElement): string => {
  const aria = el.getAttribute('aria-label');
  const text = (aria || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 120);
  const title = el.getAttribute('title') || el.getAttribute('name');
  return (title || el.tagName.toLowerCase()).slice(0, 120);
};

/**
 * Attach global listeners once per browser session. Captures clicks on buttons
 * and links, uncaught errors, and unhandled rejections across the admin area.
 */
export const initAdminTelemetry = (): (() => void) => {
  if (typeof window === 'undefined' || initialised) return () => {};
  initialised = true;

  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const el = target.closest('button, a, [role="button"], [role="tab"]') as HTMLElement | null;
    if (!el) return;
    logAdminUiEvent({
      event_type: 'cta_click',
      label: labelFromElement(el),
      detail: {
        element: el.tagName.toLowerCase(),
        href: el.getAttribute('href') || undefined,
        disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || undefined,
      },
    });
  };

  const onError = (e: ErrorEvent) => {
    logAdminUiEvent({
      event_type: 'js_error',
      label: (e.message || 'Unknown error').slice(0, 200),
      detail: {
        source: e.filename || undefined,
        line: e.lineno || undefined,
        stack: (e.error?.stack || '').slice(0, 1200) || undefined,
      },
    });
  };

  const onRejection = (e: PromiseRejectionEvent) => {
    const reason: any = e?.reason;
    logAdminUiEvent({
      event_type: 'js_error',
      label: String(reason?.message || reason || 'Unhandled rejection').slice(0, 200),
      detail: { kind: 'unhandledrejection', stack: (reason?.stack || '').slice(0, 1200) || undefined },
    });
  };

  const onHide = () => {
    if (document.visibilityState === 'hidden') void flush(true);
  };

  document.addEventListener('click', onClick, true);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  document.addEventListener('visibilitychange', onHide);

  return () => {
    document.removeEventListener('click', onClick, true);
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    document.removeEventListener('visibilitychange', onHide);
    initialised = false;
  };
};

export const flushAdminTelemetry = () => flush(true);
