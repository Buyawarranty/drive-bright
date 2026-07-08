import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp, Loader2, UserRoundCog, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';

type Row = {
  admin_id: string;
  name: string;
  email: string | null;
  role: string | null;
  team_id: string | null;
  team_name: string | null;
  workstream_recontact: boolean | null; // null = no team row
};

type Status = 'active' | 'paused' | 'removed';

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
 * - Active: agent shows up in the Recontact page picker and can be assigned recontact leads.
 * - Paused: keeps the agent on their team but excludes them from the Recontact workstream.
 * - Removed: takes the agent off their team entirely (Lead Teams page manages team membership).
 *
 * Reads/writes lead_team_members (workstream_recontact + row delete).
 * Gated to management callers by the parent.
 */
export const RecontactAccessPanel: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: agents }, { data: members }, { data: teams }] = await Promise.all([
      (supabase.from('admin_users') as any)
        .select('id, first_name, last_name, email, role, is_active')
        .in('role', ['sales', 'sales_lead'])
        .eq('is_active', true)
        .order('first_name'),
      (supabase.from('lead_team_members') as any)
        .select('admin_user_id, team_id, workstream_recontact'),
      (supabase.from('lead_teams') as any).select('id, name'),
    ]);
    const teamMap = new Map<string, string>();
    (teams || []).forEach((t: any) => teamMap.set(t.id, t.name));
    const memberMap = new Map<string, any>();
    (members || []).forEach((m: any) => memberMap.set(m.admin_user_id, m));
    const list: Row[] = ((agents as any[]) || []).map((a) => {
      const m = memberMap.get(a.id);
      const name = [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email || 'Agent';
      return {
        admin_id: a.id,
        name,
        email: a.email,
        role: a.role,
        team_id: m?.team_id ?? null,
        team_name: m?.team_id ? teamMap.get(m.team_id) ?? null : null,
        workstream_recontact: m ? !!m.workstream_recontact : null,
      };
    });
    setRows(list);
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
        toast.success(`${row.name} removed from team`);
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

  const counts = useMemo(() => {
    const c = { active: 0, paused: 0, removed: 0 };
    rows.forEach(r => { c[statusOf(r)]++; });
    return c;
  }, [rows]);

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
              Choose who receives recontact leads. Pause to hold, remove to take an agent off entirely.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <Badge className="bg-green-100 text-green-800 border-green-200">{counts.active} active</Badge>
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">{counts.paused} paused</Badge>
            <Badge variant="outline">{counts.removed} removed</Badge>
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
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">No sales agents found.</div>
          ) : (
            <>
              <div className="flex items-start gap-2 px-3 py-2 mb-3 rounded-md bg-muted text-muted-foreground border border-border">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs">
                  Only agents set to <strong>Active</strong> appear in the Recontact assignment picker below. Paused agents keep their team membership but stop receiving new recontact work.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                      <th className="py-2 pr-3 font-medium">Agent</th>
                      <th className="py-2 pr-3 font-medium">Role</th>
                      <th className="py-2 pr-3 font-medium">Team</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Access</th>
                      <th className="py-2 pr-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const s = statusOf(r);
                      const disabled = busyId === r.admin_id;
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
                            {s !== 'removed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-destructive hover:text-destructive"
                                disabled={disabled}
                                onClick={() => setStatus(r, 'removed')}
                                title="Remove from team entirely"
                              >
                                {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default RecontactAccessPanel;
