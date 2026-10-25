import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Can this viewer see OTHER sales agents' names/data (e.g. who made a deal in
 * Customer Management)?
 *
 * Always true for management (admin / super_admin / sales_manager). For sales
 * and sales_lead it depends on the per-agent "See all sales agents data"
 * switch in Lead Allocation (lead_team_members.can_see_all_agent_data),
 * which defaults to OFF. Fails closed: any error or missing row = false.
 *
 * Cached for the whole session through React Query.
 */
export function useCanSeeAllAgentData() {
  const { data, isLoading } = useQuery({
    queryKey: ['can-see-all-agent-data'],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (!uid) return false;

      const [mgmt, adminRow] = await Promise.all([
        supabase.rpc('is_management', { _user_id: uid }),
        supabase
          .from('admin_users')
          .select('id, role, is_active')
          .eq('user_id', uid)
          .eq('is_active', true)
          .maybeSingle(),
      ]);

      if (mgmt.data === true) return true;

      const adminId = (adminRow.data as any)?.id as string | undefined;
      if (!adminId) return false;

      const { data: member } = await supabase
        .from('lead_team_members')
        .select('can_see_all_agent_data')
        .eq('admin_user_id', adminId)
        .maybeSingle();

      return (member as any)?.can_see_all_agent_data === true;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { canSeeAllAgentData: data === true, loading: isLoading };
}
