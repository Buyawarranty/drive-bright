import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Check, Save, Split, Info, MoreVertical, Lock, Infinity as InfinityIcon, LifeBuoy, X, ChevronUp, ChevronDown, SkipForward, RotateCcw, Sunrise, Settings, Radio } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { PushOpenPoolControl } from './PushOpenPoolControl';
import { OpenPoolBacklogBanner } from './OpenPoolBacklogBanner';
import { getSince6pmYesterdayRange } from '@/lib/leadFeedDate';
import LeadAssignmentStream from './LeadAssignmentStream';





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
  sort_order?: number | null;
  last_assigned_at?: string | null;
  assigned_today?: number | null;
  priority?: number | null;
}

// `key` must match the lead_source value stored on the lead, because that's what
// pick_agent_for_distribution compares against allowed_sources.
// `aliases` keeps older stored values (google / facebook / organic) working.
const LEAD_SOURCES: { key: string; label: string; color: string; aliases: string[] }[] = [
  { key: 'website',   label: 'Organic',  color: '#16a34a', aliases: ['organic', 'direct'] },
  { key: 'social_ad', label: 'Meta',     color: '#1877F2', aliases: ['facebook', 'meta'] },
  { key: 'google_ad', label: 'Google',   color: '#EA4335', aliases: ['google'] },
  { key: 'bing_ad',   label: 'Bing',     color: '#0F7A8A', aliases: ['bing', 'microsoft'] },
];


interface AdminUserLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

type Workstream = 'new_leads' | 'recontact' | 'renewals';

const WORKSTREAMS: { key: Workstream; col: keyof Member; label: string; tabId: string }[] = [
  { key: 'new_leads', col: 'workstream_new_leads', label: 'New Leads',       tabId: 'new-leads' },
  { key: 'recontact', col: 'workstream_recontact', label: 'Recontact Leads', tabId: 'recontact-leads' },
  { key: 'renewals',  col: 'workstream_renewals',  label: 'Renewals',        tabId: 'renewals' },
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
  const [modeFilter, setModeFilter] = useState<'all' | 'round_robin' | 'open_pool'>('all');
  const [splitHighlighted, setSplitHighlighted] = useState(false);
  const [todayLeadCounts, setTodayLeadCounts] = useState<Record<string, number>>({});
  const [since6pmCounts, setSince6pmCounts] = useState<Record<string, number>>({});
  const [overflowRecipients, setOverflowRecipients] = useState<{ id: string; admin_user_id: string; sort_order: number }[]>([]);

  const getTodayAssignmentCounts = useCallback(async (): Promise<Record<string, number>> => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartIso = todayStart.toISOString();

    const { data, error } = await supabase
      .from('sales_leads')
      .select('assigned_to')
      .not('assigned_to', 'is', null)
      // Allocation fairness must count leads ASSIGNED today, including old backlog
      // leads handed out today. Fallback to created_at only for legacy rows with
      // no assigned_at timestamp.
      .or(`assigned_at.gte.${todayStartIso},and(assigned_at.is.null,created_at.gte.${todayStartIso})`);

    if (error) throw error;

    const counts: Record<string, number> = {};
    (data || []).forEach((lead: any) => {
      if (lead.assigned_to) {
        counts[lead.assigned_to] = (counts[lead.assigned_to] || 0) + 1;
      }
    });
    return counts;
  }, []);

  const fetchTodayLeadCounts = useCallback(async () => {
    try {
      const counts = await getTodayAssignmentCounts();
      setTodayLeadCounts(counts);
    } catch (err) {
      console.error('Error fetching today lead counts:', err);
    }
  }, [getTodayAssignmentCounts]);

  const getSince6pmAssignmentCounts = useCallback(async (): Promise<Record<string, number>> => {
    const { from } = getSince6pmYesterdayRange();
    if (!from) return {};
    const fromIso = from.toISOString();

    const { data, error } = await supabase
      .from('sales_leads')
      .select('assigned_to')
      .not('assigned_to', 'is', null)
      .or(`assigned_at.gte.${fromIso},and(assigned_at.is.null,created_at.gte.${fromIso})`);

    if (error) throw error;

    const counts: Record<string, number> = {};
    (data || []).forEach((lead: any) => {
      if (lead.assigned_to) {
        counts[lead.assigned_to] = (counts[lead.assigned_to] || 0) + 1;
      }
    });
    return counts;
  }, []);

  const fetchSince6pmCounts = useCallback(async () => {
    try {
      const counts = await getSince6pmAssignmentCounts();
      setSince6pmCounts(counts);
    } catch (err) {
      console.error('Error fetching since-6pm lead counts:', err);
    }
  }, [getSince6pmAssignmentCounts]);

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [t, m, a, c, o] = await Promise.all([
        supabase.from('lead_teams').select('id, name, color, emoji').order('sort_order'),
        supabase.from('lead_team_members').select('id, team_id, admin_user_id, workstream_new_leads, workstream_recontact, workstream_renewals'),
        // Only current staff: deactivated or archived accounts never appear in distribution.
        supabase.from('admin_users').select('id, first_name, last_name, email, role').eq('is_active', true).is('archived_at', null).order('first_name'),
        supabase.from('agent_distribution_caps').select('id, admin_user_id, percentage, paused, allowed_sources, daily_cap, assignment_mode, sort_order, last_assigned_at, assigned_today, priority'),
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

  useEffect(() => { loadAll(); fetchTodayLeadCounts(); fetchSince6pmCounts(); }, [loadAll, fetchTodayLeadCounts, fetchSince6pmCounts]);

  // Keep the "Leads today" and "Since 6pm" columns live: refresh every 30s AND on realtime inserts/updates.
  useEffect(() => {
    const iv = setInterval(() => {
      fetchTodayLeadCounts();
      fetchSince6pmCounts();
    }, 30000);
    const channel = supabase
      .channel('allocation-matrix-today-leads')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sales_leads' },
        () => {
          fetchTodayLeadCounts();
          fetchSince6pmCounts();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sales_leads' },
        () => {
          fetchTodayLeadCounts();
          fetchSince6pmCounts();
        }
      )
      .subscribe();
    return () => {
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [fetchTodayLeadCounts, fetchSince6pmCounts]);

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

  /**
   * Effective slice per ON agent — normalized to 100% based only on agents
   * currently receiving leads (toggle ON, not paused). Stored `percentage`
   * values are left untouched; this is a display + distribution-hint helper
   * so managers see what actually happens when some agents are offline/off.
   * If all ON agents have 0% stored, we fall back to equal split.
   */
  const effectiveShareByAgent = useMemo(() => {
    const pool = isTeamScoped ? visibleAgents : salesAgents;
    const onAgents = pool.filter(a => {
      const cap = capByAgent.get(a.id);
      return cap && !cap.paused;
    });
    const map = new Map<string, number>();
    if (onAgents.length === 0) return map;
    const sum = onAgents.reduce((s, a) => s + (capByAgent.get(a.id)?.percentage || 0), 0);
    if (sum <= 0) {
      const equal = Math.round((100 / onAgents.length) * 10) / 10;
      onAgents.forEach(a => map.set(a.id, equal));
      return map;
    }
    onAgents.forEach(a => {
      const pct = ((capByAgent.get(a.id)?.percentage || 0) / sum) * 100;
      map.set(a.id, Math.round(pct * 10) / 10);
    });
    return map;
  }, [isTeamScoped, visibleAgents, salesAgents, capByAgent]);

  const onAgentCount = useMemo(() => {
    const pool = isTeamScoped ? visibleAgents : salesAgents;
    return pool.filter(a => {
      const cap = capByAgent.get(a.id);
      return cap && !cap.paused;
    }).length;
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
          // New members start switched OFF for every workstream — a manager
          // must explicitly tick New Leads / Recontact / Renewals.
          workstream_new_leads: false,
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
    const wsDef = WORKSTREAMS.find(w => w.key === ws)!;
    const col = wsDef.col;
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

    // Combined behaviour: the workstream toggle also grants/revokes sidebar tab access.
    // Mirror to admin_users.permissions.tab_<id> so hiding a workstream also hides its tab.
    try {
      const { data: adminRow, error: fetchErr } = await supabase
        .from('admin_users')
        .select('permissions')
        .eq('id', agentId)
        .single();
      if (fetchErr) throw fetchErr;
      const currentPerms: Record<string, boolean> = { ...((adminRow?.permissions as any) || {}) };
      const permKey = `tab_${wsDef.tabId}`;
      if (currentPerms[permKey] !== next) {
        currentPerms[permKey] = next;
        const { error: updErr } = await supabase
          .from('admin_users')
          .update({ permissions: currentPerms } as any)
          .eq('id', agentId);
        if (updErr) throw updErr;
      }
    } catch (permErr: any) {
      toast({
        title: 'Tab access not synced',
        description: permErr?.message ?? 'Could not update sidebar tab access for this agent.',
        variant: 'destructive',
      });
    }
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
    const src = LEAD_SOURCES.find(s => s.key === source);
    const keys = [source, ...(src?.aliases ?? [])];
    const current = cap.allowed_sources ?? [];
    const has = current.some(s => keys.includes(s));
    const next = has
      ? current.filter(s => !keys.includes(s))
      : [...current.filter(s => !keys.includes(s)), source];
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
      title: `Saved ✓ ${who} is now on ${mode === 'round_robin' ? 'Round Robin' : 'Open Round Robin'}`,
      description: mode === 'round_robin'
        ? 'Every new lead is sent to them instantly — one each, in order. No pile-up.'
        : 'New leads pile up in the Open Pool. They grab one when ready via Take Next Lead.',
    });
  };

  /** Swap sort_order of an agent with their neighbour in the ordered round-robin list.
   *  Only affects ties in the picker (see tooltip on the arrows). */
  const moveAgent = async (agentId: string, dir: 'up' | 'down') => {
    if (!canEdit) return;
    // Ordered list of round-robin agents currently visible.
    const rrAgents = visibleAgents
      .filter(a => (capByAgent.get(a.id)?.assignment_mode ?? 'round_robin') === 'round_robin')
      .map(a => ({ id: a.id, cap: capByAgent.get(a.id) }))
      .sort((x, y) => {
        const sx = x.cap?.sort_order ?? 9999;
        const sy = y.cap?.sort_order ?? 9999;
        if (sx !== sy) return sx - sy;
        return x.id.localeCompare(y.id);
      });
    const idx = rrAgents.findIndex(r => r.id === agentId);
    if (idx < 0) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= rrAgents.length) return;
    // Renumber the whole list 0..N so we always have consistent ordering.
    const reordered = [...rrAgents];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    // Persist new sort_order values.
    const updates = await Promise.all(reordered.map(async (r, i) => {
      const cap = r.cap ?? await ensureCap(r.id);
      if (!cap) return null;
      if ((cap.sort_order ?? -1) === i) return cap;
      const { data, error } = await supabase
        .from('agent_distribution_caps')
        .update({ sort_order: i } as any)
        .eq('id', cap.id)
        .select()
        .single();
      if (error) {
        toast({ title: 'Reorder failed', description: error.message, variant: 'destructive' });
        return cap;
      }
      return data as Cap;
    }));
    setCaps(prev => {
      const map = new Map(prev.map(c => [c.id, c]));
      updates.forEach(u => { if (u) map.set(u.id, u as Cap); });
      return Array.from(map.values());
    });
    toast({ title: 'Rotation order updated', description: 'This only decides who goes first when two agents are tied.' });
  };

  /** Skip this agent in the next rotation by bumping their last_assigned_at to now,
   *  so the picker treats them as "just assigned" and picks someone else next. */
  const skipNext = async (agentId: string, agentName?: string) => {
    if (!canEdit) return;
    const who = agentName?.trim() || 'Agent';
    const cap = await ensureCap(agentId);
    if (!cap) return;
    const { data, error } = await supabase
      .from('agent_distribution_caps')
      .update({ last_assigned_at: new Date().toISOString() } as any)
      .eq('id', cap.id)
      .select()
      .single();
    if (error) return toast({ title: 'Skip failed', description: error.message, variant: 'destructive' });
    setCaps(prev => prev.map(c => c.id === cap.id ? (data as Cap) : c));
    toast({
      title: `Skipped ✓ ${who} bypassed once`,
      description: `${who} will be pushed to the back of the queue. Others catch up until ${who}'s turn comes round again naturally.`,
    });
  };

  /** Reset last_assigned_at (and today's counter) for every round-robin agent currently visible,
   *  so rotation starts fresh from the arrow order. */
  const resetRotationCounters = async () => {
    if (!canEdit) return;
    const rrIds = visibleAgents
      .filter(a => (capByAgent.get(a.id)?.assignment_mode ?? 'round_robin') === 'round_robin')
      .map(a => capByAgent.get(a.id)?.id)
      .filter((x): x is string => !!x);
    if (rrIds.length === 0) {
      toast({ title: 'Nothing to reset', description: 'No round-robin agents in view.' });
      return;
    }
    if (!window.confirm(`Reset rotation counters for ${rrIds.length} round-robin agent(s)? Everyone will be treated as tied, and the arrow order decides who goes first from the next lead onwards.`)) return;
    const { error } = await supabase
      .from('agent_distribution_caps')
      .update({ last_assigned_at: null, assigned_today: 0 } as any)
      .in('id', rrIds);
    if (error) return toast({ title: 'Reset failed', description: error.message, variant: 'destructive' });
    await loadAll();
    toast({
      title: 'Rotation counters reset ✓',
      description: 'Everyone is tied. The next lead goes to whoever sits highest in the arrow order, then it rotates one-each from there.',
    });
  };

  const [distributingOne, setDistributingOne] = useState(false);

  /** Click-action: hand out the oldest unassigned leads one-each to active
   *  round-robin + ORR agents in arrow order, respecting daily caps. Each
   *  click assigns up to one lead per eligible agent (one full pass of the
   *  arrow order). Managers can click repeatedly to burn through backlog. */
  const distributeOneEach = async () => {
    if (!canEdit) return;
    if (distributingOne) return;

    // Round Robin agents only. Open Round Robin agents grab their own leads
    // from the Open Pool, so auto-distribution must skip them.
    let rrAgents = visibleAgents
      .map(a => ({ agent: a, cap: capByAgent.get(a.id) }))
      .filter(({ cap }) => cap && !cap.paused && (cap.assignment_mode ?? 'round_robin') === 'round_robin');

    if (rrAgents.length === 0) {
      toast({ title: 'No active agents', description: 'Turn agents ON first.' });
      return;
    }

    setDistributingOne(true);
    try {
      // Resync the server-side `assigned_today` counter for each agent against
      // actual sales_leads assigned today. The RPC's cap enforcer reads that
      // column; if it's stale (e.g. counters weren't reset overnight), it
      // silently rejects assignments even when today's real count is 0.
      try {
        const freshCounts = await getTodayAssignmentCounts();
        setTodayLeadCounts(freshCounts);
        // Push corrected counts to agent_distribution_caps for every visible agent.
        await Promise.all(
          rrAgents.map(({ agent, cap }) =>
            supabase
              .from('agent_distribution_caps')
              .update({ assigned_today: freshCounts[agent.id] || 0 } as any)
              .eq('id', cap!.id)
          )
        );
      } catch (e) {
        console.warn('[distributeOneEach] counter resync failed', e);
      }

      const liveCounts = await getTodayAssignmentCounts();
      setTodayLeadCounts(liveCounts);


      // Grab the oldest unassigned "new"/"contacted" leads — enough for one
      // full pass across all eligible agents (plus a small buffer in case
      // some assignments fail).
      const { data: unassigned, error: leadsErr } = await supabase
        .from('sales_leads')
        .select('id, created_at')
        .is('assigned_to', null)
        .in('status', ['new', 'contacted'])
        .order('created_at', { ascending: true })
        .limit(Math.max(rrAgents.length * 10, 50));

      if (leadsErr) {
        toast({ title: 'Could not load leads', description: leadsErr.message, variant: 'destructive' });
        return;
      }

      const queue = [...(unassigned || [])];
      if (queue.length === 0) {
        toast({ title: 'No unassigned leads', description: 'There are no unassigned new/contacted leads to hand out.' });
        return;
      }

      // Track running per-agent counts locally so we respect caps mid-loop.
      const running: Record<string, number> = {};
      rrAgents.forEach(({ agent }) => {
        running[agent.id] = liveCounts[agent.id] || 0;
      });

      const capOf = (cap: any): number | null => (cap?.daily_cap ?? null);
      const hasRoom = (agentId: string, cap: any) => {
        const cv = capOf(cap);
        return cv == null || (running[agentId] || 0) < cv;
      };

      let assigned = 0;
      let leveled = 0;
      let fullPass = 0;
      let skipped = 0;

      // ── PHASE 1: AUTO-LEVEL ─────────────────────────────────────────────
      // Keep handing leads to whichever eligible agent has the FEWEST leads
      // today until everyone is tied at the same count (or we run out of
      // leads / everyone hits their cap). Ties break by arrow order.
      while (queue.length > 0) {
        const eligible = rrAgents.filter(({ agent, cap }) => hasRoom(agent.id, cap));
        if (eligible.length === 0) break;

        const counts = eligible.map(({ agent }) => running[agent.id] || 0);
        const lo = Math.min(...counts);
        const hi = Math.max(...counts);
        if (lo >= hi) break; // everyone level → stop phase 1

        // pick the lowest-count eligible agent, tiebreak by sort_order
        const target = [...eligible].sort((x, y) => {
          const cx = running[x.agent.id] || 0;
          const cy = running[y.agent.id] || 0;
          if (cx !== cy) return cx - cy;
          return (x.cap?.sort_order ?? 9999) - (y.cap?.sort_order ?? 9999);
        })[0];

        const lead = queue.shift();
        if (!lead) break;

        const { data: res, error } = await supabase.rpc('assign_lead_to_agent', {
          p_lead_id: lead.id,
          p_agent_id: target.agent.id,
          p_is_abandoned_cart: false,
          p_override_cap: false,
        } as any);
        if (error) { console.warn('[distributeOneEach] assign failed', error); queue.unshift(lead); continue; }
        const okRes = res as { success?: boolean } | null;
        if (okRes && okRes.success === false) { queue.unshift(lead); continue; }

        running[target.agent.id] = (running[target.agent.id] || 0) + 1;
        assigned++;
        leveled++;
      }

      // ── PHASE 2: ONE FULL PASS ──────────────────────────────────────────
      // After leveling, give one to each eligible agent in arrow order.
      const passOrder = [...rrAgents].sort(
        (x, y) => (x.cap?.sort_order ?? 9999) - (y.cap?.sort_order ?? 9999)
      );
      for (const { agent, cap } of passOrder) {
        if (queue.length === 0) break;
        if (!hasRoom(agent.id, cap)) { skipped++; continue; }
        const lead = queue.shift();
        if (!lead) break;
        const { data: res, error } = await supabase.rpc('assign_lead_to_agent', {
          p_lead_id: lead.id,
          p_agent_id: agent.id,
          p_is_abandoned_cart: false,
          p_override_cap: false,
        } as any);
        if (error) { console.warn('[distributeOneEach] assign failed', error); queue.unshift(lead); continue; }
        const okRes = res as { success?: boolean } | null;
        if (okRes && okRes.success === false) { queue.unshift(lead); continue; }
        running[agent.id] = (running[agent.id] || 0) + 1;
        assigned++;
        fullPass++;
      }

      await Promise.all([loadAll(), fetchTodayLeadCounts()]);
      toast({
        title: `Distributed ${assigned} lead${assigned === 1 ? '' : 's'}`,
        description: assigned === 0
          ? 'Everyone was already level and at cap, or no leads available.'
          : `${leveled} leveled up${leveled ? ' (auto catch-up)' : ''} · ${fullPass} in full pass${skipped ? ` · ${skipped} at cap` : ''}.`,
      });
    } finally {
      setDistributingOne(false);
    }
  };

  // Agent settings grid is hidden by default — the live stream is the main view.
  const [showAgentSettings, setShowAgentSettings] = useState(false);

  // ── Strict rotation: one each, in arrow order, no conditions ──────────────

  const [strictRunning, setStrictRunning] = useState(false);
  const [strictEnabled, setStrictEnabled] = useState(false);
  const [strictSettingsId, setStrictSettingsId] = useState<string | null>(null);
  const [strictCursor, setStrictCursor] = useState(0);
  const [strictLastRun, setStrictLastRun] = useState<Date | null>(null);
  const [unassignedCount, setUnassignedCount] = useState<number | null>(null);

  /** A lead only counts as "waiting" if it is genuinely fresh and untouched:
   *  unassigned, still status `new` (never contacted) and no older than 7 days.
   *  Old already-contacted leads live in Recontact / Shark Tank and must never
   *  be swept back into the live rotation. */
  const waitingLeadsQuery = () =>
    supabase
      .from('sales_leads')
      .select('id, created_at')
      .is('assigned_to', null)
      .eq('status', 'new')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  /** Fetch how many fresh unassigned leads are currently waiting in the queue. */
  const fetchUnassignedCount = async () => {
    const { count, error } = await supabase
      .from('sales_leads')
      .select('id', { count: 'exact', head: true })
      .is('assigned_to', null)
      .eq('status', 'new')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    if (!error && count !== null) setUnassignedCount(count);
  };


  // Live count of waiting leads — refresh every 20s and after every action.
  useEffect(() => {
    fetchUnassignedCount();
    const t = setInterval(fetchUnassignedCount, 20000);
    return () => clearInterval(t);
  }, []);

  // Load the saved on/off state (it stays on until switched off).
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('lead_distribution_settings')
        .select('id, strict_rotation_enabled, strict_rotation_cursor')
        .is('team_id', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        setStrictSettingsId((data as any).id);
        setStrictEnabled(!!(data as any).strict_rotation_enabled);
        setStrictCursor(Number((data as any).strict_rotation_cursor) || 0);
      }
    })();
  }, []);

  const setStrictRotation = async (on: boolean) => {
    setStrictEnabled(on);
    if (strictSettingsId) {
      await supabase
        .from('lead_distribution_settings')
        .update({ strict_rotation_enabled: on, updated_at: new Date().toISOString() } as any)
        .eq('id', strictSettingsId);
    }
    toast({
      title: on ? 'Strict rotation is ON' : 'Strict rotation is OFF',
      description: on
        ? 'Every new unassigned lead is handed out one each, in arrow order, until you switch it off.'
        : 'Leads will follow your normal Round Robin / Open Round Robin settings again.',
    });
    if (on) strictRotationDistribute(true);
  };

  /** Agents that take leads automatically. Open Round Robin agents are skipped
   *  on purpose — they grab their own leads from the Open Pool. */
  const rotationAgents = useMemo(
    () =>
      [...visibleAgents]
        .filter(a => (capByAgent.get(a.id)?.assignment_mode ?? 'round_robin') === 'round_robin')
        .sort((x, y) => (capByAgent.get(x.id)?.sort_order ?? 9999) - (capByAgent.get(y.id)?.sort_order ?? 9999)),
    [visibleAgents, capByAgent]
  );

  /** Dead-simple hand-out: takes the oldest unassigned leads and gives exactly
   *  one to each Round Robin agent, top-to-bottom in arrow order, ignoring
   *  pause state and daily caps. Open Round Robin agents are left alone so
   *  they can grab leads themselves.
   *  The rotation position carries over between runs so nobody is skipped. */
  const strictRotationDistribute = async (silent = false) => {
    if (!canEdit || strictRunning) return;

    const order = rotationAgents;
    if (order.length === 0) {
      if (!silent) toast({ title: 'No round robin agents', description: 'Everyone in view is on Open Round Robin — they grab their own leads. Switch an agent to Round Robin to auto-assign.' });
      return;
    }

    setStrictRunning(true);
    try {
      const { data: unassigned, error: leadsErr } = await waitingLeadsQuery()
        .order('created_at', { ascending: true })
        .limit(200);

      if (leadsErr) {
        if (!silent) toast({ title: 'Could not load leads', description: leadsErr.message, variant: 'destructive' });
        return;
      }
      const queue = [...(unassigned || [])];
      if (queue.length === 0) {
        if (!silent) toast({ title: 'No leads waiting', description: 'There are no fresh unassigned leads to hand out.' });

        setStrictLastRun(new Date());
        return;
      }

      let assigned = 0;
      let lastError = '';
      let cursor = strictCursor % order.length;
      let guard = 0;
      while (queue.length > 0 && guard < 500) {
        guard++;
        const agent = order[cursor % order.length];
        const lead = queue.shift();
        if (!lead) break;
        // Direct assignment — no cap/mode/pause checks, strictly one each.
        const { error } = await supabase
          .from('sales_leads')
          .update({ assigned_to: agent.id, updated_at: new Date().toISOString() } as any)
          .eq('id', lead.id)
          .is('assigned_to', null);
        if (error) {
          lastError = error.message;
          continue;
        }
        assigned++;
        cursor = (cursor + 1) % order.length;
      }

      setStrictCursor(cursor);
      setStrictLastRun(new Date());
      if (strictSettingsId) {
        await supabase
          .from('lead_distribution_settings')
          .update({ strict_rotation_cursor: cursor } as any)
          .eq('id', strictSettingsId);
      }

      await Promise.all([loadAll(), fetchTodayLeadCounts(), fetchUnassignedCount()]);
      // Background sweeps stay silent — only manual runs show a toast.
      if (!silent) {
        toast({
          title: assigned > 0 ? `Handed out ${assigned} lead${assigned === 1 ? '' : 's'}` : 'Nothing assigned',
          description: assigned > 0
            ? `One each in arrow order across ${order.length} agent${order.length === 1 ? '' : 's'}.`
            : lastError || 'No leads could be assigned.',
          variant: assigned > 0 ? undefined : 'destructive',
        });
      }
    } finally {
      setStrictRunning(false);
    }
  };

  // While the switch is ON, keep sweeping new unassigned leads every 20s.
  useEffect(() => {
    if (!strictEnabled || !canEdit) return;
    const t = setInterval(() => { strictRotationDistribute(true); }, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strictEnabled, canEdit, rotationAgents, strictCursor, strictRunning]);







  // ── Allocate next N leads to a single agent (catch-up tool) ───────────────
  const [catchUpAgentId, setCatchUpAgentId] = useState<string>('');
  const [catchUpCount, setCatchUpCount] = useState<number>(5);
  const [catchUpOverrideCap, setCatchUpOverrideCap] = useState<boolean>(false);
  const [catchUpRunning, setCatchUpRunning] = useState(false);

  const allocateNextNToAgent = async () => {
    if (!canEdit || catchUpRunning) return;
    if (!catchUpAgentId) {
      toast({ title: 'Pick an agent', description: 'Select which agent should get the next batch of leads.' });
      return;
    }
    const n = Math.max(1, Math.min(100, Math.floor(catchUpCount || 0)));
    if (!n) {
      toast({ title: 'Set a number', description: 'How many leads should go to this agent?' });
      return;
    }
    const agent = visibleAgents.find(a => a.id === catchUpAgentId);
    if (!agent) return;
    const agentName = `${agent.first_name ?? ''} ${agent.last_name ?? ''}`.trim() || agent.email;

    if (!window.confirm(`Assign the next ${n} unassigned lead${n === 1 ? '' : 's'} to ${agentName}?${catchUpOverrideCap ? '\n\nDaily cap will be OVERRIDDEN.' : ''}`)) return;

    setCatchUpRunning(true);
    try {
      await fetchTodayLeadCounts();

      const { data: unassigned, error: leadsErr } = await supabase
        .from('sales_leads')
        .select('id, created_at')
        .is('assigned_to', null)
        .in('status', ['new', 'contacted'])
        .order('created_at', { ascending: true })
        .limit(n * 3);

      if (leadsErr) {
        toast({ title: 'Could not load leads', description: leadsErr.message, variant: 'destructive' });
        return;
      }
      const queue = [...(unassigned || [])];
      if (queue.length === 0) {
        toast({ title: 'No unassigned leads', description: 'Nothing waiting in the new-leads pool right now.' });
        return;
      }

      let assigned = 0;
      let failed = 0;
      while (queue.length > 0 && assigned < n) {
        const lead = queue.shift();
        if (!lead) break;
        const { data: res, error } = await supabase.rpc('assign_lead_to_agent', {
          p_lead_id: lead.id,
          p_agent_id: agent.id,
          p_is_abandoned_cart: false,
          p_override_cap: catchUpOverrideCap,
        } as any);
        if (error) { failed++; continue; }
        const okRes = res as { success?: boolean; error?: string } | null;
        if (okRes && okRes.success === false) {
          if (!catchUpOverrideCap) {
            // hit cap — stop early
            toast({ title: 'Daily cap reached', description: `${agentName} hit their daily cap after ${assigned} lead(s). Tick "Override cap" to push more.`, variant: 'destructive' });
            break;
          }
          failed++;
          continue;
        }
        assigned++;
      }

      await Promise.all([loadAll(), fetchTodayLeadCounts()]);
      toast({
        title: `Assigned ${assigned} lead${assigned === 1 ? '' : 's'} to ${agentName}`,
        description: failed > 0 ? `${failed} lead(s) could not be assigned.` : undefined,
      });
    } finally {
      setCatchUpRunning(false);
    }
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

  const setPriority = async (agentId: string, priority: number | null) => {
    if (!canEdit) return;
    const cap = await ensureCap(agentId);
    if (!cap) return;
    if ((cap.priority ?? null) === priority) return;
    const { data, error } = await supabase
      .from('agent_distribution_caps')
      .update({ priority } as any)
      .eq('id', cap.id)
      .select('id, admin_user_id, percentage, paused, allowed_sources, daily_cap, assignment_mode, sort_order, last_assigned_at, assigned_today, priority')
      .single();
    if (error) return toast({ title: 'Priority update failed', description: error.message, variant: 'destructive' });
    setCaps(prev => prev.map(c => c.id === cap.id ? (data as Cap) : c));
    toast({
      title: priority === null ? 'Priority cleared' : `Priority set to ${priority}`,
      description: priority === null
        ? 'Agent only gets new leads if all numbered tiers are unavailable.'
        : `Tier ${priority} — this agent is picked before tiers ${priority + 1}${priority < 4 ? '–4' : ''} when on shift.`,
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
      <OpenPoolBacklogBanner canEdit={canEdit} admins={admins} caps={caps} />



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
          <p className="text-xs text-muted-foreground mt-1">
            <strong>Heads up:</strong> overflow always auto-assigns (like round-robin). If you pick an agent who is set to <em>Open Round Robin</em> below, they will still receive overflow leads directly — their Open Round Robin preference is bypassed for overflow only.
          </p>
        </div>
        <div className="px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {salesAgents.map(a => {
              const on = isOverflow(a.id);
              const displayName = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email;
              const isOpenPool = (capByAgent.get(a.id)?.assignment_mode ?? 'round_robin') === 'open_pool';
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggleOverflow(a.id)}
                  aria-pressed={on}
                  title={isOpenPool ? `${displayName} is on Open Round Robin — overflow will still auto-assign to them if picked here.` : undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    on
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                  } ${canEdit ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                >
                  {on ? <Check className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-current opacity-50" />}
                  {displayName}
                  {isOpenPool && (
                    <span className={`ml-1 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded ${on ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-amber-100 text-amber-800'}`}>
                      Open Round Robin
                    </span>
                  )}
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
              Each new lead is sent instantly to the next available Round Robin agent — one each, in order. Open Round Robin agents don't get leads sent to them; they grab from the pool themselves.
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mt-2 inline-block">
              <strong>Note:</strong> Daily cap here applies to <strong>New Leads only</strong>. Recontact access &amp; caps are managed in the <em>Agent access to Recontact Leads</em> section above. Renewals are picked from lists by the agent.
            </p>
          </div>
          <div className="text-right">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Distribution</div>
            <div className="text-2xl font-bold text-emerald-700">Even</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              One each, in order across {onAgentCount} agent{onAgentCount === 1 ? '' : 's'} currently on
            </div>
          </div>
        </div>




        {/* Mode filter + counts — makes it obvious at a glance which agents
            are on Round Robin vs Open Round Robin, and lets a manager isolate the
            "one agent on Round Robin while everyone else is on Open Round Robin"
            configuration. */}
        {(() => {
          const modeOf = (agentId: string) =>
            (capByAgent.get(agentId)?.assignment_mode ?? 'round_robin') as 'round_robin' | 'open_pool';
          const rrCount = visibleAgents.filter(a => modeOf(a.id) === 'round_robin').length;
          const opCount = visibleAgents.filter(a => modeOf(a.id) === 'open_pool').length;
          const chip = (key: 'all' | 'round_robin' | 'open_pool', label: string, count: number, activeCls: string) => (
            <button
              key={key}
              type="button"
              onClick={() => setModeFilter(key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                modeFilter === key ? activeCls : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
              }`}
            >
              {label}
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                modeFilter === key ? 'bg-white/25 text-current' : 'bg-muted text-foreground'
              }`}>{count}</span>
            </button>
          );
          return (
            <div className="px-5 py-2.5 border-b border-border bg-muted/10 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">Filter:</span>
              <span className="text-[11px] text-muted-foreground mr-1" title="These chips only show or hide agents in the list. They do not change anyone's actual assignment mode.">show/hide only</span>
              {chip('all', 'All', visibleAgents.length, 'bg-foreground text-background border-foreground')}
              {chip('round_robin', 'Round Robin', rrCount, 'bg-primary text-primary-foreground border-primary')}
              {chip('open_pool', 'Open Round Robin', opCount, 'bg-emerald-600 text-white border-emerald-600')}
              {rrCount === 1 && opCount > 0 && (
                <span className="ml-1 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                  Solo Round Robin — 1 agent on rotation, {opCount} on Open Round Robin
                </span>
              )}
              {/* Action buttons moved to the dedicated panel below */}
              {canEdit && (
                <div className="w-full mt-2">
                  {/* ── One simple round robin ── */}
                  <div className={`rounded-lg border-2 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 ${strictEnabled ? 'border-emerald-500 bg-emerald-100' : 'border-emerald-300 bg-emerald-50'}`}>
                    <div className="space-y-1.5 flex-1">
                      <h3 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                        Round robin — one lead each
                        <span className={`text-[10px] font-bold uppercase rounded px-1.5 py-0.5 ${strictEnabled ? 'bg-emerald-600 text-white' : 'bg-emerald-200 text-emerald-800'}`}>
                          {strictEnabled ? 'On' : 'Off'}
                        </span>
                      </h3>
                      <p className="text-[11px] font-medium text-emerald-900 bg-emerald-200/70 border border-emerald-400/50 rounded px-2 py-1">
                        RR agents get leads sent to them automatically. ORR agents grab their own from the pool. Both can coexist — this toggle only affects RR agents.
                      </p>
                      <p className="text-xs text-emerald-800">
                        <strong>When ON:</strong> each new lead is sent straight to the next <strong>Round Robin</strong> agent
                        in arrow order — one each, no pile-up. Runs every 20 seconds until you turn it off.
                      </p>
                      <ul className="text-[11px] text-emerald-700/90 space-y-0.5 list-disc pl-4">
                        <li><strong>Round Robin agents</strong> ({rotationAgents.length}) get leads sent to them automatically.</li>
                        <li><strong>Open Round Robin agents</strong> are never auto-assigned — their leads wait in the Open Pool until they press “Take next lead”.</li>
                        <li>Only brand-new, never-contacted, unowned leads from the last 7 days. Older or contacted leads stay in Recontact / Shark Tank.</li>
                      </ul>
                      {strictEnabled && (
                        <p className="text-[11px] text-emerald-700">
                          Next agent in line: <strong>{(() => {
                            const next = rotationAgents.length ? rotationAgents[strictCursor % rotationAgents.length] : null;
                            return next ? (next.first_name || next.email) : '—';
                          })()}</strong>
                          {strictLastRun ? ` · last checked ${strictLastRun.toLocaleTimeString()}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex flex-col items-center gap-1 text-xs font-semibold text-emerald-900 cursor-pointer">
                        <Switch checked={strictEnabled} onCheckedChange={setStrictRotation} />
                        <span>{strictEnabled ? 'On' : 'Turn on'}</span>
                      </label>
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-md px-2 py-1">
                          {unassignedCount === null ? '…' : unassignedCount} waiting
                        </div>
                        <button
                          type="button"
                          onClick={() => strictRotationDistribute(false)}
                          disabled={strictRunning || (unassignedCount !== null && unassignedCount === 0)}
                          title="Hand out the leads already waiting, one each in arrow order — right now."
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-emerald-600 bg-white text-emerald-800 text-xs font-semibold hover:bg-emerald-50 transition-colors disabled:opacity-60"
                        >
                          <Split className={`h-3.5 w-3.5 ${strictRunning ? 'animate-pulse' : ''}`} />
                          {strictRunning ? 'Handing out…' : 'Hand out waiting leads now'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Per-agent on/off — always visible, no need to open agent settings ── */}
                  <div className="mt-3 rounded-lg border border-border bg-background p-3">
                    <div className="flex items-baseline justify-between flex-wrap gap-2">
                      <h4 className="text-xs font-semibold text-foreground">Agents receiving leads</h4>
                      <span className="text-[11px] text-muted-foreground">
                        Switch an individual agent off and the round robin skips them — even while the toggle above is On.
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {visibleAgents.map(a => {
                        const cap = capByAgent.get(a.id);
                        const receiving = !!cap && !cap.paused;
                        const nm = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email;
                        const isOpen = (cap?.assignment_mode ?? 'round_robin') === 'open_pool';
                        return (
                          <div
                            key={a.id}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                              receiving ? 'border-emerald-300 bg-emerald-50' : 'border-border bg-muted/40'
                            }`}
                          >
                            <Switch
                              checked={receiving}
                              disabled={!canEdit}
                              onCheckedChange={(v) => setReceiving(a.id, v, nm)}
                            />
                            <span className={`text-xs font-medium ${receiving ? 'text-emerald-900' : 'text-muted-foreground'}`}>
                              {nm}
                            </span>
                            <span className={`text-[9px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 ${
                              isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {isOpen ? 'ORR' : 'RR'}
                            </span>
                            {!receiving && (
                              <span className="text-[9px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 bg-amber-100 text-amber-800">
                                Off
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {visibleAgents.length === 0 && (
                        <span className="text-xs text-muted-foreground">No agents to show.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {canEdit && (
                <div className="w-full border-t border-border/60 pt-2 mt-1">
                  <div className="flex items-start gap-2 flex-wrap bg-blue-50/60 border border-blue-200 rounded-md p-2">
                    <span className="text-[11px] font-semibold text-blue-900 mr-1 mt-1">Catch-up:</span>
                    <select
                      value={catchUpAgentId}
                      onChange={(e) => setCatchUpAgentId(e.target.value)}
                      className="h-7 rounded border border-border bg-background text-xs px-1.5"
                    >
                      <option value="">Select agent…</option>
                      {visibleAgents.map(a => {
                        const nm = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email;
                        return <option key={a.id} value={a.id}>{nm}</option>;
                      })}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={catchUpCount}
                      onChange={(e) => setCatchUpCount(Number(e.target.value))}
                      className="h-7 w-16 rounded border border-border bg-background text-xs px-1.5"
                    />
                    <label className="inline-flex items-center gap-1 text-[11px] text-blue-900">
                      <input
                        type="checkbox"
                        checked={catchUpOverrideCap}
                        onChange={(e) => setCatchUpOverrideCap(e.target.checked)}
                      />
                      Override daily cap
                    </label>
                    <button
                      type="button"
                      onClick={allocateNextNToAgent}
                      disabled={catchUpRunning || !catchUpAgentId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-600 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
                    >
                      <SkipForward className={`h-3.5 w-3.5 ${catchUpRunning ? 'animate-pulse' : ''}`} />
                      {catchUpRunning ? 'Assigning…' : `Allocate next ${Math.max(1, catchUpCount || 1)} to agent`}
                    </button>
                    <span className="w-full text-[10px] text-blue-900/80 leading-tight">
                      Use when one agent is falling behind. Pushes the next N oldest unassigned new leads straight to the chosen agent, ignoring rotation order. Daily cap still applies unless you tick "Override daily cap". Does not touch leads already assigned.
                    </span>
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        {/* Live stream replaces the per-agent settings grid as the default view */}
        {!showAgentSettings && (
          <>
            <div className="px-5 pt-3 pb-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAgentSettings(true)}
                className="h-7 px-3 text-[11px] font-semibold gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
              >
                <Settings className="h-3.5 w-3.5" />
                Show agent settings (teams, caps, sources)
              </Button>
            </div>
            <LeadAssignmentStream
              canReassign={canEdit}
              agents={visibleAgents.map(a => ({ id: a.id, first_name: a.first_name, last_name: a.last_name, email: a.email }))}
              teamNameByAgent={new Map(visibleAgents.map(a => {
                const m = memberByAgent.get(a.id);
                const t = m ? teams.find(x => x.id === m.team_id) : null;
                return [a.id, t?.name ?? ''] as [string, string];
              }))}
            />
          </>
        )}

        {showAgentSettings && (
        <div className="px-5 pt-3 pb-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAgentSettings(false)}
            className="h-7 px-3 text-[11px] font-semibold gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
          >
            <Radio className="h-3.5 w-3.5" />
            Hide agent settings — back to live stream
          </Button>
        </div>
        )}

        {/* Header row */}
        {showAgentSettings && (

        <div className={`hidden md:grid ${hideSources ? 'grid-cols-[1.4fr_130px_110px_90px_90px_90px_1.2fr_56px]' : 'grid-cols-[1.4fr_130px_110px_90px_90px_90px_1.2fr_1.6fr_56px]'} gap-3 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30`}>
          <div>Agent</div>
          <div>Team</div>
          <div>Getting leads?</div>
          <div title="Daily cap applies to NEW leads only. Recontact & Renewals are pulled from lists by the agent, so they're never capped.">Daily cap (new leads)</div>
          <div>New leads today</div>
          <div title="Leads assigned to this agent since 6:00 pm yesterday (London time). Helps managers see who has been fed leads recently so they can distribute the overnight batch fairly.">Since 6pm <span className="normal-case text-[10px] opacity-70">yesterday</span></div>
          <div>Lead Types</div>
          {!hideSources && <div>Sources they handle</div>}
          <div className="text-right">Actions</div>
        </div>
        )}

        {/* Filter transparency — never let an agent silently vanish because a

            team/mode chip is set. Shows exactly who is hidden and offers a reset. */}
        {!isTeamScoped && (() => {
          const shown = new Set(
            visibleAgents
              .filter(a => {
                if (modeFilter === 'all') return true;
                const m = (capByAgent.get(a.id)?.assignment_mode ?? 'round_robin') as 'round_robin' | 'open_pool';
                return m === modeFilter;
              })
              .map(a => a.id)
          );
          const hidden = salesAgents.filter(a => !shown.has(a.id));
          if (hidden.length === 0) return null;
          const names = hidden
            .map(a => `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email)
            .join(', ');
          return (
            <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center gap-2 text-xs text-amber-900">
              <span>
                <strong>{hidden.length} agent{hidden.length === 1 ? '' : 's'} hidden by the filters above:</strong> {names}
              </span>
              <button
                type="button"
                onClick={() => { setTeamFilter('__all__'); setModeFilter('all'); }}
                className="ml-auto rounded-md border border-amber-400 bg-white px-2 py-1 font-semibold text-amber-900 hover:bg-amber-100"
              >
                Show all agents
              </button>
            </div>
          );
        })()}

        {showAgentSettings && (
        <div className="divide-y divide-border">


          {visibleAgents
            .filter(a => {
              if (modeFilter === 'all') return true;
              const m = (capByAgent.get(a.id)?.assignment_mode ?? 'round_robin') as 'round_robin' | 'open_pool';
              return m === modeFilter;
            })
            .map(a => {
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
                className={`grid grid-cols-1 ${hideSources ? 'md:grid-cols-[1.4fr_130px_110px_90px_90px_90px_1.2fr_56px]' : 'md:grid-cols-[1.4fr_130px_110px_90px_90px_90px_1.2fr_1.6fr_56px]'} gap-3 px-5 py-3 items-center hover:bg-muted/20 transition-colors`}
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
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold truncate">{displayName}</div>
                      {(capByAgent.get(a.id)?.assignment_mode ?? 'round_robin') === 'open_pool' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0" title="Open Round Robin">
                          ORR
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0" title="Round Robin">
                          RR
                        </span>
                      )}
                    </div>
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

                {/* Assignment mode: Round Robin vs Open Round Robin — NEW LEADS ONLY.
                    Mutually exclusive: Open Round Robin means standard round-robin auto-assignment is OFF. */}
                {(() => {
                  const mode = (capByAgent.get(a.id)?.assignment_mode ?? 'round_robin') as 'round_robin' | 'open_pool';
                  const isOpenPool = mode === 'open_pool';
                  return (
                    <div className="flex flex-col gap-1">
                      <div
                        role="group"
                        aria-label="Assignment mode for New Leads"
                        className={`inline-flex rounded-md border ${isOpenPool && receiving ? 'border-emerald-300' : 'border-input'} bg-background p-0.5 text-xs font-medium`}
                        title={'Round Robin = leads sent instantly, one each, in order. Open Round Robin = leads pile up in a pool; agent grabs with Take Next Lead.'}
                      >
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setAssignmentMode(a.id, 'round_robin', displayName)}
                          className={`px-2 py-1 rounded-sm transition-colors ${
                            mode === 'round_robin'
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title="Round Robin — every new lead is sent to them instantly, one each, in order. No pile-up."
                        >
                          Round Robin
                        </button>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setAssignmentMode(a.id, 'open_pool', displayName)}
                          className={`px-2 py-1 rounded-sm transition-colors ${
                            mode === 'open_pool'
                              ? 'bg-emerald-600 text-white'
                              : 'text-muted-foreground hover:text-foreground'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title="Open Round Robin — leads pile up in a shared pool. Agent grabs them with Take Next Lead. Nothing is auto-sent."
                        >
                          Open Round Robin
                        </button>
                      </div>
                      <span className={`text-[10px] leading-tight ${isOpenPool && receiving ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}`}>
                        {!receiving
                          ? `Turn "Getting leads?" On to activate`
                          : isOpenPool
                            ? 'Leads pile up in pool · grab with Take Next Lead'
                            : 'Leads sent instantly · one each, in order'}
                      </span>

                      {/* Round-robin only: arrows (tiebreaker order) + Skip next (bypass once) */}
                      {mode === 'round_robin' && receiving && canEdit && (() => {
                        const rrOrdered = visibleAgents
                          .filter(x => (capByAgent.get(x.id)?.assignment_mode ?? 'round_robin') === 'round_robin')
                          .sort((x, y) => {
                            const sx = capByAgent.get(x.id)?.sort_order ?? 9999;
                            const sy = capByAgent.get(y.id)?.sort_order ?? 9999;
                            if (sx !== sy) return sx - sy;
                            return x.id.localeCompare(y.id);
                          });
                        const idx = rrOrdered.findIndex(x => x.id === a.id);
                        const canUp = idx > 0;
                        const canDown = idx >= 0 && idx < rrOrdered.length - 1;
                        return (
                          <div className="flex flex-col gap-1 mt-1">
                            <div className="flex items-center gap-1">
                              <div className="inline-flex rounded-md border border-input bg-background overflow-hidden" title="Move this agent up or down in the round-robin order. Order only decides who goes first when two agents are tied (e.g. after Reset counters, or brand-new agents). It does not force one agent to get more leads long-term.">
                                <button
                                  type="button"
                                  disabled={!canUp}
                                  onClick={() => moveAgent(a.id, 'up')}
                                  className="p-1 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                                  aria-label="Move up in rotation order"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={!canDown}
                                  onClick={() => moveAgent(a.id, 'down')}
                                  className="p-1 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed border-l border-input"
                                  aria-label="Move down in rotation order"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              {idx >= 0 && (
                                <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                              )}
                              <button
                                type="button"
                                onClick={() => skipNext(a.id, displayName)}
                                className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md border border-input bg-background text-[10px] font-medium hover:bg-muted"
                                title={`Skip ${displayName} in the next rotation. Pushes them to the back of the queue so other agents catch up. Their turn comes round again naturally — nothing else changes.`}
                              >
                                <SkipForward className="h-3 w-3" />
                                Skip next
                              </button>
                            </div>
                            <span className="text-[10px] text-muted-foreground">Lets other agents get the next turn.</span>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}



                {/* Slice % column removed — daily cap is the single source of truth for how many leads an agent gets */}



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
                          title={isUnlimited ? 'No cap on NEW leads (unlimited). Recontact & Renewals are picked from lists and never capped.' : `Stops receiving NEW leads after ${displayValue} today. Recontact & Renewals are unaffected — agents pull those from lists themselves.`}
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
                    <div className="flex items-center gap-1">
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
                      {canEdit && cap?.id && (count > 0 || (cap.assigned_today ?? 0) > 0) && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`Reset "New leads today" to 0 for ${displayName}? This clears the daily counter so they immediately start receiving leads again (until their cap of ${uncapped ? '∞' : capValue}).`)) return;
                            const { error } = await supabase
                              .from('agent_distribution_caps')
                              .update({ assigned_today: 0, last_assigned_at: null } as any)
                              .eq('id', cap.id);
                            if (error) return toast({ title: 'Reset failed', description: error.message, variant: 'destructive' });
                            await Promise.all([loadAll(), fetchTodayLeadCounts()]);
                            toast({ title: 'Counter reset ✓', description: `${displayName}'s daily counter is back to 0.` });
                          }}
                          title={`Reset ${displayName}'s "New leads today" counter to 0`}
                          className="p-1 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );

                })()}

                {/* Leads received since 6pm yesterday — helps managers distribute the overnight batch fairly */}
                {(() => {
                  const count = since6pmCounts[a.id] || 0;
                  const tone = count > 0
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-muted/40 text-muted-foreground border-border';
                  return (
                    <div
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${tone}`}
                      title={`${displayName} has been assigned ${count} lead${count === 1 ? '' : 's'} since 6:00 pm yesterday (London time).`}
                    >
                      <Sunrise className="h-3.5 w-3.5" />
                      <span className="text-sm font-semibold tabular-nums leading-none">{count}</span>
                    </div>
                  );
                })()}

                {/* Lead Types — New Leads is editable here; Recontact/Renewals
                    are read-only reflections (edit them in the dedicated panels above). */}
                <div className="flex flex-wrap gap-1.5">
                  {WORKSTREAMS.map(w => {
                    const on = m ? (m as any)[w.col] === true : false;
                    const teamColor = team?.color ?? '#64748b';
                    const isNewLeads = w.key === 'new_leads';
                    const editable = canEdit && !!m && isNewLeads && !isSalesLead ? true : false;
                    const managedElsewhere = !isNewLeads;
                    return (
                      <button
                        key={w.key}
                        type="button"
                        disabled={!editable}
                        onClick={editable ? () => toggleWorkstream(a.id, w.key) : undefined}
                        aria-pressed={on}
                        title={
                          !m
                            ? 'Pick a team first'
                            : managedElsewhere
                              ? `${w.label} access is managed in the "${w.key === 'recontact' ? 'Agent access to Recontact Leads' : 'Renewals'}" section above`
                              : (on ? 'Selected' : 'Not selected')
                        }
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border transition-colors ${
                          on
                            ? 'border-current text-white'
                            : 'border-border bg-background text-muted-foreground'
                        } ${editable ? 'cursor-pointer hover:border-foreground/30' : 'cursor-default opacity-70'}`}
                        style={on ? { backgroundColor: teamColor, borderColor: teamColor } : undefined}
                      >
                        {on && <Check className="h-3 w-3" />}
                        {w.label}
                        {managedElsewhere && <Lock className="h-2.5 w-2.5 opacity-70 ml-0.5" />}
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
                            const on = !!allowed && [s.key, ...s.aliases].some(k => allowed.includes(k));
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
                <div className="flex justify-end items-start gap-1.5">
                  {canEdit && (
                    <div className="flex flex-col items-end gap-0.5">
                      <PushOpenPoolControl
                        targetAdminId={a.id}
                        targetName={displayName}
                      />
                      <span className="text-[10px] text-muted-foreground">Manually send pool leads to this agent.</span>
                    </div>
                  )}
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
        )}

        {showAgentSettings && (
        <div className="px-5 py-3 border-t border-border bg-muted/40 text-muted-foreground flex items-center gap-2">

          <Info className="h-4 w-4 shrink-0" />
          <p className="text-xs">
            Round Robin: every new lead is sent instantly to the next agent — one each, in order, no pile-up. Open Round Robin: leads sit in a pool for agents to grab. Each agent stops receiving new leads once they hit their daily cap.
          </p>
        </div>
        )}

      </section>
    </div>
  );
};

export default AllocationMatrix;
