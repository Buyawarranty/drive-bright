import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, Clock, Moon, Sun, Sunrise, Sunset, AlertTriangle, Lock, PhoneCall,
  Zap, RefreshCw, ShieldAlert, Phone, TimerReset, Info,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

const QUEUE_TILES: Array<{ key: string; label: string; icon: any; hint?: string }> = [
  { key: 'live_waiting',        label: 'Live new leads waiting',        icon: Zap,      hint: 'Live intake, no timer yet' },
  { key: 'overnight_waiting',   label: 'Overnight leads waiting',       icon: Moon },
  { key: 'morning_waiting',     label: 'Morning retry waiting',         icon: Sunrise },
  { key: 'lunch_waiting',       label: 'Lunchtime retry waiting',       icon: Sun },
  { key: 'evening_waiting',     label: 'Evening retry waiting',         icon: Sunset },
  { key: 'assigned_locked',     label: 'Assigned leads (owned + timer)',icon: Clock },
  { key: 'waiting_agents_busy', label: 'Waiting — all agents busy',     icon: Users },
  { key: 'approaching_close',   label: 'Approaching queue close',       icon: AlertTriangle },
  { key: 'rolled_to_next_queue',label: 'Rolled to next queue',          icon: TimerReset },
  { key: 'missing_outcomes',    label: 'Missing outcomes',              icon: ShieldAlert },
  { key: 'expired_assignments', label: 'Expired assignments',           icon: AlertTriangle },
  { key: 'locked_customers',    label: 'Customers currently locked',    icon: Lock },
  { key: 'on_call_customers',   label: 'Customers on calls',            icon: PhoneCall },
  { key: 'dormant_today',       label: 'Dormant created today',         icon: Info },
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

function buildDemoSnapshot(): Snapshot {
  const now = Date.now();
  return {
    generated_at: new Date(now).toISOString(),
    counts: {
      live_waiting: 4, overnight_waiting: 12, morning_waiting: 6, lunch_waiting: 3,
      evening_waiting: 2, assigned_locked: 5, waiting_agents_busy: 3, approaching_close: 2,
      rolled_to_next_queue: 1, missing_outcomes: 2, expired_assignments: 1,
      locked_customers: 3, on_call_customers: 2, dormant_today: 4,
    },
    warnings: {
      overnight_no_attempt1: [{ phone_normalized: '447700900001', first_name: 'Demo', last_name: 'Lead', orr_attempt_count: 0, orr_pool_kind: 'overnight' }],
      waiting_past_window: [{ phone_normalized: '447700900002', first_name: 'Demo', last_name: 'Two', orr_pool_kind: 'morning_retry' }],
      missing_next_eligible: [],
      duplicate_phones: [{ phone_normalized: '447700900003', n: 2 }],
      attempt_over_7: [],
      double_locks: [],
      calls_before_eligibility: [],
      calls_after_dnc: [],
    },
    agents: [
      { agent_id: 'demo-1', agent_name: 'James Reed (demo)', role: 'sales', presence: 'online', holding_uncalled: 1, next_deadline: new Date(now + 95_000).toISOString(), current_queue: 'overnight', live_calls: 0, callbacks_owned: 2, active_sales: 1 },
      { agent_id: 'demo-2', agent_name: 'Freddie (demo)', role: 'sales', presence: 'online', holding_uncalled: 0, next_deadline: null, current_queue: 'live', live_calls: 1, callbacks_owned: 1, active_sales: 0 },
      { agent_id: 'demo-3', agent_name: 'Thomas Clark (demo)', role: 'sales', presence: 'offline', holding_uncalled: 0, next_deadline: null, current_queue: null, live_calls: 0, callbacks_owned: 0, active_sales: 0 },
    ],
  };
}

export function QueueCapacityDashboard({ showHeading = false }: { showHeading?: boolean }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  const load = async () => {
    if (demo) { setSnap(buildDemoSnapshot()); setError(null); return; }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('orr_queue_dashboard_snapshot' as any);
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSnap(data as any);
  };

  // Poll every 10s + auto-tick to keep timers accurate
  useEffect(() => {
    load();
    const poll = setInterval(load, 10000);
    const tick = setInterval(() => setSnap(s => (s ? { ...s } : s)), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {showHeading ? (
          <div>
            <h2 className="text-xl font-bold tracking-tight">Open Round Robin — Queue &amp; Capacity</h2>
            <p className="text-xs text-muted-foreground">
              Display only — agents cannot claim leads from here.
            </p>
          </div>
        ) : <div />}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {snap && <span>Updated {formatDistanceToNow(new Date(snap.generated_at), { addSuffix: true })}</span>}
          <Button
            variant={demo ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDemo(d => !d)}
          >
            {demo ? 'Demo data: on' : 'Demo data: off'}
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {demo && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-800 text-xs p-2">
          Showing simulated dummy data — nothing here reflects live leads.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {/* Queue tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {QUEUE_TILES.map(tile => {
          const Icon = tile.icon;
          const value = snap?.counts?.[tile.key] ?? 0;
          const isAlert =
            (tile.key === 'approaching_close' && value > 0) ||
            (tile.key === 'missing_outcomes' && value > 0) ||
            (tile.key === 'expired_assignments' && value > 0);
          return (
            <Card key={tile.key} className={isAlert ? 'border-destructive/50' : ''}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="truncate">{tile.label}</span>
                </div>
                <div className={`text-2xl font-bold ${isAlert ? 'text-destructive' : 'text-foreground'}`}>
                  {value}
                </div>
                {tile.hint && <div className="text-[10px] text-muted-foreground">{tile.hint}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Agents */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Agent capacity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Agent</th>
                  <th className="text-left p-2">State</th>
                  <th className="text-left p-2">Current queue</th>
                  <th className="text-right p-2">Uncalled holding</th>
                  <th className="text-right p-2">Callbacks</th>
                  <th className="text-right p-2">Active sales</th>
                  <th className="text-right p-2">Timer</th>
                </tr>
              </thead>
              <tbody>
                {(snap?.agents ?? []).map(a => {
                  let state = 'Available';
                  let tone = 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
                  if (a.presence !== 'online') { state = 'Offline'; tone = 'bg-muted text-muted-foreground'; }
                  else if (a.live_calls > 0)   { state = 'Busy — on call'; tone = 'bg-blue-500/15 text-blue-700 border-blue-500/30'; }
                  else if (a.active_sales > 0) { state = 'On active sale'; tone = 'bg-violet-500/15 text-violet-700 border-violet-500/30'; }
                  else if (a.callbacks_owned > 0) { state = 'On callback'; tone = 'bg-amber-500/15 text-amber-700 border-amber-500/30'; }
                  else if (a.holding_uncalled > 0){ state = 'Holding uncalled lead'; tone = 'bg-orange-500/15 text-orange-700 border-orange-500/30'; }
                  return (
                    <tr key={a.agent_id} className="border-t">
                      <td className="p-2 font-medium">{a.agent_name}</td>
                      <td className="p-2"><Badge variant="outline" className={tone}>{state}</Badge></td>
                      <td className="p-2 text-xs text-muted-foreground">{a.current_queue ?? '—'}</td>
                      <td className="p-2 text-right">{a.holding_uncalled}</td>
                      <td className="p-2 text-right">{a.callbacks_owned}</td>
                      <td className="p-2 text-right">{a.active_sales}</td>
                      <td className="p-2 text-right font-mono text-xs">{formatDeadline(a.next_deadline)}</td>
                    </tr>
                  );
                })}
                {(!snap || snap.agents.length === 0) && (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground text-sm">No agents to display.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {Object.entries(WARNING_LABELS).map(([key, label]) => {
          const items = snap?.warnings?.[key] ?? [];
          const empty = items.length === 0;
          return (
            <Card key={key} className={empty ? '' : 'border-amber-500/50'}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className={`h-4 w-4 ${empty ? 'text-muted-foreground' : 'text-amber-600'}`} />
                  <span className="flex-1">{label}</span>
                  <Badge variant={empty ? 'secondary' : 'destructive'}>{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              {!empty && (
                <CardContent className="p-3 pt-0 max-h-56 overflow-y-auto">
                  <ul className="space-y-1 text-xs">
                    {items.slice(0, 20).map((it: any, idx: number) => (
                      <li key={idx} className="flex items-center gap-2 py-1 border-b last:border-0">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono">{it.phone_normalized ?? it.phone ?? '—'}</span>
                        {(it.first_name || it.last_name) && (
                          <span className="text-muted-foreground">{[it.first_name, it.last_name].filter(Boolean).join(' ')}</span>
                        )}
                        {it.n != null && <Badge variant="outline">{it.n}×</Badge>}
                        {it.orr_attempt_count != null && <Badge variant="outline">A{it.orr_attempt_count}</Badge>}
                        {it.orr_pool_kind && <Badge variant="outline">{it.orr_pool_kind}</Badge>}
                        {it.agent_name && <span className="ml-auto text-muted-foreground">{it.agent_name}</span>}
                      </li>
                    ))}
                    {items.length > 20 && (
                      <li className="text-muted-foreground pt-1">+ {items.length - 20} more…</li>
                    )}
                  </ul>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default QueueCapacityDashboard;
