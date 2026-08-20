/**
 * Helpers for `.in('col', ids)` lookups against large id lists.
 *
 * Supabase/PostgREST sends `.in()` filters in the query string. A few hundred
 * uuids blow past proxy URL length limits, and the request then hangs or fails
 * silently — which is what left the New Leads and Quotes & Orders screens stuck
 * on a spinner. Always split ids into SMALL batches and bound every batch with
 * a timeout so one stalled request can never block a screen.
 */

/** Small on purpose: ~60 uuids keeps each URL comfortably under proxy limits. */
export const ID_BATCH_SIZE = 60;

/** Number of batches in flight at once — keeps wall-clock low without flooding. */
const DEFAULT_CONCURRENCY = 4;

/** Per-batch timeout. A stalled batch is skipped, never awaited forever. */
const DEFAULT_BATCH_TIMEOUT_MS = 6000;

export function chunkIds<T>(ids: T[], size: number = ID_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Runs `buildQuery(batch)` for each small batch of ids in bounded parallel
 * waves and returns the concatenated rows. Failed or timed-out batches are
 * skipped with a console warning so partial data still renders.
 */
export async function fetchByIdsInBatches<T = any>(
  ids: Array<string | number>,
  buildQuery: (batch: Array<string | number>) => any,
  options?: {
    batchSize?: number;
    concurrency?: number;
    timeoutMs?: number;
    label?: string;
  },
): Promise<T[]> {
  const unique = Array.from(new Set(ids.filter((id) => id !== null && id !== undefined)));
  if (unique.length === 0) return [];

  const batchSize = options?.batchSize ?? ID_BATCH_SIZE;
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_BATCH_TIMEOUT_MS;
  const label = options?.label ?? 'batched .in() query';

  const batches = chunkIds(unique, batchSize);
  const rows: T[] = [];

  for (let i = 0; i < batches.length; i += concurrency) {
    const wave = batches.slice(i, i + concurrency);
    const results = await Promise.all(
      wave.map(async (batch) => {
        try {
          const res: any = await withTimeout(Promise.resolve(buildQuery(batch)), timeoutMs, label);
          if (res?.error) {
            console.warn(`[batchedIn] ${label} batch failed, skipping:`, res.error);
            return [];
          }
          return (res?.data || []) as T[];
        } catch (error) {
          console.warn(`[batchedIn] ${label} batch skipped:`, error);
          return [];
        }
      }),
    );
    for (const part of results) rows.push(...part);
  }

  return rows;
}
