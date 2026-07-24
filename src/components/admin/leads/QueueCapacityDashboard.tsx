import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Users, Clock, Moon, Sun, Sunrise, Sunset, AlertTriangle, Lock, PhoneCall,
  Zap, RefreshCw, ShieldAlert, Phone, TimerReset, Info, CheckCircle2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { OpenPoolActivityMonitor } from './OpenPoolActivityMonitor';

type Snapshot = {
  generated_at: string;
  counts: Record<string, number>;
  warnings: Record<string, any[]>;
  agents: Array<{
    agent_id: string;
    agent_name: string;
    role: string;
    presence: string;
    holding_uncalled: number;
    next_deadline: string | null;
    current_queue: string | null;
    live_calls: number;
    callbacks_owned: number;
    active_sales: number;
  }>;
};

const QUEUE_GROUPS: Array<{
  title: string;
  hint: string;
  tiles: Array<{ key: string; label: string; icon: any; alertIfPositive?: boolean }>;
}> = [
  {
    title: 'Waiting to be called',
    hint: 'Leads currently sitting in a queue window',
    tiles: [
      { key: 'live_waiting',      label: 'Live (fresh intake)', icon: Zap },
      { key: 'overnight_waiting', label: 'Overnight',            icon: Moon },
      { key: 'morning_waiting',   label: 'Morning retry',        icon: Sunrise },
      { key: 'lunch_waiting',     label: 'Lunch retry',          icon: Sun },
      { key: 'evening_waiting',   label: 'Evening retry',        icon: Sunset },
    ],
  },
  {
    title: 'In progress',
    hint: 'Assigned to an agent right now',
    tiles: [
      { key: 'assigned_locked',     label: 'Assigned (locked timer)', icon: Clock },
      { key: 'waiting_agents_busy', label: 'Waiting — agents busy',   icon: Users },
      { key: 'on_call_customers',   label: 'On live calls',           icon: PhoneCall },
      { key: 'locked_customers',    label: 'Customer records locked', icon: Lock },
    ],
  },
  {
    title: 'Needs attention',
    hint: 'Managers should review these',
    tiles: [
      { key: 'approaching_close',   label: 'Closing in <5 min',   icon: AlertTriangle, alertIfPositive: true },
      { key: 'rolled_to_next_queue',label: 'Rolled to next queue',icon: TimerReset },
      { key: 'missing_outcomes',    label: 'Missing outcomes',    icon: ShieldAlert,   alertIfPositive: true },
      { key: 'expired_assignments', label: 'Expired assignments', icon: AlertTriangle, alertIfPositive: true },
      { key: 'dormant_today',       label: 'Dormant today',       icon: Info },
    ],
  },
];

const WARNING_LABELS: Record<string, string> = {
  overnight_no_attempt1:   'Overnight leads with no Attempt 1 by 11:00',
  waiting_past_window:     'Leads waiting past their queue window',
  missing_next_eligible:   'Missing next-eligible contact time',
  duplicate_phones:        'Duplicate telephone records',
  attempt_over_7:          'Attempt count above 7',
  double_locks:            'Two active locks on the same phone',
  calls_before_eligibility:'Calls attempted before eligibility',
  calls_after_dnc:         'Calls attempted after Do Not Call',
};

function formatDeadline(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMs = d.getTime() - Date.now();
  if (diffMs < 0) return 'expired';
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

function warningCount(items: any[]): number {
  if (!items || items.length === 0) return 0;
  // Some warnings return [{ n: <count> }], others return an array of rows
  if (items.length === 1 && typeof items[0]?.n === 'number' && Object.keys(items[0]).length === 1) {
    return items[0].n;
  }
  return items.length;
}

export function QueueCapacityDashboard() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('orr_queue_dashboard_snapshot' as any);
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSnap(data as any);
  };

  useEffect(() => {
    load();
    const poll = setInterval(load, 10000);
    const tick = setInterval(() => setSnap(s => (s ? { ...s } : s)), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, []);

  // Summary strip
  const agents = snap?.agents ?? [];
  const onlineAgents = agents.filter(a => a.presence === 'online').length;
  const totalWaiting =
    (snap?.counts?.live_waiting ?? 0) +
    (snap?.counts?.overnight_waiting ?? 0) +
    (snap?.counts?.morning_waiting ?? 0) +
    (snap?.counts?.lunch_waiting ?? 0) +
    (snap?.counts?.evening_waiting ?? 0);
  const totalAssigned = snap?.counts?.assigned_locked ?? 0;
  const alerts =
    (snap?.counts?.approaching_close ?? 0) +
    (snap?.counts?.missing_outcomes ?? 0) +
    (snap?.counts?.expired_assignments ?? 0);
  const warningTotal = Object.values(snap?.warnings ?? {}).reduce(
    (n, items) => n + warningCount(items as any[]),
    0,
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <SummaryStat label="ORR agents online" value={onlineAgents} icon={Users} />
          <SummaryStat label="Waiting in queues" value={totalWaiting} icon={Clock} />
          <SummaryStat label="Assigned with timer" value={totalAssigned} icon={Zap} />
          <SummaryStat
            label="Alerts"
            value={alerts + warningTotal}
            icon={alerts + warningTotal > 0 ? AlertTriangle : CheckCircle2}
            tone={alerts + warningTotal > 0 ? 'alert' : 'ok'}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {snap && <span>Updated {formatDistanceToNow(new Date(snap.generated_at), { addSuffix: true })}</span>}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      <Tabs defaultValue="queues" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="queues">Queues</TabsTrigger>
          <TabsTrigger value="agents">
            Agents
            {agents.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">{agents.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="warnings">
            Warnings
            {warningTotal > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px]">{warningTotal}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity audit</TabsTrigger>
        </TabsList>

        {/* QUEUES */}
        <TabsContent value="queues" className="space-y-5 mt-4">
          {QUEUE_GROUPS.map(group => (
            <div key={group.title}>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                <span className="text-xs text-muted-foreground">{group.hint}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {group.tiles.map(tile => {
                  const Icon = tile.icon;
                  const value = snap?.counts?.[tile.key] ?? 0;
                  const isAlert = !!tile.alertIfPositive && value > 0;
                  return (
                    <Card key={tile.key} className={isAlert ? 'border-destructive/50' : ''}>
                      <CardContent className="p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                          <span className="truncate">{tile.label}</span>
                        </div>
                        <div className={`text-2xl font-bold tabular-nums ${isAlert ? 'text-destructive' : 'text-foreground'}`}>
                          {value}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* AGENTS */}
        <TabsContent value="agents" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-2">Agent</th>
                      <th className="text-left p-2">State</th>
                      <th className="text-left p-2">Current queue</th>
                      <th className="text-right p-2">Uncalled</th>
                      <th className="text-right p-2">Callbacks</th>
                      <th className="text-right p-2">Active sales</th>
                      <th className="text-right p-2">Timer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map(a => {
                      let state = 'Available';
                      let tone = 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
                      if (a.presence !== 'online') { state = 'Offline'; tone = 'bg-muted text-muted-foreground'; }
                      else if (a.live_calls > 0)   { state = 'On call'; tone = 'bg-blue-500/15 text-blue-700 border-blue-500/30'; }
                      else if (a.active_sales > 0) { state = 'On active sale'; tone = 'bg-violet-500/15 text-violet-700 border-violet-500/30'; }
                      else if (a.callbacks_owned > 0) { state = 'On callback'; tone = 'bg-amber-500/15 text-amber-700 border-amber-500/30'; }
                      else if (a.holding_uncalled > 0){ state = 'Holding uncalled'; tone = 'bg-orange-500/15 text-orange-700 border-orange-500/30'; }
                      return (
                        <tr key={a.agent_id} className="border-t">
                          <td className="p-2 font-medium">{a.agent_name}</td>
                          <td className="p-2"><Badge variant="outline" className={tone}>{state}</Badge></td>
                          <td className="p-2 text-xs text-muted-foreground">{a.current_queue ?? '—'}</td>
                          <td className="p-2 text-right tabular-nums">{a.holding_uncalled}</td>
                          <td className="p-2 text-right tabular-nums">{a.callbacks_owned}</td>
                          <td className="p-2 text-right tabular-nums">{a.active_sales}</td>
                          <td className="p-2 text-right font-mono text-xs">{formatDeadline(a.next_deadline)}</td>
                        </tr>
                      );
                    })}
                    {agents.length === 0 && (
                      <tr><td colSpan={7} className="p-6 text-center text-muted-foreground text-sm">
                        No agents are set to Open Round Robin. Set an agent's mode to ORR in "Who gets the leads?" above.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WARNINGS */}
        <TabsContent value="warnings" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {Object.entries(WARNING_LABELS).map(([key, label]) => {
              const items = snap?.warnings?.[key] ?? [];
              const count = warningCount(items);
              const rows = items.filter((it: any) => !(Object.keys(it).length === 1 && typeof it.n === 'number'));
              return (
                <Card key={key} className={count === 0 ? '' : 'border-amber-500/50'}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className={`h-4 w-4 ${count === 0 ? 'text-muted-foreground' : 'text-amber-600'}`} />
                      <span className="text-sm font-medium flex-1">{label}</span>
                      <Badge variant={count === 0 ? 'secondary' : 'destructive'}>{count}</Badge>
                    </div>
                    {rows.length > 0 && (
                      <ul className="space-y-1 text-xs max-h-40 overflow-y-auto">
                        {rows.slice(0, 20).map((it: any, idx: number) => (
                          <li key={idx} className="flex items-center gap-2 py-1 border-b last:border-0">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono">{it.phone_normalized ?? it.phone ?? '—'}</span>
                            {it.n != null && <Badge variant="outline">{it.n}×</Badge>}
                          </li>
                        ))}
                        {rows.length > 20 && (
                          <li className="text-muted-foreground pt-1">+ {rows.length - 20} more…</li>
                        )}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ACTIVITY AUDIT */}
        <TabsContent value="activity" className="mt-4">
          <OpenPoolActivityMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryStat({
  label, value, icon: Icon, tone = 'neutral',
}: { label: string; value: number; icon: any; tone?: 'neutral' | 'alert' | 'ok' }) {
  const toneClass =
    tone === 'alert' ? 'text-destructive' :
    tone === 'ok'    ? 'text-emerald-600' :
                       'text-foreground';
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${toneClass}`} />
      <div>
        <div className={`text-lg font-semibold leading-none tabular-nums ${toneClass}`}>{value}</div>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      </div>
    </div>
  );
}

export default QueueCapacityDashboard;
