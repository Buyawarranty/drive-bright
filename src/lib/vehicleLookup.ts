import { supabase } from '@/integrations/supabase/client';
import { invokeWithFreshSession } from '@/lib/invokeWithFreshSession';

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
  opts: { skipAgeCheck?: boolean; timeoutMs?: number } = {}
): Promise<{ data: any | null; error: Error | null; timedOut: boolean }> {
  const { skipAgeCheck = false, timeoutMs = 12000 } = opts;
  const body = { registrationNumber, skipAgeCheck };

  const withTimeout = <T,>(p: Promise<T>): Promise<T | 'timeout'> =>
    Promise.race([
      p,
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), timeoutMs)),
    ]);

  try {
    const first = await withTimeout(invokeWithFreshSession<any>('dvla-vehicle-lookup', body));
    if (first === 'timeout') {
      return { data: null, error: new Error('Lookup timed out'), timedOut: true };
    }
    if (first.data?.make) return { data: first.data, error: null, timedOut: false };

    // Fall back to an unauthenticated call — the function is public for lookups.
    const second = await withTimeout(supabase.functions.invoke('dvla-vehicle-lookup', { body }));
    if (second === 'timeout') {
      return { data: first.data ?? null, error: first.error ?? new Error('Lookup timed out'), timedOut: true };
    }
    return {
      data: second.data ?? first.data ?? null,
      error: (second.error as Error) ?? first.error ?? null,
      timedOut: false,
    };
  } catch (e: any) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)), timedOut: false };
  }
}
