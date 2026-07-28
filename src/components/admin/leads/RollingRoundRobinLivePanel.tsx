import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Clock, Loader2, Play, RefreshCw, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * Live rolling round-robin hand-out (the real version of the Morning leads
 * practice panel).
 *
 *  - Leads are pre-assigned one at a time in fair rotation, up to BATCH_CAP
 *    open leads per agent, so nobody is buried and nobody cherry-picks.
 *  - Each lead carries a 30-minute first-call window (orr_first_call_deadline).
 *  - Green = plenty of time, amber = under 10 minutes, red = overdue.
 *  - No call logged within the window → the lead is pulled back to the Open
 *    Pool and handed to the next available agent on the following pass.
 */

const BATCH_CAP = 5;
const WINDOW_MINUTES = 30;
const AMBER_MS = 10 * 60 * 1000;
const AUTO_INTERVAL_MS = 60_000;

interface InFlightLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  assigned_to: string | null;
  orr_first_call_deadline: string;
  call_count: number | null;
}

interface AgentInfo {
  id: string;
  name: string;
}

function fmtRemaining(ms: number) {
  let abs = Math.floor(Math.abs(ms) / 1000);
  const wk = Math.floor(abs / 604800); abs -= wk * 604800;
  const d = Math.floor(abs / 86400); abs -= d * 86400;
  const h = Math.floor(abs / 3600); abs -= h * 3600;
  const m = Math.floor(abs / 60);
  const s = abs - m * 60;
  const parts: string[] = [];
  if (wk) parts.push(`${wk}w`);
  if (d || wk) parts.push(`${d}d`);
  if (h || d || wk) parts.push(`${h}h`);
  parts.push(`${m}m`);
  parts.push(`${String(s).padStart(2, '0')}s`);
  const t = parts.join(' ');
  return ms < 0 ? `${t} overdue` : t;
}

export function RollingRoundRobinLivePanel({ canEdit }: { canEdit: boolean }) {
  const [leads, setLeads] = useState<InFlightLead[]>([]);
  const [agents, setAgents] = useState<Record<string, AgentInfo>>({});
  const [poolCount, setPoolCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [auto, setAuto] = useState(false);
  const [, setTick] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: rows }, { count }] = await Promise.all([
        (supabase as any)
          .from('sales_leads')
          .select('id, first_name, last_name, assigned_to, orr_first_call_deadline, call_count')
          .not('orr_first_call_deadline', 'is', null)
          .not('assigned_to', 'is', null)
          .eq('status', 'new')
          .order('orr_first_call_deadline', { ascending: true })
          .limit(200),
        (supabase as any)
          .from('sales_leads')
          .select('id', { count: 'exact', head: true })
          .eq('queue', 'live_open_pool')
          .is('assigned_to', null)
          .is('owner_agent', null)
          .eq('status', 'new'),
      ]);

      const list = (rows ?? []) as InFlightLead[];
      setLeads(list);
      setPoolCount(count ?? 0);

      const ids = Array.from(new Set(list.map((l) => l.assigned_to).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: users } = await supabase
          .from('admin_users')
          .select('id, first_name, last_name, email')
          .in('id', ids);
        const map: Record<string, AgentInfo> = {};
        (users ?? []).forEach((u: any) => {
          map[u.id] = {
            id: u.id,
            name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
          };
        });
        setAgents(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runPass = useCallback(
    async (silent = false) => {
      if (busy.current) return;
      busy.current = true;
      setRunning(true);
      try {
        const { data: reclaimed, error: rErr } = await (supabase as any).rpc('rolling_rr_reclaim_overdue');
        if (rErr) throw rErr;
        const { data: assigned, error: aErr } = await (supabase as any).rpc('rolling_rr_distribute', {
          _batch_cap: BATCH_CAP,
          _window_minutes: WINDOW_MINUTES,
        });
        if (aErr) throw aErr;

        const rRow = Array.isArray(reclaimed) ? reclaimed[0] : reclaimed;
        const aRow = Array.isArray(assigned) ? assigned[0] : assigned;
        const back = rRow?.reclaimed_count ?? 0;
        const out = aRow?.assigned_count ?? 0;

        if (!silent || back > 0 || out > 0) {
          toast({
            title: `Rolling pass complete`,
            description: `${out} lead${out === 1 ? '' : 's'} handed out · ${back} pulled back for a missed first call.`,
          });
        }
        await load();
      } catch (e: any) {
        if (!silent) {
          toast({ title: 'Rolling round-robin failed', description: e.message, variant: 'destructive' });
        }
        console.error('[rolling rr]', e);
      } finally {
        busy.current = false;
        setRunning(false);
      }
    },
    [load],
  );

  useEffect(() => {
    if (!auto || !canEdit) return;
    const kick = setTimeout(() => runPass(true), 1200);
    const t = setInterval(() => runPass(true), AUTO_INTERVAL_MS);
    return () => {
      clearTimeout(kick);
      clearInterval(t);
    };
  }, [auto, canEdit, runPass]);

  const perAgent = useMemo(() => {
    const map: Record<string, { open: number; overdue: number }> = {};
    const now = Date.now();
    leads.forEach((l) => {
      if (!l.assigned_to) return;
      const e = (map[l.assigned_to] ||= { open: 0, overdue: 0 });
      e.open += 1;
      if (new Date(l.orr_first_call_deadline).getTime() < now) e.overdue += 1;
    });
    return map;
  }, [leads]);

  const overdueTotal = Object.values(perAgent).reduce((s, a) => s + a.overdue, 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Rolling round-robin · 30-minute first-call window
            <Badge variant="outline" className="text-[10px]">Test panel only</Badge>
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
            Manager practice panel — it does not run on its own anywhere else. Leads are pre-assigned one at a time in rotation — up to {BATCH_CAP} open leads per agent — so nobody
            cherry-picks. Each lead must have a first call logged within {WINDOW_MINUTES} minutes, otherwise it goes
            back to the pool and is handed to the next available agent. As soon as an agent logs a call, they are
            topped up with the next waiting lead.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
          Keep it rolling
          <Switch checked={auto} onCheckedChange={setAuto} disabled={!canEdit} />
        </label>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => runPass(false)} disabled={!canEdit || running}>
          {running ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
          Run rolling pass
        </Button>
        <Button size="sm" variant="outline" onClick={() => load()} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} /> Refresh
        </Button>
        <span className="text-xs text-muted-foreground">
          {poolCount} waiting in the pool · {leads.length} in flight
        </span>
        {overdueTotal > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            {overdueTotal} overdue — next pass returns them to the pool
          </span>
        )}
      </div>

      {/* Per-agent batch chips */}
      <div className="flex flex-wrap gap-2">
        {Object.keys(perAgent).length === 0 ? (
          <span className="text-xs text-muted-foreground">No leads currently inside a first-call window.</span>
        ) : (
          Object.entries(perAgent).map(([id, s]) => (
            <span
              key={id}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
                s.overdue > 0
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200',
              )}
            >
              {agents[id]?.name ?? 'Agent'}
              <span className="opacity-70">
                {s.open}/{BATCH_CAP} open
              </span>
              {s.overdue > 0 && <span className="font-semibold">{s.overdue} overdue</span>}
            </span>
          ))
        )}
      </div>

      {/* In-flight list */}
      {leads.length > 0 && (
        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Lead</th>
                <th className="text-left px-3 py-2">Agent</th>
                <th className="text-left px-3 py-2">First call due</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const ms = new Date(l.orr_first_call_deadline).getTime() - Date.now();
                const tone =
                  ms < 0
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : ms < AMBER_MS
                      ? 'bg-amber-100 text-amber-900 border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200';
                return (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">
                      {[l.first_name, l.last_name].filter(Boolean).join(' ') || 'Lead'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {l.assigned_to ? agents[l.assigned_to]?.name ?? '—' : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium', tone)}>
                        {ms < 0 ? <Undo2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {fmtRemaining(ms)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RollingRoundRobinLivePanel;
