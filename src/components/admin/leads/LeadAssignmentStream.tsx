import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAgentBadgeColor, getAgentColor } from '@/lib/agentColors';
import { Radio, RefreshCw, Users } from 'lucide-react';

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
  lead_source: string | null;
  status: string | null;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

const LeadAssignmentStream: React.FC<Props> = ({ agents, teamNameByAgent }) => {
  const [range, setRange] = useState<RangeKey>('since6pm');
  const [rows, setRows] = useState<StreamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const mounted = useRef(true);

  const agentById = useMemo(() => {
    const m = new Map<string, StreamAgent>();
    agents.forEach(a => m.set(a.id, a));
    return m;
  }, [agents]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const from = rangeStart(range).toISOString();
      const { data, error } = await supabase
        .from('sales_leads')
        .select('id, created_at, assigned_at, assigned_to, first_name, last_name, phone, lead_source, status')
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

  return (
    <div className="border-t border-border">
      {/* Controls */}
      <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 mr-2">
          <Radio className="h-4 w-4 text-emerald-600 animate-pulse" />
          <span className="text-sm font-semibold">Live lead stream</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {RANGES.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                range === r.key
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-muted-foreground hover:border-foreground/30'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        {lastRefresh && (
          <span className="text-[11px] text-muted-foreground">updated {lastRefresh.toLocaleTimeString()}</span>
        )}
      </div>

      {/* Balance summary */}
      <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-border">
        <Users className="h-4 w-4 text-muted-foreground" />
        {agents.length === 0 && <span className="text-xs text-muted-foreground">No agents</span>}
        {agents.map(a => {
          const name = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email;
          return (
            <span
              key={a.id}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-semibold ${getAgentBadgeColor(a.first_name, a.id)}`}
              title={teamNameByAgent?.get(a.id) ?? undefined}
            >
              {name}
              <span className="tabular-nums">{tally.get(a.id) ?? 0}</span>
            </span>
          );
        })}
        {unassigned > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold">
            Unassigned <span className="tabular-nums">{unassigned}</span>
          </span>
        )}
        <span className={`ml-auto text-xs font-semibold ${spread <= 1 ? 'text-emerald-700' : 'text-amber-700'}`}>
          {spread <= 1 ? 'Even — one each, in order' : `Off by ${spread} between the busiest and quietest agent`}
        </span>
      </div>

      {/* Stream */}
      <div className="max-h-[520px] overflow-y-auto divide-y divide-border">
        {error && <div className="px-5 py-4 text-sm text-destructive">{error}</div>}
        {!error && !loading && ordered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">No leads in this window yet.</div>
        )}
        {[...ordered].reverse().map((r, idx) => {
          const n = ordered.length - idx;
          const a = r.assigned_to ? agentById.get(r.assigned_to) : null;
          const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.phone || 'Unnamed lead';
          const agentName = a ? (`${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email) : (r.assigned_to ? 'Other user' : 'Unassigned');
          return (
            <div key={r.id} className="px-5 py-2 flex items-center gap-3 text-sm hover:bg-muted/20">
              <span className="w-10 shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">#{n}</span>
              <span className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground">
                {fmtDay(r.created_at)} {fmtTime(r.created_at)}
              </span>
              <span className="flex-1 min-w-0 truncate font-medium">{name}</span>
              <span className="w-24 shrink-0 text-xs text-muted-foreground truncate">{r.lead_source ?? '—'}</span>
              <span className="w-28 shrink-0 text-xs text-muted-foreground truncate">{r.status ?? '—'}</span>
              {r.assigned_to ? (
                <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold text-white ${getAgentColor(a?.first_name, r.assigned_to)}`}>
                  {agentName}
                </span>
              ) : (
                <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold">
                  Unassigned
                </span>
              )}
              <span className="w-20 shrink-0 text-[11px] text-muted-foreground tabular-nums text-right">
                {r.assigned_at ? fmtTime(r.assigned_at) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-2 border-t border-border bg-muted/40 text-[11px] text-muted-foreground">
        Newest first. <strong>#</strong> is the order the lead arrived, so you can read straight down and check the rotation went one each, in order,
        across every agent regardless of team. Last column = the time it was assigned.
      </div>
    </div>
  );
};

export default LeadAssignmentStream;
