import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Users, Timer, Target, PhoneCall, PhoneOff, AlertTriangle, Activity, TrendingUp, TrendingDown, Bell, ChevronRight, Loader2, Lock, CalendarIcon,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip as RTooltip, Legend, CartesianGrid, BarChart,
} from 'recharts';
import { format, differenceInCalendarDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DateRange } from 'react-day-picker';
import { CallStatsTab } from './CallStatsTab';
import { CallDataVisibilityPanel } from './leads/CallDataVisibilityPanel';
import { OvernightQueueBanner } from './leads/OvernightQueueBanner';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';

/**
 * Manager Overview — landing page for management / sales_manager / performance_manager.
 * KPI strip + hourly performance + live lead queue + agent breakdown + team comparison + alerts feed.
 * All data is derived from existing tables (sales_leads, lead_call_logs, lead_team_members, admin_users).
 */

interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  source: string | null;
  status: string | null;
  assigned_to: string | null;
  created_at: string;
}
interface CallLog { lead_id: string; created_at: string; agent_id: string | null }
interface InboundCall {
  id: string;
  source: 'callrail' | 'zoiper';
  started_at: string;
  answered_at: string | null;
  duration_seconds: number | null;
  answered: boolean;
  agent_id: string | null;
}

type Period = { from: Date; to: Date };

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };

const fmtMMSS = (sec: number | null) => {
  if (sec == null || !isFinite(sec)) return '—';
  const m = Math.floor(sec/60); const s = Math.floor(sec%60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};
const fmtWait = (sec: number) => {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec/60); const s = sec%60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};
const percentile = (arr: number[], p: number) => {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a,b)=>a-b);
  const idx = Math.min(sorted.length - 1, Math.floor((p/100)*sorted.length));
  return sorted[idx];
};

// Module-level labels updated each render so Delta / KpiCard children pick up the active period.
let _periodLabel = 'Today';
let _compareLabel = 'vs yesterday';

interface Metrics {
  inbound: number;
  medianSpeed: number | null;
  p90Speed: number | null;
  within2Min: number; // 0-1
  within5Min: number; // 0-1
  undialled: number;
  overdue: number;
  totalDials: number;
  connectRate: number; // 0-1
}

interface Agent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string | null;
}

const computeMetrics = (leads: Lead[], calls: CallLog[]): Metrics => {
  const firstCallByLead: Record<string, string> = {};
  const dialCountByLead: Record<string, number> = {};
  calls.forEach(c => {
    dialCountByLead[c.lead_id] = (dialCountByLead[c.lead_id] || 0) + 1;
    if (!firstCallByLead[c.lead_id] || firstCallByLead[c.lead_id] > c.created_at) firstCallByLead[c.lead_id] = c.created_at;
  });
  const speeds: number[] = [];
  let within2 = 0; let within5 = 0; let dialledLeads = 0; let undialled = 0; let overdue = 0;
  const now = Date.now();
  leads.forEach(l => {
    const created = new Date(l.created_at).getTime();
    const first = firstCallByLead[l.id];
    if (first) {
      const sec = Math.max(0, Math.round((new Date(first).getTime() - created)/1000));
      speeds.push(sec);
      if (sec <= 120) within2++;
      if (sec <= 300) within5++;
      dialledLeads++;
    } else {
      undialled++;
      if (now - created > 5*60*1000) overdue++;
    }
  });
  const totalDials = calls.length;
  const connected = new Set(calls.map(c => c.lead_id)).size;
  return {
    inbound: leads.length,
    medianSpeed: percentile(speeds, 50),
    p90Speed: percentile(speeds, 90),
    within2Min: dialledLeads ? within2 / dialledLeads : 0,
    within5Min: dialledLeads ? within5 / dialledLeads : 0,
    undialled,
    overdue,
    totalDials,
    connectRate: leads.length ? connected / leads.length : 0,
  };
};

const Delta: React.FC<{ current: number; previous: number; suffix?: string; invert?: boolean }> = ({ current, previous, suffix = '', invert }) => {
  if (previous === 0 && current === 0) return <span className="text-muted-foreground text-xs">—</span>;
  const diff = previous === 0 ? 100 : ((current - previous) / Math.abs(previous)) * 100;
  const up = diff > 0;
  const good = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', good ? 'text-emerald-600' : 'text-rose-600')}>
      <Icon className="w-3 h-3" />
      {Math.abs(diff).toFixed(0)}%{suffix} {_compareLabel}
    </span>
  );
};

const DeltaSeconds: React.FC<{ current: number | null; previous: number | null }> = ({ current, previous }) => {
  if (current == null || previous == null) return <span className="text-muted-foreground text-xs">—</span>;
  const diff = current - previous;
  const good = diff <= 0;
  const Icon = diff > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', good ? 'text-emerald-600' : 'text-rose-600')}>
      <Icon className="w-3 h-3" />
      {fmtMMSS(Math.abs(diff))} {_compareLabel}
    </span>
  );
};

interface KpiCardProps { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ComponentType<any>; tone?: 'default' | 'warn' | 'danger' | 'ok' }
const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon: Icon, tone = 'default' }) => (
  <Card className={cn(
    tone === 'warn' && 'border-amber-300 bg-amber-50/40',
    tone === 'danger' && 'border-rose-300 bg-rose-50/40',
    tone === 'ok' && 'border-emerald-300 bg-emerald-50/40',
  )}>
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{_periodLabel}</div>
          <div className="text-3xl font-bold tabular-nums mt-1">{value}</div>
        </div>
        <Icon className={cn('w-5 h-5 shrink-0',
          tone === 'warn' ? 'text-amber-500' : tone === 'danger' ? 'text-rose-500' : tone === 'ok' ? 'text-emerald-500' : 'text-muted-foreground')} />
      </div>
      {sub && <div className="mt-2">{sub}</div>}
    </CardContent>
  </Card>
);

const STATUS_PILL: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700 border-slate-300',
  contacted: 'bg-blue-100 text-blue-800 border-blue-300',
  qualified: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  quote_sent: 'bg-violet-100 text-violet-800 border-violet-300',
  follow_up: 'bg-amber-100 text-amber-800 border-amber-300',
  converted: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  lost: 'bg-rose-100 text-rose-800 border-rose-300',
};

interface Props {
  onNavigateToTab?: (tab: string) => void;
  userRole?: string;
}

/** Compact date-range selector with quick presets and a calendar popover. */
const DateRangePickerInline: React.FC<{ selected: Period; onChange: (p: Period) => void; periodLabel: string }> = ({ selected, onChange, periodLabel }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>({ from: selected.from, to: selected.to });

  useEffect(() => { if (open) setDraft({ from: selected.from, to: selected.to }); /* eslint-disable-next-line */ }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-[160px] justify-start font-normal">
          <CalendarIcon className="w-4 h-4 mr-2 shrink-0" /> {periodLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="end">
        <div className="flex flex-wrap gap-1 border-b p-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const n = new Date(); setDraft({ from: startOfDay(n), to: endOfDay(n) }); }}>Today</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const n = new Date(); const y = addDays(n, -1); setDraft({ from: startOfDay(y), to: endOfDay(y) }); }}>Yesterday</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const n = new Date(); setDraft({ from: startOfDay(addDays(n, -6)), to: endOfDay(n) }); }}>Last 7 days</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const n = new Date(); setDraft({ from: startOfDay(addDays(n, -29)), to: endOfDay(n) }); }}>Last 30 days</Button>
        </div>
        <Calendar mode="range" numberOfMonths={2} selected={draft} onSelect={setDraft} defaultMonth={selected.from} initialFocus className="p-3 pointer-events-auto" />
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setDraft(undefined)}>Clear</Button>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { if (draft?.from && draft?.to) { onChange({ from: startOfDay(draft.from), to: endOfDay(draft.to) }); setOpen(false); } }}>Apply</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const ManagerOverviewTab: React.FC<Props> = ({ onNavigateToTab, userRole }) => {
  const currentAdminId = useCurrentAdminId();
  const isManager = userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager' || userRole === 'performance_manager';
  const [scope, setScope] = useState<'off' | 'own' | 'team' | 'all'>('all');
  const [myTeamMates, setMyTeamMates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayLeads, setTodayLeads] = useState<Lead[]>([]);
  const [yestLeads, setYestLeads] = useState<Lead[]>([]);
  const [todayCalls, setTodayCalls] = useState<CallLog[]>([]);
  const [yestCalls, setYestCalls] = useState<CallLog[]>([]);
  const [teamByAgent, setTeamByAgent] = useState<Record<string, string>>({});
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [agents, setAgents] = useState<Agent[]>([]);
  const [hourlyAgent, setHourlyAgent] = useState<string>('all');
  const [todayInbound, setTodayInbound] = useState<InboundCall[]>([]);
  const [yestInbound, setYestInbound] = useState<InboundCall[]>([]);

  // --- Date selector ---
  const [selected, setSelected] = useState<Period>(() => {
    const n = new Date();
    return { from: startOfDay(n), to: endOfDay(n) };
  });
  const prevPeriod: Period = useMemo(() => {
    const len = differenceInCalendarDays(selected.to, selected.from) + 1;
    return { from: startOfDay(addDays(selected.from, -len)), to: endOfDay(addDays(selected.from, -1)) };
  }, [selected.from, selected.to]);
  const isSingleDay = differenceInCalendarDays(selected.to, selected.from) === 0;
  const isTodaySel = isSameDay(selected.from, new Date()) && isSameDay(selected.to, new Date());
  const isYesterdaySel = isSingleDay && isSameDay(selected.from, addDays(new Date(), -1));
  const periodLabel = isSingleDay
    ? format(selected.from, 'd MMM yyyy')
    : `${format(selected.from, 'd MMM')} – ${format(selected.to, 'd MMM yyyy')}`;
  const compareLabel = `vs ${isSingleDay ? format(prevPeriod.from, 'd MMM') : `${format(prevPeriod.from, 'd MMM')}–${format(prevPeriod.to, 'd MMM')}`}`;
  _periodLabel = periodLabel;
  _compareLabel = compareLabel;

  // Resolve current agent's call-data scope (managers always get 'all')
  useEffect(() => {
    if (isManager) { setScope('all'); return; }
    if (!currentAdminId) return;
    (async () => {
      const { data } = await supabase
        .from('lead_team_members')
        .select('call_data_scope, team_id')
        .eq('admin_user_id', currentAdminId)
        .maybeSingle();
      const s = ((data as any)?.call_data_scope ?? 'own') as 'off' | 'own' | 'team' | 'all';
      setScope(s);
      if (s === 'team' && (data as any)?.team_id) {
        const { data: mates } = await supabase
          .from('lead_team_members')
          .select('admin_user_id')
          .eq('team_id', (data as any).team_id);
        setMyTeamMates(((mates || []) as any[]).map(m => m.admin_user_id));
      }
    })();
  }, [currentAdminId, isManager]);

  const load = async () => {
    setLoading(true);
    const todayFrom = startOfDay(selected.from).toISOString();
    const todayTo = endOfDay(selected.to).toISOString();
    const yFrom = startOfDay(prevPeriod.from).toISOString();
    const yTo = endOfDay(prevPeriod.to).toISOString();

    const [tLeadsR, yLeadsR, tCallsR, yCallsR, teamR, agentsR, tCrR, yCrR, tZpR, yZpR] = await Promise.all([
      supabase.from('sales_leads')
        .select('id, first_name, last_name, source:lead_source, status, assigned_to, created_at')
        .gte('created_at', todayFrom).lte('created_at', todayTo)
        .order('created_at', { ascending: false }).limit(2000),
      supabase.from('sales_leads')
        .select('id, first_name, last_name, source:lead_source, status, assigned_to, created_at')
        .gte('created_at', yFrom).lte('created_at', yTo).limit(2000),
      supabase.from('lead_call_logs')
        .select('lead_id, created_at, agent_id')
        .gte('created_at', todayFrom).lte('created_at', todayTo).limit(5000),
      supabase.from('lead_call_logs')
        .select('lead_id, created_at, agent_id')
        .gte('created_at', yFrom).lte('created_at', yTo).limit(5000),
      supabase.from('lead_team_members').select('admin_user_id, lead_teams!inner(name)'),
      supabase.from('admin_users')
        .select('id, first_name, last_name, email, role')
        .eq('is_active', true)
        .in('role', ['sales', 'sales_lead'])
        .order('first_name', { ascending: true }),
      supabase.from('callrail_calls')
        .select('id, started_at, answered_at, duration_seconds, direction, assigned_admin_user_id')
        .gte('started_at', todayFrom).lte('started_at', todayTo).limit(5000),
      supabase.from('callrail_calls')
        .select('id, started_at, answered_at, duration_seconds, direction, assigned_admin_user_id')
        .gte('started_at', yFrom).lte('started_at', yTo).limit(5000),
      supabase.from('zoiper_call_events')
        .select('id, started_at, answered_at, duration_seconds, talk_seconds, direction, agent_user_id')
        .eq('direction', 'inbound')
        .gte('started_at', todayFrom).lte('started_at', todayTo).limit(5000),
      supabase.from('zoiper_call_events')
        .select('id, started_at, answered_at, duration_seconds, talk_seconds, direction, agent_user_id')
        .eq('direction', 'inbound')
        .gte('started_at', yFrom).lte('started_at', yTo).limit(5000),
    ]);

    // Apply per-agent call-data scope (managers see everything)
    const filterLeads = (arr: Lead[]) => {
      if (isManager || scope === 'all') return arr;
      if (scope === 'off') return [];
      if (scope === 'own') return arr.filter(l => l.assigned_to === currentAdminId);
      if (scope === 'team') return arr.filter(l => l.assigned_to && myTeamMates.includes(l.assigned_to));
      return arr;
    };
    const filterCalls = (arr: CallLog[]) => {
      if (isManager || scope === 'all') return arr;
      if (scope === 'off') return [];
      if (scope === 'own') return arr.filter(c => c.agent_id === currentAdminId);
      if (scope === 'team') return arr.filter(c => c.agent_id && myTeamMates.includes(c.agent_id));
      return arr;
    };

    const tLeads = filterLeads(((tLeadsR.data as unknown) as Lead[]) || []);
    setTodayLeads(tLeads);
    setYestLeads(filterLeads(((yLeadsR.data as unknown) as Lead[]) || []));
    setTodayCalls(filterCalls(((tCallsR.data as unknown) as CallLog[]) || []));
    setYestCalls(filterCalls(((yCallsR.data as unknown) as CallLog[]) || []));

    // Map + scope inbound calls (CallRail is always inbound; Zoiper already filtered to inbound)
    const mapCr = (rows: any[] | null): InboundCall[] => (rows || [])
      .filter(r => (r.direction || 'inbound') === 'inbound')
      .map(r => ({
        id: r.id,
        source: 'callrail' as const,
        started_at: r.started_at,
        answered_at: r.answered_at,
        duration_seconds: r.duration_seconds ?? 0,
        answered: !!r.answered_at || (r.duration_seconds ?? 0) > 0,
        agent_id: r.assigned_admin_user_id ?? null,
      }));
    const mapZp = (rows: any[] | null): InboundCall[] => (rows || [])
      .map(r => ({
        id: r.id,
        source: 'zoiper' as const,
        started_at: r.started_at,
        answered_at: r.answered_at,
        duration_seconds: (r.talk_seconds ?? r.duration_seconds) ?? 0,
        answered: !!r.answered_at || (r.talk_seconds ?? 0) > 0,
        agent_id: r.agent_user_id ?? null,
      }));
    const filterInbound = (arr: InboundCall[]) => {
      if (isManager || scope === 'all') return arr;
      if (scope === 'off') return [];
      if (scope === 'own') return arr.filter(c => c.agent_id === currentAdminId);
      if (scope === 'team') return arr.filter(c => c.agent_id && myTeamMates.includes(c.agent_id));
      return arr;
    };
    setTodayInbound(filterInbound([...mapCr(tCrR.data as any[] | null), ...mapZp(tZpR.data as any[] | null)]));
    setYestInbound(filterInbound([...mapCr(yCrR.data as any[] | null), ...mapZp(yZpR.data as any[] | null)]));

    const teams: Record<string, string> = {};
    (teamR.data as any[] | null)?.forEach(m => {
      if (m.lead_teams) teams[m.admin_user_id] = m.lead_teams.name;
    });
    setTeamByAgent(teams);

    const activeAgents = (agentsR.data as Agent[] | null) || [];
    setAgents(activeAgents);

    const agentMap: Record<string, string> = {};
    activeAgents.forEach(u => {
      agentMap[u.id] = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;
    });
    const ownerIds = Array.from(new Set(tLeads.map(l => l.assigned_to).filter(Boolean))) as string[];
    if (ownerIds.length) {
      const { data: owners } = await supabase.from('admin_users').select('id, first_name, last_name, email').in('id', ownerIds);
      (owners as any[] | null)?.forEach(u => {
        agentMap[u.id] = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;
      });
    }
    setOwnerNames(agentMap);

    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [scope, currentAdminId, myTeamMates.join(','), selected.from, selected.to]);
  useEffect(() => {
    const ch = supabase.channel('overview-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_leads' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_call_logs' }, () => load())
      .subscribe();
    const iv = setInterval(load, 60_000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metricsToday = useMemo(() => computeMetrics(todayLeads, todayCalls), [todayLeads, todayCalls]);
  const metricsYest = useMemo(() => computeMetrics(yestLeads, yestCalls), [yestLeads, yestCalls]);

  const inboundStats = (arr: InboundCall[]) => {
    const total = arr.length;
    const answered = arr.filter(c => c.answered).length;
    const missed = total - answered;
    const durs = arr.filter(c => c.answered && (c.duration_seconds || 0) > 0).map(c => c.duration_seconds || 0);
    const avgDur = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0;
    const answerSpeeds = arr
      .filter(c => c.answered_at)
      .map(c => Math.max(0, Math.round((new Date(c.answered_at as string).getTime() - new Date(c.started_at).getTime()) / 1000)));
    return {
      total, answered, missed, avgDur,
      answerRate: total ? answered / total : 0,
      medianAnswerSpeed: percentile(answerSpeeds, 50),
    };
  };
  const inToday = useMemo(() => inboundStats(todayInbound), [todayInbound]);
  const inYest = useMemo(() => inboundStats(yestInbound), [yestInbound]);

  // Hourly buckets (8-19)
  const hourly = useMemo(() => {
    // Filter by selected agent
    const leadsScoped = hourlyAgent === 'all' ? todayLeads : todayLeads.filter(l => l.assigned_to === hourlyAgent);
    const callsScoped = hourlyAgent === 'all' ? todayCalls : todayCalls.filter(c => c.agent_id === hourlyAgent);
    const firstCallByLead: Record<string, string> = {};
    callsScoped.forEach(c => {
      if (!firstCallByLead[c.lead_id] || firstCallByLead[c.lead_id] > c.created_at) firstCallByLead[c.lead_id] = c.created_at;
    });
    const now = new Date();
    if (isSingleDay) {
      const hours = Array.from({ length: 12 }, (_, i) => 8 + i);
      return hours.map(h => {
        const leadsReceived = leadsScoped.filter(l => new Date(l.created_at).getHours() === h).length;
        const firstDials = Object.values(firstCallByLead).filter(t => new Date(t).getHours() === h).length;
        const connected = callsScoped.filter(c => new Date(c.created_at).getHours() === h).length;
        const endOfH = new Date(); endOfH.setHours(h, 59, 59, 999);
        let backlog = 0;
        if (endOfH.getTime() <= now.getTime()) {
          leadsScoped.forEach(l => {
            if (new Date(l.created_at) <= endOfH) {
              const fc = firstCallByLead[l.id];
              if (!fc || new Date(fc) > endOfH) backlog++;
            }
          });
        }
        return { hour: `${String(h).padStart(2,'0')}:00`, leadsReceived, firstDials, connected, backlog };
      });
    }
    // Range: daily buckets
    const days: Date[] = [];
    let d = startOfDay(selected.from);
    const end = startOfDay(selected.to);
    while (d.getTime() <= end.getTime()) { days.push(new Date(d)); d = addDays(d, 1); }
    return days.map(day => {
      const ds = startOfDay(day).getTime(); const de = endOfDay(day).getTime();
      const leadsReceived = leadsScoped.filter(l => { const t = new Date(l.created_at).getTime(); return t >= ds && t <= de; }).length;
      const firstDials = Object.values(firstCallByLead).filter(t => { const x = new Date(t).getTime(); return x >= ds && x <= de; }).length;
      const connected = callsScoped.filter(c => { const x = new Date(c.created_at).getTime(); return x >= ds && x <= de; }).length;
      const endRef = de <= now.getTime() ? de : now.getTime();
      let backlog = 0;
      leadsScoped.forEach(l => {
        const ct = new Date(l.created_at).getTime();
        if (ct <= endRef) { const fc = firstCallByLead[l.id]; if (!fc || new Date(fc).getTime() > endRef) backlog++; }
      });
      return { hour: format(day, 'd MMM'), leadsReceived, firstDials, connected, backlog };
    });
  }, [todayLeads, todayCalls, hourlyAgent, isSingleDay, selected.from, selected.to]);

  // Live queue: undialled leads sorted by oldest waiting first
  const liveQueue = useMemo(() => {
    if (!isTodaySel) return [];
    const firstCallByLead: Record<string, string> = {};
    todayCalls.forEach(c => {
      if (!firstCallByLead[c.lead_id] || firstCallByLead[c.lead_id] > c.created_at) firstCallByLead[c.lead_id] = c.created_at;
    });
    const now = Date.now();
    return todayLeads
      .map(l => ({
        ...l,
        waitingSec: Math.floor((now - new Date(l.created_at).getTime())/1000),
        firstDial: firstCallByLead[l.id] || null,
      }))
      .filter(l => !l.firstDial)
      .sort((a,b) => b.waitingSec - a.waitingSec)
      .slice(0, 6);
  }, [todayLeads, todayCalls, isTodaySel]);

  // Team comparison
  const teamComparison = useMemo(() => {
    const buckets = { red: { leads: [] as Lead[], calls: [] as CallLog[] }, blue: { leads: [] as Lead[], calls: [] as CallLog[] } };
    todayLeads.forEach(l => {
      const t = l.assigned_to ? teamByAgent[l.assigned_to]?.toLowerCase() : '';
      if (t?.includes('red')) buckets.red.leads.push(l);
      else if (t?.includes('blue')) buckets.blue.leads.push(l);
    });
    todayCalls.forEach(c => {
      const t = c.agent_id ? teamByAgent[c.agent_id]?.toLowerCase() : '';
      if (t?.includes('red')) buckets.red.calls.push(c);
      else if (t?.includes('blue')) buckets.blue.calls.push(c);
    });
    return {
      red: computeMetrics(buckets.red.leads, buckets.red.calls),
      blue: computeMetrics(buckets.blue.leads, buckets.blue.calls),
      all: metricsToday,
    };
  }, [todayLeads, todayCalls, teamByAgent, metricsToday]);

  // Agent breakdown: per-agent metrics split by assigned leads and calls made
  const agentMetrics = useMemo(() => {
    const map: Record<string, Metrics> = {};
    agents.forEach(a => {
      const leads = todayLeads.filter(l => l.assigned_to === a.id);
      const calls = todayCalls.filter(c => c.agent_id === a.id);
      map[a.id] = computeMetrics(leads, calls);
    });
    return Object.entries(map)
      .map(([id, m]) => ({ id, name: ownerNames[id] || '—', team: teamByAgent[id] || '', metrics: m }))
      .sort((a, b) => b.metrics.inbound - a.metrics.inbound || b.metrics.totalDials - a.metrics.totalDials);
  }, [todayLeads, todayCalls, agents, ownerNames, teamByAgent]);

  // Alerts feed
  const alerts = useMemo(() => {
    if (!isTodaySel) return [];
    const out: { id: string; icon: React.ComponentType<any>; tone: string; title: string; sub: string; when: string }[] = [];
    if (metricsToday.overdue >= 3) {
      const oldest = liveQueue[0];
      out.push({
        id: 'overdue',
        icon: AlertTriangle,
        tone: 'text-rose-600',
        title: `${metricsToday.overdue} leads are overdue for first dial (>5 min)`,
        sub: oldest ? `Oldest waiting: ${fmtWait(oldest.waitingSec)}` : '',
        when: 'Now',
      });
    }
    if (metricsToday.undialled > 0) {
      out.push({
        id: 'waiting',
        icon: AlertTriangle,
        tone: 'text-amber-600',
        title: `${metricsToday.undialled} leads are waiting for first dial`,
        sub: liveQueue[0] ? `Oldest waiting: ${fmtWait(liveQueue[0].waitingSec)}` : '',
        when: 'Now',
      });
    }
    // Per-agent overdue: count undialled per owner
    const overduePerOwner: Record<string, number> = {};
    liveQueue.forEach(l => {
      if (l.waitingSec > 5*60 && l.assigned_to) {
        overduePerOwner[l.assigned_to] = (overduePerOwner[l.assigned_to] || 0) + 1;
      }
    });
    Object.entries(overduePerOwner).forEach(([uid, n]) => {
      if (n >= 2) out.push({
        id: `own-${uid}`,
        icon: AlertTriangle,
        tone: 'text-amber-600',
        title: `${ownerNames[uid] || 'Agent'} has ${n} overdue leads`,
        sub: '',
        when: 'Now',
      });
    });
    return out.slice(0, 6);
  }, [metricsToday, liveQueue, ownerNames, isTodaySel]);

  const nav = (tab: string) => onNavigateToTab?.(tab);

  if (!isManager && scope === 'off') {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <h2 className="text-lg font-semibold">Call data access is turned off</h2>
        <p className="text-sm text-muted-foreground mt-2">
          A manager has disabled Live Calls Data for your account. Please ask an admin or sales manager to change your access.
        </p>
      </div>
    );
  }

  if (loading && todayLeads.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Live Calls Data</h1>
          <p className="text-sm text-muted-foreground">{periodLabel} · {isSingleDay ? 'Hourly 08:00–19:00' : 'Daily buckets'} · UK time</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Button size="sm" variant={isTodaySel ? 'default' : 'outline'} onClick={() => { const n = new Date(); setSelected({ from: startOfDay(n), to: endOfDay(n) }); }}>
              Today
            </Button>
            <Button size="sm" variant={isYesterdaySel ? 'default' : 'outline'} onClick={() => { const n = new Date(); const y = addDays(n, -1); setSelected({ from: startOfDay(y), to: endOfDay(y) }); }}>
              Yesterday
            </Button>
          </div>
          <DateRangePickerInline selected={selected} onChange={setSelected} periodLabel={periodLabel} />
          <Button variant="outline" size="sm" onClick={load}>
            <Activity className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager') && (
        <CallDataVisibilityPanel />
      )}

      {/* Overnight ORR backlog — leads parked outside working hours */}
      <OvernightQueueBanner />

      {/* Per-agent call breakdown — with date selector */}
      <div>
        <CallStatsTab
          userRole={userRole || 'admin'}
          restrictToAgentIds={
            isManager || scope === 'all'
              ? undefined
              : scope === 'team'
                ? myTeamMates
                : currentAdminId
                  ? [currentAdminId]
                  : []
          }
          selfView={!isManager && scope !== 'all' && scope !== 'team'}
        />
      </div>


      {/* INBOUND CALLS */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <PhoneCall className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Inbound Calls</h2>
          <span className="text-xs text-muted-foreground">CallRail + Zoiper (customer → us)</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <KpiCard label="New Inbound Leads" icon={Users}
            value={metricsToday.inbound}
            sub={<Delta current={metricsToday.inbound} previous={metricsYest.inbound} />} />
          <KpiCard label="Inbound Calls" icon={PhoneCall}
            value={inToday.total}
            sub={<Delta current={inToday.total} previous={inYest.total} />} />
          <KpiCard label="Answered" icon={PhoneCall} tone="ok"
            value={inToday.answered}
            sub={<span className="text-xs text-muted-foreground">{Math.round(inToday.answerRate*100)}% answer rate</span>} />
          <KpiCard label="Missed Calls" icon={PhoneOff} tone={inToday.missed > 0 ? 'warn' : 'default'}
            value={inToday.missed}
            sub={<Delta current={inToday.missed} previous={inYest.missed} invert />} />
          <KpiCard label="Median Answer Time" icon={Timer}
            value={fmtMMSS(inToday.medianAnswerSpeed)}
            sub={<DeltaSeconds current={inToday.medianAnswerSpeed} previous={inYest.medianAnswerSpeed} />} />
          <KpiCard label="Avg Call Duration" icon={Timer}
            value={fmtMMSS(inToday.avgDur || null)}
            sub={<DeltaSeconds current={inToday.avgDur || null} previous={inYest.avgDur || null} />} />
        </div>
      </div>

      {/* OUTBOUND CALLS & LEAD RESPONSE */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <PhoneCall className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-700">Outbound Calls &amp; Lead Response</h2>
          <span className="text-xs text-muted-foreground">Agent dials → leads</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <KpiCard label="Total Dials" icon={PhoneCall}
            value={metricsToday.totalDials.toLocaleString()}
            sub={<Delta current={metricsToday.totalDials} previous={metricsYest.totalDials} />} />
          <KpiCard label="Leads Dialled" icon={PhoneCall}
            value={new Set(todayCalls.map(c => c.lead_id)).size.toLocaleString()}
            sub={<span className="text-xs text-muted-foreground">unique leads contacted</span>} />
          <KpiCard label="Connect Rate" icon={Activity}
            value={`${Math.round(metricsToday.connectRate*100)}%`}
            sub={<Delta current={metricsToday.connectRate*100} previous={metricsYest.connectRate*100} />} />
          <KpiCard label="Median Speed" icon={Timer}
            value={fmtMMSS(metricsToday.medianSpeed)}
            sub={<DeltaSeconds current={metricsToday.medianSpeed} previous={metricsYest.medianSpeed} />} />
          <KpiCard label="90th %ile Speed" icon={Timer}
            value={fmtMMSS(metricsToday.p90Speed)}
            sub={<DeltaSeconds current={metricsToday.p90Speed} previous={metricsYest.p90Speed} />} />
          <KpiCard label="Dialled Within 5 Min" icon={Target} tone="ok"
            value={`${Math.round(metricsToday.within5Min*100)}%`}
            sub={<Delta current={metricsToday.within5Min*100} previous={metricsYest.within5Min*100} />} />
          <KpiCard label="Overdue Leads" icon={AlertTriangle} tone={metricsToday.overdue > 0 ? 'danger' : 'default'}
            value={metricsToday.overdue}
            sub={<span className="text-xs text-muted-foreground">&gt; 5 min response time</span>} />
        </div>
      </div>

      {/* Live queue + hourly chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Live Lead Queue</CardTitle>
              <span className="text-xs text-muted-foreground">Waiting for first dial</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
              {!isTodaySel ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Live queue is only available when viewing today.</div>
              ) : liveQueue.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No leads waiting — nice work.</div>
              ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Waiting</th>
                    <th className="text-left px-2 py-2 font-medium">Lead</th>
                    <th className="text-left px-2 py-2 font-medium">Source</th>
                    <th className="text-left px-2 py-2 font-medium">Owner</th>
                    <th className="text-right px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {liveQueue.map(l => {
                    const overdue = l.waitingSec > 5*60;
                    const risk = l.waitingSec > 3*60;
                    return (
                      <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className={cn('px-4 py-2 font-mono font-semibold', overdue ? 'text-rose-600' : risk ? 'text-amber-600' : 'text-emerald-600')}>
                          {fmtWait(l.waitingSec)}
                        </td>
                        <td className="px-2 py-2">
                          <Link to={`/admin-dashboard?tab=new-leads&lead=${l.id}`} className="text-blue-600 hover:underline">
                            {[l.first_name, l.last_name].filter(Boolean).join(' ') || '—'}
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-muted-foreground text-xs">{l.source || '—'}</td>
                        <td className="px-2 py-2 text-xs">{l.assigned_to ? (ownerNames[l.assigned_to] || '—') : <span className="italic text-muted-foreground">Unassigned</span>}</td>
                        <td className="px-4 py-2 text-right">
                          <Badge variant="outline" className={cn('text-[10px] uppercase',
                            overdue ? 'bg-rose-100 text-rose-800 border-rose-300' :
                            risk ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            'bg-emerald-100 text-emerald-800 border-emerald-300')}>
                            {overdue ? 'Overdue' : risk ? 'At Risk' : 'On Target'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div className="p-3 border-t">
              <button onClick={() => nav('new-leads')} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                View all waiting leads <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">
                {isSingleDay ? 'Hourly' : 'Daily'} Performance ({periodLabel})
                {hourlyAgent !== 'all' && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    · {ownerNames[hourlyAgent] || 'Agent'}
                  </span>
                )}
              </CardTitle>
              <select
                value={hourlyAgent}
                onChange={(e) => setHourlyAgent(e.target.value)}
                className="text-xs border rounded-md px-2 py-1 bg-background"
              >
                <option value="all">All agents</option>
                {agents
                  .slice()
                  .sort((a, b) => (ownerNames[a.id] || '').localeCompare(ownerNames[b.id] || ''))
                  .map(a => (
                    <option key={a.id} value={a.id}>{ownerNames[a.id] || a.id.slice(0, 8)}</option>
                  ))}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hourly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" fontSize={11} />
                  <YAxis yAxisId="left" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" fontSize={11} />
                  <RTooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="leadsReceived" name="Leads Received" fill="#3b82f6" barSize={14} />
                  <Line yAxisId="left" type="monotone" dataKey="firstDials" name="First Dials" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                  <Line yAxisId="left" type="monotone" dataKey="connected" name="Connected Calls" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
                  <Line yAxisId="right" type="monotone" dataKey="backlog" name="Undialled Backlog" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Per-agent Speed to Dial — table + comparison bars */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-600" /> Speed to Dial — per agent ({periodLabel})
            </CardTitle>
            <span className="text-xs text-muted-foreground">Goal: first dial within 2 minutes</span>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 xl:grid-cols-5 gap-4 p-4">
          {/* Table */}
          <div className="xl:col-span-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-2 py-2 font-medium">Agent</th>
                  <th className="text-left px-2 py-2 font-medium">Team</th>
                  <th className="text-right px-2 py-2 font-medium">Leads received</th>
                  <th className="text-right px-2 py-2 font-medium">First dials</th>
                  <th className="text-right px-2 py-2 font-medium">Waiting (undialled)</th>
                  <th className="text-right px-2 py-2 font-medium">Within 2 min</th>
                  <th className="text-right px-2 py-2 font-medium">Median speed</th>
                </tr>
              </thead>
              <tbody>
                {agentMetrics.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No agents to show.</td></tr>
                ) : agentMetrics.map(a => {
                  const firstDials = a.metrics.inbound - a.metrics.undialled;
                  const within2Pct = Math.round(a.metrics.within2Min * 100);
                  const undialledTone = a.metrics.overdue > 0 ? 'text-rose-600 font-semibold'
                    : a.metrics.undialled > 0 ? 'text-amber-600 font-medium'
                    : 'text-muted-foreground';
                  return (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-2 py-2 font-medium">{a.name}</td>
                      <td className="px-2 py-2">
                        {a.team === 'red' ? <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300 text-[10px]">Red</Badge>
                          : a.team === 'blue' ? <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-[10px]">Blue</Badge>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{a.metrics.inbound}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-emerald-700 font-medium">{firstDials}</td>
                      <td className={cn('px-2 py-2 text-right tabular-nums', undialledTone)}>
                        {a.metrics.undialled}
                        {a.metrics.overdue > 0 && <span className="ml-1 text-[10px] uppercase">({a.metrics.overdue} overdue)</span>}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {a.metrics.inbound === 0 ? '—' : (
                          <span className={within2Pct >= 80 ? 'text-emerald-700' : within2Pct >= 50 ? 'text-amber-600' : 'text-rose-600'}>
                            {within2Pct}%
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmtMMSS(a.metrics.medianSpeed)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Comparison bars */}
          <div className="xl:col-span-2 min-h-[280px]">
            <div className="text-xs text-muted-foreground mb-2">First dials vs waiting</div>
            <ResponsiveContainer width="100%" height={Math.max(240, agentMetrics.length * 34)}>
              <BarChart
                layout="vertical"
                data={agentMetrics.map(a => ({
                  name: a.name,
                  firstDials: a.metrics.inbound - a.metrics.undialled,
                  waiting: a.metrics.undialled,
                }))}
                margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis dataKey="name" type="category" fontSize={11} width={100} />
                <RTooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="firstDials" name="First dials" fill="#10b981" barSize={10} />
                <Bar dataKey="waiting" name="Waiting" fill="#f59e0b" barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>


      {/* Team comparison + alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Team Comparison ({periodLabel})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Metric</th>
                  <th className="text-right px-4 py-2 font-medium text-rose-600">Red Team</th>
                  <th className="text-right px-4 py-2 font-medium text-blue-600">Blue Team</th>
                  <th className="text-right px-4 py-2 font-medium">All Teams</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Leads Received', teamComparison.red.inbound, teamComparison.blue.inbound, teamComparison.all.inbound],
                  ['Median First Dial', fmtMMSS(teamComparison.red.medianSpeed), fmtMMSS(teamComparison.blue.medianSpeed), fmtMMSS(teamComparison.all.medianSpeed)],
                  ['Dialled Within 5 Min', `${Math.round(teamComparison.red.within5Min*100)}%`, `${Math.round(teamComparison.blue.within5Min*100)}%`, `${Math.round(teamComparison.all.within5Min*100)}%`],
                  ['Total Dials', teamComparison.red.totalDials, teamComparison.blue.totalDials, teamComparison.all.totalDials],
                  ['Connect Rate', `${Math.round(teamComparison.red.connectRate*100)}%`, `${Math.round(teamComparison.blue.connectRate*100)}%`, `${Math.round(teamComparison.all.connectRate*100)}%`],
                  ['Undialled Now', teamComparison.red.undialled, teamComparison.blue.undialled, teamComparison.all.undialled],
                  ['Overdue Now', teamComparison.red.overdue, teamComparison.blue.overdue, teamComparison.all.overdue],
                ].map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">{row[0]}</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums text-rose-700">{row[1]}</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums text-blue-700">{row[2]}</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4" /> Alerts & Notifications</CardTitle>
              <button onClick={() => nav('new-leads')} className="text-xs text-blue-600 hover:underline">View all</button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">All clear — no alerts right now.</div>
            ) : (
              <ul className="divide-y">
                {alerts.map(a => {
                  const Icon = a.icon;
                  return (
                    <li key={a.id} className="px-4 py-3 flex items-start gap-3">
                      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', a.tone)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{a.title}</div>
                        {a.sub && <div className="text-xs text-muted-foreground mt-0.5">{a.sub}</div>}
                      </div>
                      <span className="text-[10px] uppercase text-muted-foreground shrink-0">{a.when}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default ManagerOverviewTab;
