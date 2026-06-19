import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Target, RefreshCw, Repeat, Plus, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Team {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
}

interface Member {
  id: string;
  team_id: string;
  admin_user_id: string;
  workstream_new_leads: boolean;
  workstream_recontact: boolean;
  workstream_renewals: boolean;
}

interface AdminUserLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

type Workstream = 'new_leads' | 'recontact' | 'renewals';
type WorkstreamFilter = 'all' | Workstream;

const WORKSTREAMS: { key: Workstream; col: keyof Member; label: string; short: string; icon: typeof Target; tint: string }[] = [
  { key: 'new_leads', col: 'workstream_new_leads', label: 'New Leads',  short: 'New',       icon: Target,    tint: 'text-blue-600' },
  { key: 'recontact', col: 'workstream_recontact', label: 'Recontact',  short: 'Recontact', icon: RefreshCw, tint: 'text-amber-600' },
  { key: 'renewals',  col: 'workstream_renewals',  label: 'Renewals',   short: 'Renewals',  icon: Repeat,    tint: 'text-emerald-600' },
];

interface Props {
  canEdit: boolean;
}

export const AllocationMatrix = ({ canEdit }: Props) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [admins, setAdmins] = useState<AdminUserLite[]>([]);
  const [filter, setFilter] = useState<WorkstreamFilter>('all');
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [t, m, a] = await Promise.all([
        supabase.from('lead_teams').select('id, name, color, emoji').order('sort_order'),
        supabase.from('lead_team_members').select('id, team_id, admin_user_id, workstream_new_leads, workstream_recontact, workstream_renewals'),
        supabase.from('admin_users').select('id, first_name, last_name, email, role').eq('is_active', true).order('first_name'),
      ]);
      if (t.error) throw t.error;
      if (m.error) throw m.error;
      if (a.error) throw a.error;
      setTeams((t.data || []) as Team[]);
      setMembers((m.data || []) as Member[]);
      setAdmins((a.data || []) as AdminUserLite[]);
    } catch (e: any) {
      toast({ title: 'Failed to load allocation', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const pendingAgents = useMemo(
    () => admins.filter(a =>
      (a.role === 'sales' || a.role === 'sales_lead') &&
      !members.some(m => m.admin_user_id === a.id)
    ),
    [admins, members]
  );

  const flagsChanged = (m: Member, patch: Partial<Member>) => {
    const keys: (keyof Member)[] = ['workstream_new_leads', 'workstream_recontact', 'workstream_renewals'];
    return keys.some(k => k in patch && (patch as any)[k] !== (m as any)[k]);
  };

  const toggleWorkstream = async (m: Member, ws: Workstream) => {
    if (!canEdit) return;
    const col = WORKSTREAMS.find(w => w.key === ws)!.col;
    const next = !(m as any)[col];
    const patch: any = { [col]: next };
    // If any flag changes, the agent's "what work do I do" has changed → notify on next login.
    if (flagsChanged(m, patch)) {
      patch.team_changed_at = new Date().toISOString();
      patch.notice_seen_at = null;
    }
    const { data, error } = await supabase
      .from('lead_team_members')
      .update(patch)
      .eq('id', m.id)
      .select()
      .single();
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    setMembers(prev => prev.map(x => (x.id === m.id ? (data as Member) : x)));
  };

  const bulkSetTeamWorkstream = async (teamId: string, ws: Workstream, value: boolean) => {
    if (!canEdit) return;
    const col = WORKSTREAMS.find(w => w.key === ws)!.col;
    const targets = members.filter(m => m.team_id === teamId && (m as any)[col] !== value);
    if (!targets.length) return;
    const { error } = await supabase
      .from('lead_team_members')
      .update({ [col]: value, team_changed_at: new Date().toISOString(), notice_seen_at: null } as any)
      .in('id', targets.map(t => t.id));
    if (error) {
      toast({ title: 'Bulk update failed', description: error.message, variant: 'destructive' });
      return;
    }
    setMembers(prev => prev.map(m =>
      targets.some(t => t.id === m.id) ? ({ ...m, [col]: value } as Member) : m
    ));
    toast({ title: value ? 'Enabled' : 'Disabled', description: `${WORKSTREAMS.find(w => w.key === ws)!.label} for whole team` });
  };

  const addMemberToTeam = async (adminUserId: string, teamId: string) => {
    if (!canEdit) return;
    const { data, error } = await supabase
      .from('lead_team_members')
      .insert({
        team_id: teamId,
        admin_user_id: adminUserId,
        workstream_new_leads: true,
        workstream_recontact: false,
        workstream_renewals: false,
        team_changed_at: new Date().toISOString(),
        notice_seen_at: null,
      } as any)
      .select()
      .single();
    if (error) {
      toast({ title: 'Could not add agent', description: error.message, variant: 'destructive' });
      return;
    }
    setMembers(prev => [...prev, data as Member]);
    toast({ title: 'Agent added', description: 'They\'ll see a notice on next login.' });
  };

  const moveMember = async (memberId: string, newTeamId: string) => {
    if (!canEdit) return;
    const current = members.find(m => m.id === memberId);
    if (!current || current.team_id === newTeamId) return;
    const { data, error } = await supabase
      .from('lead_team_members')
      .update({
        team_id: newTeamId,
        previous_team_id: current.team_id,
        team_changed_at: new Date().toISOString(),
        notice_seen_at: null,
      } as any)
      .eq('id', memberId)
      .select()
      .single();
    if (error) {
      toast({ title: 'Move failed', description: error.message, variant: 'destructive' });
      return;
    }
    setMembers(prev => prev.map(m => (m.id === memberId ? (data as Member) : m)));
  };

  const removeMember = async (memberId: string) => {
    if (!canEdit) return;
    if (!confirm('Remove this agent from the team? Their workstream allocations will be cleared.')) return;
    const { error } = await supabase.from('lead_team_members').delete().eq('id', memberId);
    if (error) {
      toast({ title: 'Remove failed', description: error.message, variant: 'destructive' });
      return;
    }
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const visibleMembers = useCallback((teamId: string) => {
    const list = members.filter(m => m.team_id === teamId);
    if (filter === 'all') return list;
    const col = WORKSTREAMS.find(w => w.key === filter)!.col;
    return list.filter(m => (m as any)[col]);
  }, [members, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Agent Allocation
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            One place to assign every agent to a team and choose which queues they work — New Leads, Recontact and Renewals.
            Toggle any cell to update instantly. Agents are notified on their next login.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border bg-background p-0.5">
            {(['all', 'new_leads', 'recontact', 'renewals'] as WorkstreamFilter[]).map(f => {
              const label = f === 'all' ? 'All' : WORKSTREAMS.find(w => w.key === f)!.short;
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs rounded ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <Button size="sm" variant="outline" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Pending agents */}
      {canEdit && pendingAgents.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4 text-amber-600" /> Pending sales agents
              <Badge variant="outline" className="text-[10px]">{pendingAgents.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              These agents have sales permissions but no team yet. Place them in a team — they'll start on New Leads by default and you can enable Recontact or Renewals below.
            </p>
            {pendingAgents.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-2 border rounded px-3 py-1.5 bg-background">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {`${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{a.email} · {a.role}</div>
                </div>
                <Select onValueChange={(v) => addMemberToTeam(a.id, v)} value="">
                  <SelectTrigger className="h-8 w-[160px] text-xs shrink-0">
                    <SelectValue placeholder="Add to team…" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.emoji} {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Teams */}
      {teams.map(team => {
        const teamMembers = visibleMembers(team.id);
        const totalForTeam = members.filter(m => m.team_id === team.id).length;
        const otherTeams = teams.filter(t => t.id !== team.id);
        return (
          <Card key={team.id} className="overflow-hidden">
            <CardHeader
              className="py-3"
              style={{ backgroundColor: `${team.color}15`, borderBottom: `2px solid ${team.color}` }}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-semibold"
                    style={{ backgroundColor: team.color }}
                  >
                    {team.emoji} {team.name}
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {teamMembers.length} of {totalForTeam} {filter === 'all' ? 'member' : 'on ' + WORKSTREAMS.find(w => w.key === filter)?.short}
                    {teamMembers.length === 1 ? '' : 's'}
                  </span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* per-agent toggles below — bulk controls removed so allocation is strictly per individual agent */}
              {teamMembers.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {filter === 'all' ? 'No members yet.' : `No-one on ${WORKSTREAMS.find(w => w.key === filter)?.label} in this team.`}
                </div>
              ) : (
                <div className="divide-y">
                  {/* Header row */}
                  <div className="hidden md:grid grid-cols-[1fr_repeat(3,90px)_auto] gap-2 px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/30">
                    <div>Agent</div>
                    {WORKSTREAMS.map(w => (
                      <div key={w.key} className="text-center">{w.short}</div>
                    ))}
                    <div className="text-right">Actions</div>
                  </div>
                  {teamMembers.map(m => {
                    const u = admins.find(a => a.id === m.admin_user_id);
                    return (
                      <div key={m.id} className="grid grid-cols-1 md:grid-cols-[1fr_repeat(3,90px)_auto] gap-2 px-4 py-2 items-center">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email : 'Unknown user'}
                          </div>
                          {u && <div className="text-xs text-muted-foreground truncate">{u.email} · {u.role}</div>}
                        </div>
                        {WORKSTREAMS.map(w => {
                          const on = (m as any)[w.col] === true;
                          return (
                            <div key={w.key} className="flex md:justify-center items-center gap-2">
                              <button
                                disabled={!canEdit}
                                onClick={() => toggleWorkstream(m, w.key)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition ${
                                  on
                                    ? 'bg-primary/10 border-primary/40 text-primary'
                                    : 'bg-muted/40 border-transparent text-muted-foreground hover:bg-muted'
                                } ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                                title={`${on ? 'Remove from' : 'Add to'} ${w.label}`}
                              >
                                <w.icon className={`h-3 w-3 ${on ? w.tint : ''}`} />
                                <span className="md:hidden">{w.short}</span>
                                <span className="hidden md:inline">{on ? 'On' : 'Off'}</span>
                              </button>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && otherTeams.length > 0 && (
                            <Select onValueChange={(v) => moveMember(m.id, v)} value="">
                              <SelectTrigger className="h-7 w-[120px] text-xs">
                                <SelectValue placeholder="Move to…" />
                              </SelectTrigger>
                              <SelectContent>
                                {otherTeams.map(t => (
                                  <SelectItem key={t.id} value={t.id} className="text-xs">
                                    {t.emoji} {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {canEdit && (
                            <Button variant="ghost" size="sm" onClick={() => removeMember(m.id)} title="Remove from team">
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {!teams.length && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No teams yet — add a team in the Lead Routing tab to get started.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AllocationMatrix;
