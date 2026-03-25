import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Returns the current user's admin_users record ID (not auth.uid, but admin_users.id)
 */
export const useCurrentAdminId = () => {
  const { user } = useAuth();

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

  return adminUserId || null;
};
