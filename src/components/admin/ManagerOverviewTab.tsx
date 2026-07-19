import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Users, Timer, Target, PhoneCall, PhoneOff, AlertTriangle, Activity, TrendingUp, TrendingDown, Bell, ChevronRight, Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip as RTooltip, Legend, CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';

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

interface Metrics {
  inbound: number;
  medianSpeed: number | null;
  p90Speed: number | null;
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
  let within5 = 0; let dialledLeads = 0; let undialled = 0; let overdue = 0;
  const now = Date.now();
  leads.forEach(l => {
    const created = new Date(l.created_at).getTime();
    const first = firstCallByLead[l.id];
    if (first) {
      const sec = Math.max(0, Math.round((new Date(first).getTime() - created)/1000));
      speeds.push(sec);
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
      {Math.abs(diff).toFixed(0)}%{suffix} vs yesterday
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
      {fmtMMSS(Math.abs(diff))} vs yesterday
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
          <div className="text-xs text-muted-foreground mt-0.5">Today</div>
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
}

export const ManagerOverviewTab: React.FC<Props> = ({ onNavigateToTab }) => {
  const [loading, setLoading] = useState(true);
  const [todayLeads, setTodayLeads] = useState<Lead[]>([]);
  const [yestLeads, setYestLeads] = useState<Lead[]>([]);
  const [todayCalls, setTodayCalls] = useState<CallLog[]>([]);
  const [yestCalls, setYestCalls] = useState<CallLog[]>([]);
  const [teamByAgent, setTeamByAgent] = useState<Record<string, string>>({});
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [agents, setAgents] = useState<Agent[]>([]);

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const todayFrom = startOfDay(now).toISOString();
    const todayTo = endOfDay(now).toISOString();
    const yFrom = startOfDay(addDays(now, -1)).toISOString();
    const yTo = endOfDay(addDays(now, -1)).toISOString();

    const [tLeadsR, yLeadsR, tCallsR, yCallsR, teamR] = await Promise.all([
      supabase.from('sales_leads')
        .select('id, first_name, last_name, lead_source as source, status, assigned_to, created_at')
        .gte('created_at', todayFrom).lte('created_at', todayTo)
        .order('created_at', { ascending: false }).limit(2000),
      supabase.from('sales_leads')
        .select('id, first_name, last_name, lead_source as source, status, assigned_to, created_at')
        .gte('created_at', yFrom).lte('created_at', yTo).limit(2000),
      supabase.from('lead_call_logs')
        .select('lead_id, created_at, agent_id')
        .gte('created_at', todayFrom).lte('created_at', todayTo).limit(5000),
      supabase.from('lead_call_logs')
        .select('lead_id, created_at, agent_id')
        .gte('created_at', yFrom).lte('created_at', yTo).limit(5000),
      supabase.from('lead_team_members').select('admin_user_id, lead_teams!inner(name)'),
    ]);

    const tLeads = ((tLeadsR.data as unknown) as Lead[]) || [];
    setTodayLeads(tLeads);
    setYestLeads(((yLeadsR.data as unknown) as Lead[]) || []);
    setTodayCalls(((tCallsR.data as unknown) as CallLog[]) || []);
    setYestCalls(((yCallsR.data as unknown) as CallLog[]) || []);

    const teams: Record<string, string> = {};
    (teamR.data as any[] | null)?.forEach(m => {
      if (m.lead_teams) teams[m.admin_user_id] = m.lead_teams.name;
    });
    setTeamByAgent(teams);

    const ownerIds = Array.from(new Set(tLeads.map(l => l.assigned_to).filter(Boolean))) as string[];
    if (ownerIds.length) {
      const { data: owners } = await supabase.from('admin_users').select('id, first_name, last_name, email').in('id', ownerIds);
      const map: Record<string, string> = {};
      (owners as any[] | null)?.forEach(u => {
        map[u.id] = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;
      });
      setOwnerNames(map);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, []);
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

  // Hourly buckets (8-19)
  const hourly = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => 8 + i);
    const firstCallByLead: Record<string, string> = {};
    todayCalls.forEach(c => {
      if (!firstCallByLead[c.lead_id] || firstCallByLead[c.lead_id] > c.created_at) firstCallByLead[c.lead_id] = c.created_at;
    });
    const now = new Date();
    return hours.map(h => {
      const leadsReceived = todayLeads.filter(l => new Date(l.created_at).getHours() === h).length;
      const firstDials = Object.values(firstCallByLead).filter(t => new Date(t).getHours() === h).length;
      const connected = todayCalls.filter(c => new Date(c.created_at).getHours() === h).length;
      // undialled backlog at end of hour = leads received by end of h with no first-dial by end of h
      const endOfH = new Date(); endOfH.setHours(h, 59, 59, 999);
      let backlog = 0;
      if (endOfH.getTime() <= now.getTime()) {
        todayLeads.forEach(l => {
          if (new Date(l.created_at) <= endOfH) {
            const fc = firstCallByLead[l.id];
            if (!fc || new Date(fc) > endOfH) backlog++;
          }
        });
      }
      return { hour: `${String(h).padStart(2,'0')}:00`, leadsReceived, firstDials, connected, backlog };
    });
  }, [todayLeads, todayCalls]);

  // Live queue: undialled leads sorted by oldest waiting first
  const liveQueue = useMemo(() => {
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
  }, [todayLeads, todayCalls]);

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

  // Alerts feed
  const alerts = useMemo(() => {
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
  }, [metricsToday, liveQueue, ownerNames]);

  const nav = (tab: string) => onNavigateToTab?.(tab);

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
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground">Today · Data shown in UK time (08:00–19:00)</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <Activity className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <KpiCard label="New Inbound Leads" icon={Users}
          value={metricsToday.inbound}
          sub={<Delta current={metricsToday.inbound} previous={metricsYest.inbound} />} />
        <KpiCard label="Median Speed" icon={Timer}
          value={fmtMMSS(metricsToday.medianSpeed)}
          sub={<DeltaSeconds current={metricsToday.medianSpeed} previous={metricsYest.medianSpeed} />} />
        <KpiCard label="90th %ile Speed" icon={Timer}
          value={fmtMMSS(metricsToday.p90Speed)}
          sub={<DeltaSeconds current={metricsToday.p90Speed} previous={metricsYest.p90Speed} />} />
        <KpiCard label="Dialled Within 5 Min" icon={Target} tone="ok"
          value={`${Math.round(metricsToday.within5Min*100)}%`}
          sub={<Delta current={metricsToday.within5Min*100} previous={metricsYest.within5Min*100} />} />
        <KpiCard label="Undialled Leads" icon={PhoneOff} tone={metricsToday.undialled > 0 ? 'warn' : 'default'}
          value={metricsToday.undialled}
          sub={liveQueue[0] ? <span className="text-xs text-muted-foreground">Oldest waiting {fmtWait(liveQueue[0].waitingSec)}</span> : <span className="text-xs text-muted-foreground">Right now</span>} />
        <KpiCard label="Overdue Leads" icon={AlertTriangle} tone={metricsToday.overdue > 0 ? 'danger' : 'default'}
          value={metricsToday.overdue}
          sub={<span className="text-xs text-muted-foreground">&gt; 5 min response time</span>} />
        <KpiCard label="Total Dials" icon={PhoneCall}
          value={metricsToday.totalDials.toLocaleString()}
          sub={<Delta current={metricsToday.totalDials} previous={metricsYest.totalDials} />} />
        <KpiCard label="Connect Rate" icon={Activity}
          value={`${Math.round(metricsToday.connectRate*100)}%`}
          sub={<Delta current={metricsToday.connectRate*100} previous={metricsYest.connectRate*100} />} />
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
            {liveQueue.length === 0 ? (
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
            <CardTitle className="text-base">Hourly Performance (Today)</CardTitle>
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

      {/* Team comparison + alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Team Comparison (Today)</CardTitle>
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
