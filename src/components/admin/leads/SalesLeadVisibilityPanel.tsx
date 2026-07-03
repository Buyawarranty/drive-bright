import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Eye, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAgentTeams, TEAM_COLOR_CLASSES } from '@/hooks/useAgentTeams';
import { useAllSalesLeadTeamVisibility } from '@/hooks/useSalesLeadTeamVisibility';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { cn } from '@/lib/utils';

interface SalesLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

/**
 * Management-only control: per sales_lead, choose which additional teams'
 * lead flows they can view in the Leads page chip row.
 *
 * Without any grant, sales_leads remain locked to their own team.
 * Granting Team Red to James means James can switch between his own team
 * and Team Red from the leads chips.
 */
export const SalesLeadVisibilityPanel = () => {
  const { allTeams, byAgent: agentTeamMap, loading: teamsLoading } = useAgentTeams();
  const { byAgent: grantsByAgent, loading: grantsLoading, refresh } = useAllSalesLeadTeamVisibility();
  const currentAdminId = useCurrentAdminId();
  const [salesLeads, setSalesLeads] = useState<SalesLead[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('admin_users')
      .select('id, first_name, last_name, email')
      .eq('role', 'sales_lead')
      .eq('is_active', true)
      .order('first_name')
      .then(({ data }) => setSalesLeads((data || []) as SalesLead[]));
  }, []);

  const toggle = async (adminUserId: string, teamId: string, currentlyOn: boolean) => {
    const key = `${adminUserId}:${teamId}`;
    setBusy(key);
    try {
      if (currentlyOn) {
        const { error } = await supabase
          .from('sales_lead_team_visibility')
          .delete()
          .eq('admin_user_id', adminUserId)
          .eq('team_id', teamId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sales_lead_team_visibility')
          .insert({
            admin_user_id: adminUserId,
            team_id: teamId,
            granted_by: currentAdminId,
          } as any);
        if (error) throw error;
      }
      await refresh();
      toast({
        title: currentlyOn ? 'Access removed' : 'Access granted',
        description: 'Sales lead chip view will refresh on next load.',
      });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const toggleAllTeams = async (
    adminUserId: string,
    ownTeamId: string | null,
    turnOn: boolean,
    otherTeamIds: string[],
    currentGrants: Set<string>,
  ) => {
    const key = `${adminUserId}:__all__`;
    setBusy(key);
    try {
      if (turnOn) {
        const toInsert = otherTeamIds
          .filter(tid => !currentGrants.has(tid))
          .map(tid => ({
            admin_user_id: adminUserId,
            team_id: tid,
            granted_by: currentAdminId,
          } as any));
        if (toInsert.length) {
          const { error } = await supabase.from('sales_lead_team_visibility').insert(toInsert);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from('sales_lead_team_visibility')
          .delete()
          .eq('admin_user_id', adminUserId);
        if (error) throw error;
      }
      await refresh();
      toast({
        title: turnOn ? 'Full team access granted' : 'Reverted to own team only',
        description: turnOn
          ? 'This sales lead can now see leads for every team.'
          : 'This sales lead can only see their own team again.',
      });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };


  const loading = teamsLoading || grantsLoading;

  if (loading) {
    return (
      <div className="px-5 py-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading sales leads…
      </div>
    );
  }

  if (salesLeads.length === 0) {
    return (
      <div className="px-5 py-6 text-sm text-muted-foreground">
        No active sales leads.
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <p className="text-sm text-muted-foreground mb-4">
        Sales leads only see their own team's leads by default. Flip <strong>Show all teams</strong> to give a sales lead visibility over every team, or grant individual teams below.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="py-2 pr-4 font-semibold">Sales Lead</th>
              <th className="py-2 pr-4 font-semibold">Own Team</th>
              <th className="py-2 pr-4 font-semibold text-center">Show all teams</th>
              {allTeams.map(t => (
                <th key={t.id} className="py-2 px-3 font-semibold text-center">

                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px]',
                    TEAM_COLOR_CLASSES[t.color].pill,
                  )}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', TEAM_COLOR_CLASSES[t.color].dot)} />
                    {t.name.replace(/^Formula\s+/i, '')}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {salesLeads.map(sl => {
              const ownTeam = agentTeamMap.get(sl.id);
              const grants = grantsByAgent.get(sl.id) ?? new Set<string>();
              const otherTeams = allTeams.filter(t => t.id !== ownTeam?.id);
              const seesAll = otherTeams.length > 0 && otherTeams.every(t => grants.has(t.id));
              const allKey = `${sl.id}:__all__`;
              return (
                <tr key={sl.id} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{sl.first_name} {sl.last_name}</div>
                    <div className="text-xs text-muted-foreground">{sl.email}</div>
                  </td>
                  <td className="py-3 pr-4">
                    {ownTeam ? (
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px]',
                        TEAM_COLOR_CLASSES[ownTeam.color].pill,
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', TEAM_COLOR_CLASSES[ownTeam.color].dot)} />
                        {ownTeam.name.replace(/^Formula\s+/i, '')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No team</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-center">
                    <Switch
                      checked={seesAll}
                      disabled={busy === allKey || otherTeams.length === 0}
                      onCheckedChange={(on) => toggleAllTeams(sl.id, ownTeam?.id ?? null, on, otherTeams.map(t => t.id), grants)}
                    />
                  </td>

                  {allTeams.map(t => {
                    const isOwn = ownTeam?.id === t.id;
                    const isOn = grants.has(t.id);
                    const key = `${sl.id}:${t.id}`;
                    return (
                      <td key={t.id} className="py-3 px-3 text-center">
                        {isOwn ? (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Own
                          </span>
                        ) : (
                          <Switch
                            checked={isOn}
                            disabled={busy === key}
                            onCheckedChange={() => toggle(sl.id, t.id, isOn)}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalesLeadVisibilityPanel;
