import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Target, Repeat, X, Plus } from 'lucide-react';
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

interface Cap {
  id: string;
  admin_user_id: string;
  percentage: number;
  paused: boolean;
}

interface AdminUserLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

type Workstream = 'new_leads' | 'recontact' | 'renewals';

const WORKSTREAMS: { key: Workstream; col: keyof Member; short: string }[] = [
  { key: 'new_leads', col: 'workstream_new_leads', short: 'New' },
  { key: 'recontact', col: 'workstream_recontact', short: 'Recontact' },
  { key: 'renewals',  col: 'workstream_renewals',  short: 'Renewals' },
];

interface Props {
  canEdit: boolean;
}

export const AllocationMatrix = ({ canEdit }: Props) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [caps, setCaps] = useState<Cap[]>([]);
  const [admins, setAdmins] = useState<AdminUserLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingShare, setPendingShare] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [t, m, a, c] = await Promise.all([
        supabase.from('lead_teams').select('id, name, color, emoji').order('sort_order'),
        supabase.from('lead_team_members').select('id, team_id, admin_user_id, workstream_new_leads, workstream_recontact, workstream_renewals'),
        supabase.from('admin_users').select('id, first_name, last_name, email, role').eq('is_active', true).order('first_name'),
        supabase.from('agent_distribution_caps').select('id, admin_user_id, percentage, paused'),
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

  const totalShare = useMemo(() => {
    return salesAgents.reduce((sum, a) => {
      const cap = capByAgent.get(a.id);
      if (!cap || cap.paused) return sum;
      return sum + (cap.percentage || 0);
    }, 0);
  }, [salesAgents, capByAgent]);

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
      toast({ title: 'Assign team first', description: 'Pick a team before changing workstreams.' });
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
      .select()
      .single();
    if (error) {
      toast({ title: 'Could not create allocation row', description: error.message, variant: 'destructive' });
      return null;
    }
    const cap = data as Cap;
    setCaps(prev => [...prev, cap]);
    return cap;
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
    const active = salesAgents.filter(a => {
      const cap = capByAgent.get(a.id);
      return cap && !cap.paused;
    });
    if (!active.length) {
      toast({ title: 'No active agents', description: 'Turn at least one agent on first.' });
      return;
    }
    const share = Math.floor(100 / active.length);
    const remainder = 100 - share * active.length;
    let i = 0;
    for (const a of active) {
      const value = share + (i < remainder ? 1 : 0);
      const cap = capByAgent.get(a.id)!;
      const { error } = await supabase
        .from('agent_distribution_caps')
        .update({ percentage: value } as any)
        .eq('id', cap.id);
      if (error) {
        toast({ title: 'Even split failed', description: error.message, variant: 'destructive' });
        return;
      }
      i++;
    }
    toast({ title: 'Shares evened', description: `${share}% across ${active.length} agents` });
    loadAll();
  };

  // --- render ---

  const totalColor =
    totalShare === 100 ? 'bg-emerald-600 text-white' :
    totalShare === 0   ? 'bg-muted text-foreground' :
                         'bg-amber-500 text-white';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground max-w-2xl">
          One row per agent. Set their team tag, turn lead receiving on/off, and weight how big a share they get. Team tag is just a colour label for filters and reports.
        </p>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={evenSplit}
              className="h-8 rounded-none border-2 border-foreground font-semibold uppercase text-xs"
            >
              Even split
            </Button>
          )}
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
      </div>

      <div className="border-2 border-foreground bg-background">
        {/* Header */}
        <div className="hidden md:grid grid-cols-[1.6fr_140px_90px_110px_1fr] gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted border-b-2 border-foreground">
          <div>Agent</div>
          <div>Team tag</div>
          <div className="text-center">Receiving</div>
          <div className="text-center">Share %</div>
          <div>Workstreams</div>
        </div>

        <div className="divide-y-2 divide-foreground/10">
          {salesAgents.map(a => {
            const m = memberByAgent.get(a.id);
            const cap = capByAgent.get(a.id);
            const team = m ? teams.find(t => t.id === m.team_id) : null;
            const receiving = !!cap && !cap.paused;
            const sharePending = pendingShare[a.id];
            const shareValue = sharePending !== undefined ? sharePending : String(cap?.percentage ?? 0);
            const initials = (`${a.first_name?.[0] ?? ''}${a.last_name?.[0] ?? ''}`.toUpperCase() || a.email[0].toUpperCase());
            return (
              <div
                key={a.id}
                className="grid grid-cols-1 md:grid-cols-[1.6fr_140px_90px_110px_1fr] gap-2 px-3 py-2.5 items-center hover:bg-muted/30"
              >
                {/* Agent */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="h-9 w-9 shrink-0 flex items-center justify-center text-white text-xs font-bold border-2 border-foreground"
                    style={{ backgroundColor: team?.color ?? 'hsl(var(--muted-foreground))' }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {`${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{a.email} · {a.role}</div>
                  </div>
                </div>

                {/* Team tag dropdown */}
                <Select
                  value={team?.id ?? '__none__'}
                  onValueChange={(v) => setTeamTag(a.id, v === '__none__' ? null : v)}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-8 rounded-none border-2 border-foreground/70 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs">— No team —</SelectItem>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.emoji} {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Receiving toggle */}
                <div className="flex md:justify-center">
                  <button
                    disabled={!canEdit}
                    onClick={() => setReceiving(a.id, !receiving)}
                    className={`inline-flex items-center justify-center min-w-[64px] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide border-2 transition-colors ${
                      receiving
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background text-muted-foreground border-muted hover:border-foreground/40'
                    } ${canEdit ? '' : 'opacity-60 cursor-not-allowed'}`}
                  >
                    {receiving ? 'On' : 'Off'}
                  </button>
                </div>

                {/* Share % */}
                <div className="flex md:justify-center">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={!canEdit}
                    value={shareValue}
                    onChange={(e) => setPendingShare(s => ({ ...s, [a.id]: e.target.value }))}
                    onBlur={(e) => commitShare(a.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="h-8 w-[72px] text-center border-2 border-foreground/70 bg-background text-sm font-semibold focus:outline-none focus:border-foreground"
                  />
                </div>

                {/* Workstreams */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {WORKSTREAMS.map(w => {
                    const on = m ? (m as any)[w.col] === true : false;
                    return (
                      <button
                        key={w.key}
                        disabled={!canEdit || !m}
                        onClick={() => toggleWorkstream(a.id, w.key)}
                        title={!m ? 'Pick a team first' : ''}
                        className={`inline-flex items-center justify-center px-2 py-1 text-[10px] font-bold uppercase tracking-wide border-2 transition-colors ${
                          on
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-background text-muted-foreground border-muted hover:border-foreground/40'
                        } ${canEdit && m ? '' : 'opacity-60 cursor-not-allowed'}`}
                      >
                        {w.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {salesAgents.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No active sales agents.
            </div>
          )}
        </div>

        {/* Footer total */}
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-t-2 border-foreground bg-muted">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Total share of active agents
          </span>
          <span className={`inline-flex items-center justify-center min-w-[64px] px-2.5 py-1 text-xs font-bold uppercase tracking-wide border-2 border-foreground ${totalColor}`}>
            {totalShare}%
          </span>
        </div>
      </div>

      {totalShare !== 100 && salesAgents.length > 0 && (
        <p className="text-[11px] text-amber-700 px-1">
          Total isn't 100% — round-robin still works, but new leads are weighted relative to whatever the shares add up to. Use Even split to balance.
        </p>
      )}
    </div>
  );
};

export default AllocationMatrix;
