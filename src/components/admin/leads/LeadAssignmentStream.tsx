import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAgentBadgeColor, getAgentColor } from '@/lib/agentColors';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';
import { useIsManagement } from '@/hooks/useIsManagement';

import { Lock, Phone, Radio, RefreshCw, StickyNote, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRepeatCustomers } from '@/hooks/useRepeatCustomers';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface StreamAgent {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
}

interface Props {
  agents: StreamAgent[];
  /** Optional team label per agent id (shown as a small caption). */
  teamNameByAgent?: Map<string, string>;
  /** When true, show an inline dropdown to reassign a lead to another agent. */
  canReassign?: boolean;
}

type RangeKey = 'since6pm' | 'today' | 'last24' | 'last7';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'since6pm', label: 'Since 6pm yesterday' },
  { key: 'today', label: 'Today' },
  { key: 'last24', label: 'Last 24 hours' },
  { key: 'last7', label: 'Last 7 days' },
];

function rangeStart(key: RangeKey): Date {
  const now = new Date();
  if (key === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (key === 'last24') return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (key === 'last7') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  // "Since 6pm yesterday" always means 18:00 on the previous calendar day, so the
  // window never resets to empty the moment the clock passes 18:00 today.
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

interface StreamRow {
  id: string;
  created_at: string;
  assigned_at: string | null;
  assigned_to: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  vehicle_reg: string | null;
  status: string | null;
  call_count: number | null;
  manual_call_adjustment: number | null;
  last_contacted_at: string | null;
  notes: string | null;
  manual_entry?: boolean | null;
  auto_tags?: string[] | null;
  queue?: string | null;
}

/** Plain-English answer to "why did this agent get this lead?" */
interface AssignReason {
  label: string;
  className: string;
  title: string;
}

const reasonFor = (r: StreamRow, auditType?: string | null, isRepeatCustomer = false): AssignReason | null => {
  const tags = (r.auto_tags ?? []).map(t => String(t).toLowerCase());
  const at = (auditType ?? '').toLowerCase();

  if (!r.assigned_to) {
    return {
      label: 'New lead',
      className: 'border-sky-300 bg-sky-50 text-sky-800',
      title: 'Brand new enquiry, not allocated yet — it goes to the next agent in the rotation.',
    };
  }

  if (r.manual_entry) {
    return {
      label: 'Manual',
      className: 'border-slate-300 bg-slate-100 text-slate-700',
      title: 'Added by hand by an agent — manual entries stay with whoever created them, they never go through the rotation.',
    };
  }
  if (isRepeatCustomer || at.includes('sticky') || at.includes('sibling') || at.includes('owner') || tags.includes('repeat_customer') || tags.includes('duplicate_customer')) {
    return {
      label: 'Repeat customer',
      className: 'border-emerald-300 bg-emerald-50 text-emerald-800',
      title: 'Same customer already sits with this agent (matched on email or phone), so the lead stuck with them instead of rotating.',
    };
  }
  if (at.includes('manual_reassign') || at.includes('bulk') || at.includes('manager') || at.includes('rebalance')) {
    return {
      label: 'Reassigned',
      className: 'border-blue-300 bg-blue-50 text-blue-800',
      title: 'A manager moved this lead by hand (reassign / rebalance). All notes, calls and history stayed with the lead.',
    };
  }
  if (at.includes('claim') || at.includes('shark') || at.includes('pool') || (r.queue ?? '').toLowerCase().includes('pool')) {
    return {
      label: 'Claimed',
      className: 'border-amber-300 bg-amber-50 text-amber-900',
      title: 'The agent claimed this lead themselves from the open pool, so it did not come out of the rotation.',
    };
  }
  return {
    label: 'Round robin',
    className: 'border-violet-300 bg-violet-50 text-violet-800',
    title: 'Handed out automatically by the single global rotation — one lead each, in turn, across every switched-on agent.',
  };
};


/** What the agent has actually done with the lead since it landed. */
interface LeadActivity {
  calls: number;
  notes: number;
  statusChanges: number;
  lastAt: string | null;
  /** Worked = agent has touched it, so it must not be reassigned. */
  worked: boolean;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

/** Time between the lead arriving and it being handed to an agent. */
const leadTime = (created: string, assigned: string | null): string | null => {
  if (!assigned) return null;
  const secs = Math.max(0, Math.round((new Date(assigned).getTime() - new Date(created).getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
};

const LeadAssignmentStream: React.FC<Props> = ({ agents, teamNameByAgent, canReassign = false }) => {
  const [range, setRange] = useState<RangeKey>('since6pm');
  const [rows, setRows] = useState<StreamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activity, setActivity] = useState<Map<string, LeadActivity>>(new Map());
  const [auditTypes, setAuditTypes] = useState<Map<string, string>>(new Map());
  const mounted = useRef(true);

  const allAdminUsers = useAllAdminUsersMap(rows.map(r => r.assigned_to));
  // Management (admin / super_admin / sales_manager) can reassign ANY lead in
  // this stream — including worked ones. The lock only applies to agents.
  const { isManagement } = useIsManagement();
  const canOverrideLock = isManagement === true;


  const agentById = useMemo(() => {
    const m = new Map<string, StreamAgent>();
    agents.forEach(a => m.set(a.id, a));
    return m;
  }, [agents]);

  /** Same colour for an agent everywhere: always keyed on their resolved first name. */
  const resolveAgent = useCallback(
    (id: string | null | undefined) => {
      if (!id) return null;
      const a = agentById.get(id);
      if (a) return { first_name: a.first_name ?? null, last_name: a.last_name ?? null, email: a.email };
      const u = allAdminUsers.get(id);
      if (u) return { first_name: u.first_name, last_name: u.last_name, email: u.email };
      return null;
    },
    [agentById, allAdminUsers],
  );


  const reassign = useCallback(async (leadId: string, agentId: string) => {
    setSavingId(leadId);
    const prev = rows;
    // optimistic
    setRows(rs => rs.map(r => (r.id === leadId ? { ...r, assigned_to: agentId } : r)));
    const { error } = await supabase
      .from('sales_leads')
      .update({ assigned_to: agentId })
      .eq('id', leadId);
    setSavingId(null);
    if (error) {
      setRows(prev);
      toast({ title: 'Could not reassign lead', description: error.message, variant: 'destructive' });
      return;
    }
    const a = agentById.get(agentId);
    toast({
      title: 'Lead reassigned',
      description: `Now owned by ${`${a?.first_name ?? ''} ${a?.last_name ?? ''}`.trim() || a?.email || 'agent'}. New Leads updates automatically.`,
    });
  }, [rows, agentById]);


  /**
   * Interaction history per lead. Managers need this to tell a genuinely worked
   * lead (agent still calling after 6pm) from one that was never touched — only
   * untouched leads may be reassigned.
   */
  const loadActivity = useCallback(async (leads: StreamRow[]) => {
    const ids = leads.map(l => l.id);
    const map = new Map<string, LeadActivity>();
    leads.forEach(l => {
      const calls = Math.max(0, (l.call_count ?? 0)) + Math.max(0, (l.manual_call_adjustment ?? 0));
      const hasNote = !!(l.notes && String(l.notes).trim());
      map.set(l.id, {
        calls,
        notes: hasNote ? 1 : 0,
        statusChanges: 0,
        lastAt: l.last_contacted_at ?? null,
        worked: calls > 0 || hasNote || !!l.last_contacted_at,
      });
    });

    const bump = (leadId: string, at: string | null, kind: 'calls' | 'notes' | 'statusChanges') => {
      const cur = map.get(leadId);
      if (!cur) return;
      cur[kind] += 1;
      cur.worked = true;
      if (at && (!cur.lastAt || new Date(at) > new Date(cur.lastAt))) cur.lastAt = at;
    };

    for (let i = 0; i < ids.length; i += 200) {
      const slice = ids.slice(i, i + 200);
      const [callsRes, notesRes, actRes] = await Promise.all([
        supabase.from('lead_call_logs').select('lead_id, created_at, call_started_at').in('lead_id', slice),
        supabase.from('lead_quick_notes').select('lead_id, created_at').in('lead_id', slice),
        supabase.from('lead_activities').select('lead_id, created_at, activity_type').in('lead_id', slice),
      ]);
      (callsRes.data ?? []).forEach((c: any) => bump(c.lead_id, c.call_started_at ?? c.created_at, 'calls'));
      (notesRes.data ?? []).forEach((n: any) => bump(n.lead_id, n.created_at, 'notes'));
      (actRes.data ?? []).forEach((a: any) =>
        bump(a.lead_id, a.created_at, a.activity_type === 'call' ? 'calls' : a.activity_type === 'note' ? 'notes' : 'statusChanges'),
      );
    }

    if (mounted.current) setActivity(map);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const from = rangeStart(range).toISOString();
      const { data, error } = await supabase
        .from('sales_leads')
        .select('id, created_at, assigned_at, assigned_to, first_name, last_name, phone, vehicle_reg, status, call_count, manual_call_adjustment, last_contacted_at, notes, manual_entry, auto_tags, queue')
        .gte('created_at', from)
        .order('created_at', { ascending: false })
        .limit(400);
      if (error) throw error;
      if (!mounted.current) return;
      const leads = (data ?? []) as StreamRow[];
      setRows(leads);
      setLastRefresh(new Date());
      // Latest assignment audit entry per lead tells us how it got there.
      const ids = leads.map(l => l.id);
      const types = new Map<string, string>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data: aud } = await supabase
          .from('lead_assignment_audit')
          .select('lead_id, assignment_type, created_at')
          .in('lead_id', ids.slice(i, i + 200))
          .order('created_at', { ascending: true });
        (aud ?? []).forEach((a: any) => { if (a.assignment_type) types.set(a.lead_id, a.assignment_type); });
      }
      if (mounted.current) setAuditTypes(types);
      await loadActivity(leads);
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? 'Could not load the lead stream');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [range]);


  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    load();
    return () => { mounted.current = false; };
  }, [load]);

  // Live: refresh on any sales_leads change, plus a slow safety poll.
  useEffect(() => {
    const channel = supabase
      .channel('lead-assignment-stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_leads' }, () => load())
      .subscribe();
    const t = setInterval(() => load(), 30000);
    return () => { supabase.removeChannel(channel); clearInterval(t); };
  }, [load]);

  // Oldest → newest gives the true hand-out order.
  const ordered = useMemo(() => [...rows].reverse(), [rows]);
  const { repeatByLeadId } = useRepeatCustomers(
    useMemo(() => rows.map(r => ({ id: r.id, vehicle_reg: r.vehicle_reg, created_at: (r as any).created_at })), [rows])
  );

  const tally = useMemo(() => {
    const m = new Map<string, number>();
    ordered.forEach(r => { if (r.assigned_to) m.set(r.assigned_to, (m.get(r.assigned_to) ?? 0) + 1); });
    return m;
  }, [ordered]);

  const unassigned = ordered.filter(r => !r.assigned_to).length;
  const counts = agents.map(a => tally.get(a.id) ?? 0);
  const spread = counts.length ? Math.max(...counts) - Math.min(...counts) : 0;
  const totalAssigned = ordered.length - unassigned;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header — compact, action-dense, grouped (matches New Leads card) */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap border-b border-border">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-emerald-600 animate-pulse" />
            <button
              type="button"
              className="text-lg font-bold tracking-tight hover:text-primary transition-colors cursor-default"
            >
              Live lead stream
            </button>
            <Badge variant="secondary" className="text-[10px] font-mono tabular-nums h-5">
              {ordered.length} total
            </Badge>
          </div>
          <div className="h-6 w-px bg-border" aria-hidden />
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => load()}
              disabled={loading}
              className="h-7 px-3 text-[11px] font-semibold gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-wrap gap-1">
            {RANGES.map(r => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className={cn(
                  'px-2.5 py-1 rounded-md border text-xs font-medium transition-colors',
                  range === r.key
                    ? 'border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:bg-muted'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          {lastRefresh && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Balance summary — agent chips with counts */}
      <div className="px-4 py-2.5 flex flex-wrap items-center gap-2 border-b-2 border-border bg-muted/30">
        <Users className="h-4 w-4 text-muted-foreground" />
        {agents.length === 0 && <span className="text-xs text-muted-foreground">No agents</span>}
        {agents.map(a => {
          const name = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email;
          return (
            <span
              key={a.id}
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold',
                getAgentBadgeColor(a.first_name, a.id)
              )}
              title={teamNameByAgent?.get(a.id) ?? undefined}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', getAgentColor(a.first_name, a.id))} />
              {name}
              <span className="tabular-nums ml-0.5">{tally.get(a.id) ?? 0}</span>
            </span>
          );
        })}
        {unassigned > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Unassigned <span className="tabular-nums">{unassigned}</span>
          </span>
        )}
        <span
          className={cn(
            'ml-auto text-[11px] font-semibold tabular-nums',
            spread <= 1 ? 'text-emerald-700' : 'text-amber-700'
          )}
        >
          {spread <= 1
            ? '✓ Even — one each, in order'
            : `Off by ${spread} between busiest and quietest`}
        </span>
      </div>

      {/* Stream table — matches New Leads table styling */}
      <div className="overflow-x-auto">
        {/* Column header row */}
        <div className="grid grid-cols-[44px_120px_1fr_100px_170px_130px_190px_100px_100px] gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/20 border-b-2 border-border">
          <div>#</div>
          <div>Arrived</div>
          <div>Lead</div>
          <div>Reg</div>
          <div>Assigned to</div>
          <div>Why</div>
          <div>Interaction</div>
          <div className="text-right">Assigned at</div>
          <div className="text-right">Lead time</div>
        </div>

        <div className="max-h-[520px] overflow-y-auto divide-y divide-border">
          {error && <div className="px-4 py-4 text-sm text-destructive">{error}</div>}
          {!error && !loading && ordered.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No leads in this window yet.
            </div>
          )}
          {[...ordered].reverse().map((r) => {
            const a = resolveAgent(r.assigned_to);
            const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.phone || 'Unnamed lead';
            const agentName = a
              ? `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email
              : r.assigned_to
                ? 'Agent (loading…)'
                : 'Unassigned';

            const n = ordered.length - ordered.indexOf(r);
            const act = activity.get(r.id);
            const worked = !!act?.worked;
            const why = reasonFor(r, auditTypes.get(r.id), !!repeatByLeadId[r.id]);
            return (
              <div
                key={r.id}
                className="grid grid-cols-[44px_120px_1fr_100px_170px_130px_190px_100px_100px] gap-2 px-4 py-2 items-center text-sm hover:bg-muted/30 transition-colors"
              >
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{n}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {fmtDay(r.created_at)} {fmtTime(r.created_at)}
                </span>
                <span className="min-w-0 truncate font-medium">{name}</span>
                <span className="text-xs font-mono font-semibold uppercase truncate flex items-center gap-1">
                  {r.vehicle_reg || '—'}
                  {repeatByLeadId[r.id] && (
                    <span
                      className="text-[9px] font-extrabold uppercase tracking-wider text-white bg-emerald-600 px-1 py-px rounded"
                      title="Repeat customer — has bought from us before"
                    >
                      Repeat
                    </span>
                  )}
                </span>
                {canReassign && (!worked || canOverrideLock) ? (
                  <Select
                    value={r.assigned_to && agentById.has(r.assigned_to) ? r.assigned_to : undefined}
                    onValueChange={(v) => reassign(r.id, v)}
                    disabled={savingId === r.id}
                  >
                    <SelectTrigger
                      className={cn(
                        'h-7 text-[11px] font-semibold rounded-full px-2.5 w-full',
                        r.assigned_to
                          ? getAgentBadgeColor(a?.first_name, r.assigned_to)
                          : 'border-amber-300 bg-amber-50 text-amber-900'
                      )}
                    >
                      <SelectValue placeholder={agentName} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {agents.map(ag => (
                        <SelectItem key={ag.id} value={ag.id} className="text-xs">
                          {`${ag.first_name ?? ''} ${ag.last_name ?? ''}`.trim() || ag.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : r.assigned_to ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold w-fit',
                      getAgentBadgeColor(a?.first_name, r.assigned_to)
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', getAgentColor(a?.first_name, r.assigned_to))} />
                    {agentName}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-semibold w-fit">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Unassigned
                  </span>
                )}
                {why ? (
                  <span
                    className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide w-fit',
                      why.className
                    )}
                    title={why.title}
                  >
                    {why.label}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">—</span>
                )}
                <span className="flex flex-wrap items-center gap-1">
                  {worked ? (
                    <>
                      {(act?.calls ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px] font-semibold">
                          <Phone className="h-3 w-3" />
                          {act!.calls} call{act!.calls === 1 ? '' : 's'}
                        </span>
                      )}
                      {(act?.notes ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-blue-300 bg-blue-50 text-blue-800 text-[10px] font-semibold">
                          <StickyNote className="h-3 w-3" />
                          {act!.notes} note{act!.notes === 1 ? '' : 's'}
                        </span>
                      )}
                      {(act?.statusChanges ?? 0) > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-violet-300 bg-violet-50 text-violet-800 text-[10px] font-semibold">
                          {act!.statusChanges} update{act!.statusChanges === 1 ? '' : 's'}
                        </span>
                      )}
                      {act?.lastAt && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          last {fmtDay(act.lastAt)} {fmtTime(act.lastAt)}
                        </span>
                      )}
                      {canReassign && (
                        canOverrideLock ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700"
                            title="Worked lead — as a manager you can still reassign it. Notes, calls and status history stay with the lead."
                          >
                            <Lock className="h-3 w-3" /> manager can reassign
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                            title="Worked lead — reassigning is blocked so the agent keeps the history"
                          >
                            <Lock className="h-3 w-3" /> locked
                          </span>
                        )
                      )}

                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">No interaction yet</span>
                  )}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums text-right">
                  {r.assigned_at ? fmtTime(r.assigned_at) : '—'}
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-right text-muted-foreground">
                  {leadTime(r.created_at, r.assigned_at) ?? '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-border bg-muted/40 text-[11px] text-muted-foreground">
        Newest first. <strong>#</strong> is the order the lead arrived, so you can read straight down
        and check the rotation went one each, in order, across every agent regardless of team.
        <strong> Interaction</strong> shows calls, notes and status updates with the last touch time —
        {canOverrideLock
          ? ' managers can reassign any lead here, worked or not, from the Assigned to dropdown (all history stays with the lead).'
          : ' leads with any interaction are locked and cannot be reassigned.'}{' '}

        {totalAssigned} of {ordered.length} assigned in this window.
      </div>
    </div>
  );
};

export default LeadAssignmentStream;
