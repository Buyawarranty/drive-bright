import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Server-verified management check (admin / super_admin / sales_manager on an
 * active admin_users row). Use this for management-only UI so it never depends
 * on client-side role state, props or impersonation.
 * Returns null while loading (treat as "not management").
 */
export function useIsManagement() {
  const [isManagement, setIsManagement] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        if (!uid) {
          if (mounted) setIsManagement(false);
          return;
        }
        const { data, error } = await supabase.rpc('is_management', { _user_id: uid });
        if (mounted) setIsManagement(error ? false : data === true);
      } catch {
        if (mounted) setIsManagement(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { isManagement: isManagement === true, loading: isManagement === null };
}
