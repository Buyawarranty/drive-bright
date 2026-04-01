import { supabase } from '@/integrations/supabase/client';

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
 * @param buildQuery - A function that returns a Supabase query builder (without .range/.limit)
 * @returns All rows concatenated from all batches
 */
export async function fetchAllRows<T = any>(
  buildQuery: () => any
): Promise<{ data: T[]; error: any }> {
  const allData: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const query = buildQuery();
    const { data, error } = await query.range(offset, offset + BATCH_SIZE - 1);
    
    if (error) {
      // Check for JWT expired and auto-refresh
      const refreshed = await handleJwtExpired(error);
      if (refreshed) {
        // Retry this batch immediately with the refreshed token
        const retryQuery = buildQuery();
        const retryResult = await retryQuery.range(offset, offset + BATCH_SIZE - 1);
        if (!retryResult.error && retryResult.data) {
          allData.push(...retryResult.data);
          offset += retryResult.data.length;
          hasMore = retryResult.data.length === BATCH_SIZE;
          continue;
        }
      }

      // Retry this batch before giving up
      let retrySuccess = false;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.warn(`[BatchFetch] Retrying batch at offset ${offset} (attempt ${attempt}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        const retryQuery = buildQuery();
        const retryResult = await retryQuery.range(offset, offset + BATCH_SIZE - 1);
        if (!retryResult.error && retryResult.data) {
          allData.push(...retryResult.data);
          offset += retryResult.data.length;
          hasMore = retryResult.data.length === BATCH_SIZE;
          retrySuccess = true;
          break;
        }
      }
      if (!retrySuccess) {
        console.error(`[BatchFetch] All retries failed at offset ${offset}`, error);
        return { data: allData, error };
      }
      continue;
    }

    if (data && data.length > 0) {
      allData.push(...data);
      offset += data.length;
      // If we got fewer than BATCH_SIZE, we've reached the end
      hasMore = data.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  return { data: allData, error: null };
}
