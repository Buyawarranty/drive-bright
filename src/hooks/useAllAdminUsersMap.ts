import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminUserLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  is_active: boolean;
  role: string | null;
}

// Module-level cache so multiple rows / tables share one fetch per session.
let cachedPromise: Promise<Map<string, AdminUserLite>> | null = null;
let cachedMap: Map<string, AdminUserLite> | null = null;
// Subscribers so every mounted row updates when the cache is topped up.
const subscribers = new Set<(m: Map<string, AdminUserLite>) => void>();
// Ids we already tried (and failed) to resolve, so we never loop on a truly missing id.
const attemptedIds = new Set<string>();
let inFlightTopUp = false;

const notify = () => {
  if (!cachedMap) return;
  const snapshot = new Map(cachedMap);
  cachedMap = snapshot;
  subscribers.forEach(fn => fn(snapshot));
};

const loadMap = (): Promise<Map<string, AdminUserLite>> => {
  if (cachedPromise) return cachedPromise;
  cachedPromise = (async () => {
    const { data } = await supabase
      .from('admin_users')
      .select('id, first_name, last_name, email, is_active, role');
    const map = new Map<string, AdminUserLite>();
    (data || []).forEach((u: any) => map.set(u.id, u));
    cachedMap = map;
    return map;
  })();
  return cachedPromise;
};

/**
 * Fetch specific admin_user rows that are missing from the cache and merge them in.
 * This keeps names correct for agents added after the cache was first built
 * (e.g. a new starter) instead of rendering them as "Unknown".
 */
const topUp = async (missing: string[]) => {
  if (inFlightTopUp || missing.length === 0) return;
  inFlightTopUp = true;
  try {
    const { data } = await supabase
      .from('admin_users')
      .select('id, first_name, last_name, email, is_active, role')
      .in('id', missing);
    if (data && data.length) {
      const base = cachedMap ?? new Map<string, AdminUserLite>();
      (data as any[]).forEach(u => base.set(u.id, u as AdminUserLite));
      cachedMap = base;
      notify();
    }
  } finally {
    inFlightTopUp = false;
  }
};

/**
 * Returns a map of admin_user id → user (including INACTIVE / deactivated).
 * Used to resolve the name of an agent even after they've been offboarded,
 * so lead badges never show a bare "Assigned" with no name.
 *
 * Pass the ids you need (e.g. lead.assigned_to). Any id not already cached is
 * fetched on demand, so newly created agents resolve immediately.
 */
export const useAllAdminUsersMap = (
  ensureIds?: (string | null | undefined)[] | string | null,
): Map<string, AdminUserLite> => {
  const [map, setMap] = useState<Map<string, AdminUserLite>>(cachedMap ?? new Map());

  useEffect(() => {
    subscribers.add(setMap);
    if (cachedMap) setMap(cachedMap);
    else loadMap().then(m => setMap(m));
    return () => { subscribers.delete(setMap); };
  }, []);

  const wanted = (Array.isArray(ensureIds) ? ensureIds : [ensureIds]).filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
  const key = wanted.join(',');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    loadMap().then((m) => {
      if (cancelled) return;
      const missing = wanted.filter(id => !m.has(id) && !attemptedIds.has(id));
      if (missing.length === 0) return;
      missing.forEach(id => attemptedIds.add(id));
      topUp(missing);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return map;
};
