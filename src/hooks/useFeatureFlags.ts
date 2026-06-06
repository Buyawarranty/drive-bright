import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FeatureFlag {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  category: string;
  updated_at: string;
}

// Module-level cache shared across all hook callers in the app
let cache: Record<string, boolean> | null = null;
let cachePromise: Promise<Record<string, boolean>> | null = null;
const subscribers = new Set<(flags: Record<string, boolean>) => void>();

async function fetchFlags(): Promise<Record<string, boolean>> {
  if (cache) return cache;
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('key, enabled');
    if (error) {
      console.warn('[feature_flags] fetch failed, defaulting to enabled', error);
      cachePromise = null;
      return {};
    }
    const map: Record<string, boolean> = {};
    (data || []).forEach((row: any) => {
      map[row.key] = !!row.enabled;
    });
    cache = map;
    return map;
  })();
  return cachePromise;
}

export function invalidateFeatureFlagsCache() {
  cache = null;
  cachePromise = null;
  fetchFlags().then((map) => {
    subscribers.forEach((cb) => cb(map));
  });
}

/**
 * Returns a map of flag key -> enabled boolean.
 * Unknown keys are treated as DISABLED-by-default = false. Callers should
 * decide their own fallback semantics (see `useFeatureEnabled`).
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<Record<string, boolean>>(cache || {});
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let mounted = true;
    fetchFlags().then((map) => {
      if (mounted) {
        setFlags(map);
        setLoading(false);
      }
    });
    const cb = (m: Record<string, boolean>) => {
      if (mounted) setFlags({ ...m });
    };
    subscribers.add(cb);
    return () => {
      mounted = false;
      subscribers.delete(cb);
    };
  }, []);

  return { flags, loading };
}

/**
 * Returns true if the given feature key is enabled.
 * If the flag row doesn't exist in the DB, it returns `defaultIfMissing`
 * (default `true` so we don't accidentally hide established features).
 */
export function useFeatureEnabled(key: string, defaultIfMissing = true): boolean {
  const { flags, loading } = useFeatureFlags();
  if (loading && !(key in flags)) return defaultIfMissing;
  if (!(key in flags)) return defaultIfMissing;
  return flags[key] === true;
}
