import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PhoneCall, Users, Eye, EyeOff, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useAgentTeams, TEAM_COLOR_CLASSES } from '@/hooks/useAgentTeams';

type Scope = 'off' | 'own' | 'team' | 'all';
const CALL_DATA_AGENT_ROLES = new Set(['sales', 'sales_lead']);

interface Row {
  id: string;
  admin_user_id: string;
  team_id: string;
  call_data_scope: Scope;
}

const SCOPE_META: Record<Scope, { label: string; icon: any; className: string; hint: string }> = {
  off:  { label: 'Off',       icon: EyeOff,   className: 'bg-muted text-muted-foreground border-border',                    hint: 'Agent cannot see the Live Calls Data tab' },
  own:  { label: 'Own only',  icon: Eye,      className: 'bg-sky-50 text-sky-800 border-sky-200',                            hint: 'Agent sees only their own calls and leads' },
  team: { label: 'Team',      icon: Users,    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',                hint: 'Agent sees all calls from teammates' },
  all:  { label: 'All',       icon: Globe,    className: 'bg-indigo-50 text-indigo-800 border-indigo-200',                   hint: 'Agent sees every agent\'s call data' },
};

/**
 * Manager control: for each sales agent, choose what call data they can see on
 * the Live Calls Data tab — Off, Own only (default), whole Team, or All agents.
 * Backed by lead_team_members.call_data_scope.
 */
export const CallDataVisibilityPanel = () => {
  const { allTeams, membersByTeam, loading: teamsLoading } = useAgentTeams();
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lead_team_members')
      .select('id, admin_user_id, team_id, call_data_scope');
    if (!error) setRows(((data || []) as any[]).map(r => ({ ...r, call_data_scope: (r.call_data_scope ?? 'own') as Scope })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const byAgent = useMemo(() => {
    const m = new Map<string, Row>();
    rows.forEach(r => m.set(r.admin_user_id, r));
    return m;
  }, [rows]);

  const setScope = async (row: Row, next: Scope) => {
    if (row.call_data_scope === next) return;
    setSaving(prev => new Set(prev).add(row.admin_user_id));
    const { error } = await supabase
      .from('lead_team_members')
      .update({ call_data_scope: next })
      .eq('id', row.id);
    setSaving(prev => { const n = new Set(prev); n.delete(row.admin_user_id); return n; });
    if (error) { toast.error('Could not save', { description: error.message }); return; }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, call_data_scope: next } : r));
    toast.success(`Set to ${SCOPE_META[next].label}`);
  };

  const bulkSet = async (next: Scope) => {
    if (!confirm(`Set ALL agents to "${SCOPE_META[next].label}"?`)) return;
    const updates = rows.map(r => supabase.from('lead_team_members').update({ call_data_scope: next }).eq('id', r.id));
    const results = await Promise.allSettled(updates);
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed) toast.error(`${failed} row(s) failed`);
    else toast.success(`All agents set to ${SCOPE_META[next].label}`);
    setRows(prev => prev.map(r => ({ ...r, call_data_scope: next })));
  };

  const isLoading = teamsLoading || loading;

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-base font-semibold text-foreground">Call data access (management only)</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          For each agent choose what call data they can see on Live Calls Data:
          <strong> Off</strong>, <strong>Own only</strong>, their whole <strong>Team</strong>, or <strong>All</strong> agents.
          Managers always see everything.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['off','own','team','all'] as Scope[]).map(s => (
            <Button key={s} size="sm" variant="outline" onClick={() => bulkSet(s)} className="h-7 text-xs">
              Bulk: {SCOPE_META[s].label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="px-5 py-6 text-sm text-muted-foreground">Loading agents…</div>
      ) : allTeams.length === 0 ? (
        <div className="px-5 py-6 text-sm text-muted-foreground">
          No teams yet. Add agents to a team in Lead Teams → Allocation first.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {allTeams.map(team => {
            const members = (membersByTeam.get(team.id) ?? []).filter(m => CALL_DATA_AGENT_ROLES.has(m.role || ''));
            const colors = TEAM_COLOR_CLASSES[team.color];
            if (members.length === 0) return null;
            return (
              <div key={team.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                  <span className={`text-sm font-semibold ${colors.text}`}>{team.name}</span>
                  <Badge variant="outline" className="text-xs">{members.length}</Badge>
                </div>
                <ul className="space-y-2">
                  {members.map(m => {
                    const row = byAgent.get(m.admin_user_id);
                    if (!row) return null;
                    const isSaving = saving.has(m.admin_user_id);
                    const displayName = [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email;
                    const currentMeta = SCOPE_META[row.call_data_scope];
                    return (
                      <li key={m.admin_user_id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border border-border bg-background">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{displayName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{currentMeta.hint}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Call data scope">
                          {(['off','own','team','all'] as Scope[]).map(s => {
                            const meta = SCOPE_META[s];
                            const Icon = meta.icon;
                            const active = row.call_data_scope === s;
                            return (
                              <button
                                key={s}
                                type="button"
                                disabled={isSaving}
                                onClick={() => setScope(row, s)}
                                title={meta.hint}
                                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border transition ${active ? meta.className : 'bg-background text-muted-foreground border-border hover:bg-muted'}`}
                              >
                                <Icon className="h-3 w-3" />
                                {meta.label}
                              </button>
                            );
                          })}
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

export default CallDataVisibilityPanel;
