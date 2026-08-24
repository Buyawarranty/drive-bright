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
 * Auth and realtime traffic bypasses the queue: token refreshes must never sit
 * behind data reads (that would deadlock every queued request waiting on a JWT).
 */

const MAX_CONCURRENT = 8;

let active = 0;
const waiting: Array<() => void> = [];

function pump() {
  while (active < MAX_CONCURRENT && waiting.length > 0) {
    const next = waiting.shift()!;
    active += 1;
    next();
  }
}

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiting.push(resolve));
}

function release() {
  active = Math.max(0, active - 1);
  pump();
}

function shouldBypass(url: string): boolean {
  return url.includes('/auth/v1/') || url.includes('/realtime/');
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

  await acquire();
  try {
    return await fetch(input as any, init);
  } finally {
    release();
  }
};

/** For debugging / perf panels. */
export const getRequestQueueStats = () => ({ active, queued: waiting.length });
