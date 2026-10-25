import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Override {
  /** Impersonated agent's admin_users id (ViewAs) — check THEIR switch, not the real user's */
  adminUserId: string;
  /** Impersonated agent's role */
  role: string | null;
}

const MANAGEMENT_ROLES = ['admin', 'super_admin', 'sales_manager'];

/**
 * Can this viewer see OTHER sales agents' names/data (e.g. who made a deal in
 * Customer Management)?
 *
 * Always true for management (admin / super_admin / sales_manager). For sales
 * and sales_lead it depends on the per-agent "See all sales agents data"
 * switch in Lead Allocation (lead_team_members.can_see_all_agent_data),
 * which defaults to OFF. Fails closed: any error or missing row = false.
 *
 * When impersonating (ViewAs), pass the impersonated agent so the check uses
 * their switch. Cached for the whole session through React Query.
 */
export function useCanSeeAllAgentData(override?: Override) {
  const overrideKey = override ? `${override.adminUserId}:${override.role ?? ''}` : 'self';

  const { data, isLoading } = useQuery({
    queryKey: ['can-see-all-agent-data', overrideKey],
    queryFn: async () => {
      // Impersonation: check the impersonated agent's own switch.
      if (override) {
        const role = (override.role || '').trim().toLowerCase();
        if (MANAGEMENT_ROLES.includes(role)) return true;
        const { data: member } = await supabase
          .from('lead_team_members')
          .select('can_see_all_agent_data')
          .eq('admin_user_id', override.adminUserId)
          .maybeSingle();
        return (member as any)?.can_see_all_agent_data === true;
      }

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
