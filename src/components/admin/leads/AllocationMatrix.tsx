import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Check, Save, Split, Info, MoreVertical, Lock, Infinity as InfinityIcon, LifeBuoy, X } from 'lucide-react';
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
  daily_cap: number | null;
  assignment_mode?: 'round_robin' | 'open_pool' | null;
}

const LEAD_SOURCES: { key: string; label: string; color: string }[] = [
  { key: 'facebook',  label: 'Facebook',  color: '#1877F2' },
  { key: 'google',    label: 'Google',    color: '#EA4335' },
  { key: 'organic',   label: 'Website',   color: '#16a34a' },
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
  /** When true, hide the "Sources they handle" column (e.g. for sales_lead). */
  hideSources?: boolean;
  /** When true, only show New Leads in the Lead Types column (hides Recontact / Renewals). */
  isSalesLead?: boolean;
}

export const AllocationMatrix = ({ canEdit, isTeamScoped = false, hideSources = false, isSalesLead = false }: Props) => {

  const currentAdminId = useCurrentAdminId();
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [caps, setCaps] = useState<Cap[]>([]);
  const [admins, setAdmins] = useState<AdminUserLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingShare, setPendingShare] = useState<Record<string, string>>({});
  const [pendingCap, setPendingCap] = useState<Record<string, string>>({});
  const [teamFilter, setTeamFilter] = useState<string>('__all__');
  const [todayLeadCounts, setTodayLeadCounts] = useState<Record<string, number>>({});
  const [overflowRecipients, setOverflowRecipients] = useState<{ id: string; admin_user_id: string; sort_order: number }[]>([]);

  const fetchTodayLeadCounts = useCallback(async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('sales_leads')
        .select('assigned_to')
        .not('assigned_to', 'is', null)
        .gte('created_at', todayStart.toISOString());
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((lead: any) => {
        if (lead.assigned_to) {
          counts[lead.assigned_to] = (counts[lead.assigned_to] || 0) + 1;
        }
      });
      setTodayLeadCounts(counts);
    } catch (err) {
      console.error('Error fetching today lead counts:', err);
    }
  }, []);

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [t, m, a, c, o] = await Promise.all([
        supabase.from('lead_teams').select('id, name, color, emoji').order('sort_order'),
        supabase.from('lead_team_members').select('id, team_id, admin_user_id, workstream_new_leads, workstream_recontact, workstream_renewals'),
        supabase.from('admin_users').select('id, first_name, last_name, email, role').eq('is_active', true).order('first_name'),
        supabase.from('agent_distribution_caps').select('id, admin_user_id, percentage, paused, allowed_sources, daily_cap, assignment_mode'),
        supabase.from('overflow_recipients').select('id, admin_user_id, sort_order').order('sort_order'),
      ]);
      // Surface individual query failures so RLS/permission problems don't hide behind empty rows.
      const failures: string[] = [];
      if (t.error) failures.push(`lead_teams: ${t.error.message}`);
      if (m.error) failures.push(`lead_team_members: ${m.error.message}`);
      if (a.error) failures.push(`admin_users: ${a.error.message}`);
      if (c.error) failures.push(`agent_distribution_caps: ${c.error.message}`);
      if (o.error) failures.push(`overflow_recipients: ${o.error.message}`);
      if (failures.length > 0) {
        const msg = failures.join(' • ');
        console.error('[AllocationMatrix] load failed:', failures);
        setLoadError(msg);
        toast({ title: 'Some allocation data could not load', description: msg, variant: 'destructive' });
      }
      setTeams((t.data || []) as Team[]);
      setMembers((m.data || []) as Member[]);
      setAdmins((a.data || []) as AdminUserLite[]);
      setCaps((c.data || []) as Cap[]);
      setOverflowRecipients((o.data || []) as any);
      console.info('[AllocationMatrix] loaded', {
        teams: (t.data || []).length,
        members: (m.data || []).length,
        admins: (a.data || []).length,
        caps: (c.data || []).length,
        overflow: (o.data || []).length,
      });
    } catch (e: any) {
      console.error('[AllocationMatrix] loadAll threw', e);
      setLoadError(e.message || 'Unknown error');
      toast({ title: 'Failed to load allocation', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); fetchTodayLeadCounts(); }, [loadAll, fetchTodayLeadCounts]);

  // Keep the "Leads today" column live: refresh every 30s AND on realtime inserts.
  useEffect(() => {
    const iv = setInterval(fetchTodayLeadCounts, 30000);
    const channel = supabase
      .channel('allocation-matrix-today-leads')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sales_leads' },
        () => fetchTodayLeadCounts()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sales_leads' },
        () => fetchTodayLeadCounts()
      )
      .subscribe();
    return () => {
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [fetchTodayLeadCounts]);

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
      .select('id, admin_user_id, percentage, paused, allowed_sources, assignment_mode')
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
      .select('id, admin_user_id, percentage, paused, allowed_sources, assignment_mode')
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
      .select('id, admin_user_id, percentage, paused, allowed_sources, assignment_mode')
      .single();
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    setCaps(prev => prev.map(c => c.id === cap.id ? (data as Cap) : c));
  };

  const setReceiving = async (agentId: string, on: boolean, agentName?: string) => {
    if (!canEdit) return;
    const who = agentName?.trim() || 'Agent';
    const cap = await ensureCap(agentId);
    if (!cap) {
      toast({
        title: `Couldn't save ${who} ${on ? 'On' : 'Off'}`,
        description: 'Could not load the agent record. Refresh and try again.',
        variant: 'destructive',
      });
      return;
    }
    const { data, error } = await supabase
      .from('agent_distribution_caps')
      .update({ paused: !on } as any)
      .eq('id', cap.id)
      .select()
      .single();
    if (error) {
      toast({
        title: `Failed — ${who} stayed ${cap.paused ? 'Off' : 'On'}`,
        description: `${error.message}. Tap the toggle again to retry.`,
        variant: 'destructive',
      });
      // Reset local state to actual DB value so the UI doesn't lie
      setCaps(prev => prev.map(c => c.id === cap.id ? cap : c));
      return;
    }
    setCaps(prev => prev.map(c => c.id === cap.id ? (data as Cap) : c));
    toast({
      title: `Saved ✓ ${who} is now ${on ? 'On' : 'Off'}`,
      description: on
        ? 'They will start receiving new leads on their next eligible match.'
        : 'They will not receive any new leads until turned back On.',
    });
  };

  const setAssignmentMode = async (
    agentId: string,
    mode: 'round_robin' | 'open_pool',
    agentName?: string,
  ) => {
    if (!canEdit) return;
    const who = agentName?.trim() || 'Agent';
    const cap = await ensureCap(agentId);
    if (!cap) return;
    if ((cap.assignment_mode ?? 'round_robin') === mode) return;
    const { data, error } = await supabase
      .from('agent_distribution_caps')
      .update({ assignment_mode: mode } as any)
      .eq('id', cap.id)
      .select()
      .single();
    if (error) {
      toast({
        title: `Couldn't change ${who}'s mode`,
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    setCaps(prev => prev.map(c => c.id === cap.id ? (data as Cap) : c));
    toast({
      title: `Saved ✓ ${who} is now on ${mode === 'round_robin' ? 'Round Robin' : 'Open Pool'}`,
      description: mode === 'round_robin'
        ? 'They will be auto-assigned leads in rotation.'
        : 'They will only receive leads by self-claiming from the Open Pool.',
    });
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

  const commitDailyCap = async (agentId: string, raw: string) => {
    if (!canEdit) return;
    const trimmed = (raw ?? '').trim();
    // Empty string = unlimited (null)
    const parsed = trimmed === '' ? null : Math.max(0, Math.min(9999, Math.round(Number(trimmed) || 0)));
    const cap = await ensureCap(agentId);
    if (!cap) return;
    if ((cap.daily_cap ?? null) === parsed) {
      setPendingCap(s => { const n = { ...s }; delete n[agentId]; return n; });
      return;
    }
    const { data, error } = await supabase
      .from('agent_distribution_caps')
      .update({ daily_cap: parsed } as any)
      .eq('id', cap.id)
      .select('id, admin_user_id, percentage, paused, allowed_sources, daily_cap, assignment_mode')
      .single();
    if (error) return toast({ title: 'Cap update failed', description: error.message, variant: 'destructive' });
    setCaps(prev => prev.map(c => c.id === cap.id ? (data as Cap) : c));
    setPendingCap(s => { const n = { ...s }; delete n[agentId]; return n; });
    toast({
      title: 'Daily cap saved',
      description: parsed === null ? 'No cap — this agent can receive unlimited leads today.' : `This agent will stop receiving new leads after ${parsed} today. Extras route to overflow.`,
    });
  };

  const isOverflow = (agentId: string) => overflowRecipients.some(r => r.admin_user_id === agentId);

  const toggleOverflow = async (agentId: string) => {
    if (!canEdit) return;
    const existing = overflowRecipients.find(r => r.admin_user_id === agentId);
    if (existing) {
      const { error } = await supabase.from('overflow_recipients').delete().eq('id', existing.id);
      if (error) return toast({ title: 'Remove failed', description: error.message, variant: 'destructive' });
      setOverflowRecipients(prev => prev.filter(r => r.id !== existing.id));
      toast({ title: 'Removed from overflow' });
    } else {
      const nextOrder = overflowRecipients.length ? Math.max(...overflowRecipients.map(r => r.sort_order)) + 1 : 0;
      const { data, error } = await supabase
        .from('overflow_recipients')
        .insert({ admin_user_id: agentId, sort_order: nextOrder } as any)
        .select('id, admin_user_id, sort_order')
        .single();
      if (error) return toast({ title: 'Add failed', description: error.message, variant: 'destructive' });
      setOverflowRecipients(prev => [...prev, data as any]);
      toast({ title: 'Added to overflow', description: 'They will catch leads other agents cannot take (offline, paused, or at daily cap).' });
    }
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

      {/* ───────── Overflow Recipients ───────── */}
      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Overflow recipients</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Pick which agents catch <strong>overflow leads</strong> — leads that can't go to anyone in the normal share (everyone offline, paused, or already at their daily cap). Overflow is shared round-robin between the picked agents and ignores their own daily cap.
          </p>
        </div>
        <div className="px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {salesAgents.map(a => {
              const on = isOverflow(a.id);
              const displayName = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggleOverflow(a.id)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    on
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                  } ${canEdit ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                >
                  {on ? <Check className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-current opacity-50" />}
                  {displayName}
                </button>
              );
            })}
            {salesAgents.length === 0 && !loading && (
              <div className="text-xs text-muted-foreground">
                {loadError
                  ? <>Couldn't load agents. <span className="text-destructive">{loadError}</span></>
                  : admins.length === 0
                    ? 'No admin_users returned from the database (RLS may be blocking your account, or your session expired — try signing out and back in).'
                    : 'No agents with role "sales" or "sales_lead" — assign the correct role in User Permissions.'}
              </div>
            )}
          </div>
          {overflowRecipients.length === 0 && (
            <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 inline-flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              No overflow recipients — leads that don't match anyone will stay unassigned.
            </div>
          )}
        </div>
      </section>

      {/* ───────── Sales Agents ───────── */}
      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Who gets the leads?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              For each agent, pick the team they're on, turn lead receiving on or off, set how big a slice of leads they get, cap how many leads they get per day, and tick which lead sources (Facebook, Google, etc.) they're allowed to handle.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Slices add up to</div>
            <div className={`text-2xl font-bold ${shareIsBalanced ? 'text-foreground' : 'text-muted-foreground'}`}>{totalShare}%</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {shareIsBalanced ? 'Perfect — adds to 100%' : 'Should add to 100%'}
            </div>
          </div>
        </div>

        {/* Header row */}
        <div className={`hidden md:grid ${hideSources ? 'grid-cols-[1.4fr_130px_110px_100px_90px_90px_1.2fr_56px]' : 'grid-cols-[1.4fr_130px_110px_100px_90px_90px_1.2fr_1.6fr_56px]'} gap-3 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30`}>
          <div>Agent</div>
          <div>Team</div>
          <div>Getting leads?</div>
          <div>Slice of leads</div>
          <div>Daily cap</div>
          <div>Leads today</div>
          <div>Lead Types</div>
          {!hideSources && <div>Sources they handle</div>}
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
                className={`grid grid-cols-1 ${hideSources ? 'md:grid-cols-[1.4fr_130px_110px_100px_90px_90px_1.2fr_56px]' : 'md:grid-cols-[1.4fr_130px_110px_100px_90px_90px_1.2fr_1.6fr_56px]'} gap-3 px-5 py-3 items-center hover:bg-muted/20 transition-colors`}
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
                    onCheckedChange={(v) => setReceiving(a.id, v, displayName)}
                    disabled={!canEdit}
                  />
                  <span className={`text-xs font-medium ${receiving ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {receiving ? 'On' : 'Off'}
                  </span>
                </div>

                {/* Assignment mode: Round Robin vs Open Pool */}
                {(() => {
                  const mode = (capByAgent.get(a.id)?.assignment_mode ?? 'round_robin') as 'round_robin' | 'open_pool';
                  return (
                    <div
                      role="group"
                      aria-label="Assignment mode"
                      className="inline-flex rounded-md border border-input bg-background p-0.5 text-xs font-medium"
                    >
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setAssignmentMode(a.id, 'round_robin', displayName)}
                        className={`px-2 py-1 rounded-sm transition-colors ${
                          mode === 'round_robin'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        } disabled:opacity-50`}
                        title="Round Robin — auto-assigned in rotation"
                      >
                        Round Robin
                      </button>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setAssignmentMode(a.id, 'open_pool', displayName)}
                        className={`px-2 py-1 rounded-sm transition-colors ${
                          mode === 'open_pool'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        } disabled:opacity-50`}
                        title="Open Pool — agent self-claims leads"
                      >
                        Open Pool
                      </button>
                    </div>
                  );
                })()}



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

                {/* Daily cap (leads/day) — empty = unlimited */}
                <div className="flex items-center gap-1">
                  {(() => {
                    const capPending = pendingCap[a.id];
                    const currentCap = cap?.daily_cap;
                    const displayValue = capPending !== undefined
                      ? capPending
                      : (currentCap === null || currentCap === undefined ? '' : String(currentCap));
                    const isUnlimited = displayValue === '';
                    return (
                      <>
                        <input
                          type="number"
                          min={0}
                          max={9999}
                          placeholder="∞"
                          disabled={!canEdit}
                          value={displayValue}
                          onChange={(e) => setPendingCap(s => ({ ...s, [a.id]: e.target.value }))}
                          onBlur={(e) => commitDailyCap(a.id, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          title={isUnlimited ? 'No daily cap — leave empty for unlimited.' : `Stops receiving new leads after ${displayValue} today.`}
                          className="h-9 w-16 text-center rounded-md border border-input bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted/40 disabled:text-muted-foreground placeholder:text-muted-foreground/60 placeholder:text-base"
                        />
                        {isUnlimited && <InfinityIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                      </>
                    );
                  })()}
                </div>


                {/* Leads today (with cap + overflow indicator) */}
                {(() => {
                  const count = todayLeadCounts[a.id] || 0;
                  const capValue = cap?.daily_cap; // number | null | undefined
                  const uncapped = capValue === null || capValue === undefined;
                  const atCap = !uncapped && count >= (capValue as number);
                  const nearCap =
                    !uncapped &&
                    !atCap &&
                    (capValue as number) > 0 &&
                    count >= Math.max(1, Math.floor((capValue as number) * 0.8));
                  const tone = atCap
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : nearCap
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : count > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-muted/40 text-muted-foreground border-border';
                  return (
                    <div
                      className={`inline-flex flex-col items-start gap-0.5 px-2 py-1 rounded-md border ${tone}`}
                      title={
                        atCap
                          ? `${displayName} has hit their daily cap of ${capValue}. New leads route to overflow.`
                          : uncapped
                          ? `${displayName} has received ${count} leads today (no cap set).`
                          : `${displayName} has received ${count} of ${capValue} leads today.`
                      }
                    >
                      <div className="text-sm font-semibold tabular-nums leading-none">
                        {count}
                        <span className="text-[11px] font-normal opacity-70"> / {uncapped ? '∞' : capValue}</span>
                      </div>
                      {atCap && (
                        <div className="text-[10px] font-semibold uppercase tracking-wide leading-none">
                          At cap · overflow
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Lead Types */}
                <div className="flex flex-wrap gap-1.5">
                  {(isSalesLead ? WORKSTREAMS.filter(w => w.key === 'new_leads') : WORKSTREAMS).map(w => {
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
                {!hideSources && (

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
                )}



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

          {visibleAgents.length === 0 && !loading && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground space-y-2">
              {loadError ? (
                <>
                  <div className="text-destructive font-medium">Couldn't load agents</div>
                  <div className="text-xs">{loadError}</div>
                  <div className="text-xs">Try signing out and back in, then reload this page.</div>
                </>
              ) : admins.length === 0 ? (
                <>
                  <div className="font-medium">No admin users returned</div>
                  <div className="text-xs">Your session may have expired, or RLS is blocking your account from reading admin_users. Sign out and back in.</div>
                </>
              ) : salesAgents.length === 0 ? (
                <>
                  <div className="font-medium">No agents with role "sales" or "sales_lead"</div>
                  <div className="text-xs">{admins.length} admin user{admins.length === 1 ? '' : 's'} loaded — none have a sales role. Assign sales roles in User Permissions.</div>
                </>
              ) : teamFilter !== '__all__' ? (
                <>
                  <div>No agents match the current team filter.</div>
                  <div className="text-xs">Switch the Team dropdown above back to "All Teams" to see everyone.</div>
                </>
              ) : (
                'No agents match this filter.'
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-muted/40 text-muted-foreground flex items-center gap-2">

          <Info className="h-4 w-4 shrink-0" />
          <p className="text-xs">
            {shareIsBalanced
              ? 'All good — the slices add up to 100%. Each lead goes only to agents who handle that source (or who have "All" ticked), then is shared out by their slice size.'
              : `Heads up — the slices add up to ${totalShare}%, not 100%. Leads will still go out (only to agents who handle the right source), but it's easier to read when it's exactly 100. Click "Split Leads Equally" to fix it in one tap.`}
          </p>
        </div>
      </section>
    </div>
  );
};

export default AllocationMatrix;
