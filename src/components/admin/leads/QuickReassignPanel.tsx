import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Lock, RefreshCw, Users, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { fetchLeadsSince6pm, tallyByAgent } from '@/lib/since6pmLeadCounts';
import { NOTE_LOCK_EXPLAINER } from '@/lib/leadNoteLock';
import { cn } from '@/lib/utils';
import { useRebalanceWindow } from '@/lib/rebalanceWindow';
import { RebalanceWindowPicker } from './RebalanceWindowPicker';


interface AgentRow {
  id: string;
  name: string;
  count: number;
  /** Leads that can be moved without asking the agent — no note written. */
  movable: number;
  /** Ids of those movable leads, newest first. */
  movableIds: string[];
  /** Leads holding an agent-written note — need explicit authorisation. */
  noteLocked: number;
  /** Ids of the note-locked leads, newest first. */
  noteLockedIds: string[];
}


/**
 * Quick reassign — shows how many open leads each sales agent is holding and
 * lets a manager move the newest N straight to another agent in one click,
 * without stepping through the full Bulk Reassign dialog.
 *
 * Annual leave / holiday rule: calls and status changes never block a move,
 * but a lead carrying an agent-written note is note locked — the manager must
 * double-check with the agent and tick "Authorised" before it can move.
 */
export function QuickReassignPanel({ className }: { className?: string }) {
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  /** Recipients per source agent — leads are split evenly between everyone ticked. */
  const [targets, setTargets] = useState<Record<string, string[]>>({});

  const [authorised, setAuthorised] = useState<Record<string, boolean>>({});
  const [unassigned, setUnassigned] = useState(0);
  const [totalSince6pm, setTotalSince6pm] = useState(0);
  const { from, to, label } = useRebalanceWindow();

  const load = useCallback(async () => {
    setLoading(true);
    // Shared "since 6pm yesterday" source so these numbers always match the badge.
    const [leads, { data: admins }] = await Promise.all([
      fetchLeadsSince6pm(from, to),
      supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active'),
    ]);

    const { tally, movable, noteLocked, unassigned: none, total: all } = tallyByAgent(leads);

    // Newest-first ids of the leads that can still be moved, per agent. Passing
    // these explicit ids to the RPC keeps the reassign fast (the old call made
    // the database re-scan every lead the agent has ever held, which timed out).
    const movableIdsByAgent = new Map<string, string[]>();
    const lockedIdsByAgent = new Map<string, string[]>();
    [...leads]
      .filter(l => l.assigned_to)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .forEach(l => {
        const map = l.noteLocked ? lockedIdsByAgent : movableIdsByAgent;
        const arr = map.get(l.assigned_to!) || [];
        arr.push(l.id);
        map.set(l.assigned_to!, arr);
      });
    setUnassigned(none);
    setTotalSince6pm(all);

    const list: AgentRow[] = (admins || [])
      .filter((a: any) => {
        const isSales = a.role === 'sales' || a.role === 'sales_lead';
        return (isSales && a.is_active !== false) || tally.has(a.id);
      })
      .map((a: any) => ({
        id: a.id,
        name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || 'Unknown',
        count: tally.get(a.id) || 0,
        movable: movable.get(a.id) || 0,
        movableIds: movableIdsByAgent.get(a.id) || [],
        noteLocked: noteLocked.get(a.id) || 0,
        noteLockedIds: lockedIdsByAgent.get(a.id) || [],
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    setRows(list);
    setLoading(false);
  }, [from, to]);


  useEffect(() => {
    load();
  }, [load]);

  const assignedTotal = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows]);

  const move = async (from: AgentRow) => {
    const recipients = targets[from.id] || [];
    const amount = parseInt(counts[from.id] || '', 10);
    const isAuthorised = !!authorised[from.id];
    // Note-locked leads only join the pool once the manager has confirmed they
    // checked with the agent.
    const pool = isAuthorised ? [...from.movableIds, ...from.noteLockedIds] : from.movableIds;
    if (recipients.length === 0) {
      toast({ title: 'Pick at least one agent', description: 'Choose who should receive the leads.', variant: 'destructive' });
      return;
    }
    if (pool.length === 0) {
      toast({
        title: 'Nothing to move',
        description: from.noteLocked > 0
          ? `${from.noteLocked} lead${from.noteLocked === 1 ? ' has' : 's have'} an agent note — check with ${from.name} and tick Authorised to move them.`
          : 'No leads available in this window.',
        variant: 'destructive',
      });
      return;
    }
    if (!amount || amount < 1) {
      toast({ title: 'How many?', description: 'Enter how many of the newest leads to move.', variant: 'destructive' });
      return;
    }
    setBusyId(from.id);
    try {
      const ids = pool.slice(0, amount);
      if (ids.length === 0) {
        throw new Error('No movable leads left in this window — refresh and try again.');
      }

      // Deal the leads out one at a time so everyone gets a fair, near-equal share
      // (10 leads across 3 agents = 4 / 3 / 3), newest first.
      const buckets: Record<string, string[]> = {};
      recipients.forEach(id => (buckets[id] = []));
      ids.forEach((leadId, i) => buckets[recipients[i % recipients.length]].push(leadId));

      let movedTotal = 0;
      const summary: string[] = [];
      for (const agentId of recipients) {
        const slice = buckets[agentId];
        if (slice.length === 0) continue;
        const { data, error } = await supabase.rpc('bulk_reassign_leads_to_agent', {
          p_from_agent: from.id,
          p_to_agent: agentId,
          p_lead_ids: slice,
          p_limit: slice.length,
          p_include_customers: false,
          p_skip_worked: false,
        } as any);
        if (error) throw error;
        const r = data as { success: boolean; error?: string; moved?: number };
        if (!r?.success) throw new Error(r?.error || 'Reassign failed');
        movedTotal += r.moved ?? slice.length;
        const name = rows.find((x) => x.id === agentId)?.name || 'agent';
        summary.push(`${name} ${r.moved ?? slice.length}`);
      }

      toast({
        title: `Moved ${movedTotal} lead${movedTotal === 1 ? '' : 's'}`,
        description: `${from.name} → ${summary.join(' · ')}. Newest first, split evenly.${
          isAuthorised ? ' Note-locked leads included (authorised).' : ''
        }`,
      });
      setCounts((c) => ({ ...c, [from.id]: '' }));
      setAuthorised((a) => ({ ...a, [from.id]: false }));
      await load();
    } catch (e: any) {
      const msg = String(e?.message || '');
      toast({
        title: 'Could not reassign',
        description: /timeout|57014/i.test(msg)
          ? 'The move took too long. Try a smaller number of leads.'
          : msg || 'Unknown error — please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };



  return (
    <section className={cn('rounded-lg border border-border bg-card shadow-sm', className)}>
      <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3 border-b border-border">
        <div className="flex items-start gap-2 min-w-0">
          <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Who is holding what</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              New leads since {label}, per agent. Move the newest ones straight across without opening the full tool.
              {' '}{NOTE_LOCK_EXPLAINER}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <RebalanceWindowPicker />
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {totalSince6pm} since {label} · {assignedTotal} with agents
            {unassigned > 0 ? ` · ${unassigned} not yet assigned` : ''}
          </span>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {loading && rows.length === 0 && (
          <li className="px-5 py-4 text-sm text-muted-foreground">Loading agent workloads…</li>
        )}
        {!loading && rows.length === 0 && (
          <li className="px-5 py-4 text-sm text-muted-foreground">No sales agents found.</li>
        )}
        {rows.map((row) => {
          const isAuthorised = !!authorised[row.id];
          const available = isAuthorised ? row.movable + row.noteLocked : row.movable;
          return (
          <li key={row.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-[190px]">
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 text-sm font-bold text-primary tabular-nums">
                {row.count}
              </span>
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground truncate block">{row.name}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {row.movable} movable
                  {row.noteLocked > 0 && (
                    <span className="text-amber-600 dark:text-amber-500 font-medium">
                      {' · '}{row.noteLocked} note-locked
                    </span>
                  )}
                </span>
              </div>
            </div>

            {row.noteLocked > 0 && (
              <label className="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-500 bg-amber-500/10 border border-amber-500/40 rounded-md px-2 py-1.5 cursor-pointer">
                <Checkbox
                  checked={isAuthorised}
                  onCheckedChange={(v) => setAuthorised((a) => ({ ...a, [row.id]: !!v }))}
                />
                <span className="flex items-center gap-1 font-medium">
                  <Lock className="h-3 w-3" />
                  Authorised — I checked with {row.name.split(' ')[0]}
                </span>
              </label>
            )}

            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <Input
                type="number"
                min={1}
                max={available || undefined}
                inputMode="numeric"
                placeholder="How many"
                className="h-9 w-28"
                value={counts[row.id] || ''}
                onChange={(e) => setCounts((c) => ({ ...c, [row.id]: e.target.value }))}
                disabled={available === 0}
              />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-56 justify-between font-normal"
                    disabled={available === 0}
                  >
                    <span className="truncate">
                      {(targets[row.id]?.length ?? 0) === 0
                        ? 'Share between agents'
                        : targets[row.id].length === 1
                          ? rows.find((r) => r.id === targets[row.id][0])?.name || '1 agent'
                          : `${targets[row.id].length} agents selected`}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-2 bg-popover z-50">
                  <p className="px-1 pb-2 text-xs text-muted-foreground">
                    Tick everyone who should cover these leads — they’re dealt out evenly, newest first.
                  </p>
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {rows
                      .filter((r) => r.id !== row.id)
                      .map((r) => {
                        const picked = (targets[row.id] || []).includes(r.id);
                        return (
                          <label
                            key={r.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                          >
                            <Checkbox
                              checked={picked}
                              onCheckedChange={(v) =>
                                setTargets((t) => {
                                  const cur = t[row.id] || [];
                                  return {
                                    ...t,
                                    [row.id]: v ? [...cur, r.id] : cur.filter((x) => x !== r.id),
                                  };
                                })
                              }
                            />
                            <span className="truncate">
                              {r.name} <span className="text-muted-foreground tabular-nums">({r.count})</span>
                            </span>
                          </label>
                        );
                      })}
                  </div>
                  {(targets[row.id]?.length ?? 0) > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 h-7 w-full text-xs text-muted-foreground"
                      onClick={() => setTargets((t) => ({ ...t, [row.id]: [] }))}
                    >
                      Clear selection
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
              <Button
                size="sm"
                onClick={() => move(row)}
                disabled={available === 0 || busyId === row.id}
              >
                {busyId === row.id
                  ? 'Moving…'
                  : (targets[row.id]?.length ?? 0) > 1
                    ? 'Split newest'
                    : 'Move newest'}
              </Button>

            </div>
          </li>
          );
        })}

      </ul>
    </section>
  );
}

export default QuickReassignPanel;
