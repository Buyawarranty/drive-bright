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

const MAX_CONCURRENT = 8;
const MAX_BACKGROUND_CONCURRENT = 2;

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

function canStart(lane: RequestLane) {
  if (active >= MAX_CONCURRENT) return false;
  if (lane === 'high') return true;
  if (lane === 'normal') return highQueue.length === 0;
  return highQueue.length === 0 && normalQueue.length === 0 && activeBackground < MAX_BACKGROUND_CONCURRENT;
}

function startRequest(lane: RequestLane, resolve: () => void) {
  active += 1;
  if (lane === 'background') activeBackground += 1;
  resolve();
}

function pump() {
  while (active < MAX_CONCURRENT) {
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

/** Drop-in `fetch` that paces Supabase data requests. */
export const queuedFetch: typeof fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;

  if (shouldBypass(url)) return fetch(input as any, init);

  const method = init?.method || (input instanceof Request ? input.method : 'GET');
  const isWrite = !['GET', 'HEAD'].includes(method.toUpperCase());
  const lane: RequestLane = priorityDepth > 0 || isWrite
    ? 'high'
    : backgroundDepth > 0
      ? 'background'
      : 'normal';

  await acquire(lane);
  try {
    return await fetch(input as any, init);
  } finally {
    release(lane);
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
  let promise: Promise<T>;
  try {
    // Mark only the fetches synchronously started by `fn` as background. Keeping
    // the flag set while those requests await would accidentally downgrade an
    // unrelated foreground screen load that starts in the meantime.
    promise = fn();
  } finally {
    backgroundDepth = Math.max(0, backgroundDepth - 1);
    pump();
  }
  return await promise;
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
