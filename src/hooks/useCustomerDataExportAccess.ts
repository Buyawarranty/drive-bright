import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useViewAs } from '@/contexts/ViewAsContext';
import { withTimeout } from '@/lib/withTimeout';

export function useCustomerDataExportAccess() {
  const { isImpersonating, effectiveRole, effectiveAdminUserId } = useViewAs();
  const { data } = useQuery({
    queryKey: ['customer-data-export-access', isImpersonating, effectiveAdminUserId],
    queryFn: async () => {
      if (isImpersonating) {
        if (effectiveRole === 'admin' || effectiveRole === 'super_admin') return true;
        if (!effectiveAdminUserId) return false;
        const { data, error } = await supabase.from('staff_export_grants').select('admin_user_id').eq('admin_user_id', effectiveAdminUserId).maybeSingle();
        return !error && Boolean(data);
      }
      const { data, error } = await withTimeout(supabase.rpc('can_export_customer_data'), 8000, 'Export access');
      return !error && data === true;
    },
    staleTime: 15000,
    refetchInterval: 30000,
    retry: false,
  });
  return data === true;
}