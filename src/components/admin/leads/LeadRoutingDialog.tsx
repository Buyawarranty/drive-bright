import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Users, Settings2, X, Pencil, Check, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface LeadRoutingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  conversion_threshold_pct: number | null;
  priority: number;
  notes: string | null;
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
  { value: 'google',    label: 'Google Ads',  icon: '🟡' },
  { value: 'facebook',  label: 'Facebook Ads',icon: '🔷' },
  { value: 'instagram', label: 'Instagram',   icon: '🟣' },
  { value: 'tiktok',    label: 'TikTok',      icon: '⚫' },
  { value: 'youtube',   label: 'YouTube',     icon: '🔺' },
  { value: 'organic',   label: 'Organic',     icon: '🌱' },
  { value: 'direct',    label: 'Direct',      icon: '⭐' },
  { value: 'referral',  label: 'Referral',    icon: '🔗' },
  { value: 'email',     label: 'Email',       icon: '✉️' },
  { value: 'sms',       label: 'SMS',         icon: '💬' },
  { value: 'other',     label: 'Other',       icon: '❔' },
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

export const LeadRoutingDialog = ({ open, onOpenChange, canEdit }: LeadRoutingDialogProps) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [rules, setRules] = useState<SourceRule[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [admins, setAdmins] = useState<AdminUserLite[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState(PRESET_COLORS[3]);
  const [teamDist, setTeamDist] = useState<TeamDistSettings | null>(null);
  const [globalDist, setGlobalDist] = useState<TeamDistSettings | null>(null);
  const [distLoading, setDistLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [t, r, m, a, gd] = await Promise.all([
        supabase.from('lead_teams').select('*').order('sort_order'),
        supabase.from('lead_team_source_rules').select('*'),
        supabase.from('lead_team_members').select('*'),
        supabase.from('admin_users').select('id, first_name, last_name, email, role').eq('is_active', true).order('first_name'),
        supabase.from('lead_distribution_settings').select('*').is('team_id', null).maybeSingle(),
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

  const upsertRule = async (teamId: string, source: string, patch: Partial<SourceRule>) => {
    const existing = rules.find(r => r.team_id === teamId && r.source === source);
    const payload = {
      team_id: teamId,
      source,
      allowed: patch.allowed ?? existing?.allowed ?? true,
      conversion_threshold_pct: patch.conversion_threshold_pct ?? existing?.conversion_threshold_pct ?? null,
      priority: patch.priority ?? existing?.priority ?? 0,
      notes: patch.notes ?? existing?.notes ?? null,
    };
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Lead Routing &amp; Distribution
          </DialogTitle>
          <DialogDescription>
            Configure which teams receive which lead sources. Set performance thresholds so teams unlock premium leads when they hit conversion targets.
            {!canEdit && <span className="block mt-1 text-amber-600">Read-only — you do not have edit permission.</span>}
          </DialogDescription>
        </DialogHeader>

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

        {/* Teams as pills */}
        <div className="flex flex-wrap gap-2">
          {teams.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTeamId(t.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition ${
                activeTeamId === t.id ? 'ring-2 ring-offset-1 ring-foreground' : ''
              }`}
              style={{
                backgroundColor: t.color,
                color: '#fff',
                borderColor: t.color,
              }}
            >
              <span className="mr-1">{t.emoji}</span>{t.name}
            </button>
          ))}
          {!teams.length && !loading && (
            <p className="text-sm text-muted-foreground">No teams yet — add your first team above.</p>
          )}
        </div>

        {/* Active team config */}
        {activeTeam && (
          <ScrollArea className="flex-1 -mx-6 px-6">
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
                {teamRules(activeTeam.id).map(({ source, rule }) => (
                  <Card key={source.value} className={!rule?.allowed ? 'opacity-60' : ''}>
                    <CardContent className="flex flex-wrap items-center gap-4 p-3">
                      <div className="flex items-center gap-2 min-w-[170px]">
                        <span className="text-lg">{source.icon}</span>
                        <span className="font-medium">{source.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule?.allowed ?? true}
                          disabled={!canEdit}
                          onCheckedChange={(v) => upsertRule(activeTeam.id, source.value, { allowed: v })}
                        />
                        <span className="text-xs text-muted-foreground">
                          {rule?.allowed ?? true ? 'Allowed' : 'Blocked'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Min conv %</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          className="w-20 h-8"
                          disabled={!canEdit || !(rule?.allowed ?? true)}
                          value={rule?.conversion_threshold_pct ?? ''}
                          placeholder="—"
                          onChange={(e) => {
                            const v = e.target.value === '' ? null : parseFloat(e.target.value);
                            upsertRule(activeTeam.id, source.value, { conversion_threshold_pct: v });
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Priority</Label>
                        <Input
                          type="number"
                          className="w-16 h-8"
                          disabled={!canEdit || !(rule?.allowed ?? true)}
                          value={rule?.priority ?? 0}
                          onChange={(e) => upsertRule(activeTeam.id, source.value, { priority: parseInt(e.target.value || '0') })}
                        />
                      </div>
                      <Input
                        className="flex-1 min-w-[180px] h-8"
                        placeholder="Notes (optional)"
                        disabled={!canEdit}
                        defaultValue={rule?.notes ?? ''}
                        onBlur={(e) => {
                          if ((rule?.notes ?? '') !== e.target.value) {
                            upsertRule(activeTeam.id, source.value, { notes: e.target.value || null });
                          }
                        }}
                      />
                    </CardContent>
                  </Card>
                ))}
                <p className="text-xs text-muted-foreground pt-2">
                  Teams only receive a source when its switch is on. If a min conversion % is set, the routing engine will only assign that source while the team's conversion rate meets or exceeds the threshold.
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
                      const u = admins.find(a => a.id === m.admin_user_id);
                      return (
                        <div key={m.id} className="flex items-center justify-between border rounded px-3 py-2">
                          <div>
                            <div className="font-medium text-sm">
                              {u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email : 'Unknown user'}
                            </div>
                            {u && <div className="text-xs text-muted-foreground">{u.email} · {u.role}</div>}
                          </div>
                          {canEdit && (
                            <Button variant="ghost" size="sm" onClick={() => removeMember(m.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {canEdit && (
                      <div className="pt-2 border-t">
                        <Label className="text-xs">Add agent</Label>
                        <Select onValueChange={(v) => addMember(activeTeam.id, v)} value="">
                          <SelectTrigger>
                            <SelectValue placeholder="Pick an agent…" />
                          </SelectTrigger>
                          <SelectContent>
                            {admins
                              .filter(a => !teamMembers(activeTeam.id).some(m => m.admin_user_id === a.id))
                              .map(a => (
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
                      <Settings2 className="h-4 w-4" /> Distribution for {activeTeam.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {distLoading ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-4 p-3 rounded-md border bg-muted/30">
                          <div>
                            <div className="font-medium text-sm">Override global distribution</div>
                            <div className="text-xs text-muted-foreground">
                              {teamDist
                                ? `This team uses its own distribution rules. Global is currently set to ${globalDist?.distribution_mode ?? 'round_robin'}.`
                                : `This team inherits the global ${globalDist?.distribution_mode ?? 'round_robin'} flow. Turn on to override just for ${activeTeam.name}.`}
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
                                <Label className="text-sm">Distribution mode</Label>
                                <p className="text-xs text-muted-foreground">How leads cycle inside this team.</p>
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
                                <Label className="text-sm">Solo mode</Label>
                                <p className="text-xs text-muted-foreground">
                                  Send every lead in this team to a single agent. Overrides the mode above while on.
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
                                <Label className="text-xs">Solo agent (must be a member of {activeTeam.name})</Label>
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
                                      const u = admins.find(a => a.id === m.admin_user_id);
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
                                  Remove override (inherit global)
                                </Button>
                              </div>
                            )}
                          </>
                        )}

                        <p className="text-xs text-muted-foreground pt-2 border-t">
                          The global round-robin / percentage / solo / overflow flow is unchanged. When a lead's source is allowed by this team, the engine uses these rules first; otherwise it falls back to the existing global flow.
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
