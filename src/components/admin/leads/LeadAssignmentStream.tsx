import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAgentBadgeColor, getAgentColor } from '@/lib/agentColors';
import { Radio, RefreshCw, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
  // since 6pm yesterday (local time): if it's before 18:00 today, start at 18:00 yesterday
  const d = new Date(now);
  d.setHours(18, 0, 0, 0);
  if (now < d) d.setDate(d.getDate() - 1);
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
  const mounted = useRef(true);

  const agentById = useMemo(() => {
    const m = new Map<string, StreamAgent>();
    agents.forEach(a => m.set(a.id, a));
    return m;
  }, [agents]);

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


  const load = useCallback(async () => {
    setError(null);
    try {
      const from = rangeStart(range).toISOString();
      const { data, error } = await supabase
        .from('sales_leads')
        .select('id, created_at, assigned_at, assigned_to, first_name, last_name, phone, vehicle_reg, status')
        .gte('created_at', from)
        .order('created_at', { ascending: false })
        .limit(400);
      if (error) throw error;
      if (!mounted.current) return;
      setRows((data ?? []) as StreamRow[]);
      setLastRefresh(new Date());
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
        <div className="grid grid-cols-[44px_120px_1fr_100px_170px_100px_100px] gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/20 border-b-2 border-border">
          <div>#</div>
          <div>Arrived</div>
          <div>Lead</div>
          <div>Reg</div>
          <div>Assigned to</div>
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
            const a = r.assigned_to ? agentById.get(r.assigned_to) : null;
            const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.phone || 'Unnamed lead';
            const agentName = a
              ? `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email
              : r.assigned_to
                ? 'Other user'
                : 'Unassigned';
            const n = ordered.length - ordered.indexOf(r);
            return (
              <div
                key={r.id}
                className="grid grid-cols-[44px_120px_1fr_100px_170px_100px_100px] gap-2 px-4 py-2 items-center text-sm hover:bg-muted/30 transition-colors"
              >
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{n}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {fmtDay(r.created_at)} {fmtTime(r.created_at)}
                </span>
                <span className="min-w-0 truncate font-medium">{name}</span>
                <span className="text-xs font-mono font-semibold uppercase truncate">{r.vehicle_reg || '—'}</span>
                {canReassign ? (
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
                      <SelectValue placeholder="Unassigned" />
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
        {totalAssigned} of {ordered.length} assigned in this window.
      </div>
    </div>
  );
};

export default LeadAssignmentStream;
