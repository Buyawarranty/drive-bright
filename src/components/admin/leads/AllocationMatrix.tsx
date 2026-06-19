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
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <div className="inline-flex border-2 border-foreground bg-background">
          {(['all', 'new_leads', 'recontact', 'renewals'] as WorkstreamFilter[]).map((f, i) => {
            const label = f === 'all' ? 'All' : WORKSTREAMS.find(w => w.key === f)!.short;
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  i > 0 ? 'border-l-2 border-foreground' : ''
                } ${active ? 'bg-foreground text-background' : 'bg-background text-foreground hover:bg-muted'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={loadAll}
          disabled={loading}
          className="h-8 rounded-none border-2 border-foreground font-semibold uppercase text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Pending agents */}
      {canEdit && pendingAgents.length > 0 && (
        <div className="border-2 border-amber-500 bg-amber-50">
          <div className="px-4 py-2 border-b-2 border-amber-500 bg-amber-100 flex items-center gap-2">
            <Plus className="h-4 w-4 text-amber-800" />
            <span className="text-xs font-bold uppercase tracking-wide text-amber-900">
              Pending sales agents
            </span>
            <span className="ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 bg-amber-600 text-white text-[11px] font-bold">
              {pendingAgents.length}
            </span>
          </div>
          <div className="p-3 space-y-2">
            <p className="text-xs text-amber-900/80">
              These agents have sales permissions but no team. Place them in a team — they'll start on New Leads by default.
            </p>
            {pendingAgents.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-2 border-2 border-foreground/80 px-3 py-2 bg-background">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {`${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{a.email} · {a.role}</div>
                </div>
                <Select onValueChange={(v) => addMemberToTeam(a.id, v)} value="">
                  <SelectTrigger className="h-8 w-[170px] text-xs shrink-0 rounded-none border-2 border-foreground font-semibold">
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
          </div>
        </div>
      )}

      {/* Teams — sharp rectangles, agents lead the visual hierarchy */}
      {teams.map(team => {
        const teamMembers = visibleMembers(team.id);
        const totalForTeam = members.filter(m => m.team_id === team.id).length;
        const otherTeams = teams.filter(t => t.id !== team.id);
        return (
          <div key={team.id} className="border-2 border-foreground bg-background">
            {/* Solid team header strip */}
            <div
              className="flex items-center justify-between gap-3 px-4 py-2.5 border-b-2 border-foreground text-white"
              style={{ backgroundColor: team.color }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base font-bold uppercase tracking-wide">
                  {team.emoji} {team.name}
                </span>
                <span className="text-[11px] font-medium opacity-90 uppercase tracking-wider">
                  {teamMembers.length} / {totalForTeam} {filter === 'all' ? 'agents' : 'on ' + WORKSTREAMS.find(w => w.key === filter)?.short}
                </span>
              </div>
            </div>

            {teamMembers.length === 0 ? (
              <div className="px-4 py-8 m-2 text-center text-sm text-muted-foreground border-2 border-dashed border-muted">
                {filter === 'all' ? 'No agents in this team yet.' : `No-one on ${WORKSTREAMS.find(w => w.key === filter)?.label}.`}
              </div>
            ) : (
              <div>
                {/* Column header strip */}
                <div className="hidden md:grid grid-cols-[1fr_repeat(3,100px)_180px] gap-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted border-b-2 border-foreground/20">
                  <div>Agent</div>
                  {WORKSTREAMS.map(w => (
                    <div key={w.key} className="text-center">{w.short}</div>
                  ))}
                  <div className="text-right">Actions</div>
                </div>
                <div className="divide-y-2 divide-foreground/10">
                  {teamMembers.map(m => {
                    const u = admins.find(a => a.id === m.admin_user_id);
                    const initials = u
                      ? (`${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase() || u.email[0].toUpperCase())
                      : '?';
                    return (
                      <div key={m.id} className="grid grid-cols-1 md:grid-cols-[1fr_repeat(3,100px)_180px] gap-2 px-4 py-2.5 items-center hover:bg-muted/40">
                        <div className="min-w-0 flex items-center gap-2.5">
                          <div
                            className="h-9 w-9 shrink-0 flex items-center justify-center text-white text-xs font-bold border-2 border-foreground"
                            style={{ backgroundColor: team.color }}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">
                              {u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email : 'Unknown user'}
                            </div>
                            {u && <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>}
                          </div>
                        </div>
                        {WORKSTREAMS.map(w => {
                          const on = (m as any)[w.col] === true;
                          return (
                            <div key={w.key} className="flex md:justify-center items-center gap-2">
                              <button
                                disabled={!canEdit}
                                onClick={() => toggleWorkstream(m, w.key)}
                                className={`inline-flex items-center justify-center gap-1.5 min-w-[72px] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide border-2 transition-colors ${
                                  on
                                    ? 'bg-foreground text-background border-foreground'
                                    : 'bg-background text-muted-foreground border-muted hover:border-foreground/40'
                                } ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                title={`${on ? 'Remove from' : 'Add to'} ${w.label}`}
                              >
                                <w.icon className="h-3 w-3" />
                                {on ? 'On' : 'Off'}
                              </button>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && otherTeams.length > 0 && (
                            <Select onValueChange={(v) => moveMember(m.id, v)} value="">
                              <SelectTrigger className="h-8 w-[130px] text-xs rounded-none border-2 border-foreground/70 font-semibold">
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
                            <button
                              onClick={() => removeMember(m.id)}
                              title="Remove from team"
                              className="h-8 w-8 flex items-center justify-center border-2 border-foreground/70 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!teams.length && !loading && (
        <div className="border-2 border-dashed border-muted-foreground/40 py-8 text-center text-sm text-muted-foreground">
          No teams yet — add a team in the routing section below to get started.
        </div>
      )}
    </div>
  );
};

export default AllocationMatrix;
