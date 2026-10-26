import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useViewAs } from '@/contexts/ViewAsContext';
import { withTimeout } from '@/lib/withTimeout';

export interface ExportPermissions {
  canExportNewLeads: boolean;
  canExportCustomers: boolean;
  canSeeLeadSource: boolean;
}

const NONE: ExportPermissions = {
  canExportNewLeads: false,
  canExportCustomers: false,
  canSeeLeadSource: false,
};

/**
 * Scoped export / lead-source permissions. All three are OFF by default for
 * every role except admin and super admin (automatic). Anyone else needs an
 * explicit grant in User Permissions, stored in staff_export_grants and
 * checked server-side by get_my_export_permissions().
 */
export function useExportPermissions(): ExportPermissions {
  const { isImpersonating, effectiveRole, effectiveAdminUserId } = useViewAs();
  const { data } = useQuery({
    queryKey: ['export-permissions', isImpersonating, effectiveAdminUserId],
    queryFn: async (): Promise<ExportPermissions> => {
      if (isImpersonating) {
        if (effectiveRole === 'admin' || effectiveRole === 'super_admin') {
          return { canExportNewLeads: true, canExportCustomers: true, canSeeLeadSource: true };
        }
        if (!effectiveAdminUserId) return NONE;
        const { data, error } = await supabase
          .from('staff_export_grants')
          .select('can_export_new_leads, can_export_customers, can_see_lead_source')
          .eq('admin_user_id', effectiveAdminUserId)
          .maybeSingle();
        if (error || !data) return NONE;
        return {
          canExportNewLeads: data.can_export_new_leads === true,
          canExportCustomers: data.can_export_customers === true,
          canSeeLeadSource: data.can_see_lead_source === true,
        };
      }
      const { data, error } = await withTimeout(
        supabase.rpc('get_my_export_permissions'),
        8000,
        'Export permissions',
      );
      if (error || !data) return NONE;
      const row = data as Record<string, unknown>;
      return {
        canExportNewLeads: row.can_export_new_leads === true,
        canExportCustomers: row.can_export_customers === true,
        canSeeLeadSource: row.can_see_lead_source === true,
      };
    },
    staleTime: 15000,
    refetchInterval: 30000,
    retry: false,
  });
  return data ?? NONE;
}
