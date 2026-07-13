import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAgentTeams, TEAM_COLOR_CLASSES } from '@/hooks/useAgentTeams';

interface Row {
  id: string; // lead_team_members.id
  admin_user_id: string;
  team_id: string;
  can_see_team_leads: boolean;
}

/**
 * Per-agent toggle: "Own leads only" (default) vs "All team leads".
 * Writes to lead_team_members.can_see_team_leads. Sales agent's My Leads view
 * reads this flag to decide whether to filter to own or to any teammate.
 */
export const AgentLeadVisibilityPanel = () => {
  const { allTeams, membersByTeam, loading: teamsLoading } = useAgentTeams();
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lead_team_members')
      .select('id, admin_user_id, team_id, can_see_team_leads');
    if (!error) setRows((data || []) as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const byAgent = useMemo(() => {
    const m = new Map<string, Row>();
    rows.forEach(r => m.set(r.admin_user_id, r));
    return m;
  }, [rows]);

  const toggle = async (row: Row, next: boolean) => {
    setSaving(prev => new Set(prev).add(row.admin_user_id));
    const { error } = await supabase
      .from('lead_team_members')
      .update({ can_see_team_leads: next })
      .eq('id', row.id);
    setSaving(prev => {
      const n = new Set(prev);
      n.delete(row.admin_user_id);
      return n;
    });
    if (error) {
      toast.error('Could not save', { description: error.message });
      return;
    }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, can_see_team_leads: next } : r));
    toast.success(next ? 'Agent now sees all team leads' : 'Agent now sees only their own leads');
  };

  const isLoading = teamsLoading || loading;

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-base font-semibold text-foreground">
            Own leads only view ↔ All team leads view
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Per-agent toggle, grouped by team. Toggle <strong>OFF</strong> = <em>Own leads only view</em> (agent
          sees only leads assigned to them). Toggle <strong>ON</strong> = <em>All team leads view</em> (agent
          also sees leads assigned to anyone else on their team). The sales agent's My Leads view respects this live.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-muted-foreground border border-border">
            <EyeOff className="h-3 w-3" /> Off = Own leads only
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Users className="h-3 w-3" /> On = All team leads visible
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="px-5 py-6 text-sm text-muted-foreground">Loading agents…</div>
      ) : allTeams.length === 0 ? (
        <div className="px-5 py-6 text-sm text-muted-foreground">
          No teams yet. Add agents to a team in the Allocation section above.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {allTeams.map(team => {
            const members = membersByTeam.get(team.id) ?? [];
            const colors = TEAM_COLOR_CLASSES[team.color];
            if (members.length === 0) return null;
            return (
              <div key={team.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                  <span className={`text-sm font-semibold ${colors.text}`}>{team.name}</span>
                  <Badge variant="outline" className="text-xs">{members.length} agent{members.length === 1 ? '' : 's'}</Badge>
                </div>
                <ul className="space-y-2">
                  {members.map(m => {
                    const row = byAgent.get(m.admin_user_id);
                    if (!row) return null;
                    const on = row.can_see_team_leads;
                    const isSaving = saving.has(m.admin_user_id);
                    const displayName = [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email;
                    return (
                      <li
                        key={m.admin_user_id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border border-border bg-background"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{displayName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {on
                              ? <span className="text-emerald-700">Sees all leads assigned to anyone on {team.name}</span>
                              : <span>Sees only leads assigned to them</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-medium ${on ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                            {on ? 'All team leads' : 'Own leads only'}
                          </span>
                          <Switch
                            checked={on}
                            disabled={isSaving}
                            onCheckedChange={(v) => toggle(row, v)}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default AgentLeadVisibilityPanel;
