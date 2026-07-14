import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Loader2, PhoneMissed, PhoneCall, Clock, AlertTriangle, Copy, ExternalLink, Play } from 'lucide-react';
import { toast } from 'sonner';

interface CallRow {
  id: string;
  callrail_call_id: string | null;
  status: string | null;
  direction: string | null;
  tracker_id: string | null;
  tracked_number: string | null;
  caller_number: string | null;
  assigned_admin_user_id: string | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  callback_lead_id: string | null;
  matched_lead_id: string | null;
  recording_url: string | null;
}

interface AgentRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

const RANGES = [
  { value: '1', label: 'Last 24h' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const fmtDuration = (secs: number | null | undefined) => {
  if (secs === null || secs === undefined || !isFinite(secs)) return '—';
  if (secs < 60) return `${Math.round(secs)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
};

const median = (arr: number[]) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const CallRailAnalyticsPanel = () => {
  const [days, setDays] = useState('7');
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [agents, setAgents] = useState<Record<string, AgentRow>>({});
  const [loading, setLoading] = useState(true);
  const [recentExpanded, setRecentExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString();
      const [callsRes, agentsRes] = await Promise.all([
        supabase
          .from('callrail_calls')
          .select('id,callrail_call_id,status,direction,tracker_id,tracked_number,caller_number,assigned_admin_user_id,started_at,answered_at,ended_at,duration_seconds,acknowledged_at,acknowledged_by,callback_lead_id,matched_lead_id,recording_url')
          .gte('started_at', since)
          .order('started_at', { ascending: false })
          .limit(1000),
        supabase.from('admin_users').select('id, first_name, last_name, email'),
      ]);
      if (cancelled) return;
      setCalls((callsRes.data as CallRow[]) || []);
      const map: Record<string, AgentRow> = {};
      ((agentsRes.data as AgentRow[]) || []).forEach((a) => (map[a.id] = a));
      setAgents(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const stats = useMemo(() => {
    // Screening cut-off: iPhone Live Voicemail, Google Call Screen, and carrier
    // spam verification systems pick the line up for a few seconds before a
    // human is ever reached. Any "answered" call under this threshold is
    // classified as Screened, not Answered.
    const SCREENED_MAX_SECONDS = 15;

    const isScreened = (c: CallRow) => {
      const d = c.duration_seconds ?? 0;
      if (c.status === 'screened') return true;
      // Historical rows written before the webhook fix: reclassify short
      // "completed" pick-ups as screened for reporting.
      return d > 0 && d < SCREENED_MAX_SECONDS;
    };
    const isAnswered = (c: CallRow) => {
      if (isScreened(c)) return false;
      return !!c.answered_at || (c.duration_seconds ?? 0) >= SCREENED_MAX_SECONDS;
    };
    const isMissed = (c: CallRow) =>
      !isAnswered(c) && !isScreened(c) && !c.answered_at && (c.duration_seconds ?? 0) === 0;

    const total = calls.length;
    const answered = calls.filter(isAnswered).length;
    const screened = calls.filter(isScreened).length;
    const missed = calls.filter(isMissed);
    const missedCount = missed.length;
    const acknowledged = missed.filter((c) => !!c.acknowledged_at);
    const unacknowledged = missed.filter((c) => !c.acknowledged_at);

    const ackTimes = acknowledged
      .map((c) => {
        const start = c.started_at ? new Date(c.started_at).getTime() : null;
        const ack = c.acknowledged_at ? new Date(c.acknowledged_at).getTime() : null;
        return start && ack ? (ack - start) / 1000 : null;
      })
      .filter((v): v is number => v !== null && v >= 0);

    const medianAck = median(ackTimes);
    const avgAck = ackTimes.length ? ackTimes.reduce((a, b) => a + b, 0) / ackTimes.length : null;
    const converted = missed.filter((c) => !!c.callback_lead_id || !!c.matched_lead_id).length;

    // Missed by reason
    const reasons: Record<string, number> = {};
    missed.forEach((c) => {
      const key = c.status || 'unknown';
      reasons[key] = (reasons[key] || 0) + 1;
    });

    // Per-agent (assigned_admin_user_id) missed handling
    const perAgent: Record<string, { assigned: number; acked: number; ackTimes: number[]; unacked: number }> = {};
    missed.forEach((c) => {
      const key = c.assigned_admin_user_id || 'unassigned';
      if (!perAgent[key]) perAgent[key] = { assigned: 0, acked: 0, ackTimes: [], unacked: 0 };
      perAgent[key].assigned++;
      if (c.acknowledged_at) {
        perAgent[key].acked++;
        const start = c.started_at ? new Date(c.started_at).getTime() : null;
        const ack = new Date(c.acknowledged_at).getTime();
        if (start) perAgent[key].ackTimes.push((ack - start) / 1000);
      } else {
        perAgent[key].unacked++;
      }
    });

    // Per-tracker
    const perTracker: Record<string, { number: string; total: number; missed: number }> = {};
    calls.forEach((c) => {
      const key = c.tracker_id || 'unknown';
      if (!perTracker[key]) perTracker[key] = { number: c.tracked_number || '—', total: 0, missed: 0 };
      perTracker[key].total++;
      if (isMissed(c)) perTracker[key].missed++;
    });

    return {
      total,
      answered,
      screened,
      missedCount,
      acknowledgedCount: acknowledged.length,
      unacknowledgedCount: unacknowledged.length,
      medianAck,
      avgAck,
      converted,
      reasons,
      perAgent,
      perTracker,
    };
  }, [calls]);

  const agentName = (id: string) => {
    if (id === 'unassigned') return 'Unassigned / no owner';
    const a = agents[id];
    if (!a) return id.slice(0, 8);
    const n = [a.first_name, a.last_name].filter(Boolean).join(' ').trim();
    return n || a.email;
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Inbound Call Analytics
            <Badge variant="secondary" className="ml-2 text-[10px]">Management &amp; Lead Gen</Badge>
          </CardTitle>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Time-to-acknowledge, miss reasons, and per-agent handling of inbound calls.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : calls.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
            No inbound calls recorded in this window yet.
          </div>
        ) : (
          <>
            {/* Top KPI tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <PhoneCall className="h-3.5 w-3.5" /> Total calls
                </div>
                <div className="text-2xl font-semibold mt-1">{stats.total}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {stats.answered} answered · {stats.screened} screened · {stats.missedCount} missed
                </div>
              </div>
              <div className="rounded-md border p-3 bg-red-50/40 border-red-200">
                <div className="flex items-center gap-2 text-xs text-red-700">
                  <PhoneMissed className="h-3.5 w-3.5" /> Missed
                </div>
                <div className="text-2xl font-semibold mt-1 text-red-700">{stats.missedCount}</div>
                <div className="text-[11px] text-red-600 mt-0.5">
                  {stats.unacknowledgedCount} still unacknowledged
                </div>
              </div>
              <div className="rounded-md border p-3 bg-amber-50/40 border-amber-200">
                <div className="flex items-center gap-2 text-xs text-amber-700">
                  <Clock className="h-3.5 w-3.5" /> Median time to acknowledge
                </div>
                <div className="text-2xl font-semibold mt-1 text-amber-700">{fmtDuration(stats.medianAck)}</div>
                <div className="text-[11px] text-amber-700 mt-0.5">
                  avg {fmtDuration(stats.avgAck)} · {stats.acknowledgedCount} acked
                </div>
              </div>
              <div className="rounded-md border p-3 bg-emerald-50/40 border-emerald-200">
                <div className="flex items-center gap-2 text-xs text-emerald-700">
                  <PhoneCall className="h-3.5 w-3.5" /> Converted to lead
                </div>
                <div className="text-2xl font-semibold mt-1 text-emerald-700">{stats.converted}</div>
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  from missed calls linked to a lead
                </div>
              </div>
            </div>

            {/* Miss reasons */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" /> Miss reasons
              </h4>
              {Object.keys(stats.reasons).length === 0 ? (
                <div className="text-xs text-muted-foreground">No missed calls in this window.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.reasons)
                    .sort((a, b) => b[1] - a[1])
                    .map(([reason, count]) => (
                      <Badge key={reason} variant="outline" className="text-xs">
                        {reason.replace(/_/g, ' ')} · {count}
                      </Badge>
                    ))}
                </div>
              )}
            </div>

            {/* Per-agent handling */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Per-agent missed-call handling</h4>
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-2 px-3 font-medium">Assigned agent</th>
                      <th className="py-2 px-3 font-medium text-right">Missed routed</th>
                      <th className="py-2 px-3 font-medium text-right">Acknowledged</th>
                      <th className="py-2 px-3 font-medium text-right">Unacknowledged</th>
                      <th className="py-2 px-3 font-medium text-right">Median ack time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.perAgent)
                      .sort((a, b) => b[1].assigned - a[1].assigned)
                      .map(([id, row]) => (
                        <tr key={id} className="border-t">
                          <td className="py-2 px-3">{agentName(id)}</td>
                          <td className="py-2 px-3 text-right">{row.assigned}</td>
                          <td className="py-2 px-3 text-right">{row.acked}</td>
                          <td className="py-2 px-3 text-right">
                            {row.unacked > 0 ? (
                              <span className="text-red-600 font-medium">{row.unacked}</span>
                            ) : (
                              0
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">{fmtDuration(median(row.ackTimes))}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per-tracker */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Per tracking number</h4>
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-2 px-3 font-medium">Tracked number</th>
                      <th className="py-2 px-3 font-medium text-right">Total</th>
                      <th className="py-2 px-3 font-medium text-right">Missed</th>
                      <th className="py-2 px-3 font-medium text-right">Miss rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.perTracker)
                      .sort((a, b) => b[1].total - a[1].total)
                      .map(([id, row]) => {
                        const rate = row.total ? Math.round((row.missed / row.total) * 100) : 0;
                        return (
                          <tr key={id} className="border-t">
                            <td className="py-2 px-3 font-mono text-xs">{row.number}</td>
                            <td className="py-2 px-3 text-right">{row.total}</td>
                            <td className="py-2 px-3 text-right">{row.missed}</td>
                            <td className="py-2 px-3 text-right">
                              <span className={rate >= 30 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                                {rate}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent calls — CallRail provenance */}
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h4 className="text-sm font-semibold">Recent CallRail calls (verification)</h4>
                <span className="text-[11px] text-muted-foreground">
                  Every row shows the exact CallRail Call ID + link to CallRail's own dashboard as proof of source.
                </span>
              </div>
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-2 px-3 font-medium">When</th>
                      <th className="py-2 px-3 font-medium">Caller</th>
                      <th className="py-2 px-3 font-medium">CallRail Call ID</th>
                      <th className="py-2 px-3 font-medium">Tracker</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-3 font-medium text-right">Duration</th>
                      <th className="py-2 px-3 font-medium text-right">Verify</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recentExpanded ? calls.slice(0, 50) : calls.slice(0, 5)).map((c) => {
                      const cid = c.callrail_call_id;
                      const crUrl = cid ? `https://app.callrail.com/calls/${cid}` : null;
                      return (
                        <tr key={c.id} className="border-t align-top">
                          <td className="py-2 px-3 whitespace-nowrap text-xs">
                            {c.started_at ? new Date(c.started_at).toLocaleString('en-GB') : '—'}
                          </td>
                          <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">
                            {c.caller_number || '—'}
                          </td>
                          <td className="py-2 px-3">
                            {cid ? (
                              <div className="flex items-center gap-1">
                                <code className="font-mono text-[11px] bg-muted/60 px-1.5 py-0.5 rounded">
                                  {cid}
                                </code>
                                <button
                                  type="button"
                                  className="p-1 rounded hover:bg-muted"
                                  onClick={() => {
                                    navigator.clipboard.writeText(cid);
                                    toast.success('CallRail Call ID copied');
                                  }}
                                  title="Copy Call ID"
                                >
                                  <Copy className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">
                            {c.tracker_id || '—'}
                          </td>
                          <td className="py-2 px-3 text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {c.status || 'unknown'}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right text-xs">
                            {fmtDuration(c.duration_seconds)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {c.recording_url && (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  title="Play recording (CallRail)"
                                >
                                  <a href={c.recording_url} target="_blank" rel="noreferrer">
                                    <Play className="h-3 w-3" />
                                  </a>
                                </Button>
                              )}
                              {crUrl && (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px]"
                                  title="Open in CallRail"
                                >
                                  <a href={crUrl} target="_blank" rel="noreferrer">
                                    Open in CallRail <ExternalLink className="h-3 w-3 ml-1" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {calls.length > 5 && (
                <div className="flex justify-center mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRecentExpanded((v) => !v)}
                  >
                    {recentExpanded
                      ? 'Collapse'
                      : `Show all (${Math.min(calls.length, 50)})`}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
