// Hook for using the permissions system
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PermissionPolicy, MaskLevel, TabPermission } from '@/lib/permissions/types';
import { applyMask, getColumnMaskLevel, hasTabPermission, canPerformAction } from '@/lib/permissions/helpers';
import { useAuth } from '@/hooks/useAuth';

interface UsePermissionsReturn {
  policy: PermissionPolicy | null;
  loading: boolean;
  error: string | null;
  // Tab permissions
  canViewTab: (tabKey: string) => boolean;
  canEditTab: (tabKey: string) => boolean;
  canDeleteTab: (tabKey: string) => boolean;
  canExportTab: (tabKey: string) => boolean;
  // Granular tab permissions (view/export for customers and new-leads)
  // Returns true if granted, false if denied, undefined if not explicitly set
  hasGranularPermission: (tabKey: string, permissionKey: string) => boolean | undefined;
  // Column masking
  getMaskLevel: (columnKey: string) => MaskLevel;
  maskValue: (value: string | null | undefined, columnKey: string) => string;
  // Actions
  canInviteUsers: () => boolean;
  canManageRoles: () => boolean;
  canApproveDiscount: (percent: number) => boolean;
  // Refresh
  refreshPermissions: () => Promise<void>;
  // Raw permissions for legacy checks
  rawPermissions: Record<string, boolean>;
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth();
  const [policy, setPolicy] = useState<PermissionPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawPermissions, setRawPermissions] = useState<Record<string, boolean>>({});

  const fetchPermissions = useCallback(async () => {
    if (!user?.id) {
      setPolicy(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First try to get policy from the new system
      const { data: adminUser, error: adminError } = await supabase
        .from('admin_users')
        .select('*, permission_policies(*)')
        .eq('user_id', user.id)
        .single();

      if (adminError) {
        // User might not be an admin
        setPolicy(null);
        setLoading(false);
        return;
      }

      if (adminUser?.permission_policies) {
        // Use the linked policy
        const policyData = adminUser.permission_policies as any;
        setPolicy({
          name: policyData.name,
          description: policyData.description,
          department: policyData.department,
          security: {
            require_2fa: policyData.require_2fa ?? true,
            require_sso: policyData.require_sso ?? false,
            session_timeout_minutes: policyData.session_timeout_minutes ?? 30,
            export_rate_limit_per_hour: policyData.export_rate_limit_per_hour ?? 2,
            approval_required_for_export: policyData.approval_required_for_export ?? true,
          },
          tabs: policyData.tabs_permissions ?? {},
          columns: policyData.column_masking ?? {},
          actions: policyData.action_permissions ?? {},
          elevated_until: policyData.elevated_until,
        });
        setRawPermissions({});
      } else {
        // Fallback to legacy permissions
        const legacyPerms = adminUser.permissions as Record<string, boolean> || {};
        const columnMasking = (adminUser as any).column_masking as Record<string, any> || {};
        
        // Store raw permissions for granular checks
        setRawPermissions(legacyPerms);
        
        // Convert legacy tab permissions
        const tabs: Record<string, TabPermission> = {};
        for (const [key, value] of Object.entries(legacyPerms)) {
          if (key.startsWith('tab_')) {
            const tabKey = key.replace('tab_', '').replace(/-/g, '_');
            tabs[tabKey] = {
              view: value,
              create: value,
              edit: value,
              delete: false,
              export: false,
              approve: false,
            };
          }
        }

        setPolicy({
          name: 'Legacy',
          department: (adminUser as any).department,
          security: {
            require_2fa: (adminUser as any).require_2fa ?? true,
            require_sso: false,
            session_timeout_minutes: 30,
            export_rate_limit_per_hour: 2,
            approval_required_for_export: true,
          },
          tabs,
          columns: columnMasking,
          actions: {
            approve_discount: { allowed: false, limit_percent: 0 },
            invite_user: { allowed: false, scope: 'none' },
            manage_roles: { allowed: false, scope: 'none' },
            resend_invite: { allowed: false },
            deactivate_user: { allowed: false },
            reactivate_user: { allowed: false },
          },
        });
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError('Failed to load permissions');
      setPolicy(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const canViewTab = useCallback((tabKey: string): boolean => {
    return hasTabPermission(policy, tabKey, 'view');
  }, [policy]);

  const canEditTab = useCallback((tabKey: string): boolean => {
    return hasTabPermission(policy, tabKey, 'edit');
  }, [policy]);

  const canDeleteTab = useCallback((tabKey: string): boolean => {
    return hasTabPermission(policy, tabKey, 'delete');
  }, [policy]);

  const canExportTab = useCallback((tabKey: string): boolean => {
    return hasTabPermission(policy, tabKey, 'export');
  }, [policy]);

  const getMaskLevel = useCallback((columnKey: string): MaskLevel => {
    return getColumnMaskLevel(policy, columnKey);
  }, [policy]);

  const maskValue = useCallback((value: string | null | undefined, columnKey: string): string => {
    const level = getMaskLevel(columnKey);
    return applyMask(value, level);
  }, [getMaskLevel]);

  const canInviteUsers = useCallback((): boolean => {
    if (!policy) return false;
    const { allowed, scope } = policy.actions.invite_user || {};
    return allowed && scope !== 'none';
  }, [policy]);

  const canManageRoles = useCallback((): boolean => {
    if (!policy) return false;
    const { allowed, scope } = policy.actions.manage_roles || {};
    return allowed && scope !== 'none';
  }, [policy]);

  const canApproveDiscount = useCallback((percent: number): boolean => {
    if (!policy) return false;
    const { allowed, limit_percent } = policy.actions.approve_discount || {};
    return allowed && percent <= limit_percent;
  }, [policy]);

  // Check granular permissions like tab_customers_view, tab_new-leads_export
  // Returns: true if explicitly granted, false if explicitly denied, undefined if not set
  const hasGranularPermission = useCallback((tabKey: string, permissionKey: string): boolean | undefined => {
    const key = `tab_${tabKey}_${permissionKey}`;
    if (key in rawPermissions) {
      return rawPermissions[key] === true;
    }
    // Not explicitly set - return undefined so callers can apply defaults
    return undefined;
  }, [rawPermissions]);

  return {
    policy,
    loading,
    error,
    canViewTab,
    canEditTab,
    canDeleteTab,
    canExportTab,
    hasGranularPermission,
    getMaskLevel,
    maskValue,
    canInviteUsers,
    canManageRoles,
    canApproveDiscount,
    refreshPermissions: fetchPermissions,
    rawPermissions,
  };
}
