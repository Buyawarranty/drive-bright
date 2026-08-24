import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Can this user see every agent's figures (targets, attendance)?
 *
 * True for management (admin / super_admin / sales_manager) and for
 * performance_manager, who needs the same all-agent visibility.
 * Everyone else (sales, sales_lead, lead_gen…) sees only their own row.
 *
 * PERF: cached for the whole session through React Query — many panels mount
 * this at the same time and each used to fire its own `is_management` RPC plus
 * an `admin_users` read.
 */
export function useSeesAllAgents() {
  const { data, isLoading } = useQuery({
    queryKey: ['sees-all-agents'],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (!uid) return false;
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
      return mgmt.data === true || isPerf;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { seesAll: data === true, loading: isLoading };
}
