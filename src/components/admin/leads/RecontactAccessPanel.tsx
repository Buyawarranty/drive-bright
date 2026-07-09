import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp, Loader2, UserRoundCog, Trash2, Info, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useViewAs } from '@/contexts/ViewAsContext';

const MANAGEMENT_ROLES = ['admin', 'super_admin', 'sales_manager'];

type Row = {
  admin_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  role: string | null;
  team_id: string | null;
  team_name: string | null;
  workstream_recontact: boolean | null; // null = no team row
  presence: 'online' | 'away' | 'offline';
  assigned_count: number;
};

type Status = 'active' | 'paused' | 'removed';
type Team = { id: string; name: string };

const statusOf = (r: Row): Status => {
  if (r.team_id == null) return 'removed';
  return r.workstream_recontact ? 'active' : 'paused';
};

const statusBadge = (s: Status) => {
  if (s === 'active') return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
  if (s === 'paused') return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Paused</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Removed</Badge>;
};

/**
 * Management-only panel to control which agents can work Recontact Leads.
 * By default no agents are listed — managers explicitly add agents via the
 * "Add agent" picker. Added agents can then be set Active (receiving work)
 * or Paused (kept on team but excluded from recontact assignment).
 * Remove takes them off the list entirely.
 */
const RecontactAccessPanelInner: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [addAgentId, setAddAgentId] = useState<string>('');
  const [addTeamId, setAddTeamId] = useState<string>('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: agents }, { data: members }, { data: teamsData }] = await Promise.all([
      (supabase.from('admin_users') as any)
        .select('id, user_id, first_name, last_name, email, role, is_active')
        .in('role', ['sales', 'sales_lead'])
        .eq('is_active', true)
        .order('first_name'),
      (supabase.from('lead_team_members') as any)
        .select('admin_user_id, team_id, workstream_recontact'),
      (supabase.from('lead_teams') as any).select('id, name').order('name'),
    ]);
    const adminIds = ((agents as any[]) || []).map(a => a.id);
    const [{ data: presenceRows }, { data: leadRows }] = await Promise.all([
      adminIds.length
        ? (supabase.from('user_presence') as any)
            .select('admin_user_id, status, last_seen_at')
            .in('admin_user_id', adminIds)
        : Promise.resolve({ data: [] as any[] }),
      (supabase.from('sales_leads') as any)
        .select('assigned_to')
        .not('assigned_to', 'is', null),
    ]);
    const presenceMap = new Map<string, { status: string; last_seen_at: string | null }>();
    (presenceRows || []).forEach((p: any) => {
      presenceMap.set(p.admin_user_id, { status: p.status, last_seen_at: p.last_seen_at });
    });
    const counts: Record<string, number> = {};
    (leadRows || []).forEach((l: any) => {
      if (l.assigned_to) counts[l.assigned_to] = (counts[l.assigned_to] || 0) + 1;
    });
    const teamMap = new Map<string, string>();
    (teamsData || []).forEach((t: any) => teamMap.set(t.id, t.name));
    const memberMap = new Map<string, any>();
    (members || []).forEach((m: any) => memberMap.set(m.admin_user_id, m));
    const now = Date.now();
    const list: Row[] = ((agents as any[]) || []).map((a) => {
      const m = memberMap.get(a.id);
      const name = [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email || 'Agent';
      const p = presenceMap.get(a.id);
      let presence: 'online' | 'away' | 'offline' = 'offline';
      if (p) {
        const seen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
        const stale = now - seen > 5 * 60 * 1000;
        if (p.status === 'online' && !stale) presence = 'online';
        else if ((p.status === 'away' || p.status === 'online') && !stale) presence = 'away';
        else presence = 'offline';
      }
      return {
        admin_id: a.id,
        user_id: a.user_id ?? null,
        name,
        email: a.email,
        role: a.role,
        team_id: m?.team_id ?? null,
        team_name: m?.team_id ? teamMap.get(m.team_id) ?? null : null,
        workstream_recontact: m ? !!m.workstream_recontact : null,
        presence,
        assigned_count: counts[a.id] || 0,
      };
    });
    setRows(list);
    setTeams((teamsData as Team[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = useCallback(async (row: Row, next: Status) => {
    if (statusOf(row) === next) return;
    setBusyId(row.admin_id);
    try {
      if (next === 'removed') {
        const { error } = await (supabase.from('lead_team_members') as any)
          .delete().eq('admin_user_id', row.admin_id);
        if (error) throw error;
        toast.success(`${row.name} removed`);
      } else {
        if (!row.team_id) {
          toast.error('Assign a team first on the Lead Teams page');
          return;
        }
        const { error } = await (supabase.from('lead_team_members') as any)
          .update({ workstream_recontact: next === 'active' })
          .eq('admin_user_id', row.admin_id);
        if (error) throw error;
        toast.success(`${row.name} ${next === 'active' ? 'activated' : 'paused'}`);
      }
      await load();
    } catch (e: any) {
      toast.error('Update failed', { description: e.message });
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const addAgent = useCallback(async () => {
    if (!addAgentId || !addTeamId) {
      toast.error('Pick an agent and a team');
      return;
    }
    setAdding(true);
    try {
      const { error } = await (supabase.from('lead_team_members') as any)
        .upsert({
          admin_user_id: addAgentId,
          team_id: addTeamId,
          workstream_recontact: true,
        }, { onConflict: 'admin_user_id' });
      if (error) throw error;
      toast.success('Agent added to Recontact Leads');
      setAddAgentId('');
      setAddTeamId('');
      await load();
    } catch (e: any) {
      toast.error('Add failed', { description: e.message });
    } finally {
      setAdding(false);
    }
  }, [addAgentId, addTeamId, load]);

  // Only show agents the manager has explicitly added (have a team row).
  const visibleRows = useMemo(() => rows.filter(r => r.team_id != null), [rows]);
  const availableAgents = useMemo(() => rows.filter(r => r.team_id == null), [rows]);

  const counts = useMemo(() => {
    const c = { active: 0, paused: 0 };
    visibleRows.forEach(r => {
      const s = statusOf(r);
      if (s === 'active') c.active++;
      else if (s === 'paused') c.paused++;
    });
    return c;
  }, [visibleRows]);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <UserRoundCog className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="text-base font-semibold text-foreground">Agent access to Recontact Leads</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Add the agents who should work recontact leads. Pause to hold, remove to take off entirely.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <Badge className="bg-green-100 text-green-800 border-green-200">{counts.active} active</Badge>
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">{counts.paused} paused</Badge>
          </div>
          {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <CardContent className="border-t pt-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading agents…
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 px-3 py-2 mb-3 rounded-md bg-muted text-muted-foreground border border-border">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs">
                  Only agents added below appear in the Recontact assignment picker. <strong>Active</strong> agents receive new recontact work; <strong>Paused</strong> agents keep their team membership but are skipped for assignment.
                </p>
              </div>

              {/* Add agent picker */}
              <div className="flex flex-wrap items-end gap-2 p-3 mb-4 rounded-md border border-dashed bg-muted/30">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Add agent</label>
                  <Select value={addAgentId} onValueChange={setAddAgentId} disabled={adding || availableAgents.length === 0}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder={availableAgents.length === 0 ? 'All agents added' : 'Pick an agent…'} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAgents.map(a => (
                        <SelectItem key={a.admin_id} value={a.admin_id}>{a.name} · {a.role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Team</label>
                  <Select value={addTeamId} onValueChange={setAddTeamId} disabled={adding || !addAgentId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Pick a team…" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  className="h-9"
                  onClick={addAgent}
                  disabled={adding || !addAgentId || !addTeamId}
                >
                  {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                  Add
                </Button>
              </div>

              {visibleRows.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center border rounded-md bg-muted/20">
                  No agents added yet. Use the picker above to add agents to Recontact Leads.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                        <th className="py-2 pr-3 font-medium">Agent</th>
                        <th className="py-2 pr-3 font-medium">Role</th>
                        <th className="py-2 pr-3 font-medium">Team</th>
                        <th className="py-2 pr-3 font-medium">Presence</th>
                        <th className="py-2 pr-3 font-medium">Assigned</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 pr-3 font-medium">Access</th>
                        <th className="py-2 pr-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((r) => {
                        const s = statusOf(r);
                        const disabled = busyId === r.admin_id;
                        const presenceColor = r.presence === 'online'
                          ? 'bg-green-500'
                          : r.presence === 'away' ? 'bg-amber-400' : 'bg-slate-300';
                        return (
                          <tr key={r.admin_id} className="border-b last:border-b-0 hover:bg-muted/30">
                            <td className="py-2 pr-3">
                              <div className="font-medium text-foreground">{r.name}</div>
                              <div className="text-xs text-muted-foreground">{r.email}</div>
                            </td>
                            <td className="py-2 pr-3 text-xs text-muted-foreground">{r.role}</td>
                            <td className="py-2 pr-3 text-xs">
                              {r.team_name ? r.team_name : <span className="text-muted-foreground italic">No team</span>}
                            </td>
                            <td className="py-2 pr-3">
                              <span className="inline-flex items-center gap-1.5 text-xs capitalize">
                                <span className={`inline-block h-2 w-2 rounded-full ${presenceColor}`} />
                                {r.presence}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-xs font-medium tabular-nums">{r.assigned_count}</td>
                            <td className="py-2 pr-3">{statusBadge(s)}</td>
                            <td className="py-2 pr-3">
                              <Select
                                value={s === 'removed' ? 'removed' : s}
                                onValueChange={(v) => setStatus(r, v as Status)}
                                disabled={disabled}
                              >
                                <SelectTrigger className="h-8 w-[130px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active" disabled={!r.team_id}>Active</SelectItem>
                                  <SelectItem value="paused" disabled={!r.team_id}>Paused</SelectItem>
                                  <SelectItem value="removed">Removed</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-2 pr-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-destructive hover:text-destructive"
                                disabled={disabled}
                                onClick={() => setStatus(r, 'removed')}
                                title="Remove from Recontact Leads entirely"
                              >
                                {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export const RecontactAccessPanel: React.FC = () => {
  const { effectiveRole } = useViewAs();
  if (!MANAGEMENT_ROLES.includes(effectiveRole || '')) return null;
  return <RecontactAccessPanelInner />;
};

export default RecontactAccessPanel;
