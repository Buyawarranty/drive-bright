import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useViewAs } from '@/contexts/ViewAsContext';

/**
 * Returns the current user's admin_users record ID (admin_users.id, not auth.uid).
 *
 * When a super_admin is impersonating another agent via the "View As" dropdown,
 * this returns the impersonated agent's admin_users.id so role-scoped UI (team
 * locks, "My leads only", etc.) reflects the user being viewed.
 */
export const useCurrentAdminId = () => {
  const { user } = useAuth();
  const { isImpersonating, effectiveAdminUserId } = useViewAs();

  const { data: adminUserId } = useQuery({
    queryKey: ['current-admin-id', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      return data?.id || null;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  if (isImpersonating && effectiveAdminUserId) return effectiveAdminUserId;
  return adminUserId || null;
};
