import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, AlarmClock, CheckCircle2, PhoneOff, Timer, Users, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { UnifiedDateFilter, periodToRange, type PeriodKey } from '@/components/admin/UnifiedDateFilter';
import type { DateRange } from 'react-day-picker';
import { isSameDay, format, parse, isValid } from 'date-fns';
import { useSearchParams } from 'react-router-dom';

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

const MISSED_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const BUSINESS_START_HOUR = 9;  // 09:00
const BUSINESS_END_HOUR = 18;   // 18:00
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
  missed: number;
  pending: number;
  avgResponseMinutes: number | null;
}

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const isWeekday = (d: Date) => { const w = d.getDay(); return w !== 0 && w !== 6; };

// Is a timestamp inside business hours (09:00–18:00, any day)?
const isBusinessHours = (ts: number) => {
  const d = new Date(ts);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return minutes >= BUSINESS_START_HOUR * 60 && minutes < BUSINESS_END_HOUR * 60;
};

// End-of-business-hours timestamp for the day of `ts` (used to cap "now" for past days).
const endOfBusinessDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(BUSINESS_END_HOUR, 0, 0, 0);
  return d.getTime();
};

export const LiveLeadTrackingPanel: React.FC<Props> = ({ userRole }) => {
  const canSee = !!userRole && ALLOWED_ROLES.has(userRole);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [agents, setAgents] = useState<Record<string, AgentRow>>({});
  const [firstActionAt, setFirstActionAt] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);

  // Date filter state (persisted to URL query so refresh/share preserves selection)
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPeriod = (searchParams.get('ltPeriod') as PeriodKey | null) ?? 'today';
  const urlFrom = searchParams.get('ltFrom');
  const urlTo = searchParams.get('ltTo');
  const parseDate = (s: string | null) => {
    if (!s) return undefined;
    const d = parse(s, 'yyyy-MM-dd', new Date());
    return isValid(d) ? d : undefined;
  };
  const initialCustom: DateRange | undefined =
    urlPeriod === 'custom' && parseDate(urlFrom)
      ? { from: parseDate(urlFrom)!, to: parseDate(urlTo) ?? parseDate(urlFrom)! }
      : undefined;

  const [period, setPeriod] = useState<PeriodKey>(urlPeriod);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(initialCustom);

  const activeRange = useMemo<DateRange | undefined>(() => {
    if (period === 'custom') return customRange;
    return periodToRange(period);
  }, [period, customRange]);

  // Sync selection back to URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('ltPeriod', period);
    if (period === 'custom' && customRange?.from) {
      next.set('ltFrom', format(customRange.from, 'yyyy-MM-dd'));
      next.set('ltTo', format(customRange.to ?? customRange.from, 'yyyy-MM-dd'));
    } else {
      next.delete('ltFrom');
      next.delete('ltTo');
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customRange]);

  const { fromMs, toMs, includesToday, label } = useMemo(() => {
    const today = new Date();
    const from = activeRange?.from ?? today;
    const to = activeRange?.to ?? from;
    const fromD = startOfDay(from);
    const toD = endOfDay(to);
    const inc = today >= fromD && today <= toD;
    const lbl = isSameDay(fromD, toD)
      ? fromD.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
      : `${fromD.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${toD.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
    return { fromMs: fromD.getTime(), toMs: toD.getTime(), includesToday: inc, label: lbl };
  }, [activeRange]);

  const load = useCallback(async () => {
    if (!canSee) return;
    setLoading(true);
    const { data: leadRows } = await supabase
      .from('sales_leads')
      .select('id, assigned_to, assigned_at, created_at, status')
      .gte('created_at', new Date(fromMs).toISOString())
      .lte('created_at', new Date(toMs).toISOString())
      .not('assigned_to', 'is', null)
      .limit(5000);

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
  }, [canSee, fromMs, toMs]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!canSee || !includesToday) return;
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [canSee, load, includesToday]);
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
      // Only count assignments that fell inside business hours (Mon–Fri, 09:00–18:00).
      if (!isBusinessHours(assignedAt)) continue;

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
      // Cap "now" at end of the business day the lead was assigned on — so
      // past-day rows deterministically resolve to Missed or Actioned.
      const evalNow = Math.min(now, endOfBusinessDay(assignedAt));
      if (actionAt && actionAt >= assignedAt) {
        s.actioned += 1;
        totals.actioned += 1;
        const resp = actionAt - assignedAt;
        responseTimes.push(resp);
        (s as any)._sum = ((s as any)._sum || 0) + resp;
        (s as any)._n = ((s as any)._n || 0) + 1;
      } else {
        const age = evalNow - assignedAt;
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
    <TooltipProvider delayDuration={200}>
      <Card className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/60 to-white shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </div>
              <Activity className="h-4 w-4 text-emerald-700" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-900">Live Tracking</h3>
              <span className="text-xs text-muted-foreground">
                · Business hours 09:00–18:00 · flagged after {MISSED_THRESHOLD_MS / 60000}m of no note or call
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex items-center text-emerald-700 hover:text-emerald-900">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                  <div className="font-semibold mb-1">How metrics are defined</div>
                  <ul className="space-y-1 list-disc pl-4">
                    <li><b>Assigned</b>: leads assigned to an agent inside 09:00–18:00 Mon–Fri within the selected date range (excludes lost/converted/fake/sale_made).</li>
                    <li><b>Missed</b>: assigned ≥ 5 min ago and the assigned agent still hasn't added a note or logged a call.</li>
                    <li><b>Pending (&lt;5m)</b>: assigned less than 5 min ago, no note or call yet — still within SLA.</li>
                    <li><b>Actioned</b>: the assigned agent added at least one note or call log after assignment.</li>
                    <li><b>Avg response</b>: average minutes from assignment to first note/call by that agent.</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const today = new Date();
                const yest = new Date(today); yest.setDate(today.getDate() - 1);
                const setSingleDay = (d: Date) => {
                  setPeriod('custom');
                  setCustomRange({ from: startOfDay(d), to: endOfDay(d) });
                };
                const isSingleDay = activeRange?.from && activeRange?.to && isSameDay(activeRange.from, activeRange.to);
                const shiftDay = (dir: -1 | 1) => {
                  const base = activeRange?.from ?? today;
                  const next = new Date(base);
                  next.setDate(base.getDate() + dir);
                  setSingleDay(next);
                };
                const btn = 'h-7 px-2 text-xs';
                return (
                  <>
                    <Button variant="outline" size="sm" className={btn} onClick={() => shiftDay(-1)} aria-label="Previous day">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={period === 'yesterday' || (isSingleDay && isSameDay(activeRange!.from!, yest)) ? 'default' : 'outline'}
                      size="sm" className={btn}
                      onClick={() => { setPeriod('yesterday'); setCustomRange(undefined); }}
                    >Yesterday</Button>
                    <Button
                      variant={period === 'today' || (isSingleDay && isSameDay(activeRange!.from!, today)) ? 'default' : 'outline'}
                      size="sm" className={btn}
                      onClick={() => { setPeriod('today'); setCustomRange(undefined); }}
                    >Today</Button>
                    <Button
                      variant={period === 'this_month' ? 'default' : 'outline'}
                      size="sm" className={btn}
                      onClick={() => { setPeriod('this_month'); setCustomRange(undefined); }}
                    >This month</Button>
                    <Button variant="outline" size="sm" className={btn} onClick={() => shiftDay(1)} aria-label="Next day">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </>
                );
              })()}
              <UnifiedDateFilter
                scope="signup"
                period={period}
                customRange={customRange}
                availableScopes={['signup']}
                showLabel={false}
                onChange={({ period: p, customRange: r }) => {
                  setPeriod(p);
                  setCustomRange(r);
                }}
              />
              <span className="text-[10px] text-muted-foreground">
                {loading ? 'refreshing…' : `${label} · updated ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
              </span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setCollapsed(c => !c)}>
                {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Tile icon={<Users className="h-4 w-4" />} label="Assigned" value={stats.totals.total} tone="slate" />
            <Tile icon={<PhoneOff className="h-4 w-4" />} label="Missed" value={stats.totals.missed} tone="red" />
            <Tile icon={<AlarmClock className="h-4 w-4" />} label="Pending (<5m)" value={stats.totals.pending} tone="amber" />
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
                  No assigned leads in business hours for {label}.
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
    </TooltipProvider>
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
