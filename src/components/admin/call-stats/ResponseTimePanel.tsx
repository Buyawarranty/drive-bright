import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Timer, Gauge } from 'lucide-react';
import { formatResponseTime, responseTone } from '@/hooks/useLeadResponseTime';

/**
 * Response times per agent for the Live Calls Data page.
 *
 * "Response time" = seconds between a lead arriving and the owning agent's
 * first action on it (call logged, quick note written, or status changed).
 * Managers see every agent; an agent sees only their own row.
 */

interface Props {
  dateFrom: Date;
  dateTo: Date;
  /** Managers: null/undefined. Agents: their own admin_users id only. */
  restrictToAgentIds?: string[] | null;
  selfView?: boolean;
}

interface AgentStat {
  agentId: string;
  name: string;
  responded: number;
  total: number;
  avg: number;
  fastest: number;
  slowest: number;
  withinTarget: number;
}

export const ResponseTimePanel: React.FC<Props> = ({ dateFrom, dateTo, restrictToAgentIds, selfView }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AgentStat[]>([]);

  const restrictKey = (restrictToAgentIds || []).join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999);

      let q = supabase
        .from('sales_leads')
        .select('id, created_at, assigned_to')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .not('assigned_to', 'is', null)
        .limit(5000);
      if (restrictToAgentIds && restrictToAgentIds.length > 0) {
        q = q.in('assigned_to', restrictToAgentIds);
      }
      const { data: leads } = await q;
      if (cancelled) return;

      const leadRows = (leads as any[]) || [];
      const createdById: Record<string, string> = {};
      const ownerById: Record<string, string> = {};
      leadRows.forEach(l => { createdById[l.id] = l.created_at; ownerById[l.id] = l.assigned_to; });
      const ids = Object.keys(createdById);

      const firstAction: Record<string, string> = {};
      const consider = (leadId: string, at?: string | null) => {
        if (!leadId || !at || !createdById[leadId]) return;
        if (!firstAction[leadId] || new Date(at).getTime() < new Date(firstAction[leadId]).getTime()) {
          firstAction[leadId] = at;
        }
      };

      for (let i = 0; i < ids.length; i += 200) {
        const batch = ids.slice(i, i + 200);
        const [calls, notes, changes] = await Promise.all([
          supabase.from('lead_call_logs').select('lead_id, created_at').in('lead_id', batch),
          supabase.from('lead_quick_notes').select('lead_id, created_at').in('lead_id', batch).not('created_by', 'is', null),
          supabase
            .from('sales_leads_changelog')
            .select('lead_id, changed_at, old_status, new_status')
            .in('lead_id', batch)
            .not('changed_by', 'is', null),
        ]);
        if (cancelled) return;
        (calls.data as any[] || []).forEach(r => consider(r.lead_id, r.created_at));
        (notes.data as any[] || []).forEach(r => consider(r.lead_id, r.created_at));
        (changes.data as any[] || []).forEach(r => {
          if (!r.new_status || r.old_status === r.new_status) return;
          consider(r.lead_id, r.changed_at);
        });
      }

      const ownerIds = Array.from(new Set(Object.values(ownerById)));
      const { data: owners } = ownerIds.length
        ? await supabase.from('admin_users').select('id, first_name, last_name, email').in('id', ownerIds)
        : { data: [] as any[] };
      if (cancelled) return;
      const nameById: Record<string, string> = {};
      (owners as any[] || []).forEach(u => {
        nameById[u.id] = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;
      });

      const buckets = new Map<string, { secs: number[]; total: number }>();
      ids.forEach(leadId => {
        const agentId = ownerById[leadId];
        if (!buckets.has(agentId)) buckets.set(agentId, { secs: [], total: 0 });
        const b = buckets.get(agentId)!;
        b.total += 1;
        const at = firstAction[leadId];
        if (at) {
          const sec = Math.max(0, Math.round((new Date(at).getTime() - new Date(createdById[leadId]).getTime()) / 1000));
          b.secs.push(sec);
        }
      });

      const rows: AgentStat[] = Array.from(buckets.entries()).map(([agentId, b]) => {
        const secs = b.secs;
        const sum = secs.reduce((a, c) => a + c, 0);
        return {
          agentId,
          name: nameById[agentId] || 'Unknown agent',
          responded: secs.length,
          total: b.total,
          avg: secs.length ? Math.round(sum / secs.length) : 0,
          fastest: secs.length ? Math.min(...secs) : 0,
          slowest: secs.length ? Math.max(...secs) : 0,
          withinTarget: secs.filter(s => s <= 120).length,
        };
      }).sort((a, b) => (a.avg || Infinity) - (b.avg || Infinity));

      setStats(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, restrictKey]);

  const overall = useMemo(() => {
    const responded = stats.reduce((a, s) => a + s.responded, 0);
    if (!responded) return null;
    const avg = Math.round(stats.reduce((a, s) => a + s.avg * s.responded, 0) / responded);
    return {
      avg,
      fastest: Math.min(...stats.filter(s => s.responded).map(s => s.fastest)),
      slowest: Math.max(...stats.filter(s => s.responded).map(s => s.slowest)),
      responded,
      withinTarget: stats.reduce((a, s) => a + s.withinTarget, 0),
    };
  }, [stats]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="w-4 h-4" />
          {selfView ? 'My response times' : 'Response times by agent'}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Time from a lead arriving to the first action on it — a logged call, a note, or a status
          change. Target is 120 seconds.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : !overall ? (
          <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
            No responded leads in this window yet.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-md border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Average</div>
                <div className={`text-lg font-bold ${responseTone(overall.avg)}`}>{formatResponseTime(overall.avg)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Fastest</div>
                <div className="text-lg font-bold text-emerald-700">{formatResponseTime(overall.fastest)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Slowest</div>
                <div className="text-lg font-bold text-rose-700">{formatResponseTime(overall.slowest)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Within 120s</div>
                <div className="text-lg font-bold">
                  {Math.round((overall.withinTarget / overall.responded) * 100)}%
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({overall.withinTarget}/{overall.responded})
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-2 px-3 font-medium">Agent</th>
                    <th className="py-2 px-3 font-medium text-right">Leads</th>
                    <th className="py-2 px-3 font-medium text-right">Responded</th>
                    <th className="py-2 px-3 font-medium text-right">Average</th>
                    <th className="py-2 px-3 font-medium text-right">Fastest</th>
                    <th className="py-2 px-3 font-medium text-right">Slowest</th>
                    <th className="py-2 px-3 font-medium text-right">Within 120s</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map(s => (
                    <tr key={s.agentId} className="border-t">
                      <td className="py-2 px-3 font-medium flex items-center gap-2">
                        <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                        {s.name}
                      </td>
                      <td className="py-2 px-3 text-right">{s.total}</td>
                      <td className="py-2 px-3 text-right">{s.responded}</td>
                      <td className={`py-2 px-3 text-right font-semibold ${responseTone(s.responded ? s.avg : null)}`}>
                        {s.responded ? formatResponseTime(s.avg) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-700">
                        {s.responded ? formatResponseTime(s.fastest) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-rose-700">
                        {s.responded ? formatResponseTime(s.slowest) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {s.responded ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {Math.round((s.withinTarget / s.responded) * 100)}%
                          </Badge>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ResponseTimePanel;
