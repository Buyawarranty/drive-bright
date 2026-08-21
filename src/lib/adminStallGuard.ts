/**
 * Admin request stall guard.
 *
 * Why this exists: agents (Thomas, James) reported Quotes & Orders "buffering"
 * and only a full computer restart clearing it. That is the signature of a dead
 * connection, not a slow database — after a laptop sleeps or the wifi drops, the
 * browser keeps reusing sockets that never answer, and the access token in
 * memory has already expired. Every read the screen makes then hangs forever
 * with no error, so the tab spins until the whole browser is restarted.
 *
 * This guard wraps the data reads the CRM makes:
 *  - every read gets a hard time limit (no request can hang forever)
 *  - a timed-out or network-failed READ is retried once on a brand new
 *    connection with a freshly refreshed staff session
 *  - slow reads are recorded as `slow_load` telemetry so the Sales staff app
 *    performance panel shows the real numbers instead of nothing
 *
 * Writes are never retried (only GET/HEAD), and storage uploads, edge functions
 * and realtime are left completely alone.
 */
import { logAdminSlowLoad } from '@/lib/adminTelemetry';

const READ_TIMEOUT_MS = 20_000;
const SLOW_READ_MS = 8_000;
/**
 * Chrome runs out of sockets/memory (net::ERR_INSUFFICIENT_RESOURCES) once a
 * page has thousands of reads in flight — that is what blanked the sales CRM.
 * We cap how many CRM reads run at once and queue the rest, and we share one
 * response between identical reads fired at the same moment.
 */
const MAX_CONCURRENT_READS = 10;

let inFlight = 0;
const waiters: Array<() => void> = [];
const dedupe = new Map<string, Promise<Response>>();

const acquireSlot = (): Promise<void> => {
  if (inFlight < MAX_CONCURRENT_READS) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiters.push(resolve));
};

const releaseSlot = () => {
  const next = waiters.shift();
  if (next) next();
  else inFlight = Math.max(0, inFlight - 1);
};

let installed = false;

const isGuardedRead = (url: string, method: string): boolean => {
  if (!/\/rest\/v1\//.test(url)) return false;
  const m = method.toUpperCase();
  return m === 'GET' || m === 'HEAD';
};


const withTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  originalFetch: typeof fetch,
  ms: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  // Respect a caller's own abort signal as well as our timeout.
  const callerSignal = init?.signal;
  const onCallerAbort = () => controller.abort();
  callerSignal?.addEventListener('abort', onCallerAbort);
  try {
    return await originalFetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
};

/** Ask the auth server for a new token, bounded so it can never hang either. */
const refreshStaffToken = async (): Promise<string | null> => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const bounded = await Promise.race([
      supabase.auth.refreshSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    const session = (bounded as any)?.data?.session;
    return session?.access_token ?? null;
  } catch {
    return null;
  }
};

/**
 * Install the guard once per browser session. Returns a detach function.
 */
export const installAdminStallGuard = (): (() => void) => {
  if (typeof window === 'undefined' || installed) return () => {};
  installed = true;

  const originalFetch = window.fetch.bind(window);

  const runGuardedRead = async (
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    url: string,
  ): Promise<Response> => {
    const startedAt = performance.now();
    try {
      const res = await withTimeout(input, init, originalFetch, READ_TIMEOUT_MS);
      const ms = performance.now() - startedAt;
      if (ms > SLOW_READ_MS) {
        logAdminSlowLoad('Slow CRM data read', ms, { url: String(url).split('?')[0] });
      }
      return res;
    } catch (firstError) {
      // Timed out or the socket died. Refresh the session, then retry ONCE on a
      // fresh connection — this is what previously needed a browser restart.
      const ms = performance.now() - startedAt;
      logAdminSlowLoad('CRM data read stalled — retrying', ms, {
        url: String(url).split('?')[0],
        reason: (firstError as any)?.name || 'error',
      });

      const token = await refreshStaffToken();
      const retryInit: RequestInit = { ...init, cache: 'no-store' };
      if (token) {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        headers.set('Authorization', `Bearer ${token}`);
        retryInit.headers = headers;
      }
      try {
        return await withTimeout(url as any, retryInit, originalFetch, READ_TIMEOUT_MS);
      } catch (secondError) {
        logAdminSlowLoad('CRM data read failed after retry', performance.now() - startedAt, {
          url: String(url).split('?')[0],
        });
        throw secondError;
      }
    }
  };

  const guarded: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const method = init?.method || (input instanceof Request ? input.method : 'GET');

    if (!isGuardedRead(url || '', method)) return originalFetch(input as any, init);

    // Identical reads fired in the same instant (one screen, many rows/widgets
    // asking for the same thing) share one network request instead of opening
    // hundreds of sockets.
    const key = `${method.toUpperCase()} ${url}`;
    const existing = dedupe.get(key);
    if (existing) return existing.then((r) => r.clone());

    const task = (async () => {
      await acquireSlot();
      try {
        return await runGuardedRead(input, init, url);
      } finally {
        releaseSlot();
        dedupe.delete(key);
      }
    })();

    dedupe.set(key, task);
    return task.then((r) => r.clone());
  };


  window.fetch = guarded;

  // Coming back from sleep / a dropped connection: get a valid token in place
  // before the screens start reading, so the first read doesn't have to fail.
  // Only when the token is actually expiring — never refresh on every tab switch.
  const onWake = async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase.auth.getSession();
      const expiresAt = (data?.session?.expires_at ?? 0) * 1000;
      if (!expiresAt || expiresAt - Date.now() < 120_000) await refreshStaffToken();
    } catch {
      /* never block the UI */
    }
  };
  document.addEventListener('visibilitychange', onWake);
  window.addEventListener('online', onWake);

  return () => {
    window.fetch = originalFetch;
    document.removeEventListener('visibilitychange', onWake);
    window.removeEventListener('online', onWake);
    installed = false;
  };
};
