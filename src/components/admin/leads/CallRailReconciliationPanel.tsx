import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Loader2, PhoneOutgoing, ShieldAlert, StickyNote, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Call rail reconciliation
 *
 * For every inbound Call rail call we check whether the sales team has since
 * dialled that customer back through Zoiper / Dial 9 (phone_events) or logged a
 * call attempt (lead_call_logs), and surface the note that was written so
 * management can see the follow-up actually happened.
 */

interface CallRow {
  id: string;
  caller_number: string | null;
  caller_name: string | null;
  tracked_number: string | null;
  status: string | null;
  direction: string | null;
  duration_seconds: number | null;
  started_at: string | null;
  matched_lead_id: string | null;
  matched_customer_id: string | null;
}

interface FollowUp {
  at: string;
  agentName: string | null;
  outcome: string | null;
  notes: string | null;
  channel: 'zoiper' | 'call_log';
}

const RANGES = [
  { value: '1', label: 'Last 24h' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
];

const tail9 = (v?: string | null) => {
  const digits = (v || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : '';
};

const fmt = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const OUTBOUND_EVENTS = new Set([
  'phone_clicked',
  'spoken_to_selected',
  'no_answer_selected',
  'voicemail_selected',
  'busy_selected',
  'callback_requested',
  'wrong_number_selected',
  'not_interested_selected',
]);

export const CallRailReconciliationPanel = () => {
  const [days, setDays] = useState('7');
  const [filter, setFilter] = useState<'all' | 'done' | 'missing'>('all');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [followUps, setFollowUps] = useState<Record<string, FollowUp[]>>({});
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - parseInt(days) * 86400000).toISOString();

      const { data: callData } = await supabase
        .from('callrail_calls')
        .select(
          'id,caller_number,caller_name,tracked_number,status,direction,duration_seconds,started_at,matched_lead_id,matched_customer_id'
        )
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(500);

      const rows = ((callData as CallRow[]) || []).filter((c) => (c.direction ?? 'inbound') !== 'outbound');
      if (cancelled) return;
      setCalls(rows);

      const [eventsRes, logsRes] = await Promise.all([
        supabase
          .from('phone_events')
          .select('phone_number, agent_name, event_type, selected_outcome, created_at, lead_id')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(3000),
        supabase
          .from('lead_call_logs')
          .select('phone_normalized, agent_name, outcome, notes, created_at, lead_id')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(3000),
      ]);
      if (cancelled) return;

      // Bucket every outbound signal by phone tail-9 and by lead id.
      const byKey: Record<string, FollowUp[]> = {};
      const push = (key: string, f: FollowUp) => {
        if (!key) return;
        (byKey[key] ||= []).push(f);
      };

      ((eventsRes.data as any[]) || []).forEach((e) => {
        if (!OUTBOUND_EVENTS.has(e.event_type)) return;
        const f: FollowUp = {
          at: e.created_at,
          agentName: e.agent_name ?? null,
          outcome: e.selected_outcome ?? e.event_type ?? null,
          notes: null,
          channel: 'zoiper',
        };
        push(`p:${tail9(e.phone_number)}`, f);
        if (e.lead_id) push(`l:${e.lead_id}`, f);
      });

      ((logsRes.data as any[]) || []).forEach((l) => {
        const f: FollowUp = {
          at: l.created_at,
          agentName: l.agent_name ?? null,
          outcome: l.outcome ?? null,
          notes: l.notes ?? null,
          channel: 'call_log',
        };
        push(`p:${tail9(l.phone_normalized)}`, f);
        if (l.lead_id) push(`l:${l.lead_id}`, f);
      });

      // Attach to each call anything that happened at/after the inbound call.
      const map: Record<string, FollowUp[]> = {};
      rows.forEach((c) => {
        const keys = [`p:${tail9(c.caller_number)}`, c.matched_lead_id ? `l:${c.matched_lead_id}` : ''];
        const startedMs = c.started_at ? new Date(c.started_at).getTime() : 0;
        const seen = new Set<string>();
        const list: FollowUp[] = [];
        keys.forEach((k) => {
          (byKey[k] || []).forEach((f) => {
            if (new Date(f.at).getTime() < startedMs - 60_000) return;
            const sig = `${f.at}|${f.channel}|${f.agentName}`;
            if (seen.has(sig)) return;
            seen.add(sig);
            list.push(f);
          });
        });
        list.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
        map[c.id] = list;
      });

      setFollowUps(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [days, reloadKey]);

  const stats = useMemo(() => {
    let done = 0;
    let withNote = 0;
    calls.forEach((c) => {
      const f = followUps[c.id] || [];
      if (f.length) done += 1;
      if (f.some((x) => x.notes && x.notes.trim())) withNote += 1;
    });
    return { total: calls.length, done, missing: calls.length - done, withNote };
  }, [calls, followUps]);

  const visible = useMemo(() => {
    return calls.filter((c) => {
      const has = (followUps[c.id] || []).length > 0;
      if (filter === 'done') return has;
      if (filter === 'missing') return !has;
      return true;
    });
  }, [calls, followUps, filter]);

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <PhoneOutgoing className="w-5 h-5" />
            Call reconciliation — has sales rung them back?
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Matches each inbound Call rail call to Zoiper / Dial 9 activity and logged call notes on the same number,
          so you can see the follow-up was actually made.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Inbound calls', value: stats.total, tone: 'text-foreground' },
            { label: 'Rung back by sales', value: stats.done, tone: 'text-green-600' },
            { label: 'No follow-up yet', value: stats.missing, tone: 'text-red-600' },
            { label: 'With call notes', value: stats.withNote, tone: 'text-blue-600' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border p-3">
              <div className={`text-2xl font-bold ${s.tone}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {(
            [
              ['all', `All (${stats.total})`],
              ['done', `Reconciled (${stats.done})`],
              ['missing', `Not contacted (${stats.missing})`],
            ] as const
          ).map(([k, label]) => (
            <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} onClick={() => setFilter(k)}>
              {label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No calls for this period.</p>
        ) : (
          <div className="space-y-2">
            {visible.map((c) => {
              const list = followUps[c.id] || [];
              const first = list[0];
              const noted = list.find((f) => f.notes && f.notes.trim());
              return (
                <div
                  key={c.id}
                  className={`rounded-lg border-2 p-3 ${
                    list.length ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {list.length ? (
                      <Badge className="bg-green-600 hover:bg-green-600 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Rung back
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldAlert className="w-3 h-3" /> No follow-up
                      </Badge>
                    )}
                    <span className="font-mono font-semibold">{c.caller_number || '—'}</span>
                    {c.caller_name && <span className="text-sm text-muted-foreground">{c.caller_name}</span>}
                    <span className="text-xs text-muted-foreground">Called in {fmt(c.started_at)}</span>
                    {c.status && (
                      <Badge variant="outline" className="text-xs">
                        {c.status}
                      </Badge>
                    )}
                    {c.matched_lead_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 ml-auto"
                        onClick={() =>
                          navigate(`/admin-dashboard/?tab=new-leads&leadId=${c.matched_lead_id}`)
                        }
                      >
                        Open lead
                      </Button>
                    )}
                  </div>

                  {first ? (
                    <div className="mt-2 text-sm space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <PhoneOutgoing className="w-3.5 h-3.5 text-green-600" />
                        <span className="font-medium">{first.agentName || 'Unknown agent'}</span>
                        <span className="text-muted-foreground">{fmt(first.at)}</span>
                        <Badge variant="outline" className="text-xs">
                          {first.channel === 'zoiper' ? 'Zoiper / Dial 9' : 'Call log'}
                        </Badge>
                        {first.outcome && (
                          <span className="text-xs text-muted-foreground">{first.outcome.replace(/_/g, ' ')}</span>
                        )}
                        {list.length > 1 && (
                          <span className="text-xs text-muted-foreground">+{list.length - 1} more attempt(s)</span>
                        )}
                      </div>
                      {noted ? (
                        <div className="flex items-start gap-2 rounded border bg-white p-2">
                          <StickyNote className="w-3.5 h-3.5 mt-0.5 text-blue-600 shrink-0" />
                          <span className="text-xs whitespace-pre-wrap">{noted.notes}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700">Dialled, but no call note written yet.</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-red-700">
                      No Zoiper / Dial 9 dial or call log recorded for this number since the call came in.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
