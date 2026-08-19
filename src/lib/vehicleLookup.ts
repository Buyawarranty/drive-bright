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

  const withTimeout = <T,>(p: Promise<T>, ms: number = timeoutMs): Promise<T | 'timeout'> =>
    Promise.race([
      p,
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms)),
    ]);

  // Plain anon invoke — the lookup function is public, so this works even when the
  // staff session is stale, refreshing, or completely gone.
  const anonLookup = async (ms: number) => {
    const res = await withTimeout(supabase.functions.invoke('dvla-vehicle-lookup', { body }), ms);
    if (res === 'timeout') return { data: null, error: new Error('Lookup timed out'), timedOut: true };
    return { data: (res as any).data ?? null, error: ((res as any).error as Error) ?? null, timedOut: false };
  };

  const run = async (): Promise<LookupResult> => {
    try {
      // The authenticated attempt gets only PART of the budget. Agents were left
      // staring at "Could not identify vehicle" because a stalled getSession/
      // refreshSession call ate the whole 12s and no fallback ever ran.
      const AUTH_BUDGET_MS = Math.min(6000, Math.max(3000, Math.floor(timeoutMs / 2)));
      const first = await withTimeout(
        invokeWithFreshSession<any>('dvla-vehicle-lookup', body),
        AUTH_BUDGET_MS
      );

      if (first !== 'timeout' && first.data?.make) {
        cache.set(key, { at: Date.now(), data: first.data });
        return { data: first.data, error: null, timedOut: false };
      }

      // Fall back to an unauthenticated call with the remaining budget.
      const second = await anonLookup(Math.max(4000, timeoutMs - AUTH_BUDGET_MS));
      const firstData = first === 'timeout' ? null : first.data ?? null;
      const firstError = first === 'timeout' ? new Error('Lookup timed out') : first.error ?? null;
      const data = second.data ?? firstData;
      if (data?.make) {
        cache.set(key, { at: Date.now(), data });
        return { data, error: null, timedOut: false };
      }
      return {
        data,
        error: second.error ?? firstError ?? null,
        timedOut: second.timedOut && !data,
      };
    } catch (e: any) {
      return { data: null, error: e instanceof Error ? e : new Error(String(e)), timedOut: false };
    }
  };


  const promise = run().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
