import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Check, Save, Split, Info, MoreVertical, Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';


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

interface Cap {
  id: string;
  admin_user_id: string;
  percentage: number;
  paused: boolean;
  allowed_sources: string[] | null;
}

const LEAD_SOURCES: { key: string; label: string; color: string }[] = [
  { key: 'facebook',  label: 'Facebook',  color: '#1877F2' },
  { key: 'google',    label: 'Google',    color: '#EA4335' },
  { key: 'organic',   label: 'Organic',   color: '#16a34a' },
  { key: 'tiktok',    label: 'TikTok',    color: '#000000' },
  { key: 'instagram', label: 'Instagram', color: '#E1306C' },
  { key: 'youtube',   label: 'YouTube',   color: '#FF0000' },
  { key: 'email',     label: 'Email',     color: '#6366f1' },
  { key: 'sms',       label: 'SMS',       color: '#0ea5e9' },
  { key: 'referral',  label: 'Referral',  color: '#a855f7' },
  { key: 'direct',    label: 'Direct',    color: '#64748b' },
  { key: 'other',     label: 'Other',     color: '#94a3b8' },
];

interface AdminUserLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

type Workstream = 'new_leads' | 'recontact' | 'renewals';

const WORKSTREAMS: { key: Workstream; col: keyof Member; label: string }[] = [
  { key: 'new_leads', col: 'workstream_new_leads', label: 'New Leads' },
  { key: 'recontact', col: 'workstream_recontact', label: 'Recontact Leads' },
  { key: 'renewals',  col: 'workstream_renewals',  label: 'Renewals' },
];

interface Props {
  canEdit: boolean;
  /** When true, scope the view to the viewer's own team and hide master controls (team picker). */
  isTeamScoped?: boolean;
}

export const AllocationMatrix = ({ canEdit, isTeamScoped = false }: Props) => {
  const currentAdminId = useCurrentAdminId();
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [caps, setCaps] = useState<Cap[]>([]);
  const [admins, setAdmins] = useState<AdminUserLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingShare, setPendingShare] = useState<Record<string, string>>({});
  const [teamFilter, setTeamFilter] = useState<string>('__all__');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [t, m, a, c] = await Promise.all([
        supabase.from('lead_teams').select('id, name, color, emoji').order('sort_order'),
        supabase.from('lead_team_members').select('id, team_id, admin_user_id, workstream_new_leads, workstream_recontact, workstream_renewals'),
        supabase.from('admin_users').select('id, first_name, last_name, email, role').eq('is_active', true).order('first_name'),
        supabase.from('agent_distribution_caps').select('id, admin_user_id, percentage, paused, allowed_sources'),
      ]);
      if (t.error) throw t.error;
      if (m.error) throw m.error;
      if (a.error) throw a.error;
      if (c.error) throw c.error;
      setTeams((t.data || []) as Team[]);
      setMembers((m.data || []) as Member[]);
      setAdmins((a.data || []) as AdminUserLite[]);
      setCaps((c.data || []) as Cap[]);
    } catch (e: any) {
      toast({ title: 'Failed to load allocation', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const salesAgents = useMemo(
    () => admins.filter(a => a.role === 'sales' || a.role === 'sales_lead'),
    [admins]
  );

  const memberByAgent = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach(m => map.set(m.admin_user_id, m));
    return map;
  }, [members]);

  const capByAgent = useMemo(() => {
    const map = new Map<string, Cap>();
    caps.forEach(c => map.set(c.admin_user_id, c));
    return map;
  }, [caps]);

  /** When team-scoped (sales_lead), only show agents on the viewer's own team. */
  const myTeamId = useMemo(() => {
    if (!isTeamScoped || !currentAdminId) return null;
    return memberByAgent.get(currentAdminId)?.team_id ?? null;
  }, [isTeamScoped, currentAdminId, memberByAgent]);

  const visibleAgents = useMemo(() => {
    if (isTeamScoped) {
      if (!myTeamId) return [];
      return salesAgents.filter(a => memberByAgent.get(a.id)?.team_id === myTeamId);
    }
    if (teamFilter === '__all__') return salesAgents;
    if (teamFilter === '__none__') return salesAgents.filter(a => !memberByAgent.get(a.id));
    return salesAgents.filter(a => memberByAgent.get(a.id)?.team_id === teamFilter);
  }, [isTeamScoped, myTeamId, salesAgents, teamFilter, memberByAgent]);

  const totalShare = useMemo(() => {
    const pool = isTeamScoped ? visibleAgents : salesAgents;
    return pool.reduce((sum, a) => {
      const cap = capByAgent.get(a.id);
      if (!cap || cap.paused) return sum;
      return sum + (cap.percentage || 0);
    }, 0);
  }, [isTeamScoped, visibleAgents, salesAgents, capByAgent]);

  // --- mutations ---

  const setTeamTag = async (agentId: string, newTeamId: string | null) => {
    if (!canEdit) return;
    const existing = memberByAgent.get(agentId);
    if (newTeamId === null) {
      if (!existing) return;
      const { error } = await supabase.from('lead_team_members').delete().eq('id', existing.id);
      if (error) return toast({ title: 'Remove failed', description: error.message, variant: 'destructive' });
      setMembers(prev => prev.filter(m => m.id !== existing.id));
      return;
    }
    if (existing) {
      if (existing.team_id === newTeamId) return;
      const { data, error } = await supabase
        .from('lead_team_members')
        .update({
          team_id: newTeamId,
          previous_team_id: existing.team_id,
          team_changed_at: new Date().toISOString(),
          notice_seen_at: null,
        } as any)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) return toast({ title: 'Move failed', description: error.message, variant: 'destructive' });
      setMembers(prev => prev.map(m => m.id === existing.id ? (data as Member) : m));
    } else {
      const { data, error } = await supabase
        .from('lead_team_members')
        .insert({
          team_id: newTeamId,
          admin_user_id: agentId,
          workstream_new_leads: true,
          workstream_recontact: false,
          workstream_renewals: false,
          team_changed_at: new Date().toISOString(),
          notice_seen_at: null,
        } as any)
        .select()
        .single();
      if (error) return toast({ title: 'Add failed', description: error.message, variant: 'destructive' });
      setMembers(prev => [...prev, data as Member]);
    }
  };

  const toggleWorkstream = async (agentId: string, ws: Workstream) => {
    if (!canEdit) return;
    const m = memberByAgent.get(agentId);
    if (!m) {
      toast({ title: 'Assign a team first', description: 'Pick a team before choosing lead types.' });
      return;
    }
    const col = WORKSTREAMS.find(w => w.key === ws)!.col;
    const next = !(m as any)[col];
    const { data, error } = await supabase
      .from('lead_team_members')
      .update({
        [col]: next,
        team_changed_at: new Date().toISOString(),
        notice_seen_at: null,
      } as any)
      .eq('id', m.id)
      .select()
      .single();
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    setMembers(prev => prev.map(x => x.id === m.id ? (data as Member) : x));
  };

  const ensureCap = async (agentId: string): Promise<Cap | null> => {
    const existing = capByAgent.get(agentId);
    if (existing) return existing;
    const { data, error } = await supabase
      .from('agent_distribution_caps')
      .insert({ admin_user_id: agentId, percentage: 0, paused: true } as any)
      .select('id, admin_user_id, percentage, paused, allowed_sources')
      .single();
    if (error) {
      toast({ title: 'Could not create row', description: error.message, variant: 'destructive' });
      return null;
    }
    const cap = data as Cap;
    setCaps(prev => [...prev, cap]);
    return cap;
  };

  const toggleSource = async (agentId: string, source: string) => {
    if (!canEdit) return;
    const cap = await ensureCap(agentId);
    if (!cap) return;
    const current = cap.allowed_sources ?? [];
    const has = current.includes(source);
    const next = has ? current.filter(s => s !== source) : [...current, source];
    // Empty array stored as null = "all sources allowed"
    const payload = next.length === 0 ? null : next;
    const { data, error } = await supabase
      .from('agent_distribution_caps')
      .update({ allowed_sources: payload } as any)
      .eq('id', cap.id)
      .select('id, admin_user_id, percentage, paused, allowed_sources')
      .single();
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    setCaps(prev => prev.map(c => c.id === cap.id ? (data as Cap) : c));
  };

  const setAllSources = async (agentId: string) => {
    if (!canEdit) return;
    const cap = await ensureCap(agentId);
    if (!cap) return;
    const { data, error } = await supabase
      .from('agent_distribution_caps')
      .update({ allowed_sources: null } as any)
      .eq('id', cap.id)
      .select('id, admin_user_id, percentage, paused, allowed_sources')
      .single();
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    setCaps(prev => prev.map(c => c.id === cap.id ? (data as Cap) : c));
  };

  const setReceiving = async (agentId: string, on: boolean) => {
    if (!canEdit) return;
    const cap = await ensureCap(agentId);
    if (!cap) return;
    const { data, error } = await supabase
      .from('agent_distribution_caps')
      .update({ paused: !on } as any)
      .eq('id', cap.id)
      .select()
      .single();
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    setCaps(prev => prev.map(c => c.id === cap.id ? (data as Cap) : c));
  };

  const commitShare = async (agentId: string, raw: string) => {
    if (!canEdit) return;
    const parsed = Math.max(0, Math.min(100, Math.round(Number(raw) || 0)));
    const cap = await ensureCap(agentId);
    if (!cap) return;
    if (cap.percentage === parsed) {
      setPendingShare(s => { const n = { ...s }; delete n[agentId]; return n; });
      return;
    }
    const { data, error } = await supabase
      .from('agent_distribution_caps')
      .update({ percentage: parsed } as any)
      .eq('id', cap.id)
      .select()
      .single();
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    setCaps(prev => prev.map(c => c.id === cap.id ? (data as Cap) : c));
    setPendingShare(s => { const n = { ...s }; delete n[agentId]; return n; });
  };

  const evenSplit = async () => {
    if (!canEdit) return;
    const pool = (teamFilter === '__all__' ? salesAgents : visibleAgents).filter(a => {
      const cap = capByAgent.get(a.id);
      return cap && !cap.paused;
    });
    if (!pool.length) {
      toast({ title: 'No active agents', description: 'Turn at least one agent on first.' });
      return;
    }
    const share = Math.floor(100 / pool.length);
    const remainder = 100 - share * pool.length;
    let i = 0;
    for (const a of pool) {
      const value = share + (i < remainder ? 1 : 0);
      const cap = capByAgent.get(a.id)!;
      const { error } = await supabase
        .from('agent_distribution_caps')
        .update({ percentage: value } as any)
        .eq('id', cap.id);
      if (error) {
        toast({ title: 'Split failed', description: error.message, variant: 'destructive' });
        return;
      }
      i++;
    }
    toast({ title: 'Leads split equally', description: `${share}% across ${pool.length} agents` });
    loadAll();
  };

  // --- render ---

  const shareIsBalanced = totalShare === 100;

  return (
    <div className="space-y-6">
      {/* ───────── Default Lead Allocation ───────── */}
      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Default Lead Allocation</h2>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            New leads are shared between all active agents based on their lead share percentage.
          </p>
        </div>
        <div className="px-5 py-4 flex flex-wrap items-end gap-4 justify-between">
          <div className="flex flex-wrap items-end gap-4">
            {isTeamScoped ? (
              <div className="space-y-1.5 min-w-[180px]">
                <label className="text-xs font-semibold text-foreground">Team</label>
                <div className="h-10 px-3 flex items-center gap-2 rounded-md border border-input bg-muted/40 text-sm">
                  {(() => {
                    const t = teams.find(x => x.id === myTeamId);
                    if (!t) return <span className="text-muted-foreground">No team assigned</span>;
                    return (
                      <>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                        <span className="font-medium">{t.name}</span>
                        <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 min-w-[180px]">
                <label className="text-xs font-semibold text-foreground">Team</label>
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Teams</SelectItem>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.emoji} {t.name}</SelectItem>
                    ))}
                    <SelectItem value="__none__">— No team —</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5 min-w-[180px]">
              <label className="text-xs font-semibold text-foreground">Default Lead Routing</label>
              <div className="h-10 px-3 flex items-center rounded-md border border-input bg-muted/40 text-sm text-muted-foreground">
                Default (All active agents)
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                variant="outline"
                onClick={evenSplit}
                className="h-10 gap-2"
              >
                <Split className="h-4 w-4" /> Split Leads Equally
              </Button>
            )}
            <Button
              variant="outline"
              onClick={loadAll}
              disabled={loading}
              className="h-10 gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button
              onClick={() => toast({ title: 'Changes saved', description: 'Allocation settings saved automatically as you edit.' })}
              className="h-10 gap-2"
            >
              <Save className="h-4 w-4" /> Save Changes
            </Button>
          </div>
        </div>
      </section>

      {/* ───────── Sales Agents ───────── */}
      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Who gets the leads?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              For each agent, pick the team they're on, turn lead receiving on or off, set how big a slice of leads they get, and tick which lead sources (Facebook, Google, etc.) they're allowed to handle.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Slices add up to</div>
            <div className={`text-2xl font-bold ${shareIsBalanced ? 'text-emerald-600' : 'text-amber-600'}`}>{totalShare}%</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {shareIsBalanced ? 'Perfect — adds to 100%' : 'Should add to 100%'}
            </div>
          </div>
        </div>

        {/* Header row */}
        <div className="hidden md:grid grid-cols-[1.4fr_130px_110px_100px_1.2fr_1.6fr_56px] gap-3 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
          <div>Agent</div>
          <div>Team</div>
          <div>Getting leads?</div>
          <div>Slice of leads</div>
          <div>Lead Types</div>
          <div>Sources they handle</div>
          <div className="text-right">Actions</div>
        </div>


        <div className="divide-y divide-border">
          {visibleAgents.map(a => {
            const m = memberByAgent.get(a.id);
            const cap = capByAgent.get(a.id);
            const team = m ? teams.find(t => t.id === m.team_id) : null;
            const receiving = !!cap && !cap.paused;
            const sharePending = pendingShare[a.id];
            const shareValue = sharePending !== undefined ? sharePending : String(cap?.percentage ?? 0);
            const initials = (`${a.first_name?.[0] ?? ''}${a.last_name?.[0] ?? ''}`.toUpperCase() || a.email[0].toUpperCase());
            const displayName = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email;
            return (
              <div
                key={a.id}
                className="grid grid-cols-1 md:grid-cols-[1.4fr_130px_110px_100px_1.2fr_1.6fr_56px] gap-3 px-5 py-3 items-center hover:bg-muted/20 transition-colors"
              >
                {/* Agent */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-semibold"
                    style={{ backgroundColor: team?.color ?? 'hsl(var(--muted-foreground))' }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{displayName}</div>
                    <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                  </div>
                </div>

                {/* Team — read-only for sales_lead (master control) */}
                {isTeamScoped ? (
                  <div className="h-9 px-3 flex items-center gap-2 rounded-md border border-input bg-muted/40 text-sm">
                    {team ? (
                      <>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color }} />
                        <span className="truncate">{team.name}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">No team</span>
                    )}
                    <Lock className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                  </div>
                ) : (
                  <Select
                    value={team?.id ?? '__none__'}
                    onValueChange={(v) => setTeamTag(a.id, v === '__none__' ? null : v)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue>
                        {team ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color }} />
                            {team.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No team</span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— No team —</SelectItem>
                      {teams.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                            {t.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Receive Leads toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={receiving}
                    onCheckedChange={(v) => setReceiving(a.id, v)}
                    disabled={!canEdit}
                  />
                  <span className={`text-xs font-medium ${receiving ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {receiving ? 'On' : 'Off'}
                  </span>
                </div>

                {/* Lead Share */}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={!canEdit || !receiving}
                    value={receiving ? shareValue : '0'}
                    onChange={(e) => setPendingShare(s => ({ ...s, [a.id]: e.target.value }))}
                    onBlur={(e) => commitShare(a.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="h-9 w-16 text-center rounded-md border border-input bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted/40 disabled:text-muted-foreground"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>

                {/* Lead Types */}
                <div className="flex flex-wrap gap-1.5">
                  {WORKSTREAMS.map(w => {
                    const on = m ? (m as any)[w.col] === true : false;
                    const teamColor = team?.color ?? '#64748b';
                    return (
                      <button
                        key={w.key}
                        type="button"
                        disabled={!canEdit || !m}
                        onClick={() => toggleWorkstream(a.id, w.key)}
                        aria-pressed={on}
                        title={!m ? 'Pick a team first' : (on ? 'Selected' : 'Not selected')}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border transition-colors ${
                          on
                            ? 'border-current text-white'
                            : 'border-border bg-background text-muted-foreground hover:border-foreground/30'
                        } ${canEdit && m ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                        style={on ? { backgroundColor: teamColor, borderColor: teamColor } : undefined}
                      >
                        {on && <Check className="h-3 w-3" />}
                        {w.label}
                      </button>
                    );
                  })}
                </div>

                {/* Allowed Sources */}
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const allowed = cap?.allowed_sources ?? null;
                      const allOn = !allowed || allowed.length === 0;
                      return (
                        <>
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => setAllSources(a.id)}
                            aria-pressed={allOn}
                            title="Receive leads from every source"
                            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                              allOn
                                ? 'border-foreground bg-foreground text-background'
                                : 'border-border bg-background text-muted-foreground hover:border-foreground/30'
                            } ${canEdit ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                          >
                            {allOn && <Check className="h-3 w-3" />}
                            All
                          </button>
                          {LEAD_SOURCES.map(s => {
                            const on = !!allowed && allowed.includes(s.key);
                            return (
                              <button
                                key={s.key}
                                type="button"
                                disabled={!canEdit}
                                onClick={() => toggleSource(a.id, s.key)}
                                aria-pressed={on}
                                title={on ? `Allowed: ${s.label}` : `Click to allow ${s.label}`}
                                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                                  on
                                    ? 'text-white border-current'
                                    : 'border-border bg-background text-muted-foreground hover:border-foreground/30'
                                } ${canEdit ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                                style={on ? { backgroundColor: s.color, borderColor: s.color } : undefined}
                              >
                                {on && <Check className="h-3 w-3" />}
                                {s.label}
                              </button>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                  {!receiving && (
                    <div className="text-[11px] text-muted-foreground">Not receiving leads</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                    title="More actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {visibleAgents.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No agents match this filter.
            </div>
          )}
        </div>

        {/* Footer banner */}
        <div className={`px-5 py-3 border-t border-border flex items-center gap-2 ${
          shareIsBalanced ? 'bg-blue-50 text-blue-900' : 'bg-amber-50 text-amber-900'
        }`}>
          <Info className="h-4 w-4 shrink-0" />
          <p className="text-xs">
            {shareIsBalanced
              ? 'Lead shares total 100%. Each lead is offered only to agents whose Allowed Sources include that lead\'s source (or who have "All" selected), then split by their lead share.'
              : `Lead shares total ${totalShare}%. Each lead still only goes to agents whose Allowed Sources include its source (or who have "All"). Use Split Leads Equally to balance.`}
          </p>
        </div>
      </section>
    </div>
  );
};

export default AllocationMatrix;
