import { supabase } from '@/integrations/supabase/client';

const BATCH_SIZE = 1000;

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
      return { data: allData, error };
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
