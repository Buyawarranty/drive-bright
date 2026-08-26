import { supabase } from '@/integrations/supabase/client';
import { withBackgroundPriority } from '@/lib/requestQueue';

const BATCH_SIZE = 1000;
const MAX_RETRIES = 2;

/**
 * Attempts to refresh the session if a JWT expired error is detected.
 * Returns true if refresh succeeded.
 */
async function handleJwtExpired(error: any): Promise<boolean> {
  if (error?.message?.includes('JWT expired') || error?.code === 'PGRST301') {
    console.warn('[BatchFetch] JWT expired, refreshing session...');
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError) {
      console.log('[BatchFetch] Session refreshed successfully');
      return true;
    }
    console.error('[BatchFetch] Session refresh failed:', refreshError);
  }
  return false;
}

/**
 * Fetches all rows from a Supabase query by paginating with .range().
 * This bypasses the PostgREST default 1000-row limit.
 *
 * PERF: pages are fetched in parallel waves (see CONCURRENCY) instead of one at
 * a time. Tables like abandoned_carts / sales_leads are 20k+ rows, which used to
 * mean ~20 strictly sequential round trips (seconds of dead time) before the
 * caller could render anything.
 *
 * @param buildQuery - A function that returns a Supabase query builder (without .range/.limit)
 * @returns All rows concatenated from all batches
 */
const CONCURRENCY = 6;

async function fetchPage<T>(
  buildQuery: () => any,
  offset: number,
): Promise<{ data: T[] | null; error: any }> {
  const run = async () => await buildQuery().range(offset, offset + BATCH_SIZE - 1);

  let result = await run();
  if (!result.error) return result;

  if (await handleJwtExpired(result.error)) {
    result = await run();
    if (!result.error) return result;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.warn(`[BatchFetch] Retrying batch at offset ${offset} (attempt ${attempt}/${MAX_RETRIES})`);
    await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    result = await run();
    if (!result.error) return result;
  }

  console.error(`[BatchFetch] All retries failed at offset ${offset}`, result.error);
  return result;
}

export async function fetchAllRows<T = any>(
  buildQuery: () => any,
  options?: { background?: boolean }
): Promise<{ data: T[]; error: any }> {
  const allData: T[] = [];
  let offset = 0;
  const getPage = (pageOffset: number) =>
    options?.background
      ? withBackgroundPriority(() => fetchPage<T>(buildQuery, pageOffset))
      : fetchPage<T>(buildQuery, pageOffset);

  // First page on its own so single-page queries stay a single round trip.
  const first = await getPage(0);
  if (first.error) return { data: allData, error: first.error };
  allData.push(...(first.data || []));
  if (!first.data || first.data.length < BATCH_SIZE) {
    return { data: allData, error: null };
  }
  offset = BATCH_SIZE;

  // Remaining pages in parallel waves: a full wave means there is very likely
  // more to come, a short page inside a wave means we've hit the end.
  for (;;) {
    const offsets = Array.from({ length: CONCURRENCY }, (_, i) => offset + i * BATCH_SIZE);
    const pages = await Promise.all(offsets.map(o => getPage(o)));

    let reachedEnd = false;
    for (const page of pages) {
      if (page.error) return { data: allData, error: page.error };
      const rows = page.data || [];
      allData.push(...rows);
      if (rows.length < BATCH_SIZE) {
        reachedEnd = true;
        break;
      }
    }

    if (reachedEnd) break;
    offset += CONCURRENCY * BATCH_SIZE;
  }

  // Parallel paging can only shift rows between pages when the caller's query
  // has no deterministic order, so drop any row seen twice by id.
  const first0 = allData[0] as any;
  if (first0 && typeof first0 === 'object' && 'id' in first0) {
    const seen = new Set<any>();
    const unique = allData.filter((row: any) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
    return { data: unique, error: null };
  }

  return { data: allData, error: null };
}

