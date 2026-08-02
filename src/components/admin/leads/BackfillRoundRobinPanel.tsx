import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { History, RotateCcw } from 'lucide-react';
import { getSince6pmYesterdayRange } from '@/lib/leadFeedDate';

interface AgentLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface Props {
  canEdit: boolean;
  agents: AgentLite[];
  /** Called after leads have been assigned so parent counters can refresh. */
  onDone?: () => void;
}

/** yyyy-MM-ddTHH:mm for <input type="datetime-local"> in the viewer's local time. */
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const agentName = (a: AgentLite) =>
  `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email;

/**
 * Backdated round robin: take the unassigned leads that arrived inside a chosen
 * window (defaults to "since 6pm yesterday") and hand them out one each, in
 * strict order, across the agents ticked here — james, freddie, james, freddie…
 * Saves managers doing yesterday-evening backlog by hand every morning.
 */
export const BackfillRoundRobinPanel = ({ canEdit, agents, onDone }: Props) => {
  const defaults = useMemo(() => {
    const { from } = getSince6pmYesterdayRange();
    return {
      from: toLocalInput(from ?? new Date()),
      to: toLocalInput(new Date()),
    };
  }, []);

  const [fromLocal, setFromLocal] = useState(defaults.from);
  const [toLocal, setToLocal] = useState(defaults.to);
  const [selected, setSelected] = useState<string[]>([]);
  const [order, setOrder] = useState<'oldest' | 'newest'>('oldest');
  const [overrideCap, setOverrideCap] = useState(false);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const rotation = useMemo(
    () => selected.map(id => agents.find(a => a.id === id)).filter(Boolean) as AgentLite[],
    [selected, agents]
  );

  const fetchWaiting = useCallback(async () => {
    const fromIso = new Date(fromLocal).toISOString();
    const toIso = new Date(toLocal).toISOString();
    const { count, error } = await supabase
      .from('sales_leads')
      .select('id', { count: 'exact', head: true })
      .is('assigned_to', null)
      .in('status', ['new', 'contacted'])
      .gte('created_at', fromIso)
      .lte('created_at', toIso);
    if (error) return;
    setWaiting(count ?? 0);
  }, [fromLocal, toLocal]);

  useEffect(() => { fetchWaiting(); }, [fetchWaiting]);

  const toggleAgent = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const run = async () => {
    if (!canEdit || running) return;
    if (rotation.length === 0) {
      toast({ title: 'Pick at least one agent', description: 'Tick the agents who should share these leads.' });
      return;
    }
    const fromIso = new Date(fromLocal).toISOString();
    const toIso = new Date(toLocal).toISOString();

    const { data: leads, error } = await supabase
      .from('sales_leads')
      .select('id, created_at')
      .is('assigned_to', null)
      .in('status', ['new', 'contacted'])
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: order === 'oldest' })
      .limit(500);

    if (error) {
      toast({ title: 'Could not load leads', description: error.message, variant: 'destructive' });
      return;
    }
    const queue = leads || [];
    if (queue.length === 0) {
      toast({ title: 'Nothing to share out', description: 'No unassigned leads in that window.' });
      return;
    }

    const names = rotation.map(agentName).join(' → ');
    if (!window.confirm(
      `Share ${queue.length} lead${queue.length === 1 ? '' : 's'} one each in this order?\n\n${names}\n\n` +
      `${order === 'oldest' ? 'Oldest lead first' : 'Newest lead first'}${overrideCap ? '\nDaily caps will be OVERRIDDEN.' : ''}`
    )) return;

    setRunning(true);
    try {
      let assigned = 0;
      let failed = 0;
      const perAgent: Record<string, number> = {};
      for (let i = 0; i < queue.length; i++) {
        const agent = rotation[i % rotation.length];
        const { data: res, error: rpcErr } = await supabase.rpc('assign_lead_to_agent', {
          p_lead_id: queue[i].id,
          p_agent_id: agent.id,
          p_is_abandoned_cart: false,
          p_override_cap: overrideCap,
        } as any);
        const okRes = res as { success?: boolean } | null;
        if (rpcErr || (okRes && okRes.success === false)) {
          failed++;
          continue;
        }
        assigned++;
        perAgent[agent.id] = (perAgent[agent.id] || 0) + 1;
      }

      const breakdown = rotation
        .map(a => `${agentName(a)} ${perAgent[a.id] || 0}`)
        .join(' • ');
      toast({
        title: `Shared out ${assigned} lead${assigned === 1 ? '' : 's'}`,
        description: failed > 0 ? `${breakdown} — ${failed} could not be assigned (cap or lock).` : breakdown,
      });
      await fetchWaiting();
      onDone?.();
    } finally {
      setRunning(false);
    }
  };

  const resetWindow = () => {
    setFromLocal(defaults.from);
    setToLocal(toLocalInput(new Date()));
  };

  /** Quick windows — each sets an exact date AND time. */
  const applyPreset = (preset: 'yesterday6pm' | 'yesterdayAll' | 'today' | 'last24h') => {
    const now = new Date();
    if (preset === 'yesterday6pm') {
      const f = new Date(now); f.setDate(f.getDate() - 1); f.setHours(18, 0, 0, 0);
      setFromLocal(toLocalInput(f)); setToLocal(toLocalInput(now));
    } else if (preset === 'yesterdayAll') {
      const f = new Date(now); f.setDate(f.getDate() - 1); f.setHours(0, 0, 0, 0);
      const t = new Date(now); t.setDate(t.getDate() - 1); t.setHours(23, 59, 0, 0);
      setFromLocal(toLocalInput(f)); setToLocal(toLocalInput(t));
    } else if (preset === 'today') {
      const f = new Date(now); f.setHours(0, 0, 0, 0);
      setFromLocal(toLocalInput(f)); setToLocal(toLocalInput(now));
    } else {
      const f = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      setFromLocal(toLocalInput(f)); setToLocal(toLocalInput(now));
    }
  };

  if (!canEdit) return null;

  return (
    <div className="w-full border-t border-border/60 pt-2 mt-1">
      <div className="rounded-md border border-purple-200 bg-purple-50/60 p-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-purple-900 inline-flex items-center gap-1">
            <History className="h-3.5 w-3.5" />
            Backdated round robin:
          </span>
          <label className="text-[10px] text-purple-900/80 inline-flex items-center gap-1">
            From
            <input
              type="datetime-local"
              value={fromLocal}
              onChange={(e) => setFromLocal(e.target.value)}
              className="h-7 rounded border border-border bg-background text-xs px-1.5"
            />
          </label>
          <label className="text-[10px] text-purple-900/80 inline-flex items-center gap-1">
            To
            <input
              type="datetime-local"
              value={toLocal}
              onChange={(e) => setToLocal(e.target.value)}
              className="h-7 rounded border border-border bg-background text-xs px-1.5"
            />
          </label>
          <button
            type="button"
            onClick={resetWindow}
            title="Reset to since 6pm yesterday"
            className="inline-flex items-center gap-1 h-7 px-2 rounded border border-purple-300 bg-white text-[10px] font-semibold text-purple-800 hover:bg-purple-50"
          >
            <RotateCcw className="h-3 w-3" />
            Since 6pm yesterday
          </button>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as 'oldest' | 'newest')}
            className="h-7 rounded border border-border bg-background text-xs px-1.5"
          >
            <option value="oldest">Oldest lead first</option>
            <option value="newest">Newest lead first</option>
          </select>
          <span className="text-[11px] font-semibold text-purple-900 bg-purple-100 border border-purple-300 rounded px-2 py-0.5">
            {waiting === null ? '…' : waiting} unassigned in window
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold text-purple-900/80">Share between:</span>
          {agents.map(a => {
            const on = selected.includes(a.id);
            const pos = selected.indexOf(a.id);
            return (
              <label
                key={a.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs cursor-pointer ${
                  on ? 'border-purple-400 bg-white text-purple-900 font-medium' : 'border-border bg-muted/40 text-muted-foreground'
                }`}
              >
                <input type="checkbox" checked={on} onChange={() => toggleAgent(a.id)} />
                {on && <span className="text-[9px] font-bold text-purple-700">#{pos + 1}</span>}
                {agentName(a)}
              </label>
            );
          })}
          {agents.length === 0 && <span className="text-xs text-muted-foreground">No agents to show.</span>}
        </div>

        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <label className="inline-flex items-center gap-1 text-[11px] text-purple-900">
            <input type="checkbox" checked={overrideCap} onChange={(e) => setOverrideCap(e.target.checked)} />
            Override daily caps
          </label>
          <button
            type="button"
            onClick={run}
            disabled={running || selected.length === 0 || waiting === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-purple-600 bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors disabled:opacity-60"
          >
            <History className={`h-3.5 w-3.5 ${running ? 'animate-pulse' : ''}`} />
            {running ? 'Sharing out…' : 'Share out one each in order'}
          </button>
          {rotation.length > 0 && (
            <span className="text-[10px] text-purple-900/80">
              Order: {rotation.map(agentName).join(' → ')} → repeat
            </span>
          )}
        </div>

        <span className="mt-1 block text-[10px] text-purple-900/80 leading-tight">
          Use each morning for yesterday-evening leads that arrived out of order. Picks the unassigned leads created inside the window and hands them out one each, in the tick order shown, looping until they're gone. Leads already assigned are never touched.
        </span>
      </div>
    </div>
  );
};

export default BackfillRoundRobinPanel;
