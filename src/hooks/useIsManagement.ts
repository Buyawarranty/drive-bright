import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Server-verified management check (admin / super_admin / sales_manager on an
 * active admin_users row). Use this for management-only UI so it never depends
 * on client-side role state, props or impersonation.
 *
 * PERF: this hook is mounted by dozens of admin components at once. It goes
 * through React Query with an infinite staleTime so the `is_management` RPC is
 * fired ONCE per session and shared, instead of once per component (which used
 * to flood the network stack with ERR_INSUFFICIENT_RESOURCES).
 */
export function useIsManagement() {
  const { data, isLoading } = useQuery({
    queryKey: ['is-management'],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (!uid) return false;
      const { data, error } = await supabase.rpc('is_management', { _user_id: uid });
      return error ? false : data === true;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { isManagement: data === true, loading: isLoading };
}
