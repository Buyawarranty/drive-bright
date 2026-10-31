import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useViewAs } from '@/contexts/ViewAsContext';
import { withTimeout } from '@/lib/withTimeout';
import { canDisplayLeadSource, hasDefaultLeadSourceAccess } from '@/lib/leadSourceAccess';

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
 * Exports retain scoped grants. Source access includes protected account
 * defaults and unconditional sales-role denial, checked by the server RPC.
 */
export function useExportPermissions(): ExportPermissions {
  const { isImpersonating, effectiveRole, effectiveAdminUserId, viewAsAgent } = useViewAs();
  const { data } = useQuery({
    queryKey: ['export-permissions', isImpersonating, effectiveAdminUserId, effectiveRole, viewAsAgent?.email],
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
        if (error) return NONE;
        return {
          canExportNewLeads: data?.can_export_new_leads === true,
          canExportCustomers: data?.can_export_customers === true,
          canSeeLeadSource: canDisplayLeadSource(data?.can_see_lead_source === true || hasDefaultLeadSourceAccess(effectiveRole, viewAsAgent?.email), effectiveRole),
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
        canSeeLeadSource: canDisplayLeadSource(row.can_see_lead_source === true, effectiveRole),
      };
    },
    staleTime: 15000,
    refetchInterval: 30000,
    retry: false,
  });
  return data ? { ...data, canSeeLeadSource: canDisplayLeadSource(data.canSeeLeadSource, effectiveRole) } : NONE;
}
