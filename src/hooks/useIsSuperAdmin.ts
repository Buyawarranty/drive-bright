import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Server-verified super-admin check. Use this for super-admin-only UI so it
 * never depends on client-side role state, props or impersonation.
 *
 * Goes through React Query with an infinite staleTime so the RPC fires once
 * per session and is shared by every mounted component.
 */
export function useIsSuperAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ['is-super-admin'],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (!uid) return false;
      const { data, error } = await supabase.rpc('is_super_admin_user', { _user_id: uid });
      return error ? false : data === true;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { isSuperAdmin: data === true, loading: isLoading };
}
