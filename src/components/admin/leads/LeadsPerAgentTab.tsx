import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Lock, Radio, CalendarRange, RefreshCcw, Download, Users, Target, AlertTriangle, CheckCircle2, PhoneCall, StickyNote, BellRing, Activity, ChevronRight, Mail, Phone, Car, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, subDays, isToday } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from 'recharts';
import { useGlobalTeamFilter } from '@/hooks/useGlobalTeamFilter';
import { useAgentTeams, TEAM_COLOR_CLASSES } from '@/hooks/useAgentTeams';
import { cn } from '@/lib/utils';

const MANAGEMENT_ROLES = new Set(['admin', 'super_admin', 'sales_manager']);

interface StatsRow {
  agent_id: string;
  stat_date: string;
  leads_assigned: number;
  self_assigned: number;
  marked_fake: number;
  marked_lost: number;
  marked_converted: number;
  notes_added: number;
  callbacks_set: number;
  callbacks_completed: number;
  calls_logged: number;
  status_changes: number;
  active_leads_eod: number;
  locked_at?: string | null;
  team_id?: string | null;
}

interface AgentMeta {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  team_name?: string | null;
}

type RangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

interface LeadsPerAgentTabProps {
  userRole?: string | null;
  currentUserId?: string | null;
}

const fmtYMD = (d: Date) => format(d, 'yyyy-MM-dd');

const SOURCE_META: Record<string, { label: string; emoji: string; cls: string }> = {
  google_ad:  { label: 'Google Ad', emoji: '🟢', cls: 'bg-green-100 text-green-800 border-green-200' },
  google:     { label: 'Google',    emoji: '🟢', cls: 'bg-green-100 text-green-800 border-green-200' },
  social_ad:  { label: 'Social Ad', emoji: '🔵', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  facebook:   { label: 'Facebook',  emoji: '🔵', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  instagram:  { label: 'Instagram', emoji: '🟣', cls: 'bg-pink-100 text-pink-800 border-pink-200' },
  tiktok:     { label: 'TikTok',    emoji: '⚫', cls: 'bg-zinc-100 text-zinc-800 border-zinc-200' },
  youtube:    { label: 'YouTube',   emoji: '🔴', cls: 'bg-red-100 text-red-800 border-red-200' },
  organic:    { label: 'Organic',   emoji: '🌱', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  website:    { label: 'Website',   emoji: '🌐', cls: 'bg-slate-100 text-slate-800 border-slate-200' },
  direct:     { label: 'Direct',    emoji: '➡️', cls: 'bg-slate-100 text-slate-800 border-slate-200' },
  referral:   { label: 'Referral',  emoji: '🔗', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  email:      { label: 'Email',     emoji: '✉️', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  sms:        { label: 'SMS',       emoji: '💬', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  unknown:    { label: 'Unknown',   emoji: '❓', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
};
const getSourceMeta = (s: string) => SOURCE_META[s] || { label: s.replace(/_/g, ' '), emoji: '•', cls: 'bg-gray-100 text-gray-700 border-gray-200' };

export const LeadsPerAgentTab: React.FC<LeadsPerAgentTabProps> = ({ userRole, currentUserId }) => {
  const isManagement = MANAGEMENT_ROLES.has((userRole || '').toLowerCase());

  const [preset, setPreset] = useState<RangePreset>('today');
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StatsRow[]>([]);
  const [mtdRows, setMtdRows] = useState<StatsRow[]>([]);
  const [agents, setAgents] = useState<Record<string, AgentMeta>>({});
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [sortKey, setSortKey] = useState<keyof StatsRow>('leads_assigned');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sourcesByAgent, setSourcesByAgent] = useState<Map<string, Record<string, number>>>(new Map());

  // Global team filter (shared with sidebar switcher + New Leads chips)
  const [teamFilter, setTeamFilter] = useGlobalTeamFilter();
  const { byAgent: agentTeamMap, allTeams } = useAgentTeams();
  const isInTeam = useCallback((agentId: string) => {
    if (!teamFilter) return true;
    return agentTeamMap.get(agentId)?.id === teamFilter;
  }, [teamFilter, agentTeamMap]);

  // Date range derived from preset
  const { fromDate, toDate } = useMemo(() => {
    const today = new Date();
    switch (preset) {
      case 'today': return { fromDate: today, toDate: today };
      case 'yesterday': {
        const y = subDays(today, 1);
        return { fromDate: y, toDate: y };
      }
      case 'week': return { fromDate: startOfWeek(today, { weekStartsOn: 1 }), toDate: today };
      case 'month': return { fromDate: startOfMonth(today), toDate: today };
      case 'custom': return { fromDate: customRange.from ?? today, toDate: customRange.to ?? customRange.from ?? today };
    }
  }, [preset, customRange]);

  const isLiveView = useMemo(() => isToday(toDate) && isToday(fromDate), [fromDate, toDate]);

  // Load agents metadata — ONLY active sales agents + sales team leads.
  // Admins, super_admins, lead_gen, support etc. don't take calls so they
  // pollute the leaderboard with empty rows.
  useEffect(() => {
    (async () => {
      const { data: au } = await supabase
        .from('admin_users')
        .select('id, user_id, email, first_name, last_name, role, is_active')
        .eq('is_active', true)
        .in('role', ['sales', 'sales_lead']);
      if (!au) return;
      const map: Record<string, AgentMeta> = {};
      au.forEach((a: any) => {
        map[a.id] = {
          id: a.id,
          user_id: a.user_id,
          email: a.email,
          role: a.role,
          name: [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email,
        };
      });
      setAgents(map);
    })();
  }, []);

  // Fetch stats: combine snapshot rows (past) + live RPC (today)
  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const allDays = eachDayOfInterval({ start: fromDate, end: toDate });
      const pastDays = allDays.filter(d => !isToday(d));
      const liveToday = allDays.find(d => isToday(d));

      let snapshotRows: StatsRow[] = [];
      if (pastDays.length > 0) {
        const { data, error } = await supabase
          .from('agent_daily_lead_stats')
          .select('*')
          .gte('stat_date', fmtYMD(pastDays[0]))
          .lte('stat_date', fmtYMD(pastDays[pastDays.length - 1]));
        if (error) throw error;
        snapshotRows = (data || []) as StatsRow[];
        if (!isManagement && currentUserId) {
          snapshotRows = snapshotRows.filter(r => r.agent_id === currentUserId);
        }
      }

      let liveRows: StatsRow[] = [];
      if (liveToday) {
        const { data, error } = await supabase.rpc('get_agent_live_stats', { p_date: fmtYMD(liveToday) });
        if (error) throw error;
        liveRows = (data || []) as StatsRow[];
      }

      setRows([...snapshotRows, ...liveRows]);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, isManagement, currentUserId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Fetch lead-source breakdown per agent for the selected date range
  const fetchSources = useCallback(async () => {
    try {
      const fromIso = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0).toISOString();
      const toIso = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59).toISOString();
      let q = supabase
        .from('sales_leads')
        .select('assigned_to, lead_source')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .not('assigned_to', 'is', null)
        .limit(5000);
      if (!isManagement && currentUserId) q = q.eq('assigned_to', currentUserId);
      const { data, error } = await q;
      if (error) throw error;
      const map = new Map<string, Record<string, number>>();
      (data || []).forEach((r: any) => {
        if (!r.assigned_to) return;
        const src = (r.lead_source || 'unknown').toLowerCase();
        const cur = map.get(r.assigned_to) || {};
        cur[src] = (cur[src] || 0) + 1;
        map.set(r.assigned_to, cur);
      });
      setSourcesByAgent(map);
    } catch (e: any) {
      console.warn('Source breakdown failed', e?.message);
    }
  }, [fromDate, toDate, isManagement, currentUserId]);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  // Always-on month-to-date fetch for the converted Today/Week/Month rollup
  const fetchMtd = useCallback(async () => {
    try {
      const today = new Date();
      const monthStart = startOfMonth(today);
      const { data: snap, error: snapErr } = await supabase
        .from('agent_daily_lead_stats')
        .select('agent_id, stat_date, marked_converted')
        .gte('stat_date', fmtYMD(monthStart))
        .lt('stat_date', fmtYMD(today));
      if (snapErr) throw snapErr;
      const { data: live, error: liveErr } = await supabase.rpc('get_agent_live_stats', { p_date: fmtYMD(today) });
      if (liveErr) throw liveErr;
      let combined = [...((snap || []) as any[]), ...((live || []) as any[])] as StatsRow[];
      if (!isManagement && currentUserId) combined = combined.filter(r => r.agent_id === currentUserId);
      setMtdRows(combined);
    } catch (e: any) {
      // silent — primary table still works
      console.warn('MTD converted rollup failed', e?.message);
    }
  }, [isManagement, currentUserId]);

  useEffect(() => { fetchMtd(); }, [fetchMtd]);

  // Auto-refresh today every 60s
  useEffect(() => {
    if (!isLiveView) return;
    const id = setInterval(() => { fetchStats(); fetchMtd(); fetchSources(); }, 60_000);
    return () => clearInterval(id);
  }, [isLiveView, fetchStats, fetchMtd, fetchSources]);

  // Aggregate per agent across the range.
  // Seed every active sales agent so they show even with zero activity,
  // and exclude any rows whose agent isn't in the sales-only roster.
  const perAgent = useMemo(() => {
    const empty = (): StatsRow & { days: number; locked: boolean } => ({
      agent_id: '', stat_date: '', leads_assigned: 0, self_assigned: 0,
      marked_fake: 0, marked_lost: 0, marked_converted: 0, notes_added: 0,
      callbacks_set: 0, callbacks_completed: 0, calls_logged: 0,
      status_changes: 0, active_leads_eod: 0, days: 0, locked: true,
    });
    const grouped = new Map<string, StatsRow & { days: number; locked: boolean }>();
    Object.keys(agents).forEach(uid => {
      if (!isInTeam(uid)) return;
      grouped.set(uid, { ...empty(), agent_id: uid });
    });
    rows.filter(r => isInTeam(r.agent_id) && agents[r.agent_id]).forEach(r => {
      const existing = grouped.get(r.agent_id) || { ...empty(), agent_id: r.agent_id };
      existing.leads_assigned += r.leads_assigned;
      existing.self_assigned += r.self_assigned;
      existing.marked_fake += r.marked_fake;
      existing.marked_lost += r.marked_lost;
      existing.marked_converted += r.marked_converted;
      existing.notes_added += r.notes_added;
      existing.callbacks_set += r.callbacks_set;
      existing.callbacks_completed += r.callbacks_completed;
      existing.calls_logged += r.calls_logged;
      existing.status_changes += r.status_changes;
      if (r.stat_date >= existing.stat_date) existing.active_leads_eod = r.active_leads_eod;
      existing.days += 1;
      if (!r.locked_at) existing.locked = false;
      grouped.set(r.agent_id, existing);
    });
    let list = Array.from(grouped.values());
    list.sort((a, b) => {
      const va = (a[sortKey] as any) ?? 0;
      const vb = (b[sortKey] as any) ?? 0;
      return sortDir === 'desc' ? (vb as number) - (va as number) : (va as number) - (vb as number);
    });
    return list;
  }, [rows, sortKey, sortDir, isInTeam, agents]);

  // Per-source totals across the visible agents (footer summary).
  const sourceTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    perAgent.forEach(r => {
      const src = sourcesByAgent.get(r.agent_id) || {};
      Object.entries(src).forEach(([k, n]) => { totals[k] = (totals[k] || 0) + n; });
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [perAgent, sourcesByAgent]);

  const totals = useMemo(() => {
    return perAgent.reduce((acc, r) => ({
      leads_assigned: acc.leads_assigned + r.leads_assigned,
      self_assigned: acc.self_assigned + r.self_assigned,
      marked_fake: acc.marked_fake + r.marked_fake,
      marked_lost: acc.marked_lost + r.marked_lost,
      marked_converted: acc.marked_converted + r.marked_converted,
      notes_added: acc.notes_added + r.notes_added,
      callbacks_set: acc.callbacks_set + r.callbacks_set,
      callbacks_completed: acc.callbacks_completed + r.callbacks_completed,
      calls_logged: acc.calls_logged + r.calls_logged,
      status_changes: acc.status_changes + r.status_changes,
      active_leads_eod: acc.active_leads_eod + r.active_leads_eod,
    }), {
      leads_assigned: 0, self_assigned: 0, marked_fake: 0, marked_lost: 0, marked_converted: 0,
      notes_added: 0, callbacks_set: 0, callbacks_completed: 0, calls_logged: 0,
      status_changes: 0, active_leads_eod: 0,
    });
  }, [perAgent]);

  // Converted Today / Week / Month rollup (independent of selected date range)
  const convRollup = useMemo(() => {
    const today = new Date();
    const todayStr = fmtYMD(today);
    const weekStartStr = fmtYMD(startOfWeek(today, { weekStartsOn: 1 }));
    const monthStartStr = fmtYMD(startOfMonth(today));
    const map = new Map<string, { day: number; week: number; month: number }>();
    mtdRows.filter(r => isInTeam(r.agent_id)).forEach(r => {
      const cur = map.get(r.agent_id) || { day: 0, week: 0, month: 0 };
      const c = r.marked_converted || 0;
      if (r.stat_date >= monthStartStr) cur.month += c;
      if (r.stat_date >= weekStartStr) cur.week += c;
      if (r.stat_date === todayStr) cur.day += c;
      map.set(r.agent_id, cur);
    });
    const totals = Array.from(map.values()).reduce(
      (a, v) => ({ day: a.day + v.day, week: a.week + v.week, month: a.month + v.month }),
      { day: 0, week: 0, month: 0 }
    );
    return { map, totals };
  }, [mtdRows, isInTeam]);

  const getConv = (agentId: string) => convRollup.map.get(agentId) || { day: 0, week: 0, month: 0 };

  const rebuildDay = async (dateStr: string) => {
    if (!isManagement) return;
    setRebuilding(true);
    try {
      const { error } = await supabase.functions.invoke('snapshot-agent-daily-stats', {
        body: { date: dateStr },
      });
      if (error) throw error;
      toast.success(`Rebuilt ${dateStr}`);
      await fetchStats();
    } catch (e: any) {
      toast.error(e?.message || 'Rebuild failed');
    } finally {
      setRebuilding(false);
    }
  };

  const exportCSV = () => {
    if (!isManagement) return;
    const header = ['Agent', 'Role', 'Leads assigned', 'Self-assigned', 'Notes', 'Callbacks set', 'Callbacks done', 'Calls', 'Marked fake', 'Marked lost', 'Marked converted', 'Status changes', 'Active EOD'];
    const lines = [header.join(',')];
    perAgent.forEach(r => {
      const a = agents[r.agent_id];
      lines.push([
        `"${a?.name || r.agent_id}"`, a?.role || '',
        r.leads_assigned, r.self_assigned, r.notes_added, r.callbacks_set, r.callbacks_completed,
        r.calls_logged, r.marked_fake, r.marked_lost, r.marked_converted, r.status_changes, r.active_leads_eod,
      ].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-per-agent-${fmtYMD(fromDate)}_to_${fmtYMD(toDate)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const headerSort = (key: keyof StatsRow) => () => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const summaryCards = [
    { label: 'Leads worked', value: totals.leads_assigned, icon: Target, accent: 'text-primary' },
    { label: 'Notes added', value: totals.notes_added, icon: StickyNote, accent: 'text-foreground' },
    { label: 'Calls logged', value: totals.calls_logged, icon: PhoneCall, accent: 'text-foreground' },
    { label: 'Callbacks set', value: totals.callbacks_set, icon: BellRing, accent: 'text-foreground' },
    { label: 'Marked fake', value: totals.marked_fake, icon: AlertTriangle, accent: 'text-destructive' },
    { label: 'Converted', value: totals.marked_converted, icon: CheckCircle2, accent: 'text-emerald-600' },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leads per Agent</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isManagement
                ? 'Per-agent activity, locked daily at 00:01 UK time. Live view auto-refreshes every minute.'
                : 'Your activity, locked daily at 00:01 UK time. Live view auto-refreshes every minute.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isLiveView ? (
              <Badge variant="secondary" className="gap-1.5 border-2 border-emerald-200">
                <Radio className="h-3 w-3 text-emerald-600 animate-pulse" /> Live
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 border-2">
                <Lock className="h-3 w-3" /> Locked
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading} className="gap-2 border-2">
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {isManagement && (
              <>
                <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 border-2">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
                {!isLiveView && fromDate.toDateString() === toDate.toDateString() && (
                  <Button variant="outline" size="sm" onClick={() => rebuildDay(fmtYMD(fromDate))} disabled={rebuilding} className="gap-2 border-2">
                    <RefreshCcw className={`h-3.5 w-3.5 ${rebuilding ? 'animate-spin' : ''}`} />
                    Rebuild day
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Team colour filter (Red / Blue / Green) — management only */}
        {isManagement && allTeams.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
              Team
            </span>
            <button
              type="button"
              onClick={() => setTeamFilter(null)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                teamFilter === null
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              All teams
            </button>
            {allTeams.map((t) => {
              const c = TEAM_COLOR_CLASSES[t.color];
              const active = teamFilter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTeamFilter(active ? null : t.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                    active ? c.pill : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
                  {t.name.replace(/^Formula\s+/i, '')}
                </button>
              );
            })}
          </div>
        )}

        {/* Range selector */}
        <Card className="border-2">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <Tabs value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="yesterday">Yesterday</TabsTrigger>
                <TabsTrigger value="week">This week</TabsTrigger>
                <TabsTrigger value="month">This month</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
            {preset === 'custom' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 border-2">
                    <CalendarRange className="h-3.5 w-3.5" />
                    {customRange.from ? format(customRange.from, 'd MMM') : 'Start'} – {customRange.to ? format(customRange.to, 'd MMM') : 'End'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0 w-auto">
                  <Calendar
                    mode="range"
                    selected={{ from: customRange.from, to: customRange.to }}
                    onSelect={(r: any) => setCustomRange({ from: r?.from, to: r?.to })}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            )}
            <div className="ml-auto text-xs text-muted-foreground">
              {format(fromDate, 'd MMM yyyy')} → {format(toDate, 'd MMM yyyy')} · UK time
            </div>
          </CardContent>
        </Card>

        {/* Converted rollup (always visible — independent of selected range) */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Converted today', value: convRollup.totals.day },
            { label: 'Converted this week', value: convRollup.totals.week },
            { label: 'Converted this month', value: convRollup.totals.month },
          ].map(({ label, value }) => (
            <Card key={label} className="border-2 border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
                  {value.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary cards (management only) */}
        {isManagement && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {summaryCards.map(({ label, value, icon: Icon, accent }) => (
              <Card key={label} className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
                    <Icon className={`h-4 w-4 ${accent}`} />
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{loading ? <Skeleton className="h-7 w-12" /> : value.toLocaleString()}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Table */}
        <Card className="border-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              {isManagement ? `${perAgent.length} agent${perAgent.length === 1 ? '' : 's'}` : 'My activity'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-y-2">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 font-medium sticky left-0 bg-muted/50 z-10">Agent</th>
                    <th className="px-3 py-2.5 font-medium text-left min-w-[260px]" title="Lead sources assigned in this date range">Lead sources</th>
                    <Th onClick={headerSort('leads_assigned')} active={sortKey==='leads_assigned'} dir={sortDir}>Assigned</Th>
                    <Th onClick={headerSort('calls_logged')} active={sortKey==='calls_logged'} dir={sortDir}>Calls</Th>
                    <Th onClick={headerSort('notes_added')} active={sortKey==='notes_added'} dir={sortDir}>Notes</Th>
                    <Th onClick={headerSort('callbacks_set')} active={sortKey==='callbacks_set'} dir={sortDir}>Callbacks</Th>
                    <Th onClick={headerSort('marked_fake')} active={sortKey==='marked_fake'} dir={sortDir}>Fake</Th>
                    <Th onClick={headerSort('marked_converted')} active={sortKey==='marked_converted'} dir={sortDir}>Converted</Th>
                    <Th onClick={headerSort('active_leads_eod')} active={sortKey==='active_leads_eod'} dir={sortDir}>Active EOD</Th>
                    <th className="px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 10 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                      ))}
                    </tr>
                  ))}
                  {!loading && perAgent.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">No sales agents match the current filter.</td></tr>
                  )}
                  {!loading && perAgent.map(r => {
                    const a = agents[r.agent_id];
                    return (
                      <tr key={r.agent_id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedAgent(r.agent_id)}>
                        <td className="px-4 py-3 sticky left-0 bg-background z-10">
                          <div className="font-medium">{a?.name || 'Unknown agent'}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {a?.role === 'sales_lead' ? 'Team lead' : 'Sales'}
                            {r.locked ? (
                              <Tooltip><TooltipTrigger><Lock className="h-3 w-3" /></TooltipTrigger><TooltipContent>Locked snapshot</TooltipContent></Tooltip>
                            ) : (
                              <Tooltip><TooltipTrigger><Radio className="h-3 w-3 text-emerald-600" /></TooltipTrigger><TooltipContent>Live data (today)</TooltipContent></Tooltip>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {(() => {
                            const src = sourcesByAgent.get(r.agent_id) || {};
                            const entries = Object.entries(src).sort((a, b) => b[1] - a[1]);
                            if (entries.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
                            return (
                              <div className="flex flex-wrap gap-1">
                                {entries.slice(0, 5).map(([k, n]) => {
                                  const m = getSourceMeta(k);
                                  return (
                                    <span key={k} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap', m.cls)}>
                                      <span>{m.emoji}</span>
                                      <span>{m.label}</span>
                                      <span className="tabular-nums font-semibold">{n}</span>
                                    </span>
                                  );
                                })}
                                {entries.length > 5 && (
                                  <span className="text-[11px] text-muted-foreground self-center">+{entries.length - 5}</span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <Td className="font-semibold">{r.leads_assigned}</Td>
                        <Td>{r.calls_logged}</Td>
                        <Td>{r.notes_added}</Td>
                        <Td>{r.callbacks_set}</Td>
                        <Td className={r.marked_fake ? 'text-destructive font-medium' : ''}>{r.marked_fake}</Td>
                        <Td className={r.marked_converted ? 'text-emerald-600 font-semibold' : ''}>{r.marked_converted}</Td>
                        <Td className="font-semibold">{r.active_leads_eod}</Td>
                        <td className="px-2 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
                      </tr>
                    );
                  })}
                </tbody>
                {isManagement && perAgent.length > 0 && (
                  <tfoot className="bg-muted/40 border-t-2 font-medium">
                    <tr>
                      <td className="px-4 py-3 sticky left-0 bg-muted/40">Total</td>
                      <td className="px-3 py-3">
                        {sourceTotals.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {sourceTotals.map(([k, n]) => {
                              const m = getSourceMeta(k);
                              return (
                                <span key={k} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap', m.cls)}>
                                  <span>{m.emoji}</span>
                                  <span>{m.label}</span>
                                  <span className="tabular-nums">{n}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <Td>{totals.leads_assigned}</Td>
                      <Td>{totals.calls_logged}</Td>
                      <Td>{totals.notes_added}</Td>
                      <Td>{totals.callbacks_set}</Td>
                      <Td>{totals.marked_fake}</Td>
                      <Td className="text-emerald-700">{totals.marked_converted}</Td>
                      <Td>{totals.active_leads_eod}</Td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>

        <AgentDetailSheet
          agentId={selectedAgent}
          agent={selectedAgent ? agents[selectedAgent] : undefined}
          fromDate={fromDate}
          toDate={toDate}
          rows={rows.filter(r => r.agent_id === selectedAgent)}
          onClose={() => setSelectedAgent(null)}
        />
      </div>
    </TooltipProvider>
  );
};

const Th: React.FC<React.PropsWithChildren<{ onClick: () => void; active: boolean; dir: 'asc' | 'desc' }>> = ({ children, onClick, active, dir }) => (
  <th className="px-3 py-2.5 font-medium text-right select-none">
    <button onClick={onClick} className={`inline-flex items-center gap-1 hover:text-foreground transition ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
      {children}{active ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}
    </button>
  </th>
);
const Td: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <td className={`px-3 py-3 text-right tabular-nums ${className}`}>{children}</td>
);

const AgentDetailSheet: React.FC<{
  agentId: string | null;
  agent?: AgentMeta;
  fromDate: Date;
  toDate: Date;
  rows: StatsRow[];
  onClose: () => void;
}> = ({ agentId, agent, fromDate, toDate, rows, onClose }) => {
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: fromDate, end: toDate });
    return days.map(d => {
      const r = rows.find(x => x.stat_date === fmtYMD(d));
      return {
        date: format(d, 'EEE d'),
        Assigned: r?.leads_assigned ?? 0,
        Notes: r?.notes_added ?? 0,
        Calls: r?.calls_logged ?? 0,
        Callbacks: r?.callbacks_set ?? 0,
        Converted: r?.marked_converted ?? 0,
      };
    });
  }, [rows, fromDate, toDate]);

  const tallies = useMemo(() => {
    const total = rows.reduce((acc, r) => ({
      assigned: acc.assigned + r.leads_assigned,
      notes: acc.notes + r.notes_added,
      calls: acc.calls + r.calls_logged,
      callbacks: acc.callbacks + r.callbacks_set,
      fake: acc.fake + r.marked_fake,
      converted: acc.converted + r.marked_converted,
    }), { assigned: 0, notes: 0, calls: 0, callbacks: 0, fake: 0, converted: 0 });
    const days = rows.length || 1;
    return { total, daily: {
      assigned: (total.assigned / days).toFixed(1),
      notes: (total.notes / days).toFixed(1),
      calls: (total.calls / days).toFixed(1),
    }};
  }, [rows]);

  return (
    <Sheet open={!!agentId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{agent?.name || 'Agent'}</SheetTitle>
          <p className="text-xs text-muted-foreground">{agent?.email} · {agent?.role}</p>
        </SheetHeader>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { l: 'Total assigned', v: tallies.total.assigned },
            { l: 'Avg/day', v: tallies.daily.assigned },
            { l: 'Notes', v: tallies.total.notes },
            { l: 'Calls', v: tallies.total.calls },
            { l: 'Callbacks', v: tallies.total.callbacks },
            { l: 'Converted', v: tallies.total.converted },
          ].map(c => (
            <div key={c.l} className="border-2 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.l}</div>
              <div className="text-xl font-semibold mt-1">{c.v}</div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <div className="text-sm font-medium mb-2 flex items-center gap-2"><Activity className="h-4 w-4" /> Daily breakdown</div>
          <div className="h-72 border-2 rounded-lg p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RTooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Assigned" fill="hsl(var(--primary))" />
                <Bar dataKey="Notes" fill="hsl(var(--muted-foreground))" />
                <Bar dataKey="Calls" fill="hsl(var(--accent-foreground))" />
                <Bar dataKey="Converted" fill="hsl(142 71% 45%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <AgentAssignedLeads agentId={agentId} />
      </SheetContent>
    </Sheet>
  );
};

const ACTIVE_STATUSES = ['new', 'contacted', 'follow_up', 'quote_sent', 'negotiating', 'urgent_callback'] as const;

const statusClass = (s: string) => {
  switch (s) {
    case 'new': return 'bg-blue-100 text-blue-800';
    case 'contacted': return 'bg-yellow-100 text-yellow-800';
    case 'follow_up': return 'bg-purple-100 text-purple-800';
    case 'quote_sent': return 'bg-cyan-100 text-cyan-800';
    case 'negotiating': return 'bg-orange-100 text-orange-800';
    case 'urgent_callback': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const AgentAssignedLeads: React.FC<{ agentId: string | null }> = ({ agentId }) => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!agentId) { setLeads([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('sales_leads')
        .select('id, first_name, last_name, full_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, status, last_activity_date, created_at')
        .eq('assigned_to', agentId)
        .in('status', ACTIVE_STATUSES)
        .order('last_activity_date', { ascending: false, nullsFirst: false })
        .limit(500);
      if (cancelled) return;
      if (error) toast.error(error.message); else setLeads(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [agentId]);

  const visible = showAll ? leads : leads.slice(0, 25);

  return (
    <div className="mt-6">
      <div className="text-sm font-medium mb-2 flex items-center gap-2">
        <Inbox className="h-4 w-4" /> Currently assigned leads
        <Badge variant="secondary" className="ml-1">{loading ? '…' : leads.length}</Badge>
      </div>
      <div className="border-2 rounded-lg bg-background">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : leads.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">No active leads on this agent's plate.</div>
        ) : (
          <div className="divide-y">
            {visible.map(l => (
              <a
                key={l.id}
                href={`/admin-dashboard/?tab=leads&lead=${l.id}`}
                className="px-3 py-2 text-xs flex items-center gap-3 flex-wrap hover:bg-muted/40 transition"
              >
                <Badge className={`${statusClass(l.status)} hover:${statusClass(l.status)} text-[10px] shrink-0`}>
                  {l.status.replace('_', ' ')}
                </Badge>
                <span className="font-medium truncate max-w-[180px]">
                  {l.full_name || `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || '—'}
                </span>
                {l.email && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground truncate max-w-[200px]">
                    <Mail className="h-3 w-3" />{l.email}
                  </span>
                )}
                {l.phone && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-3 w-3" />{l.phone}
                  </span>
                )}
                {l.vehicle_reg && (
                  <span className="inline-flex items-center gap-1 font-mono uppercase">
                    <Car className="h-3 w-3" />{l.vehicle_reg}
                  </span>
                )}
                <span className="ml-auto text-muted-foreground">
                  {format(new Date(l.last_activity_date || l.created_at), 'd MMM HH:mm')}
                </span>
              </a>
            ))}
            {leads.length > 25 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="w-full px-3 py-2 text-[11px] text-center text-muted-foreground hover:bg-muted/40"
              >
                {showAll ? 'Show fewer' : `Show all ${leads.length}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadsPerAgentTab;
