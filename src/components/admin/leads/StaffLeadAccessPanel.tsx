import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, UserCog, Info, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Staff Lead Access
 *
 * Per-agent control of who can assign / reassign leads to other agents.
 *
 *   managers / lead-gen / accounts  →  always (all teams), not configurable here
 *   sales_lead / sales              →  configurable per agent:
 *                                       toggle "can assign" + scope
 *                                       (own team / all teams)
 *
 * The selection is stored on `agent_distribution_caps` and mirrored by the
 * `can_manage_lead_routing` / `lead_routing_scope` SQL functions, so the
 * client-side reassign gates (via `useLeadRoutingPermission`) honour it.
 */

const ALWAYS_ROLES = new Set([
  'admin',
  'super_admin',
  'performance_manager',
  'sales_manager',
  'lead_gen',
  'accounts_manager',
  'accounts',
]);

const CONFIGURABLE_ROLES = new Set(['sales', 'sales_lead']);

interface AdminUser {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
}

interface Cap {
  admin_user_id: string;
  can_reassign_leads: boolean;
  reassign_scope: 'own_team' | 'all_teams';
}

interface TeamInfo {
  id: string;
  name: string;
}

const fullName = (u: AdminUser) =>
  [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;

export const StaffLeadAccessPanel = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [caps, setCaps] = useState<Record<string, Cap>>({});
  const [teamsByAdmin, setTeamsByAdmin] = useState<Record<string, TeamInfo[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: adminUsers }, { data: capRows }, { data: members }, { data: teams }] =
        await Promise.all([
          supabase
            .from('admin_users')
            .select('id, user_id, first_name, last_name, email, role, is_active')
            .order('first_name', { ascending: true }),
          supabase
            .from('agent_distribution_caps')
            .select('admin_user_id, can_reassign_leads, reassign_scope'),
          supabase.from('lead_team_members').select('admin_user_id, team_id'),
          supabase.from('lead_teams').select('id, name'),
        ]);

      const capMap: Record<string, Cap> = {};
      (capRows ?? []).forEach((c: any) => {
        capMap[c.admin_user_id] = {
          admin_user_id: c.admin_user_id,
          can_reassign_leads: c.can_reassign_leads ?? false,
          reassign_scope: c.reassign_scope ?? 'own_team',
        };
      });
      setCaps(capMap);

      const teamMap: Record<string, TeamInfo[]> = {};
      const teamLookup = new Map((teams ?? []).map((t: any) => [t.id, t] as const));
      (members ?? []).forEach((m: any) => {
        const t = teamLookup.get(m.team_id);
        if (!t) return;
        (teamMap[m.admin_user_id] ??= []).push({ id: t.id, name: t.name });
      });
      setTeamsByAdmin(teamMap);

      // Show active sales-floor staff (configurable) + managers (read-only)
      const relevant = (adminUsers ?? []).filter(
        (u: AdminUser) =>
          u.is_active &&
          (ALWAYS_ROLES.has(u.role) || CONFIGURABLE_ROLES.has(u.role))
      );
      setUsers(relevant as AdminUser[]);
    } catch (err) {
      console.error('Error loading staff lead access:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useCallback(
    async (adminUserId: string, canReassign: boolean, scope: 'own_team' | 'all_teams') => {
      setSaving(adminUserId);
      try {
        const { error } = await supabase
          .from('agent_distribution_caps')
          .upsert(
            {
              admin_user_id: adminUserId,
              can_reassign_leads: canReassign,
              reassign_scope: scope,
            },
            { onConflict: 'admin_user_id' }
          );
        if (error) throw error;
        setCaps((prev) => ({
          ...prev,
          [adminUserId]: { admin_user_id: adminUserId, can_reassign_leads: canReassign, reassign_scope: scope },
        }));
        toast({
          title: 'Access updated',
          description: canReassign
            ? 'This agent can now assign leads to other agents.'
            : 'This agent can no longer assign leads.',
        });
      } catch (err) {
        console.error('Error updating lead access:', err);
        toast({ title: 'Update failed', description: 'Could not save the change.', variant: 'destructive' });
      } finally {
        setSaving(null);
      }
    },
    []
  );

  const configurable = users.filter((u) => CONFIGURABLE_ROLES.has(u.role));
  const alwaysUsers = users.filter((u) => ALWAYS_ROLES.has(u.role));
  const allowedCount = configurable.filter((u) => caps[u.id]?.can_reassign_leads).length;

  return (
    <section
      id="staff-lead-access"
      className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-start gap-2.5 min-w-0">
          <UserCog className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">
              Staff Lead Access
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Choose, agent by agent, who can assign leads to other agents — and
              whether they can reassign across their own team only or all teams.
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Summary line */}
        <div className="flex items-center gap-2 text-xs">
          {allowedCount > 0 ? (
            <>
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <span className="text-green-700 font-medium">
                {allowedCount} sales-floor agent{allowedCount !== 1 ? 's' : ''} can
                currently assign leads to others.
              </span>
            </>
          ) : (
            <>
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <span className="text-amber-700 font-medium">
                No sales-floor agents can assign leads — only managers can.
              </span>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading staff…
          </div>
        ) : (
          <>
            {/* Managers / lead-gen / accounts — always, read only */}
            {alwaysUsers.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">
                    Always — managers & office staff
                  </h4>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {alwaysUsers.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {fullName(u)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.email}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 bg-green-50 text-green-700 border-green-200"
                      >
                        All teams
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Configurable sales-floor staff */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-foreground">
                  Sales floor — choose per agent
                </h4>
              </div>

              {configurable.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active sales agents to configure.
                </p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Agent</th>
                        <th className="text-left font-medium px-3 py-2">Team</th>
                        <th className="text-center font-medium px-3 py-2 w-[120px]">
                          Can assign
                        </th>
                        <th className="text-left font-medium px-3 py-2 w-[150px]">
                          Scope
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {configurable.map((u) => {
                        const cap = caps[u.id] ?? {
                          admin_user_id: u.id,
                          can_reassign_leads: false,
                          reassign_scope: 'own_team' as const,
                        };
                        const teams = teamsByAdmin[u.id] ?? [];
                        const teamLabel =
                          teams.map((t) => t.name).join(', ') || 'No team';
                        const isSaving = saving === u.id;

                        return (
                          <tr
                            key={u.id}
                            className="border-t border-border align-middle"
                          >
                            <td className="px-3 py-2.5">
                              <p className="font-medium text-foreground">
                                {fullName(u)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {u.email}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {teamLabel}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <Switch
                                checked={cap.can_reassign_leads}
                                disabled={isSaving}
                                onCheckedChange={(checked) =>
                                  persist(u.id, checked, cap.reassign_scope)
                                }
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <Select
                                value={cap.reassign_scope}
                                disabled={isSaving || !cap.can_reassign_leads}
                                onValueChange={(v) =>
                                  persist(u.id, cap.can_reassign_leads, v as 'own_team' | 'all_teams')
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="own_team">
                                    Own team only
                                  </SelectItem>
                                  <SelectItem value="all_teams">
                                    All teams
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Help note */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2.5">
              <h4 className="text-sm font-semibold text-foreground">
                How this works
              </h4>
              <ul className="list-disc ml-5 space-y-1.5 text-sm text-muted-foreground">
                <li>
                  <span className="text-foreground">Managers, lead-gen and accounts</span> can
                  always assign and reassign leads across all teams — no toggle
                  needed.
                </li>
                <li>
                  <span className="text-foreground">Sales agents & team leads</span> get the
                  reassign / allocate controls only when their <em>Can assign</em>{' '}
                  toggle above is on. Switch the scope to <em>Own team only</em> to
                  keep them within their own team, or <em>All teams</em> to let them
                  reassign anywhere.
                </li>
                <li>
                  Turning an agent off removes those controls immediately. Existing
                  leads already assigned to them are unaffected.
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default StaffLeadAccessPanel;
