/**
 * Global concurrency limiter for Supabase HTTP calls — the "toll booth".
 *
 * The admin dashboard mounts dozens of panels at once, and even after
 * de-duplicating the worst offenders it can still *start* a few hundred
 * requests in the same tick. Chrome only keeps ~6 sockets per host open and
 * queues the rest in a fixed-size buffer; overflow is what produces
 * net::ERR_INSUFFICIENT_RESOURCES and half-empty screens.
 *
 * So instead of handing every request to the browser immediately, we pace them
 * ourselves: at most MAX_CONCURRENT in flight, the rest wait in a FIFO queue.
 * Nothing is dropped — it just arrives slightly later, in order.
 *
 * PRIORITISATION (important):
 *  1. Bypass (never queued): auth token refresh, realtime, and edge function
 *     calls. Edge functions are always user-initiated (reg lookup, import lead,
 *     send quote, MOT history) and have their own client-side timeouts — if
 *     they sit behind a wall of background dashboard reads they time out and
 *     look "broken". They are few in number, so they go straight out.
 *  2. High lane: interactive reads/writes explicitly marked by the UI
 *     (see `withPriority`). Served before any background work.
 *  3. Normal lane: active screen reads.
 *  4. Background lane: pollers, counters, badge/alert refreshes. These are
 *     capped separately so they can never occupy every socket while an agent is
 *     waiting for New Leads or Quotes & Orders to paint.
 */

import { isSecondaryCrmTab } from '@/lib/crmTabCoordinator';

const MAX_CONCURRENT = 8;
const MAX_BACKGROUND_CONCURRENT = 2;

/**
 * Agents keep the CRM open in several tabs. Each tab has its own limiter, so
 * N tabs meant N × the traffic to one origin — which is what leaves the active
 * tab on a spinner. Duplicate (non-primary) tabs and hidden tabs therefore get
 * a much smaller share: interactive work is untouched, only background pollers
 * and counters are squeezed.
 */
/**
 * Deep sleep for forgotten tabs.
 *
 * Telemetry from the sales CRM showed a tab left open on Customers overnight
 * still firing background reads the next morning, while the agent's *active*
 * New Leads tab waited 15 seconds for five reads that all landed at once —
 * the classic "blank screen" signature. A tab nobody has looked at for two
 * minutes has no business polling, so once it crosses that line we stop
 * granting it background slots entirely. Interactive work (high lane) and the
 * active screen's reads (normal lane) are untouched, and everything resumes on
 * the next `visibilitychange`.
 */
const DEEP_SLEEP_AFTER_HIDDEN_MS = 120_000;
let hiddenSince: number | null =
  typeof document !== 'undefined' && document.hidden ? Date.now() : null;

function isDeepSleeping(): boolean {
  return hiddenSince !== null && Date.now() - hiddenSince >= DEEP_SLEEP_AFTER_HIDDEN_MS;
}

function backgroundCap(): number {
  if (isDeepSleeping()) return 0;
  if (typeof document !== 'undefined' && document.hidden) return 1;
  if (isSecondaryCrmTab()) return 1;
  return MAX_BACKGROUND_CONCURRENT;
}

function concurrencyCap(): number {
  return isSecondaryCrmTab() ? 4 : MAX_CONCURRENT;
}

let active = 0;
let activeBackground = 0;

type RequestLane = 'high' | 'normal' | 'background';
type QueuedRequest = { lane: RequestLane; resolve: () => void };

const highQueue: QueuedRequest[] = [];
const normalQueue: QueuedRequest[] = [];
const backgroundQueue: QueuedRequest[] = [];

/** Set while an interactive user action is running (see withPriority). */
let priorityDepth = 0;
/** Set while non-blocking CRM work is running (pollers, counters, badges). */
let backgroundDepth = 0;

/**
 * Safety valve: a deep-sleeping tab holds its background reads back, but never
 * hoards them forever — past this many waiting reads we let them trickle out
 * one at a time so nothing can leak memory or hang a caller indefinitely.
 */
const MAX_HELD_BACKGROUND = 40;

function canStart(lane: RequestLane) {
  if (active >= concurrencyCap()) return false;
  if (lane === 'high') return true;
  if (lane === 'normal') return highQueue.length === 0;
  const cap = backgroundCap();
  const allowance =
    cap === 0 && backgroundQueue.length > MAX_HELD_BACKGROUND ? 1 : cap;
  return highQueue.length === 0 && normalQueue.length === 0 && activeBackground < allowance;
}

function startRequest(lane: RequestLane, resolve: () => void) {
  active += 1;
  if (lane === 'background') activeBackground += 1;
  resolve();
}

function pump() {
  while (active < concurrencyCap()) {
    const next = highQueue[0] || normalQueue[0] || backgroundQueue[0];
    if (!next || !canStart(next.lane)) return;

    if (next.lane === 'high') highQueue.shift();
    else if (next.lane === 'normal') normalQueue.shift();
    else backgroundQueue.shift();

    startRequest(next.lane, next.resolve);
  }
}

function acquire(lane: RequestLane): Promise<void> {
  if (canStart(lane)) {
    startRequest(lane, () => undefined);
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const queued = { lane, resolve };
    if (lane === 'high') highQueue.push(queued);
    else if (lane === 'normal') normalQueue.push(queued);
    else backgroundQueue.push(queued);
  });
}

function release(lane: RequestLane) {
  active = Math.max(0, active - 1);
  if (lane === 'background') activeBackground = Math.max(0, activeBackground - 1);
  pump();
}

/**
 * Requests that must never wait behind background data reads.
 * - /auth/v1/  : token refresh (queuing it deadlocks everything waiting on a JWT)
 * - /realtime/ : websocket handshakes
 * - /functions/v1/ : user-initiated edge functions (reg lookup, import lead, …)
 */
function shouldBypass(url: string): boolean {
  return (
    url.includes('/auth/v1/') ||
    url.includes('/realtime/') ||
    url.includes('/functions/v1/')
  );
}

/**
 * In-flight read de-duplication.
 *
 * Dozens of panels and table rows mount at once and independently ask for the
 * SAME rows. Those identical reads used to each take a socket, so the page the
 * agent is waiting for queued behind copies of itself. Now the first one goes
 * out and every later caller shares its response until it settles.
 *
 * Only plain GET/HEAD reads with no abort signal are shared, so nothing can be
 * cancelled out from under another caller, and writes are never merged.
 */
const inflightReads = new Map<string, Promise<Response>>();

function headerValue(input: RequestInfo | URL, init: RequestInit | undefined, name: string) {
  try {
    const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    return h.get(name) ?? '';
  } catch {
    return '';
  }
}

function readDedupeKey(
  url: string,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  method: string,
): string | null {
  if (!['GET', 'HEAD'].includes(method.toUpperCase())) return null;
  if (init?.signal || (input instanceof Request && input.signal)) return null;
  const parts = ['authorization', 'apikey', 'range', 'prefer', 'accept', 'accept-profile'].map(
    (h) => headerValue(input, init, h),
  );
  return `${method} ${url} ${parts.join('|')}`;
}

/** Drop-in `fetch` that paces Supabase data requests. */
export const queuedFetch: typeof fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;

  if (shouldBypass(url)) return fetch(input as any, init);

  // Extension-safety: never let our own lane bookkeeping be the thing that
  // throws. If anything below fails we still complete the request.

  const method = init?.method || (input instanceof Request ? input.method : 'GET');
  const isWrite = !['GET', 'HEAD'].includes(method.toUpperCase());
  const lane: RequestLane = priorityDepth > 0 || isWrite
    ? 'high'
    : backgroundDepth > 0
      ? 'background'
      : 'normal';

  const dedupeKey = readDedupeKey(url, input, init, method);
  if (dedupeKey) {
    const shared = inflightReads.get(dedupeKey);
    if (shared) {
      try {
        return (await shared).clone();
      } catch {
        /* the shared read failed — fall through and try our own */
      }
    }
  }

  try {
    await acquire(lane);
  } catch {
    return fetch(input as any, init);
  }

  const run = (async () => {
    try {
      return await fetch(input as any, init);
    } finally {
      try {
        release(lane);
      } catch {
        /* keep the queue alive even if a listener misbehaves */
      }
    }
  })();

  if (!dedupeKey) return run;

  inflightReads.set(dedupeKey, run);
  try {
    const response = await run;
    return response.clone();
  } finally {
    inflightReads.delete(dedupeKey);
  }
};

/**
 * Run an interactive user action (button click, reg lookup, import, save) so
 * that any queries it fires jump ahead of background dashboard traffic.
 *
 *   await withPriority(() => importLead(id));
 */
export async function withPriority<T>(fn: () => Promise<T>): Promise<T> {
  priorityDepth += 1;
  try {
    return await fn();
  } finally {
    priorityDepth = Math.max(0, priorityDepth - 1);
    pump();
  }
}

/** Run non-blocking background CRM work without letting it starve the active page. */
export async function withBackgroundPriority<T>(fn: () => Promise<T>): Promise<T> {
  backgroundDepth += 1;
  let result: Promise<T>;
  try {
    // Mark only the fetches started in the first async turn as background.
    // Supabase builders are thenables, so `await supabase.from(...)` starts the
    // actual fetch in a microtask; clearing immediately would miss it, while
    // clearing after the network completes would downgrade unrelated foreground
    // work that starts meanwhile.
    result = fn();
  } catch (error) {
    backgroundDepth = Math.max(0, backgroundDepth - 1);
    throw error;
  }
  queueMicrotask(() => {
    backgroundDepth = Math.max(0, backgroundDepth - 1);
    pump();
  });
  return await result;
}

// Resume paced background work as soon as the tab is looked at again, and when
// tab primacy changes (e.g. the primary tab was closed).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    hiddenSince = document.hidden ? Date.now() : null;
    pump();
  });
}

/** For debugging / perf panels. */
export const getRequestQueueStats = () => ({
  active,
  activeBackground,
  queued: highQueue.length + normalQueue.length + backgroundQueue.length,
  queuedBackground: backgroundQueue.length,
  queuedHigh: highQueue.length,
  queuedNormal: normalQueue.length,
});
