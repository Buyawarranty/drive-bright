import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Phone, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Tracker {
  id: string;
  callrail_tracker_id: string;
  phone_e164: string | null;
  label: string | null;
  assigned_admin_user_id: string | null;
  active: boolean;
}

interface AdminUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  callrail_banner_enabled: boolean;
}

interface Team {
  id: string;
  name: string;
  color: string | null;
  callrail_banner_enabled: boolean;
}

const UNASSIGNED = '__unassigned__';

export const CallRailTrackerAssignments = () => {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [agents, setAgents] = useState<AdminUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [
      { data: t, error: tErr },
      { data: a, error: aErr },
      { data: teamRows, error: teamErr },
    ] = await Promise.all([
      supabase
        .from('callrail_tracking_numbers')
        .select('id, callrail_tracker_id, phone_e164, label, assigned_admin_user_id, active')
        .order('label', { ascending: true, nullsFirst: false }),
      supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, callrail_banner_enabled')
        .eq('is_active', true)
        .in('role', ['sales', 'sales_lead'])
        .order('first_name', { ascending: true }),
      supabase
        .from('lead_teams')
        .select('id, name, color, callrail_banner_enabled')
        .order('name', { ascending: true }),
    ]);
    if (tErr) toast.error('Failed to load CallRail trackers');
    if (aErr) toast.error('Failed to load agents');
    if (teamErr) toast.error('Failed to load teams');
    setTrackers((t as Tracker[]) || []);
    setAgents((a as AdminUser[]) || []);
    setTeams((teamRows as Team[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const agentLabel = (u: AdminUser) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    return name ? `${name} · ${u.role}` : `${u.email} · ${u.role}`;
  };

  const sortedAgents = useMemo(
    () => [...agents].sort((x, y) => agentLabel(x).localeCompare(agentLabel(y))),
    [agents],
  );

  const updateTracker = async (id: string, patch: Partial<Tracker>) => {
    setSavingId(id);
    const { error } = await supabase.from('callrail_tracking_numbers').update(patch).eq('id', id);
    if (error) toast.error(`Update failed: ${error.message}`);
    else {
      setTrackers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      toast.success('Tracker updated');
    }
    setSavingId(null);
  };

  const toggleTeam = async (teamId: string, value: boolean) => {
    const prev = teams;
    setTeams((p) => p.map((t) => (t.id === teamId ? { ...t, callrail_banner_enabled: value } : t)));
    const { error } = await supabase
      .from('lead_teams')
      .update({ callrail_banner_enabled: value })
      .eq('id', teamId);
    if (error) {
      setTeams(prev);
      toast.error(`Team update failed: ${error.message}`);
    } else {
      toast.success(`Team banner ${value ? 'enabled' : 'disabled'}`);
    }
  };

  const toggleAgent = async (agentId: string, value: boolean) => {
    const prev = agents;
    setAgents((p) => p.map((a) => (a.id === agentId ? { ...a, callrail_banner_enabled: value } : a)));
    const { error } = await supabase
      .from('admin_users')
      .update({ callrail_banner_enabled: value })
      .eq('id', agentId);
    if (error) {
      setAgents(prev);
      toast.error(`Agent update failed: ${error.message}`);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary" />
          CallRail Tracker Assignments
          <Badge variant="secondary" className="ml-2 text-[10px]">Management &amp; Lead Gen</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Incoming-call banners broadcast to <strong>every enabled agent across all teams</strong>. Missed-call alerts still route to the assigned agent below.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Team-level broadcast toggles */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Team broadcast</h4>
                <span className="text-xs text-muted-foreground">Turn banners on/off for a whole team</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {teams.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No teams configured.</div>
                ) : (
                  teams.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: t.color || '#94a3b8' }}
                      />
                      <span className="text-sm font-medium">{t.name}</span>
                      <Switch
                        checked={t.callrail_banner_enabled}
                        onCheckedChange={(v) => toggleTeam(t.id, v)}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Individual agent toggles */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Individual agents</h4>
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2 px-3 font-medium">Agent</th>
                      <th className="py-2 px-3 font-medium">Role</th>
                      <th className="py-2 px-3 font-medium text-right">Receive banners</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAgents.map((a) => {
                      const name = [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email;
                      return (
                        <tr key={a.id} className="border-t">
                          <td className="py-2 px-3">{name}</td>
                          <td className="py-2 px-3 text-xs text-muted-foreground">{a.role}</td>
                          <td className="py-2 px-3 text-right">
                            <Switch
                              checked={a.callrail_banner_enabled}
                              onCheckedChange={(v) => toggleAgent(a.id, v)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tracker → agent assignment (missed-call routing) */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Missed-call routing</h4>
              {trackers.length === 0 ? (
                <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4">
                  No tracking numbers found yet. They will appear here automatically after the first CallRail webhook is received.
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-2 px-3 font-medium">Label</th>
                        <th className="py-2 px-3 font-medium">Number</th>
                        <th className="py-2 px-3 font-medium">Tracker ID</th>
                        <th className="py-2 px-3 font-medium">Assigned agent</th>
                        <th className="py-2 px-3 font-medium">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trackers.map((t) => (
                        <tr key={t.id} className="border-t">
                          <td className="py-2 px-3">{t.label || <span className="text-muted-foreground">—</span>}</td>
                          <td className="py-2 px-3 font-mono text-xs">{t.phone_e164 || '—'}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">{t.callrail_tracker_id}</td>
                          <td className="py-2 px-3 min-w-[220px]">
                            <Select
                              value={t.assigned_admin_user_id ?? UNASSIGNED}
                              disabled={savingId === t.id}
                              onValueChange={(v) =>
                                updateTracker(t.id, { assigned_admin_user_id: v === UNASSIGNED ? null : v })
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                              <SelectContent className="max-h-72">
                                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                                {sortedAgents.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {agentLabel(a)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-3">
                            <Switch
                              checked={t.active}
                              disabled={savingId === t.id}
                              onCheckedChange={(v) => updateTracker(t.id, { active: v })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
