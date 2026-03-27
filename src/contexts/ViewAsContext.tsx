import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ViewAsAgent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  permissions: Record<string, boolean> | null;
}

interface ViewAsContextType {
  /** The agent being impersonated, or null if viewing as self */
  viewAsAgent: ViewAsAgent | null;
  /** Set the agent to impersonate */
  setViewAsAgent: (agent: ViewAsAgent | null) => void;
  /** Whether impersonation mode is active */
  isImpersonating: boolean;
  /** The effective role (impersonated or real) */
  effectiveRole: string | null;
  /** The effective permissions (impersonated or real) */
  effectivePermissions: Record<string, boolean> | null;
  /** The effective admin user ID for data filtering */
  effectiveAdminUserId: string | null;
  /** List of available agents to impersonate */
  availableAgents: ViewAsAgent[];
  /** Whether we're loading agents */
  loadingAgents: boolean;
}

const ViewAsContext = createContext<ViewAsContextType>({
  viewAsAgent: null,
  setViewAsAgent: () => {},
  isImpersonating: false,
  effectiveRole: null,
  effectivePermissions: null,
  effectiveAdminUserId: null,
  availableAgents: [],
  loadingAgents: false,
});

export const useViewAs = () => useContext(ViewAsContext);

interface ViewAsProviderProps {
  children: React.ReactNode;
  realRole: string | null;
  realPermissions: Record<string, boolean> | null;
  realAdminUserId: string | null;
}

export const ViewAsProvider: React.FC<ViewAsProviderProps> = ({
  children,
  realRole,
  realPermissions,
  realAdminUserId,
}) => {
  const [viewAsAgent, setViewAsAgent] = useState<ViewAsAgent | null>(null);
  const [availableAgents, setAvailableAgents] = useState<ViewAsAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const isSuperAdmin = realRole === 'super_admin';
  const isImpersonating = isSuperAdmin && viewAsAgent !== null;

  // Fetch available agents for impersonation
  useEffect(() => {
    if (!isSuperAdmin) return;

    const fetchAgents = async () => {
      setLoadingAgents(true);
      try {
        const { data } = await supabase
          .from('admin_users')
          .select('id, first_name, last_name, email, role, permissions')
          .eq('is_active', true)
          .order('first_name');

        if (data) {
          setAvailableAgents(
            data
              .filter(u => u.id !== realAdminUserId) // Exclude self
              .map(u => ({
                id: u.id,
                firstName: u.first_name || '',
                lastName: u.last_name || '',
                email: u.email,
                role: u.role,
                permissions: u.permissions as Record<string, boolean> | null,
              }))
          );
        }
      } catch (e) {
        console.error('Failed to fetch agents for ViewAs:', e);
      } finally {
        setLoadingAgents(false);
      }
    };

    fetchAgents();
  }, [isSuperAdmin, realAdminUserId]);

  const effectiveRole = isImpersonating ? viewAsAgent!.role : realRole;
  const effectivePermissions = isImpersonating ? viewAsAgent!.permissions : realPermissions;
  const effectiveAdminUserId = isImpersonating ? viewAsAgent!.id : realAdminUserId;

  return (
    <ViewAsContext.Provider
      value={{
        viewAsAgent,
        setViewAsAgent: isSuperAdmin ? setViewAsAgent : () => {},
        isImpersonating,
        effectiveRole,
        effectivePermissions,
        effectiveAdminUserId,
        availableAgents,
        loadingAgents,
      }}
    >
      {children}
    </ViewAsContext.Provider>
  );
};
