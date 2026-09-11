import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Clock, PhoneMissed, Headset } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Handover = {
  id: string;
  thread_id: string;
  status: string;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
  customer_name: string | null;
  registration: string | null;
};

type AgentMessage = { thread_id: string; created_at: string };

type StaffRow = {
  id: string;
  name: string;
  handled: number;
  avgSeconds: number | null;
  slowest: number | null;
};

const fmt = (seconds: number | null) => {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
};

/**
 * How quickly staff answer website chats — and which live customers were left
 * without any reply at all.
 */
export default function ChatResponseStatsPanel({
  fromIso,
  toIso,
}: {
  fromIso?: string | null;
  toIso?: string | null;
}) {
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let hq = supabase
      .from('ai_sandbox_handovers')
      .select('id, thread_id, status, claimed_by, claimed_at, created_at, customer_name, registration')
      .eq('kind', 'live_handover')
      .order('created_at', { ascending: false })
      .limit(500);
    if (fromIso) hq = hq.gte('created_at', fromIso);
    if (toIso) hq = hq.lte('created_at', toIso);

    let mq = supabase
      .from('ai_sandbox_messages')
      .select('thread_id, created_at')
      .eq('role', 'agent')
      .order('created_at', { ascending: true })
      .limit(2000);
    if (fromIso) mq = mq.gte('created_at', fromIso);
    if (toIso) mq = mq.lte('created_at', toIso);

    const [{ data: h }, { data: m }, { data: staff }] = await Promise.all([
      hq,
      mq,
      supabase.from('admin_users').select('user_id, first_name, last_name, email'),
    ]);
    setHandovers((h ?? []) as Handover[]);
    setAgentMessages((m ?? []) as AgentMessage[]);
    const names: Record<string, string> = {};
    (staff ?? []).forEach((s: any) => {
      if (!s.user_id) return;
      const full = [s.first_name, s.last_name].filter(Boolean).join(' ').trim();
      names[s.user_id] = full || s.email || 'Staff member';
    });
    setStaffNames(names);
    setLoading(false);
  }, [fromIso, toIso]);

  useEffect(() => {
    void load();
  }, [load]);

  const analysis = useMemo(() => {
    const firstAgentAt = new Map<string, string>();
    agentMessages.forEach((m) => {
      if (!firstAgentAt.has(m.thread_id)) firstAgentAt.set(m.thread_id, m.created_at);
    });

    const answered: Array<{ handover: Handover; seconds: number }> = [];
    const missed: Handover[] = [];

    handovers.forEach((h) => {
      const reply = firstAgentAt.get(h.thread_id) ?? h.claimed_at;
      if (reply && reply >= h.created_at) {
        answered.push({
          handover: h,
          seconds: (new Date(reply).getTime() - new Date(h.created_at).getTime()) / 1000,
        });
      } else {
        missed.push(h);
      }
    });

    const byStaff = new Map<string, number[]>();
    answered.forEach(({ handover, seconds }) => {
      const key = handover.claimed_by ?? 'unknown';
      const list = byStaff.get(key) ?? [];
      list.push(seconds);
      byStaff.set(key, list);
    });

    const staffRows: StaffRow[] = [...byStaff.entries()]
      .map(([id, list]) => ({
        id,
        name: id === 'unknown' ? 'Not recorded' : staffNames[id] ?? 'Staff member',
        handled: list.length,
        avgSeconds: list.reduce((a, b) => a + b, 0) / list.length,
        slowest: Math.max(...list),
      }))
      .sort((a, b) => b.handled - a.handled);

    const all = answered.map((a) => a.seconds);
    return {
      answered,
      missed,
      staffRows,
      total: handovers.length,
      avgSeconds: all.length ? all.reduce((a, b) => a + b, 0) / all.length : null,
      within20: all.length ? Math.round((all.filter((s) => s <= 20).length / all.length) * 100) : null,
    };
  }, [handovers, agentMessages, staffNames]);

  const chartData = analysis.staffRows.map((s) => ({
    name: s.name.split(' ')[0],
    seconds: Math.round(s.avgSeconds ?? 0),
    handled: s.handled,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
        <span className="text-xs text-muted-foreground">
          Live-chat requests, who answered them and how long the customer waited.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Customers asking for a person</p>
            <p className="text-2xl font-bold">{analysis.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Average time to first reply</p>
            <p className="text-2xl font-bold">{fmt(analysis.avgSeconds)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Answered within 20 seconds</p>
            <p className="text-2xl font-bold">
              {analysis.within20 === null ? '—' : `${analysis.within20}%`}
            </p>
          </CardContent>
        </Card>
        <Card className={analysis.missed.length ? 'border-rose-300' : undefined}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Never replied to</p>
            <p className="text-2xl font-bold text-rose-700">{analysis.missed.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Average reply time by member of staff
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chats were answered in this period.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis unit="s" />
                  <ReTooltip
                    formatter={(v: any, key: any) =>
                      key === 'seconds' ? [`${v}s`, 'Average reply'] : [v, 'Chats answered']
                    }
                  />
                  <Bar dataKey="seconds" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 space-y-1">
            {analysis.staffRows.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Headset className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{s.name}</span>
                <Badge variant="outline">{s.handled} answered</Badge>
                <Badge variant="outline">average {fmt(s.avgSeconds)}</Badge>
                <Badge variant="outline">slowest {fmt(s.slowest)}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className={analysis.missed.length ? 'border-rose-300' : undefined}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PhoneMissed className="h-4 w-4 text-rose-600" /> Live customers nobody replied to
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysis.missed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every customer who asked for a person got a reply. 
            </p>
          ) : (
            <div className="space-y-1">
              {analysis.missed.slice(0, 40).map((h) => (
                <div key={h.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge className="border-rose-200 bg-rose-100 text-rose-800">No reply</Badge>
                  <span>{new Date(h.created_at).toLocaleString('en-GB')}</span>
                  {h.customer_name && <span className="font-semibold">{h.customer_name}</span>}
                  {h.registration && <Badge variant="outline">{h.registration}</Badge>}
                  <a
                    className="text-xs font-semibold text-primary underline"
                    href={`/admin-dashboard/?tab=chatbot-data&chatThread=${h.thread_id}`}
                  >
                    Open the chat
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
