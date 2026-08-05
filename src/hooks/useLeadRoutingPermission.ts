import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';

/**
 * Roles that can always reassign leads across all teams. These are not subject
 * to the per-agent toggle — they keep full access. Per-agent control only
 * applies to the sales floor (sales + sales_lead).
 */
const ALWAYS_REASSIGN_ROLES = [
  'admin',
  'super_admin',
  'performance_manager',
  'sales_manager',
  'lead_gen',
  'accounts_manager',
  'accounts',
];

export type LeadRoutingScope = 'own_team' | 'all_teams' | null;

interface RoutingPermission {
  canReassign: boolean;
  scope: LeadRoutingScope;
  teammates: string[];
}

/**
 * Determines whether the current (or impersonated) user can reassign/allocate
 * leads to other agents, and the scope they may reassign within.
 *
 * Authority mirrors the `can_manage_lead_routing` / `lead_routing_scope` SQL
 * functions but is computed client-side so it respects the View-As
 * impersonation context (the RPC takes a real auth uid, which would not match
 * the impersonated agent).
 *
 *  - Managers / lead-gen / accounts → always, all teams.
 *  - sales_lead                     → per-agent `can_reassign_leads` flag,
 *                                     falling back to the global toggle.
 *  - sales                          → per-agent `can_reassign_leads` flag only.
 *
 * Also resolves the set of admin_user_ids the viewer may reassign *to* when
 * scoped to their own team (teammates, including themselves).
 */
export function useLeadRoutingPermission() {
  const { effectiveRole } = useViewAs();
  const currentAdminId = useCurrentAdminId();

  const isAlwaysRole = ALWAYS_REASSIGN_ROLES.includes(effectiveRole || '');
  const isSalesLead = effectiveRole === 'sales_lead';

  const { data, isLoading } = useQuery<RoutingPermission>({
    queryKey: ['lead-routing-permission', currentAdminId, effectiveRole],
    queryFn: async () => {
      if (!currentAdminId) {
        return { canReassign: false, scope: null, teammates: [] };
      }

      // Managers / lead-gen / accounts bypass the per-agent flag.
      if (isAlwaysRole) {
        return { canReassign: true, scope: 'all_teams', teammates: [] };
      }

      const { data: cap } = await supabase
        .from('agent_distribution_caps')
        .select('can_reassign_leads, reassign_scope')
        .eq('admin_user_id', currentAdminId)
        .maybeSingle();

      // Recontact-specific grant, toggled by managers on the Recontact access panel.
      const { data: recontactCap } = await (supabase as any)
        .from('recontact_agent_caps')
        .select('can_reassign')
        .eq('admin_user_id', currentAdminId)
        .maybeSingle();

      let globalFallback = false;
      if (isSalesLead) {
        const { data: cfg } = await supabase
          .from('admin_config')
          .select('config_value')
          .eq('config_key', 'sales_lead_distribution_access')
          .maybeSingle();
        // Default to true when unset (backwards compatible)
        globalFallback = cfg?.config_value !== false;
      }

      const capReassign = !!cap?.can_reassign_leads || !!recontactCap?.can_reassign;
      const canReassign = capReassign || (isSalesLead && globalFallback);

      let scope: LeadRoutingScope = null;
      if (canReassign) {
        scope = capReassign
          ? (cap?.reassign_scope as LeadRoutingScope) || 'own_team'
          : 'own_team';
      }

      let teammates: string[] = [];
      if (canReassign && scope === 'own_team') {
        const { data: myTeams } = await supabase
          .from('lead_team_members')
          .select('team_id')
          .eq('admin_user_id', currentAdminId);
        const teamIds = (myTeams ?? []).map((t) => t.team_id);
        if (teamIds.length) {
          const { data: mem } = await supabase
            .from('lead_team_members')
            .select('admin_user_id')
            .in('team_id', teamIds);
          teammates = Array.from(
            new Set([
              ...(mem ?? []).map((m) => m.admin_user_id),
              currentAdminId,
            ])
          );
        } else {
          teammates = [currentAdminId];
        }
      }

      return { canReassign, scope, teammates };
    },
    enabled: !!currentAdminId,
    staleTime: 30_000,
  });

  return {
    canReassign: data?.canReassign ?? false,
    scope: data?.scope ?? null,
    teammateAdminUserIds: new Set(data?.teammates ?? []),
    loading: isLoading && !!currentAdminId,
  };
}
