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
 *  3. Normal lane: everything else — background panel reads, counters, stats.
 */

const MAX_CONCURRENT = 8;

let active = 0;
const highQueue: Array<() => void> = [];
const normalQueue: Array<() => void> = [];

/** Set while an interactive user action is running (see withPriority). */
let priorityDepth = 0;

function pump() {
  while (active < MAX_CONCURRENT && (highQueue.length > 0 || normalQueue.length > 0)) {
    const next = (highQueue.length > 0 ? highQueue.shift() : normalQueue.shift())!;
    active += 1;
    next();
  }
}

function acquire(high: boolean): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    (high ? highQueue : normalQueue).push(resolve);
  });
}

function release() {
  active = Math.max(0, active - 1);
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

  const high = priorityDepth > 0;
  await acquire(high);
  try {
    return await fetch(input as any, init);
  } finally {
    release();
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

/** For debugging / perf panels. */
export const getRequestQueueStats = () => ({
  active,
  queued: highQueue.length + normalQueue.length,
  queuedHigh: highQueue.length,
  queuedNormal: normalQueue.length,
});
