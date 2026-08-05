import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Users, Settings2, X, Pencil, Check, ShieldAlert } from 'lucide-react';
import { RoutingTester } from './RoutingTester';
import { SourceRulesMatrix } from './SourceRulesMatrix';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';


interface LeadRoutingPanelProps {
  canEdit: boolean;
}


interface Team {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
  notes: string | null;
}

interface SourceRule {
  id: string;
  team_id: string;
  source: string;
  allowed: boolean;
  percentage?: number | null;
  conversion_threshold_pct: number | null;
  priority: number;
  notes: string | null;
  daily_cap: number | null;
  overflow_team_id: string | null;
}

interface Member {
  id: string;
  team_id: string;
  admin_user_id: string;
}

interface AdminUserLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

// Centralised list of lead sources we route on. Add new ones here.
export const LEAD_SOURCES: { value: string; label: string; icon: string }[] = [
  { value: 'google_ad', label: 'Google Ad',       icon: '🟡' },
  { value: 'social_ad', label: 'Facebook / Meta Ad', icon: '🔷' },
  { value: 'bing_ad',   label: 'Bing / Microsoft Ad', icon: '🔎' },
  { value: 'website',   label: 'Website (direct / organic)', icon: '🌐' },
];

const LEAD_SOURCE_GROUPS = [
  { title: 'Paid ads', values: ['google_ad', 'social_ad', 'bing_ad'] },
  { title: 'Organic and web', values: ['website'] },
];



const PRESET_COLORS = [
  { name: 'Red',    hex: '#ef4444', emoji: '🔴' },
  { name: 'Blue',   hex: '#3b82f6', emoji: '🔵' },
  { name: 'Green',  hex: '#22c55e', emoji: '🟢' },
  { name: 'Yellow', hex: '#eab308', emoji: '🟡' },
  { name: 'Purple', hex: '#a855f7', emoji: '🟣' },
  { name: 'Orange', hex: '#f97316', emoji: '🟠' },
  { name: 'Black',  hex: '#0a0a0a', emoji: '⚫' },
  { name: 'White',  hex: '#f5f5f5', emoji: '⚪' },
];

interface TeamDistSettings {
  id: string;
  team_id: string | null;
  distribution_mode: string;
  solo_mode_enabled: boolean;
  solo_agent_id: string | null;
  active_only_distribution: boolean;
  overflow_recipient_id: string | null;
}

export const LeadRoutingPanel = ({ canEdit }: LeadRoutingPanelProps) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [rules, setRules] = useState<SourceRule[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [admins, setAdmins] = useState<AdminUserLite[]>([]);
  // Fallback roster (includes agents added after this dialog's roster was fetched)
  // so a member never renders as "Unknown user".
  const allAdminsMap = useAllAdminUsersMap(members.map(m => m.admin_user_id));
  const findAdmin = (id: string): AdminUserLite | undefined =>
    admins.find(a => a.id === id) || (allAdminsMap.get(id) as AdminUserLite | undefined);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState(PRESET_COLORS[3]);
  const [teamDist, setTeamDist] = useState<TeamDistSettings | null>(null);
  const [globalDist, setGlobalDist] = useState<TeamDistSettings | null>(null);
  const [distLoading, setDistLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [routingEnabled, setRoutingEnabled] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [t, r, m, a, gd, ks] = await Promise.all([
        supabase.from('lead_teams').select('*').order('sort_order'),
        supabase.from('lead_team_source_rules').select('*'),
        supabase.from('lead_team_members').select('*'),
        supabase.from('admin_users').select('id, first_name, last_name, email, role').eq('is_active', true).order('first_name'),
        supabase.from('lead_distribution_settings').select('*').is('team_id', null).maybeSingle(),
        supabase.from('lead_settings').select('setting_value').eq('setting_key', 'team_routing_enabled').maybeSingle(),
      ]);
      if (t.error) throw t.error;
      if (r.error) throw r.error;
      if (m.error) throw m.error;
      if (a.error) throw a.error;
      setTeams(t.data || []);
      setRules(r.data || []);
      setMembers(m.data || []);
      setAdmins(a.data || []);
      setGlobalDist((gd.data as TeamDistSettings) || null);
      setRoutingEnabled(Boolean((ks.data?.setting_value as any) === true || (ks.data?.setting_value as any)?.enabled === true));
      if (!activeTeamId && (t.data || []).length) setActiveTeamId(t.data![0].id);
    } catch (e: any) {
      toast({ title: 'Failed to load routing data', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [activeTeamId]);

  // Load per-team distribution settings whenever the active team changes
  useEffect(() => {
    if (!activeTeamId || !open) return;
    let cancel = false;
    (async () => {
      setDistLoading(true);
      const { data } = await supabase
        .from('lead_distribution_settings')
        .select('*')
        .eq('team_id', activeTeamId)
        .maybeSingle();
      if (!cancel) {
        setTeamDist((data as TeamDistSettings) || null);
        setDistLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [activeTeamId, open]);

  useEffect(() => {
    if (open) loadAll();
  }, [open, loadAll]);

  const addTeam = async () => {
    if (!newTeamName.trim()) return;
    const { data, error } = await supabase
      .from('lead_teams')
      .insert({
        name: newTeamName.trim(),
        color: newTeamColor.hex,
        emoji: newTeamColor.emoji,
        sort_order: teams.length + 1,
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Could not add team', description: error.message, variant: 'destructive' });
      return;
    }
    setTeams([...teams, data as Team]);
    setActiveTeamId(data!.id);
    setNewTeamName('');
    toast({ title: 'Team added', description: data!.name });
  };

  const deleteTeam = async (id: string) => {
    if (!confirm('Delete this team and all its rules?')) return;
    const { error } = await supabase.from('lead_teams').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    setTeams(teams.filter(t => t.id !== id));
    setRules(rules.filter(r => r.team_id !== id));
    setMembers(members.filter(m => m.team_id !== id));
    if (activeTeamId === id) setActiveTeamId(teams[0]?.id ?? null);
  };

  const renameTeam = async (id: string, newName: string) => {
    const name = newName.trim();
    if (!name) { setRenamingId(null); return; }
    const current = teams.find(t => t.id === id);
    if (!current || current.name === name) { setRenamingId(null); return; }
    const { data, error } = await supabase
      .from('lead_teams')
      .update({ name })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      toast({ title: 'Rename failed', description: error.message, variant: 'destructive' });
      return;
    }
    setTeams(teams.map(t => (t.id === id ? (data as Team) : t)));
    setRenamingId(null);
    toast({ title: 'Team renamed', description: name });
  };

  const toggleRoutingEnabled = async (enabled: boolean) => {
    const { error } = await supabase
      .from('lead_settings')
      .upsert(
        { setting_key: 'team_routing_enabled', setting_value: enabled, description: 'Master switch: when ON, the routing engine consults lead_team_source_rules. When OFF, all leads follow the existing global flow (Team Red / live).' },
        { onConflict: 'setting_key' }
      );
    if (error) {
      toast({ title: 'Could not update master switch', description: error.message, variant: 'destructive' });
      return;
    }
    setRoutingEnabled(enabled);
    toast({
      title: enabled ? 'Team routing armed' : 'Team routing disabled',
      description: enabled
        ? 'New leads will follow team source rules once the live trigger is wired. Until then, behaviour is unchanged.'
        : 'All leads follow the existing global flow. No change to current live behaviour.',
    });
  };

  const upsertRule = async (teamId: string, source: string, patch: Partial<SourceRule>) => {
    const existing = rules.find(r => r.team_id === teamId && r.source === source);
    // Determine the new allowed state: explicit patch wins, otherwise keep existing.
    const nextAllowed =
      patch.allowed !== undefined
        ? patch.allowed
        : patch.percentage !== undefined
          ? (patch.percentage ?? 0) > 0
          : existing?.allowed ?? false;
    // Determine the new percentage: explicit patch wins; otherwise keep existing,
    // defaulting to 100 the first time a source is switched on.
    const rawPct =
      patch.percentage !== undefined
        ? patch.percentage ?? 0
        : nextAllowed
          ? (existing?.percentage && existing.percentage > 0 ? existing.percentage : 100)
          : existing?.percentage ?? 0;
    const nextPercentage = Math.max(0, Math.min(100, Math.round(rawPct)));
    const payload: any = {
      team_id: teamId,
      source,
      percentage: nextPercentage,
      allowed: nextAllowed,
      conversion_threshold_pct: patch.conversion_threshold_pct ?? existing?.conversion_threshold_pct ?? null,
      priority: patch.priority ?? existing?.priority ?? 0,
      notes: patch.notes ?? existing?.notes ?? null,
      daily_cap: patch.daily_cap !== undefined ? patch.daily_cap : existing?.daily_cap ?? null,
      overflow_team_id: patch.overflow_team_id !== undefined ? patch.overflow_team_id : existing?.overflow_team_id ?? null,
    };
    // Optimistic update so the % input feels instant
    setRules(prev => {
      const filtered = prev.filter(r => !(r.team_id === teamId && r.source === source));
      return [
        ...filtered,
        { ...(existing ?? { id: 'tmp', team_id: teamId, source }), ...payload } as SourceRule,
      ];
    });
    const { data, error } = await supabase
      .from('lead_team_source_rules')
      .upsert(payload, { onConflict: 'team_id,source' })
      .select()
      .single();
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    setRules(prev => {
      const filtered = prev.filter(r => !(r.team_id === teamId && r.source === source));
      return [...filtered, data as SourceRule];
    });
  };

  const bulkSetAllAllowed = async (teamId: string, allowed: boolean) => {
    const payload = LEAD_SOURCES.map(s => {
      const existing = rules.find(r => r.team_id === teamId && r.source === s.value);
      return {
        team_id: teamId,
        source: s.value,
        allowed,
        conversion_threshold_pct: existing?.conversion_threshold_pct ?? null,
        priority: existing?.priority ?? 0,
        notes: existing?.notes ?? null,
      };
    });
    const { data, error } = await supabase
      .from('lead_team_source_rules')
      .upsert(payload, { onConflict: 'team_id,source' })
      .select();
    if (error) {
      toast({ title: 'Bulk update failed', description: error.message, variant: 'destructive' });
      return;
    }
    setRules(prev => {
      const others = prev.filter(r => r.team_id !== teamId);
      return [...others, ...((data || []) as SourceRule[])];
    });
    toast({
      title: allowed ? 'Every lead source turned ON for this team' : 'Every lead source turned OFF for this team',
      description: allowed
        ? 'Google Ads, Facebook and Website will all feed this team (once the master switch above is ON).'
        : 'No sources will feed this team. Leads fall back to the live Team Red flow.',
    });
  };

  const addMember = async (teamId: string, adminUserId: string) => {
    const { data, error } = await supabase
      .from('lead_team_members')
      .insert({ team_id: teamId, admin_user_id: adminUserId })
      .select()
      .single();
    if (error) {
      toast({ title: 'Could not add member', description: error.message, variant: 'destructive' });
      return;
    }
    setMembers([...members, data as Member]);
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from('lead_team_members').delete().eq('id', memberId);
    if (error) {
      toast({ title: 'Remove failed', description: error.message, variant: 'destructive' });
      return;
    }
    setMembers(members.filter(m => m.id !== memberId));
  };

  // One-click team switch: update the existing membership row's team_id rather
  // than the old remove-then-add flow. Keeps the same row id and audit trail.
  const moveMember = async (memberId: string, newTeamId: string) => {
    const current = members.find(m => m.id === memberId);
    if (!current || current.team_id === newTeamId) return;
    const { data, error } = await supabase
      .from('lead_team_members')
      .update({
        team_id: newTeamId,
        previous_team_id: current.team_id,
        team_changed_at: new Date().toISOString(),
        notice_seen_at: null,
      })
      .eq('id', memberId)
      .select()
      .single();
    if (error) {
      toast({ title: 'Move failed', description: error.message, variant: 'destructive' });
      return;
    }
    setMembers(members.map(m => (m.id === memberId ? (data as Member) : m)));
    const toName = teams.find(t => t.id === newTeamId)?.name ?? 'team';
    toast({ title: 'Agent moved', description: `Switched to ${toName}. They'll see a notice on next login.` });
  };


  const upsertTeamDist = async (patch: Partial<TeamDistSettings>) => {
    if (!activeTeamId) return;
    const base = teamDist || {
      team_id: activeTeamId,
      distribution_mode: globalDist?.distribution_mode || 'round_robin',
      solo_mode_enabled: false,
      solo_agent_id: null,
      active_only_distribution: globalDist?.active_only_distribution ?? true,
      overflow_recipient_id: null,
    };
    const payload = { ...base, ...patch, team_id: activeTeamId };
    const { data, error } = await supabase
      .from('lead_distribution_settings')
      .upsert(payload as any, { onConflict: 'team_id' })
      .select()
      .single();
    if (error) {
      toast({ title: 'Could not save team distribution', description: error.message, variant: 'destructive' });
      return;
    }
    setTeamDist(data as TeamDistSettings);
    toast({ title: 'Team distribution updated' });
  };

  const clearTeamDist = async () => {
    if (!activeTeamId || !teamDist) return;
    if (!confirm('Remove this team\u2019s override and inherit the global distribution settings?')) return;
    const { error } = await supabase.from('lead_distribution_settings').delete().eq('team_id', activeTeamId);
    if (error) {
      toast({ title: 'Could not clear override', description: error.message, variant: 'destructive' });
      return;
    }
    setTeamDist(null);
    toast({ title: 'Team now inherits global distribution' });
  };

  const activeTeam = teams.find(t => t.id === activeTeamId) || null;
  const teamRules = (tid: string) =>
    LEAD_SOURCES.map(s => {
      const r = rules.find(x => x.team_id === tid && x.source === s.value);
      return { source: s, rule: r };
    });
  const teamMembers = (tid: string) => members.filter(m => m.team_id === tid);

  // Sales agents / leads who have been granted permissions but not yet placed in a team.
  const pendingAgents = useMemo(
    () => admins.filter(a => (a.role === 'sales' || a.role === 'sales_lead') && !members.some(m => m.admin_user_id === a.id)),
    [admins, members]
  );

  return (
    <div className="space-y-4">
      {!canEdit && (
        <p className="text-sm text-muted-foreground">
          Read-only — you do not have edit permission.
        </p>
      )}

        {/* Master kill-switch */}
        <div className="flex items-start gap-3 rounded-md border border-border bg-card p-4">
          <ShieldAlert className={`h-5 w-5 mt-0.5 shrink-0 ${routingEnabled ? 'text-foreground' : 'text-muted-foreground'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-sm text-foreground">Team routing enabled</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${
                  routingEnabled
                    ? 'border-border bg-muted text-foreground'
                    : 'border-border bg-muted text-muted-foreground'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${routingEnabled ? 'bg-foreground animate-pulse' : 'bg-muted-foreground'}`} />
                {routingEnabled ? 'Armed — rules are live' : 'Off — live flow protected'}
              </span>
              <Switch
                checked={routingEnabled}
                disabled={!canEdit}
                onCheckedChange={toggleRoutingEnabled}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {routingEnabled ? (
                <>
                  <strong className="text-foreground">On:</strong> new leads are first checked against <code>lead_team_source_rules</code>. If their source matches an <em>Allowed</em> rule on a team with available members, they route to that team. If no match or the team can't take it, the lead falls back to the existing live flow.
                </>
              ) : (
                <>
                  <strong className="text-foreground">Off:</strong> every new lead follows the existing global round-robin / live flow. You can build teams, assign agents, and set source rules, but nothing changes for real leads.
                </>
              )}
            </p>
          </div>
        </div>


        {/* Routing tester */}
        <RoutingTester />

        {/* Flat per-team × per-source matrix — all levers visible at a glance */}
        <SourceRulesMatrix
          teams={teams}
          rules={rules}
          canEdit={canEdit}
          routingEnabled={routingEnabled}
          onSetAllowed={(teamId, source, allowed) => upsertRule(teamId, source, { allowed, percentage: allowed ? 100 : 0 })}
          onSetPriority={(teamId, source, priority) => upsertRule(teamId, source, { priority })}
        />




        {/* Pending sales agents — shown at the top so managers allocate before they hit the live flow */}
        {canEdit && pendingAgents.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                <Users className="h-4 w-4 text-muted-foreground" />
                Pending sales agents
                <Badge variant="outline" className="text-[10px]">{pendingAgents.length}</Badge>
              </CardTitle>

            </CardHeader>
            <CardContent className="space-y-1.5">
              <p className="text-xs text-muted-foreground mb-2">
                These agents have sales permissions but are not in any team yet. A manager must place them before they show in a team filter.
              </p>
              {pendingAgents.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-2 border rounded px-3 py-1.5 bg-background">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {`${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{a.email} · {a.role}</div>
                  </div>
                  <Select onValueChange={(v) => addMember(v, a.id)} value="">
                    <SelectTrigger className="h-8 w-[150px] text-xs shrink-0">
                      <SelectValue placeholder="Add to…" />
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

        {/* Add team bar */}
        {canEdit && (
          <div className="flex flex-wrap items-end gap-2 border rounded-lg p-3 bg-muted/30">
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs">New team name</Label>
              <Input
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                placeholder="e.g. Formula Yellow"
              />
            </div>
            <div>
              <Label className="text-xs">Colour</Label>
              <div className="flex gap-1 mt-1">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setNewTeamColor(c)}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm ${
                      newTeamColor.hex === c.hex ? 'border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {c.emoji}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={addTeam} disabled={!newTeamName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add team
            </Button>
          </div>
        )}

        {/* Teams as pills (with inline rename) */}
        <div className="flex flex-wrap gap-2 items-center">
          {teams.map(t => {
            const isRenaming = renamingId === t.id;
            const isActive = activeTeamId === t.id;
            if (isRenaming) {
              return (
                <div key={t.id} className="flex items-center gap-1.5 rounded-md border border-border bg-card pl-2 pr-1 py-1">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="text-sm">{t.emoji}</span>
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') renameTeam(t.id, renameValue);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onBlur={() => renameTeam(t.id, renameValue)}
                    className="h-7 w-36 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => renameTeam(t.id, renameValue)}
                    className="p-1 text-muted-foreground hover:text-foreground rounded-md"
                    title="Save"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }
            return (
              <div
                key={t.id}
                className={`group flex items-center rounded-md text-sm font-medium border bg-card text-foreground transition ${
                  isActive ? 'ring-2 ring-ring border-transparent' : 'border-border hover:bg-muted'
                }`}
              >
                <button
                  onClick={() => setActiveTeamId(t.id)}
                  className="pl-2.5 pr-2 py-1.5 flex items-center gap-1.5"
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <span>{t.emoji}</span>
                  <span>{t.name}</span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setRenamingId(t.id); setRenameValue(t.name); }}
                    className="pr-2 py-1.5 text-muted-foreground opacity-70 hover:opacity-100"
                    title="Rename team"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );

          })}
          {!teams.length && !loading && (
            <p className="text-sm text-muted-foreground">No teams yet — add your first team above.</p>
          )}
        </div>

        {/* Active team config */}
        {activeTeam && (
          <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 pb-2">
            <Tabs defaultValue="sources" className="w-full">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="sources">Lead Sources</TabsTrigger>
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="distribution">Distribution</TabsTrigger>
                </TabsList>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => deleteTeam(activeTeam.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete team
                  </Button>
                )}
              </div>

              <TabsContent value="sources" className="space-y-2 mt-3">
                {canEdit && (() => {
                  const activeTeamRules = teamRules(activeTeam.id);
                  const allOn = activeTeamRules.every(({ rule }) => rule?.allowed === true);
                  const allOff = activeTeamRules.every(({ rule }) => !rule?.allowed);
                  const labelText = allOn ? 'All sources on' : allOff ? 'All sources off' : 'Some sources on';
                  return (
                    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-3 gap-3">
                      <p className="text-xs text-muted-foreground">
                        Switch all sources on or off for <strong>{activeTeam.name}</strong>. Then use the individual switches below to fine-tune.
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {allOn && <Check className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-xs font-semibold text-foreground">{labelText}</span>
                        <Switch
                          checked={allOn}
                          onCheckedChange={(v) => bulkSetAllAllowed(activeTeam.id, v)}
                        />
                      </div>
                    </div>
                  );
                })()}
                {LEAD_SOURCE_GROUPS.map(group => {
                  const groupRules = teamRules(activeTeam.id).filter(({ source }) => group.values.includes(source.value));
                  return (
                    <div key={group.title} className="rounded-md border border-border bg-card p-3 space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group.title}</h4>
                      <div className="grid gap-2 lg:grid-cols-2">
                        {groupRules.map(({ source, rule }) => {
                          const isOn = rule?.allowed === true;
                          return (
                            <div
                              key={source.value}
                              className={cn(
                                "relative flex flex-wrap items-center gap-3 rounded-md border p-3 transition-colors",
                                isOn
                                  ? "bg-muted/60 border-foreground/20"
                                  : "bg-background border-border"
                              )}
                            >
                              {isOn && (
                                <div className="absolute top-2 right-2 rounded-md bg-muted p-1">
                                  <Check className="h-3.5 w-3.5 text-foreground" />
                                </div>
                              )}
                              <div className="flex items-center gap-2 min-w-[150px] flex-1">
                                <span className="text-lg">{source.icon}</span>
                                <span className="font-medium text-foreground">{source.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={isOn}
                                  disabled={!canEdit}
                                  onCheckedChange={(v) => upsertRule(activeTeam.id, source.value, { allowed: v })}
                                />
                                <span className={`text-xs font-semibold ${isOn ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {isOn ? 'Allowed' : 'Off'}
                                </span>
                              </div>


                              <div className="flex items-center gap-2">
                                <Label className="text-xs">Share %</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  className="w-20 h-8"
                                  disabled={!canEdit || !isOn}
                                  value={rule?.percentage ?? ''}
                                  placeholder="100"
                                  onChange={(e) => {
                                    const v = e.target.value === '' ? 0 : parseInt(e.target.value);
                                    upsertRule(activeTeam.id, source.value, { percentage: v });
                                  }}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs" title="Max leads/day. Blank = unlimited.">Daily cap</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  className="w-20 h-8"
                                  disabled={!canEdit || !isOn}
                                  value={rule?.daily_cap ?? ''}
                                  placeholder="—"
                                  onChange={(e) => {
                                    const v = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value));
                                    upsertRule(activeTeam.id, source.value, { daily_cap: v });
                                  }}
                                />
                              </div>
                              <div className="flex items-center gap-2 min-w-[220px]">
                                <Label className="text-xs whitespace-nowrap">Overflow →</Label>
                                <Select
                                  value={rule?.overflow_team_id ?? '__none__'}
                                  disabled={!canEdit || !isOn}
                                  onValueChange={(v) =>
                                    upsertRule(activeTeam.id, source.value, {
                                      overflow_team_id: v === '__none__' ? null : v,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs flex-1">
                                    <SelectValue placeholder="None (fall through)" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__" className="text-xs">None (fall through)</SelectItem>
                                    {teams.filter(t => t.id !== activeTeam.id).map(t => (
                                      <SelectItem key={t.id} value={t.id} className="text-xs">
                                        {t.emoji} {t.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs">Min conv %</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  className="w-20 h-8"
                                  disabled={!canEdit || !isOn}
                                  value={rule?.conversion_threshold_pct ?? ''}
                                  placeholder="—"
                                  onChange={(e) => {
                                    const v = e.target.value === '' ? null : parseFloat(e.target.value);
                                    upsertRule(activeTeam.id, source.value, { conversion_threshold_pct: v });
                                  }}
                                />
                              </div>
                              <Input
                                className="w-full h-8"
                                placeholder="Notes (optional)"
                                disabled={!canEdit}
                                defaultValue={rule?.notes ?? ''}
                                onBlur={(e) => {
                                  if ((rule?.notes ?? '') !== e.target.value) {
                                    upsertRule(activeTeam.id, source.value, { notes: e.target.value || null });
                                  }
                                }}
                              />

                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground pt-2 leading-relaxed">
                  <strong>How the share works:</strong> when multiple teams have the same source turned on, leads are shared in proportion to their <strong>Share %</strong> (weighted round-robin — Red 70 / Blue 30 means over 10 Google leads Red gets ~7 and Blue ~3). If a team hits its <strong>Daily cap</strong>, the next lead is routed to that team's <strong>Overflow</strong> team instead of being wasted. If Overflow is <em>None</em>, the lead falls through to the next team by share debt, then to the global open pool. <strong>Min conv %</strong> gates the team out until its live conversion rate meets the threshold.
                </p>
              </TabsContent>

              <TabsContent value="members" className="space-y-3 mt-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" /> Members of {activeTeam.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {teamMembers(activeTeam.id).length === 0 && (
                      <p className="text-sm text-muted-foreground">No members yet.</p>
                    )}
                    {teamMembers(activeTeam.id).map(m => {
                      const u = findAdmin(m.admin_user_id);
                      const otherTeams = teams.filter(t => t.id !== activeTeam.id);
                      return (
                        <div key={m.id} className="flex items-center justify-between gap-2 border rounded px-3 py-2">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">
                              {u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email : 'Unknown user'}
                            </div>
                            {u && <div className="text-xs text-muted-foreground truncate">{u.email} · {u.role}</div>}
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1 shrink-0">
                              {otherTeams.length > 0 && (
                                <Select onValueChange={(v) => moveMember(m.id, v)} value="">
                                  <SelectTrigger className="h-8 w-[150px] text-xs">
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
                              <Button variant="ghost" size="sm" onClick={() => removeMember(m.id)} title="Remove from team">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {canEdit && pendingAgents.length > 0 && (
                      <div className="pt-2 border-t">
                        <Label className="text-xs">Add agent</Label>
                        <Select onValueChange={(v) => addMember(activeTeam.id, v)} value="">
                          <SelectTrigger>
                            <SelectValue placeholder="Pick a pending agent…" />
                          </SelectTrigger>
                          <SelectContent>
                            {pendingAgents.map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {(`${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email)} — {a.role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Pending agents are managed at the top of the dialog. */}

                {/* Cross-team membership glance */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">All teams at a glance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {teams.map(t => {
                      const count = members.filter(m => m.team_id === t.id).length;
                      const allowedCount = rules.filter(r => r.team_id === t.id && r.allowed).length;
                      return (
                        <div key={t.id} className="flex items-center gap-3 text-sm">
                          <Badge style={{ backgroundColor: t.color, color: '#fff' }}>
                            {t.emoji} {t.name}
                          </Badge>
                          <span className="text-muted-foreground">
                            {count} member{count === 1 ? '' : 's'} · {allowedCount} source{allowedCount === 1 ? '' : 's'} allowed
                          </span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="distribution" className="space-y-3 mt-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      How {activeTeam.name} shares its leads
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {distLoading ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-4 p-3 rounded-md border bg-muted/30">
                          <div>
                            <div className="font-medium text-sm">
                              {teamDist
                                ? `${activeTeam.name} has its own rules`
                                : `${activeTeam.name} uses the same rules as every other team`}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {teamDist
                                ? `Switch off to share leads the same way as every other team (currently: ${globalDist?.distribution_mode === 'percentage' ? 'Percentage per agent' : 'Round Robin'}).`
                                : `Switch on to set different rules just for ${activeTeam.name}. The default rule is ${globalDist?.distribution_mode === 'percentage' ? 'Percentage per agent' : 'Round Robin'}, shared with all other teams.`}
                            </div>
                          </div>
                          <Switch
                            checked={!!teamDist}
                            disabled={!canEdit}
                            onCheckedChange={(v) => {
                              if (v) {
                                upsertTeamDist({});
                              } else {
                                clearTeamDist();
                              }
                            }}
                          />
                        </div>

                        {teamDist && (
                          <>
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <Label className="text-sm">How leads cycle between agents</Label>
                                <p className="text-xs text-muted-foreground">
                                  Round Robin = one lead each, in turn. Percentage = each agent gets their set share.
                                </p>
                              </div>
                              <Select
                                value={teamDist.distribution_mode}
                                onValueChange={(v) => upsertTeamDist({ distribution_mode: v })}
                                disabled={!canEdit}
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="round_robin">Round Robin</SelectItem>
                                  <SelectItem value="percentage">Percentage (per agent)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-center justify-between gap-4 pt-2 border-t">
                              <div>
                                <Label className="text-sm">Send every lead to one agent</Label>
                                <p className="text-xs text-muted-foreground">
                                  Useful for cover days or training. Overrides the rule above while on.
                                </p>
                              </div>
                              <Switch
                                checked={teamDist.solo_mode_enabled}
                                disabled={!canEdit}
                                onCheckedChange={(v) => upsertTeamDist({ solo_mode_enabled: v, solo_agent_id: v ? teamDist.solo_agent_id : null })}
                              />
                            </div>

                            {teamDist.solo_mode_enabled && (
                              <div>
                                <Label className="text-xs">Pick the agent (must already be in {activeTeam.name})</Label>
                                <Select
                                  value={teamDist.solo_agent_id ?? ''}
                                  onValueChange={(v) => upsertTeamDist({ solo_agent_id: v })}
                                  disabled={!canEdit}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Pick an agent…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {teamMembers(activeTeam.id).map(m => {
                                      const u = findAdmin(m.admin_user_id);
                                      if (!u) return null;
                                      return (
                                        <SelectItem key={u.id} value={u.id}>
                                          {(`${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email)}
                                        </SelectItem>
                                      );
                                    })}
                                    {teamMembers(activeTeam.id).length === 0 && (
                                      <div className="px-3 py-2 text-xs text-muted-foreground">
                                        Add members to this team first.
                                      </div>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {canEdit && (
                              <div className="pt-3 border-t">
                                <Button variant="outline" size="sm" onClick={clearTeamDist}>
                                  Reset to default rules
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
    </div>
  );
};

