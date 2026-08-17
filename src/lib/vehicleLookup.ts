import { supabase } from '@/integrations/supabase/client';
import { invokeWithFreshSession } from '@/lib/invokeWithFreshSession';

type LookupResult = { data: any | null; error: Error | null; timedOut: boolean };

/**
 * PERF: agents re-look-up the same plate constantly (step 1 preview → step 2
 * confirm → step 4 payment, or flipping between leads). The DVLA/DVSA round trip
 * costs 1–4s each time, so a successful result is cached for the session and
 * concurrent calls for the same plate share one request instead of stacking up.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: any }>();
const inflight = new Map<string, Promise<LookupResult>>();

const keyFor = (reg: string, skipAgeCheck: boolean) =>
  `${reg.replace(/\s+/g, '').toUpperCase()}|${skipAgeCheck ? 1 : 0}`;

/** Drop a plate from the cache — used when an agent forces a fresh lookup. */
export function clearVehicleLookupCache(registrationNumber?: string) {
  if (!registrationNumber) {
    cache.clear();
    return;
  }
  const norm = registrationNumber.replace(/\s+/g, '').toUpperCase();
  cache.delete(`${norm}|0`);
  cache.delete(`${norm}|1`);
}

/**
 * Reg lookup used by Quotes & Orders.
 *
 * Agents were left staring at a spinner with a customer on the phone: the old
 * code created an AbortController but never wired it to `functions.invoke`, so a
 * hanging gateway call (or a stale staff token in a long-open admin tab) could
 * spin forever and the price never appeared.
 *
 * This helper always resolves within `timeoutMs`, refreshes the staff session
 * first, and falls back to a plain anon invoke if the authenticated call fails.
 */
export async function lookupVehicleByReg(
  registrationNumber: string,
  opts: { skipAgeCheck?: boolean; timeoutMs?: number; force?: boolean } = {}
): Promise<LookupResult> {
  const { skipAgeCheck = false, timeoutMs = 12000, force = false } = opts;
  const body = { registrationNumber, skipAgeCheck };
  const key = keyFor(registrationNumber, skipAgeCheck);

  if (!force) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return { data: hit.data, error: null, timedOut: false };
    }
    const pending = inflight.get(key);
    if (pending) return pending;
  }

  const withTimeout = <T,>(p: Promise<T>): Promise<T | 'timeout'> =>
    Promise.race([
      p,
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), timeoutMs)),
    ]);

  const run = async (): Promise<LookupResult> => {
    try {
      const first = await withTimeout(invokeWithFreshSession<any>('dvla-vehicle-lookup', body));
      if (first === 'timeout') {
        return { data: null, error: new Error('Lookup timed out'), timedOut: true };
      }
      if (first.data?.make) {
        cache.set(key, { at: Date.now(), data: first.data });
        return { data: first.data, error: null, timedOut: false };
      }

      // Fall back to an unauthenticated call — the function is public for lookups.
      const second = await withTimeout(supabase.functions.invoke('dvla-vehicle-lookup', { body }));
      if (second === 'timeout') {
        return { data: first.data ?? null, error: first.error ?? new Error('Lookup timed out'), timedOut: true };
      }
      const data = second.data ?? first.data ?? null;
      if (data?.make) cache.set(key, { at: Date.now(), data });
      return {
        data,
        error: (second.error as Error) ?? first.error ?? null,
        timedOut: false,
      };
    } catch (e: any) {
      return { data: null, error: e instanceof Error ? e : new Error(String(e)), timedOut: false };
    }
  };

  const promise = run().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
