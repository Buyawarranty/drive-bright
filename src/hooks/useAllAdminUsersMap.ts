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
 * Returns a map of admin_user id → user (including INACTIVE / deactivated).
 * Used to resolve the name of an agent even after they've been offboarded,
 * so lead badges never show a bare "Assigned" with no name.
 */
export const useAllAdminUsersMap = (): Map<string, AdminUserLite> => {
  const [map, setMap] = useState<Map<string, AdminUserLite>>(cachedMap ?? new Map());

  useEffect(() => {
    if (cachedMap) { setMap(cachedMap); return; }
    let cancelled = false;
    loadMap().then(m => { if (!cancelled) setMap(m); });
    return () => { cancelled = true; };
  }, []);

  return map;
};
