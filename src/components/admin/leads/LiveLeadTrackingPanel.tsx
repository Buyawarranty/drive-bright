import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, AlarmClock, CheckCircle2, PhoneOff, Timer, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  userRole: string | null | undefined;
}

const ALLOWED_ROLES = new Set([
  'super_admin',
  'admin',
  'sales_manager',
  'performance_manager',
  'accounts_manager',
  'sales_lead',
]);

// A lead is considered "missed" if it was assigned more than this long ago
// and the assigned agent still hasn't logged a note or a call for it.
const MISSED_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const WINDOW_MS = 24 * 60 * 60 * 1000; // last 24h
const TERMINAL = new Set(['lost', 'converted', 'fake_lead', 'sale_made']);

interface LeadRow {
  id: string;
  assigned_to: string | null;
  assigned_at: string | null;
  created_at: string;
  status: string | null;
}

interface AgentRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface AgentStat {
  adminId: string;
  name: string;
  total: number;
  actioned: number;
  missed: number; // assigned > threshold ago AND still no action
  pending: number; // assigned but under threshold, no action yet
  avgResponseMinutes: number | null;
}

export const LiveLeadTrackingPanel: React.FC<Props> = ({ userRole }) => {
  const canSee = !!userRole && ALLOWED_ROLES.has(userRole);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [agents, setAgents] = useState<Record<string, AgentRow>>({});
  const [firstActionAt, setFirstActionAt] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    if (!canSee) return;
    setLoading(true);
    const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();
    const { data: leadRows } = await supabase
      .from('sales_leads')
      .select('id, assigned_to, assigned_at, created_at, status')
      .gte('created_at', sinceIso)
      .not('assigned_to', 'is', null)
      .limit(1000);

    const rows = (leadRows || []) as LeadRow[];
    setLeads(rows);

    const agentIds = Array.from(new Set(rows.map(r => r.assigned_to).filter(Boolean))) as string[];
    if (agentIds.length > 0) {
      const { data: agentData } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email')
        .in('id', agentIds);
      const map: Record<string, AgentRow> = {};
      (agentData || []).forEach((a: any) => { map[a.id] = a; });
      setAgents(map);
    } else {
      setAgents({});
    }

    const leadIds = rows.map(r => r.id);
    if (leadIds.length > 0) {
      const chunks: string[][] = [];
      for (let i = 0; i < leadIds.length; i += 200) chunks.push(leadIds.slice(i, i + 200));
      const actionMap: Record<string, number> = {};
      for (const ch of chunks) {
        const [notesRes, callsRes] = await Promise.all([
          supabase.from('lead_quick_notes').select('lead_id, created_by, created_at').in('lead_id', ch),
          supabase.from('lead_call_logs').select('lead_id, agent_id, created_at').in('lead_id', ch),
        ]);
        (notesRes.data || []).forEach((n: any) => {
          const key = `${n.lead_id}:${n.created_by}`;
          const t = new Date(n.created_at).getTime();
          if (!actionMap[key] || t < actionMap[key]) actionMap[key] = t;
        });
        (callsRes.data || []).forEach((c: any) => {
          const key = `${c.lead_id}:${c.agent_id}`;
          const t = new Date(c.created_at).getTime();
          if (!actionMap[key] || t < actionMap[key]) actionMap[key] = t;
        });
      }
      setFirstActionAt(actionMap);
    } else {
      setFirstActionAt({});
    }
    setLoading(false);
  }, [canSee]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!canSee) return;
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [canSee, load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const byAgent: Record<string, AgentStat> = {};
    let totals = { total: 0, actioned: 0, missed: 0, pending: 0 };
    const responseTimes: number[] = [];

    for (const l of leads) {
      if (!l.assigned_to) continue;
      if (TERMINAL.has((l.status || '').toLowerCase())) continue;
      const assignedAt = new Date(l.assigned_at || l.created_at).getTime();
      const actionAt = firstActionAt[`${l.id}:${l.assigned_to}`];
      const agent = agents[l.assigned_to];
      const name = agent
        ? (`${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email || 'Unknown')
        : 'Unknown';
      const s = byAgent[l.assigned_to] ||= {
        adminId: l.assigned_to,
        name,
        total: 0,
        actioned: 0,
        missed: 0,
        pending: 0,
        avgResponseMinutes: null,
      };
      s.total += 1;
      totals.total += 1;
      if (actionAt && actionAt >= assignedAt) {
        s.actioned += 1;
        totals.actioned += 1;
        const resp = actionAt - assignedAt;
        responseTimes.push(resp);
        (s as any)._sum = ((s as any)._sum || 0) + resp;
        (s as any)._n = ((s as any)._n || 0) + 1;
      } else {
        const age = now - assignedAt;
        if (age >= MISSED_THRESHOLD_MS) {
          s.missed += 1;
          totals.missed += 1;
        } else {
          s.pending += 1;
          totals.pending += 1;
        }
      }
    }

    const rows = Object.values(byAgent).map(s => {
      const sum = (s as any)._sum as number | undefined;
      const n = (s as any)._n as number | undefined;
      s.avgResponseMinutes = sum && n ? Math.round(sum / n / 60000) : null;
      return s;
    }).sort((a, b) => b.missed - a.missed || b.total - a.total);

    const avgAll = responseTimes.length
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 60000)
      : null;

    return { rows, totals, avgAll };
  }, [leads, agents, firstActionAt, now]);

  if (!canSee) return null;

  return (
    <Card className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/60 to-white shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
            <Activity className="h-4 w-4 text-emerald-700" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-900">Live Tracking</h3>
            <span className="text-xs text-muted-foreground">
              · Missed new-lead alerts (last 24h · flagged after {MISSED_THRESHOLD_MS / 60000}m of no note or call)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {loading ? 'refreshing…' : `updated ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
            </span>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setCollapsed(c => !c)}>
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Tile icon={<Users className="h-4 w-4" />} label="Assigned (24h)" value={stats.totals.total} tone="slate" />
          <Tile icon={<PhoneOff className="h-4 w-4" />} label="Missed" value={stats.totals.missed} tone="red" />
          <Tile icon={<AlarmClock className="h-4 w-4" />} label="Pending (<30m)" value={stats.totals.pending} tone="amber" />
          <Tile icon={<CheckCircle2 className="h-4 w-4" />} label="Actioned" value={stats.totals.actioned} tone="emerald" />
          <Tile icon={<Timer className="h-4 w-4" />} label="Avg response" value={stats.avgAll != null ? `${stats.avgAll}m` : '—'} tone="blue" />
        </div>

        {!collapsed && (
          <div className="border rounded-md overflow-hidden bg-white">
            <div className="grid grid-cols-12 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-slate-50 border-b px-3 py-2">
              <div className="col-span-4">Agent</div>
              <div className="col-span-2 text-right">Assigned</div>
              <div className="col-span-2 text-right">Missed</div>
              <div className="col-span-2 text-right">Actioned</div>
              <div className="col-span-2 text-right">Avg response</div>
            </div>
            {stats.rows.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No assigned leads in the last 24 hours.
              </div>
            )}
            {stats.rows.map(r => {
              const missRate = r.total ? r.missed / r.total : 0;
              return (
                <div
                  key={r.adminId}
                  className={cn(
                    'grid grid-cols-12 items-center px-3 py-2 text-sm border-b last:border-b-0',
                    r.missed > 0 && 'bg-red-50/40'
                  )}
                >
                  <div className="col-span-4 font-medium truncate">{r.name}</div>
                  <div className="col-span-2 text-right tabular-nums">{r.total}</div>
                  <div className="col-span-2 text-right">
                    <Badge
                      variant="outline"
                      className={cn(
                        'tabular-nums font-bold',
                        r.missed === 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : missRate >= 0.5
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                      )}
                    >
                      {r.missed}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-right tabular-nums text-emerald-700 font-semibold">{r.actioned}</div>
                  <div className="col-span-2 text-right tabular-nums text-muted-foreground">
                    {r.avgResponseMinutes != null ? `${r.avgResponseMinutes}m` : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const toneMap = {
  slate: 'bg-slate-50 text-slate-800 border-slate-200',
  red: 'bg-red-50 text-red-800 border-red-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200',
} as const;

const Tile: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; tone: keyof typeof toneMap }> = ({
  icon, label, value, tone,
}) => (
  <div className={cn('rounded-md border px-3 py-2 flex items-center gap-2', toneMap[tone])}>
    <div className="opacity-80">{icon}</div>
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide opacity-80 truncate">{label}</div>
      <div className="text-lg font-bold leading-tight tabular-nums">{value}</div>
    </div>
  </div>
);

export default LiveLeadTrackingPanel;
