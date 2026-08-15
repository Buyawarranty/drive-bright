import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Can this user see every agent's figures (targets, attendance)?
 *
 * True for management (admin / super_admin / sales_manager) and for
 * performance_manager, who needs the same all-agent visibility.
 * Everyone else (sales, sales_lead, lead_gen…) sees only their own row.
 */
export function useSeesAllAgents() {
  const [seesAll, setSeesAll] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        if (!uid) {
          if (mounted) setSeesAll(false);
          return;
        }
        const [mgmt, adminRow] = await Promise.all([
          supabase.rpc('is_management', { _user_id: uid }),
          supabase
            .from('admin_users')
            .select('role, is_active')
            .eq('user_id', uid)
            .eq('is_active', true)
            .maybeSingle(),
        ]);
        const isPerf = (adminRow.data as any)?.role === 'performance_manager';
        if (mounted) setSeesAll(mgmt.data === true || isPerf);
      } catch {
        if (mounted) setSeesAll(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { seesAll: seesAll === true, loading: seesAll === null };
}
