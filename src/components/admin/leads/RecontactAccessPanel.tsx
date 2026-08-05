import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChevronDown, ChevronUp, Loader2, UserRoundCog, Trash2, Info, Plus, Check, Send } from 'lucide-react';
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
  can_self_assign: boolean;
  can_reassign: boolean;
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
  const [allocDrafts, setAllocDrafts] = useState<Record<string, string>>({});
  const [poolRemaining, setPoolRemaining] = useState<number | null>(null);
  const [confirmFor, setConfirmFor] = useState<{ row: Row; count: number } | null>(null);
  const [allocating, setAllocating] = useState(false);

  const loadPool = useCallback(async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await (supabase.from('sales_leads') as any)
      .select('id', { count: 'exact', head: true })
      .is('assigned_to', null)
      .not('status', 'in', '(lost,fake_lead,converted,archived)')
      .lt('created_at', cutoff);
    setPoolRemaining(count ?? 0);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    loadPool();
    const [{ data: agents }, { data: members }, { data: teamsData }, { data: capRows }] = await Promise.all([
      (supabase.from('admin_users') as any)
        .select('id, user_id, first_name, last_name, email, role, is_active')
        .in('role', ['sales', 'sales_lead'])
        .eq('is_active', true)
        .order('first_name'),
      (supabase.from('lead_team_members') as any)
        .select('admin_user_id, team_id, workstream_recontact'),
      (supabase.from('lead_teams') as any).select('id, name').order('name'),
      (supabase.from('recontact_agent_caps') as any)
        .select('admin_user_id, can_self_assign, can_reassign, skip_batch_check, blocked'),
    ]);
    const capMap = new Map<string, any>();
    ((capRows as any[]) || []).forEach((c) => capMap.set(c.admin_user_id, c));
    const adminIds = ((agents as any[]) || []).map(a => a.id);
    // Terminal statuses that shouldn't count as "assigned open work"
    const TERMINAL = ['lost', 'converted', 'fake_lead', 'won', 'paid'];
    const [{ data: presenceRows }, countResults] = await Promise.all([
      adminIds.length
        ? (supabase.from('user_presence') as any)
            .select('admin_user_id, status, last_seen_at')
            .in('admin_user_id', adminIds)
        : Promise.resolve({ data: [] as any[] }),
      Promise.all(
        adminIds.map((id) =>
          (supabase.from('sales_leads') as any)
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', id)
            .not('status', 'in', `(${TERMINAL.join(',')})`)
            .then((res: any) => ({ id, count: res.count ?? 0 }))
        )
      ),
    ]);
    const presenceMap = new Map<string, { status: string; last_seen_at: string | null }>();
    (presenceRows || []).forEach((p: any) => {
      presenceMap.set(p.admin_user_id, { status: p.status, last_seen_at: p.last_seen_at });
    });
    const counts: Record<string, number> = {};
    (countResults || []).forEach((r: any) => { counts[r.id] = r.count; });
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
        can_self_assign: !!capMap.get(a.id)?.can_self_assign,
        can_reassign: !!capMap.get(a.id)?.can_reassign,
      };
    });
    setRows(list);
    setTeams((teamsData as Team[]) || []);
    setLoading(false);
  }, [loadPool]);

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
        const on = next === 'active';
        const { error } = await (supabase.from('lead_team_members') as any)
          .update({ workstream_recontact: on })
          .eq('admin_user_id', row.admin_id);
        if (error) throw error;
        // Keep the claiming cap in step with the toggle so "On" really means they can claim.
        const { error: capError } = await (supabase.from('recontact_agent_caps') as any)
          .upsert({ admin_user_id: row.admin_id, blocked: !on }, { onConflict: 'admin_user_id' });
        if (capError) throw capError;
        toast.success(`${row.name} recontact access ${on ? 'On' : 'Off'}`, {
          description: on
            ? 'They can now claim recontact leads and be allocated them.'
            : 'They will not be able to claim recontact leads until turned back On.',
        });
      }
      await load();
    } catch (e: any) {
      toast.error('Update failed', { description: e.message });
    } finally {
      setBusyId(null);
    }
  }, [load]);

  /**
   * Per-agent recontact permissions:
   *  - can_self_assign: agent may claim recontact leads to themselves
   *  - can_reassign: agent may change who a recontact lead is assigned to
   * Self-assign also flips skip_batch_check so they aren't blocked by the
   * "finish your batch first" guard, and mirrors the reassign right onto
   * agent_distribution_caps which the CRM reads for the reassign UI.
   */
  const setCapFlag = useCallback(async (
    row: Row,
    field: 'can_self_assign' | 'can_reassign',
    value: boolean,
  ) => {
    setBusyId(row.admin_id);
    try {
      const patch: Record<string, any> = { admin_user_id: row.admin_id, [field]: value };
      if (field === 'can_self_assign') patch.skip_batch_check = value;
      const { error } = await (supabase.from('recontact_agent_caps') as any)
        .upsert(patch, { onConflict: 'admin_user_id' });
      if (error) throw error;

      if (field === 'can_reassign') {
        const { error: dErr } = await (supabase.from('agent_distribution_caps') as any)
          .upsert(
            { admin_user_id: row.admin_id, can_reassign_leads: value },
            { onConflict: 'admin_user_id' },
          );
        if (dErr) throw dErr;
      }

      toast.success(
        field === 'can_self_assign'
          ? `${row.name} can ${value ? 'now' : 'no longer'} assign recontact leads to themselves`
          : `${row.name} can ${value ? 'now' : 'no longer'} change who a recontact lead is assigned to`,
      );
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

  const runAllocate = useCallback(async (row: Row, count: number) => {
    setAllocating(true);
    try {
      const { data, error } = await (supabase.rpc as any)('assign_recontact_leads_to_agent', {
        _agent_id: row.admin_id,
        _batch_size: count,
      });
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      const reason: string | null = r?.blocked_reason ?? null;
      const assigned: number = r?.assigned_count ?? 0;
      const remaining: number = r?.pool_remaining ?? 0;
      if (reason === 'not_management') { toast.error("You don't have permission to allocate leads"); return; }
      if (reason === 'agent_inactive') { toast.error(`${row.name} is inactive`); return; }
      if (reason === 'agent_not_on_recontact') { toast.error(`${row.name} isn't set to Active on Recontact`); return; }
      if (assigned === 0) {
        toast.info('No unassigned recontact leads (30+ days old) available');
      } else {
        toast.success(`Allocated ${assigned} lead${assigned === 1 ? '' : 's'} to ${row.name}`, {
          description: `${remaining} still in the recontact pool`,
        });
      }
      setAllocDrafts(prev => { const n = { ...prev }; delete n[row.admin_id]; return n; });
      setConfirmFor(null);
      await load();
    } catch (e: any) {
      toast.error('Allocation failed', { description: e.message });
    } finally {
      setAllocating(false);
    }
  }, [load]);

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
            {poolRemaining != null && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                {poolRemaining} in pool
              </Badge>
            )}
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
                  Only agents added below appear in the Recontact assignment picker and can claim from the recontact pool. Remove an agent to take them off Recontact entirely.
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
                        <th className="py-2 pr-3 font-medium">Recontact on/off</th>
                        <th className="py-2 pr-3 font-medium">Self-assign</th>
                        <th className="py-2 pr-3 font-medium">Can reassign</th>
                        <th className="py-2 pr-3 font-medium">Assigned</th>
                        <th className="py-2 pr-3 font-medium">Allocate leads</th>
                        <th className="py-2 pr-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((r) => {
                        const disabled = busyId === r.admin_id;
                        const status = statusOf(r);
                        const isOnline = r.presence === 'online';
                        const isAway = r.presence === 'away';
                        const workingPill = isOnline && status === 'active' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 border border-green-300 px-2 py-0.5 text-[11px] font-semibold">
                            <Check className="h-3 w-3" /> Working
                          </span>
                        ) : isOnline && status === 'paused' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 text-[11px] font-semibold">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Online · paused
                          </span>
                        ) : isAway ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[11px] font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Away
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-[11px] font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Offline
                          </span>
                        );
                        const draft = allocDrafts[r.admin_id] ?? '';
                        const draftNum = Math.max(0, Math.min(200, Number(draft) || 0));
                        const allocDisabled =
                          status !== 'active' || draftNum < 1 || (poolRemaining ?? 0) < 1 || allocating;
                        const rowClass = isOnline && status === 'active'
                          ? 'bg-green-50/40 hover:bg-green-50/70'
                          : 'hover:bg-muted/30';
                        return (
                          <tr key={r.admin_id} className={`border-b last:border-b-0 ${rowClass}`}>
                            <td className="py-2 pr-3">
                              <div className="font-medium text-foreground flex items-center gap-2">
                                {r.name}
                                {isOnline && status === 'active' && (
                                  <span className="h-2 w-2 rounded-full bg-green-500 ring-2 ring-green-200" title="Online and working" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{r.email}</div>
                            </td>
                            <td className="py-2 pr-3 text-xs text-muted-foreground">{r.role}</td>
                            <td className="py-2 pr-3 text-xs">
                              {r.team_name ? r.team_name : <span className="text-muted-foreground italic">No team</span>}
                            </td>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={status === 'active'}
                                  disabled={disabled}
                                  aria-label={`Recontact access for ${r.name}`}
                                  onCheckedChange={(v) => setStatus(r, v ? 'active' : 'paused')}
                                />
                                <span className={`text-[11px] font-semibold ${status === 'active' ? 'text-green-700' : 'text-amber-700'}`}>
                                  {disabled ? 'Saving…' : status === 'active' ? 'On' : 'Off'}
                                </span>
                                {workingPill}
                              </div>
                            </td>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={r.can_self_assign}
                                  disabled={disabled}
                                  aria-label={`Allow ${r.name} to assign recontact leads to themselves`}
                                  onCheckedChange={(v) => setCapFlag(r, 'can_self_assign', v)}
                                />
                                <span className={`text-[11px] font-semibold ${r.can_self_assign ? 'text-green-700' : 'text-muted-foreground'}`}>
                                  {r.can_self_assign ? 'Allowed' : 'Off'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={r.can_reassign}
                                  disabled={disabled}
                                  aria-label={`Allow ${r.name} to change who a recontact lead is assigned to`}
                                  onCheckedChange={(v) => setCapFlag(r, 'can_reassign', v)}
                                />
                                <span className={`text-[11px] font-semibold ${r.can_reassign ? 'text-green-700' : 'text-muted-foreground'}`}>
                                  {r.can_reassign ? 'Allowed' : 'Off'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 pr-3 text-xs font-medium tabular-nums">{r.assigned_count}</td>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="number"
                                  min={1}
                                  max={200}
                                  placeholder="25"
                                  className="h-8 w-16 text-xs"
                                  value={draft}
                                  disabled={status !== 'active'}
                                  onChange={(e) => setAllocDrafts(p => ({ ...p, [r.admin_id]: e.target.value }))}
                                />
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 bg-green-600 hover:bg-green-700 text-white border-green-700"
                                  disabled={allocDisabled}
                                  onClick={() => setConfirmFor({ row: r, count: draftNum })}
                                  title={
                                    status !== 'active' ? 'Agent must be Active on Recontact'
                                    : (poolRemaining ?? 0) < 1 ? 'Recontact pool is empty'
                                    : `Allocate ${draftNum || 25} recontact leads to ${r.name}`
                                  }
                                >
                                  <Send className="h-3.5 w-3.5 mr-1" />
                                  Allocate
                                </Button>
                              </div>
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

      <AlertDialog open={!!confirmFor} onOpenChange={(o) => { if (!o) setConfirmFor(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Allocate recontact leads?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmFor && (
                <>
                  Assign the next <strong>{confirmFor.count}</strong> oldest unassigned
                  recontact lead{confirmFor.count === 1 ? '' : 's'} (30+ days old) to{' '}
                  <strong>{confirmFor.row.name}</strong>?
                  {poolRemaining != null && (
                    <span className="block mt-2 text-xs text-muted-foreground">
                      {poolRemaining} lead{poolRemaining === 1 ? '' : 's'} currently in the recontact pool.
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={allocating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={allocating}
              onClick={(e) => {
                e.preventDefault();
                if (confirmFor) runAllocate(confirmFor.row, confirmFor.count);
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {allocating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Allocate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export const RecontactAccessPanel: React.FC = () => {
  const { effectiveRole } = useViewAs();
  if (!MANAGEMENT_ROLES.includes(effectiveRole || '')) return null;
  return <RecontactAccessPanelInner />;
};

export default RecontactAccessPanel;
