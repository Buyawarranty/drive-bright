import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, RefreshCw, Users, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fairFillShares } from '@/lib/fairFillShares';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';

/**
 * Live Open Pool banner for managers. Shows the current unclaimed pool count,
 * lets a manager auto-distribute leads to active round-robin / open-pool agents
 * according to their remaining daily caps, and offers manual reallocation.
 */

interface AgentOption {
  admin_user_id: string;
  name: string;
  mode: 'round_robin' | 'open_pool' | null;
  paused: boolean;
  daily_cap: number | null;
  assigned_today: number;
  remaining: number;
}

interface AgentActualCount {
  assigned_today: number;
}

const THRESHOLD = 20;
const REASSIGN_WINDOW_MINUTES = 60 * 24 * 90; // 90 days
const AUTO_SWEEP_KEY = 'open_pool_auto_distribute';
const AUTO_SWEEP_INTERVAL_MS = 30_000;

interface Props {
  canEdit: boolean;
  admins: Array<{ id: string; first_name: string | null; last_name: string | null; email: string }>;
  caps: Array<{
    admin_user_id: string;
    paused: boolean;
    assignment_mode?: 'round_robin' | 'open_pool' | null;
    daily_cap?: number | null;
    assigned_today?: number | null;
  }>;
}


export const OpenPoolBacklogBanner = ({ canEdit, admins, caps }: Props) => {
  const [poolCount, setPoolCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [targetAgentId, setTargetAgentId] = useState<string>('');
  const [countToMove, setCountToMove] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [autoDistribute, setAutoDistribute] = useState<boolean>(false);
  const [autoLoading, setAutoLoading] = useState<boolean>(false);
  const [sweeping, setSweeping] = useState<boolean>(false);
  const [lastSweep, setLastSweep] = useState<{ at: number; assigned: number; agents: number } | null>(null);
  const [agentCounts, setAgentCounts] = useState<Record<string, AgentActualCount>>({});
  const sweepingRef = useRef<boolean>(false);

  const loadCount = useCallback(async () => {
    setLoading(true);
    // Open Pool = ONLY genuinely never-contacted leads (status = 'new')
    // with no owner and no assignment. Anything past 'new' belongs to the
    // agent who moved it there and must never sit in the pool.
    const { count } = await (supabase as any)
      .from('sales_leads')
      .select('id', { count: 'exact', head: true })
      .eq('queue', 'live_open_pool')
      .is('assigned_to', null)
      .is('owner_agent', null)
      .eq('status', 'new');
    setPoolCount(count ?? 0);
    setLoading(false);
  }, []);

  const loadAgentCounts = useCallback(async () => {
    const activeAgentIds = caps
      .filter(c => !c.paused && (c.assignment_mode === 'round_robin' || c.assignment_mode === 'open_pool'))
      .map(c => c.admin_user_id);
    if (activeAgentIds.length === 0) {
      setAgentCounts({});
      return;
    }
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString();
    const { data, error } = await (supabase as any)
      .from('sales_leads')
      .select('assigned_to')
      .not('assigned_to', 'is', null)
      .gte('assigned_at', todayStart)
      .in('assigned_to', activeAgentIds);
    if (error) {
      console.error('[OpenPoolBacklogBanner] loadAgentCounts failed:', error);
      return;
    }
    const counts: Record<string, AgentActualCount> = {};
    (data || []).forEach((lead: any) => {
      const id = lead.assigned_to;
      if (!id) return;
      counts[id] = { assigned_today: (counts[id]?.assigned_today ?? 0) + 1 };
    });
    // Ensure every known agent has an entry so the UI never shows stale numbers.
    activeAgentIds.forEach(id => {
      if (!counts[id]) counts[id] = { assigned_today: 0 };
    });
    setAgentCounts(counts);
  }, [caps]);

  const loadRows = useCallback(async () => {
    setRowsLoading(true);
    const { data } = await (supabase as any)
      .from('sales_leads')
      .select('id, first_name, last_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, lead_source, status, call_count, last_contacted_at, last_activity_date, created_at, notes, quote_amount, cart_value, pool_recycle_count')
      .eq('queue', 'live_open_pool')
      .is('assigned_to', null)
      .is('owner_agent', null)
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(500);


    const baseRows = data || [];
    const normalize = (s: string | null | undefined) => (s || '').replace(/\D/g, '').replace(/^0+/, '');
    const leadIds = baseRows.map((r: any) => r.id);
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString();

    const [zoiperRes, phoneEvRes, callLogRes, quickNoteRes] = await Promise.all([
      (supabase as any)
        .from('zoiper_call_events')
        .select('dialed_number, started_at, talk_seconds, status, agent_email')
        .gte('started_at', since)
        .limit(5000),
      (supabase as any)
        .from('phone_events')
        .select('phone_number, event_type, selected_outcome, agent_name, created_at')
        .gte('created_at', since)
        .limit(5000),
      leadIds.length
        ? (supabase as any)
            .from('lead_call_logs')
            .select('lead_id, outcome, notes, agent_name, created_at')
            .in('lead_id', leadIds)
        : Promise.resolve({ data: [] }),
      leadIds.length
        ? (supabase as any)
            .from('lead_quick_notes')
            .select('lead_id, note, author_name, created_at')
            .in('lead_id', leadIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const zoiperByPhone: Record<string, any[]> = {};
    (zoiperRes.data || []).forEach((z: any) => {
      const k = normalize(z.dialed_number);
      if (k) (zoiperByPhone[k] ||= []).push(z);
    });
    const phoneEvByPhone: Record<string, any[]> = {};
    (phoneEvRes.data || []).forEach((p: any) => {
      const k = normalize(p.phone_number);
      if (k) (phoneEvByPhone[k] ||= []).push(p);
    });
    const callLogsByLead: Record<string, any[]> = {};
    (callLogRes.data || []).forEach((c: any) => {
      (callLogsByLead[c.lead_id] ||= []).push(c);
    });
    const quickNotesByLead: Record<string, any[]> = {};
    (quickNoteRes.data || []).forEach((n: any) => {
      (quickNotesByLead[n.lead_id] ||= []).push(n);
    });

    const matchPhone = (leadKey: string, bucket: Record<string, any[]>) => {
      if (!leadKey) return [];
      const hits: any[] = [];
      for (const k of Object.keys(bucket)) {
        if (k === leadKey || k.endsWith(leadKey) || leadKey.endsWith(k)) hits.push(...bucket[k]);
      }
      return hits;
    };

    const enriched = baseRows.map((r: any) => {
      const key = normalize(r.phone);
      const zs = matchPhone(key, zoiperByPhone);
      const talked = zs.filter(z => (z.talk_seconds ?? 0) > 0);
      const lastZ = zs.reduce((m: any, z: any) => (!m || new Date(z.started_at) > new Date(m.started_at) ? z : m), null);
      const pes = matchPhone(key, phoneEvByPhone);
      const cls = callLogsByLead[r.id] || [];
      const qns = quickNotesByLead[r.id] || [];
      const agentNoteParts = [
        ...qns.map((n: any) => `${n.author_name || 'Agent'}: ${n.note}`),
        ...cls.filter((c: any) => c.notes).map((c: any) => `${c.agent_name || 'Agent'} (${c.outcome}): ${c.notes}`),
      ];
      return {
        ...r,
        _zoiperCalls: zs.length,
        _zoiperTalked: talked.length,
        _lastZoiperAt: lastZ?.started_at || null,
        _phoneEvents: pes.length,
        _callLogs: cls.length,
        _agentNotes: agentNoteParts.join(' • '),
      };
    });

    setRows(enriched);
    setRowsLoading(false);
  }, []);

  useEffect(() => {
    loadCount();
    loadAgentCounts();
    const t = setInterval(loadCount, 30_000);
    const t2 = setInterval(loadAgentCounts, 30_000);
    return () => {
      clearInterval(t);
      clearInterval(t2);
    };
  }, [loadCount, loadAgentCounts]);

  useEffect(() => {
    if (expanded) loadRows();
  }, [expanded, loadRows, poolCount]);

  // Realtime — refresh whenever a pool row moves.
  useEffect(() => {
    const ch = supabase
      .channel('open-pool-backlog-banner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_leads', filter: 'queue=eq.live_open_pool' },
        () => loadCount(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadCount]);

  const agentOptions = useMemo<AgentOption[]>(() => {
    const byId = new Map(admins.map(a => [a.id, a]));
    return caps
      .filter(c => !c.paused && (c.assignment_mode === 'round_robin' || c.assignment_mode === 'open_pool'))
      .map(c => {
        const a = byId.get(c.admin_user_id);
        const name = a ? ([a.first_name, a.last_name].filter(Boolean).join(' ') || a.email) : 'Unknown agent';
        const daily_cap = (c.daily_cap ?? null) as number | null;
        // Always source today's count from live sales_leads.assigned_at (UTC midnight).
        // Never fall back to agent_distribution_caps.assigned_today — that column is a
        // stored counter that isn't guaranteed to reset at midnight, so falling back to
        // it makes yesterday's totals look like today's ("Thomas 32/30 today" bug).
        const assigned_today = agentCounts[c.admin_user_id]?.assigned_today ?? 0;
        const remaining = daily_cap == null ? Number.POSITIVE_INFINITY : Math.max(0, daily_cap - assigned_today);
        return {
          admin_user_id: c.admin_user_id,
          name,
          mode: (c.assignment_mode ?? null) as AgentOption['mode'],
          paused: c.paused,
          daily_cap,
          assigned_today,
          remaining,
        };
      })
      .filter(o => !!byId.get(o.admin_user_id))
      .sort((a, b) => {
        if (a.mode !== b.mode) return a.mode === 'round_robin' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [admins, caps, agentCounts]);


  const openDialog = () => {
    setCountToMove(poolCount);
    setTargetAgentId(agentOptions[0]?.admin_user_id ?? '');
    setOpen(true);
  };

  const reassign = async () => {
    if (!targetAgentId || countToMove <= 0) return;
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc('open_pool_bulk_assign_to_agent', {
        _target_admin_id: targetAgentId,
        _count: countToMove,
        _window_minutes: REASSIGN_WINDOW_MINUTES,
      });
      if (error) throw error;
      const assigned = Array.isArray(data) ? (data[0]?.assigned_count ?? 0) : 0;
      const target = agentOptions.find(a => a.admin_user_id === targetAgentId);
      toast({
        title: 'Leads reassigned',
        description: `${assigned} lead${assigned === 1 ? '' : 's'} moved to ${target?.name ?? 'agent'}.`,
      });
      setOpen(false);
      loadCount();
      loadAgentCounts();
    } catch (e: any) {
      toast({
        title: 'Reassignment failed',
        description: e?.message ?? 'Could not reassign pool leads.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Auto-distribute -----------------------------------------------------

  const totalRemaining = useMemo(
    () => agentOptions.reduce((s, a) => s + (Number.isFinite(a.remaining) ? a.remaining : 0), 0),
    [agentOptions],
  );

  const loadAutoDistribute = useCallback(async () => {
    setAutoLoading(true);
    const { data } = await (supabase as any)
      .from('admin_config')
      .select('config_value')
      .eq('config_key', AUTO_SWEEP_KEY)
      .maybeSingle();
    setAutoDistribute(!!data?.config_value);
    setAutoLoading(false);
  }, []);

  useEffect(() => { loadAutoDistribute(); }, [loadAutoDistribute]);

  const toggleAutoDistribute = useCallback(async (next: boolean) => {
    setAutoDistribute(next); // optimistic
    const { error } = await (supabase as any)
      .from('admin_config')
      .upsert({ config_key: AUTO_SWEEP_KEY, config_value: next, updated_at: new Date().toISOString() }, { onConflict: 'config_key' });
    if (error) {
      setAutoDistribute(!next);
      toast({ title: 'Could not update setting', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: next ? 'Auto-distribute enabled' : 'Auto-distribute disabled',
      description: next
        ? 'Open Pool leads are handed to active agents automatically — Round Robin is unaffected.'
        : 'Open Pool leads will pile up until you hand them out. Round Robin still works normally.',
    });
  }, []);

  const runAutoSweep = useCallback(async (opts?: { silent?: boolean }) => {
    if (sweepingRef.current) return;
    if (!agentOptions.length) return;
    if (poolCount <= 0) return;
    sweepingRef.current = true;
    setSweeping(true);
    try {
      // Fair fill: hand out one lead at a time to whoever has the fewest today.
      const weights = agentOptions.map(a => ({
        id: a.admin_user_id,
        name: a.name,
        usedToday: a.assigned_today ?? 0,
        remaining: Number.isFinite(a.remaining) ? a.remaining : 1000,
      })).filter(a => a.remaining > 0);
      if (!weights.length) {
        if (!opts?.silent) toast({ title: 'No capacity', description: 'Every eligible agent has hit their daily cap.', variant: 'destructive' });
        return;
      }

      const shares = fairFillShares(weights, poolCount);

      let totalAssigned = 0;
      let agentsUsed = 0;
      for (const a of weights) {
        const share = shares[a.id] ?? 0;
        if (share <= 0) continue;
        const { data, error } = await (supabase as any).rpc('open_pool_bulk_assign_to_agent', {
          _target_admin_id: a.id,
          _count: share,
          _window_minutes: REASSIGN_WINDOW_MINUTES,
        });
        if (error) {
          console.error('[auto-sweep] rpc failed for', a.name, error);
          continue;
        }
        const n = Array.isArray(data) ? (data[0]?.assigned_count ?? 0) : 0;
        totalAssigned += n;
        if (n > 0) agentsUsed += 1;
      }


      setLastSweep({ at: Date.now(), assigned: totalAssigned, agents: agentsUsed });
      if (!opts?.silent && totalAssigned > 0) {
        toast({
          title: 'Leads distributed',
          description: `${totalAssigned} lead${totalAssigned === 1 ? '' : 's'} handed to ${agentsUsed} agent${agentsUsed === 1 ? '' : 's'}.`,
        });
      }
      loadCount();
      loadAgentCounts();
      if (expanded) loadRows();
    } catch (e: any) {
      if (!opts?.silent) toast({ title: 'Auto-distribute failed', description: e?.message ?? 'Sweep error.', variant: 'destructive' });
    } finally {
      sweepingRef.current = false;
      setSweeping(false);
    }
  }, [agentOptions, poolCount, expanded, loadCount, loadAgentCounts, loadRows]);

  // Background auto-sweep is handled globally by <GlobalAutoDistributeBar />
  // so it keeps running on every admin page, not only when this banner is
  // mounted. We deliberately do NOT start a second interval here to avoid
  // two sweepers racing on the same pool.

  if (!canEdit) return null;
  if (poolCount <= 0 && !autoDistribute) return null;

  const critical = poolCount >= THRESHOLD;
  const shellClass = critical
    ? 'rounded-lg border-2 border-amber-500 bg-amber-50 shadow-sm'
    : 'rounded-lg border-2 border-sky-400 bg-sky-50 shadow-sm';
  const iconClass = critical ? 'text-amber-600' : 'text-sky-600';
  const headingClass = critical ? 'text-amber-900' : 'text-sky-900';
  const badgeClass = critical
    ? 'text-amber-700 bg-amber-200'
    : 'text-sky-700 bg-sky-200';
  const bodyClass = critical ? 'text-amber-900/90' : 'text-sky-900/90';
  const btnBorderClass = critical ? 'border-amber-300 hover:bg-amber-100' : 'border-sky-300 hover:bg-sky-100';
  const primaryBtnClass = critical ? 'bg-amber-600 hover:bg-amber-700' : 'bg-sky-600 hover:bg-sky-700';

  const fmt = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  const fmtCap = (n: number) => (Number.isFinite(n) ? String(n) : '∞');

  return (
    <>
      <div className={shellClass}>
        <div className="p-4 flex items-start gap-3">
          <div className="mt-0.5">
            <AlertTriangle className={`h-6 w-6 ${iconClass}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-base font-bold ${headingClass}`}>
                {poolCount} never-contacted lead{poolCount === 1 ? '' : 's'} waiting in the Open Pool
              </h3>
              <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${badgeClass}`}>
                {critical ? 'Action needed' : 'Live'}
              </span>
              {autoDistribute && (
                <span className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Auto-distribute ON
                </span>
              )}
            </div>
            <p className={`text-sm mt-1 ${bodyClass}`}>
              <strong>Open Pool = status "new" only</strong> (never spoken to, no owner). The moment an agent moves a lead to <em>contacted / quote sent / follow up</em> it becomes theirs and leaves the pool — it can never come back here.{' '}
              {autoDistribute
                ? `Sweeping every ${Math.round(AUTO_SWEEP_INTERVAL_MS / 1000)}s and round-robining them to active agents by remaining daily cap. Each lead is locked and stamped to one agent only — never handed out twice.`
                : 'Turn on Auto-distribute to round-robin these leads to active agents automatically, respecting each agent\u2019s daily cap. Each lead is locked so it can only go to one agent.'}


              {' '}Total remaining capacity across active agents: <strong>{fmtCap(totalRemaining)}</strong>.
              {lastSweep && (
                <>
                  {' · Last sweep: '}
                  <strong>{lastSweep.assigned}</strong> lead{lastSweep.assigned === 1 ? '' : 's'} to <strong>{lastSweep.agents}</strong> agent{lastSweep.agents === 1 ? '' : 's'} at {new Date(lastSweep.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.
                </>
              )}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-foreground bg-white/80 border border-border rounded-full px-3 py-1.5 cursor-pointer">
              <Zap className={`h-3.5 w-3.5 ${autoDistribute ? 'text-emerald-600' : 'text-muted-foreground'}`} />
              Auto-distribute
              <Switch
                checked={autoDistribute}
                disabled={autoLoading}
                onCheckedChange={toggleAutoDistribute}
              />
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded(v => !v)}
                className={`h-9 bg-white gap-1 ${btnBorderClass}`}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {expanded ? 'Hide leads' : 'View all leads'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { loadCount(); if (expanded) loadRows(); }}
                disabled={loading}
                className={`h-9 bg-white ${btnBorderClass}`}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runAutoSweep()}
                disabled={sweeping || poolCount === 0 || agentOptions.length === 0}
                className="h-9 bg-white border-emerald-300 hover:bg-emerald-50 text-emerald-800 gap-1"
              >
                {sweeping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Distribute now
              </Button>
              <Button
                size="sm"
                onClick={openDialog}
                className={`h-9 text-white gap-2 ${primaryBtnClass}`}
              >
                <Users className="h-4 w-4" /> Reallocate leads
              </Button>
            </div>
          </div>
        </div>

        {agentOptions.length > 0 && (
          <div className="px-4 pb-3 -mt-1">
            <p className={`text-[11px] font-medium mb-1.5 ${bodyClass}`}>
              Active agents · assigned today / daily cap · remaining:
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {agentOptions.map(a => {
                const cap = fmtCap(a.daily_cap ?? Number.POSITIVE_INFINITY);
                const full = Number.isFinite(a.remaining) && a.remaining === 0;
                const modeLabel = a.mode === 'round_robin' ? 'Round Robin' : 'Open Pool';
                return (
                  <span
                    key={a.admin_user_id}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border ${full ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-border text-foreground'}`}
                    title={`${modeLabel} agent · ${a.assigned_today} assigned today · cap ${cap} · ${fmtCap(a.remaining)} remaining`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${a.mode === 'round_robin' ? 'bg-indigo-500' : 'bg-teal-500'}`} />
                    {a.name}
                    <span className="text-muted-foreground">·</span>
                    {a.assigned_today}/{cap} today
                    <span className="text-muted-foreground">·</span>
                    {fmtCap(a.remaining)} left
                    {full && <span className="font-semibold">· full</span>}
                  </span>
                );
              })}
            </div>
          </div>
        )}


        {expanded && (
          <div className="border-t border-amber-300 bg-white rounded-b-lg">
            {rowsLoading ? (
              <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading pool leads…
              </div>
            ) : rows.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No leads to display.</div>
            ) : (
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-amber-100/70 sticky top-0 z-10">
                    <tr className="text-left text-amber-900">
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Phone</th>
                      <th className="px-3 py-2 font-semibold">Vehicle</th>
                      <th className="px-3 py-2 font-semibold">Source</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold text-center" title="Zoiper calls / talked (last 60 days)">Rung?</th>
                      <th className="px-3 py-2 font-semibold">Last Zoiper call</th>
                      <th className="px-3 py-2 font-semibold text-center">Calls</th>
                      <th className="px-3 py-2 font-semibold text-center">Recycles</th>
                      <th className="px-3 py-2 font-semibold">Last contact</th>
                      <th className="px-3 py-2 font-semibold">Last activity</th>
                      <th className="px-3 py-2 font-semibold">Created</th>
                      <th className="px-3 py-2 font-semibold text-right">Quote</th>
                      <th className="px-3 py-2 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || '—';
                      const vehicle = [r.vehicle_reg, [r.vehicle_make, r.vehicle_model].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || '—';
                      const quote = r.quote_amount ?? r.cart_value;
                      const rung = r._zoiperCalls > 0;
                      const spoke = r._zoiperTalked > 0;
                      const combinedNotes = [r.notes, r._agentNotes].filter(Boolean).join(' • ');
                      return (
                        <tr key={r.id} className={i % 2 ? 'bg-amber-50/40' : 'bg-white'}>
                          <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{name}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.email || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.phone || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{vehicle}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.lead_source || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.status || '—'}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            {rung ? (
                              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold ${spoke ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>
                                {spoke ? '✅ Spoke' : '📞 Tried'} · {r._zoiperCalls}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Never</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmt(r._lastZoiperAt)}</td>
                          <td className="px-3 py-2 text-center">{r.call_count ?? 0}</td>
                          <td className="px-3 py-2 text-center">{r.pool_recycle_count ?? 0}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmt(r.last_contacted_at)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmt(r.last_activity_date)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmt(r.created_at)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{quote != null ? `£${Number(quote).toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-2 max-w-xs truncate" title={combinedNotes || ''}>{combinedNotes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-3 py-2 text-xs text-muted-foreground border-t border-amber-200">
                  Showing {rows.length} of {poolCount} pool lead{poolCount === 1 ? '' : 's'}{rows.length >= 500 ? ' (capped at 500)' : ''}.
                </div>
              </div>
            )}
          </div>
        )}
      </div>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reallocate Open Pool leads</DialogTitle>
            <DialogDescription>
              Move unclaimed pool leads directly to an agent. Round-robin agents get them as normal assignments; open-pool agents receive them as personal reservations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Target agent</label>
              <Select value={targetAgentId} onValueChange={setTargetAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agentOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No active round-robin or open-pool agents found.
                    </div>
                  ) : (
                    agentOptions.map(a => (
                      <SelectItem key={a.admin_user_id} value={a.admin_user_id}>
                        {a.name} · {a.mode === 'round_robin' ? 'Round Robin' : 'Open Pool'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">How many leads?</label>
              <Input
                type="number"
                min={1}
                max={poolCount}
                value={countToMove}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(poolCount, Number(e.target.value) || 0));
                  setCountToMove(n);
                }}
              />
              <p className="text-xs text-muted-foreground">
                {poolCount} lead{poolCount === 1 ? '' : 's'} available in the pool.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={reassign} disabled={submitting || !targetAgentId || countToMove <= 0}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Reassigning…</>
              ) : (
                <>Move {countToMove} lead{countToMove === 1 ? '' : 's'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OpenPoolBacklogBanner;
