import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Loader2, Phone, PhoneMissed, PhoneCall, Download, ChevronDown, ChevronRight, Info, Timer, Clock, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { UnifiedDateFilter, periodToRange, type PeriodKey } from './UnifiedDateFilter';
import type { DateRange } from 'react-day-picker';
import { LeadSpeedTable } from './call-stats/LeadSpeedTable';

interface CallEvent {
  id: string;
  agent_user_id: string | null;
  agent_email: string | null;
  agent_extension: string | null;
  direction: string;
  status: string;
  dialed_number: string | null;
  started_at: string;
  answered_at: string | null;
  duration_seconds: number | null;
  talk_seconds: number | null;
}

interface AgentRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string | null;
  sip_extension: string | null;
}

interface TeamMember {
  admin_user_id: string;
  team_id: string;
  lead_teams: { name: string; color: string | null } | null;
}

interface CallStatsTabProps {
  userRole: string | null;
  /**
   * When provided, the per-agent breakdown is limited to these admin_users ids.
   * Sales agents get their own id only; managers get the full list (undefined).
   */
  restrictToAgentIds?: string[] | null;
  /** True when the viewer is only seeing their own dials — changes the copy. */
  selfView?: boolean;
}

const SHIFT_START_HOUR = 8;   // 08:00 UK
const SHIFT_END_HOUR = 19;    // 19:00 UK exclusive

// Return the UK-local hour of an ISO timestamp, no external deps.
const ukHour = (iso: string): number => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour12: false,
    hour: '2-digit',
  }).formatToParts(new Date(iso));
  const h = parts.find(p => p.type === 'hour')?.value ?? '0';
  return parseInt(h, 10);
};

const isInShift = (iso: string) => {
  const h = ukHour(iso);
  return h >= SHIFT_START_HOUR && h < SHIFT_END_HOUR;
};

const fmtSecs = (s: number | null | undefined) => {
  if (!s || s <= 0) return '0s';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

const agentName = (a: AgentRow) => {
  const n = [a.first_name, a.last_name].filter(Boolean).join(' ').trim();
  return n || a.email;
};

export const CallStatsTab: React.FC<CallStatsTabProps> = ({ userRole, restrictToAgentIds, selfView }) => {
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const activeRange = useMemo<DateRange | undefined>(() => {
    if (period === 'custom') return customRange;
    return periodToRange(period);
  }, [period, customRange]);
  const dateFrom = activeRange?.from ?? new Date(new Date().setHours(0, 0, 0, 0));
  const dateTo = activeRange?.to ?? activeRange?.from ?? new Date();
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('inshift-desc');
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [events, setEvents] = useState<CallEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    let ranOnce = false;

    const run = async () => {
      // Never hammer the DB while the tab is backgrounded — this page is a
      // "watch it live" dashboard, but sales agents may leave it open behind
      // their Zoiper / Dial 9 windows. Fetching in the background adds nothing
      // and just competes for network + CPU with active calls.
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (ranOnce || cancelled) return;
      ranOnce = true;

      setLoading(true);
      const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999);

      const [agentsRes, teamRes, eventsRes] = await Promise.all([
        supabase
          .from('admin_users')
          .select('id, first_name, last_name, email, role, sip_extension')
          .in('role', ['sales', 'sales_lead']),
        supabase
          .from('lead_team_members')
          .select('admin_user_id, team_id, lead_teams!inner(name, color)'),
        supabase
          .from('zoiper_call_events')
          .select('id, agent_user_id, agent_email, agent_extension, direction, status, dialed_number, started_at, answered_at, duration_seconds, talk_seconds')
          .gte('started_at', from.toISOString())
          .lte('started_at', to.toISOString())
          .order('started_at', { ascending: false })
          .limit(2500),
      ]);
      if (cancelled) return;
      setAgents((agentsRes.data as AgentRow[]) || []);
      setTeamMembers((teamRes.data as any as TeamMember[]) || []);
      setEvents((eventsRes.data as CallEvent[]) || []);

      if (cancelled) return;
      setLoading(false);
    };

    // Debounce so rapid date-filter changes coalesce into one query.
    const t = window.setTimeout(run, 250);
    const onVis = () => {
      if (document.visibilityState === 'visible' && !ranOnce) run();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [dateFrom, dateTo]);

  const teamByAgent = useMemo(() => {
    const m: Record<string, { name: string; color: string | null }> = {};
    teamMembers.forEach(tm => {
      if (tm.lead_teams) m[tm.admin_user_id] = tm.lead_teams;
    });
    return m;
  }, [teamMembers]);

  const availableTeams = useMemo(() => {
    const set = new Map<string, { name: string; color: string | null }>();
    Object.values(teamByAgent).forEach(t => set.set(t.name.toLowerCase(), t));
    return Array.from(set.values());
  }, [teamByAgent]);

  const filteredAgents = useMemo(() => {
    const allowed = restrictToAgentIds ? new Set(restrictToAgentIds) : null;
    return agents.filter(a => {
      if (allowed && !allowed.has(a.id)) return false;
      const team = teamByAgent[a.id];
      const teamName = team?.name?.toLowerCase() || '';
      if (teamFilter === 'all') return true;
      if (teamFilter === 'blue-red') return teamName.includes('blue') || teamName.includes('red');
      if (teamFilter === 'unassigned') return !team;
      return teamName === teamFilter || teamName.includes(teamFilter);
    });
  }, [agents, teamByAgent, teamFilter, restrictToAgentIds]);

  const eventsByAgent = useMemo(() => {
    const map: Record<string, CallEvent[]> = {};
    events.forEach(e => {
      // Match by agent_user_id first, else by email (case-insensitive)
      let key: string | null = e.agent_user_id;
      if (!key && e.agent_email) {
        const match = agents.find(a => a.email.toLowerCase() === e.agent_email!.toLowerCase());
        if (match) key = match.id;
      }
      if (!key && e.agent_extension) {
        const match = agents.find(a => a.sip_extension === e.agent_extension);
        if (match) key = match.id;
      }
      if (!key) return;
      (map[key] ||= []).push(e);
    });
    return map;
  }, [events, agents]);

  const rows = useMemo(() => {
    const built = filteredAgents.map(a => {
      // De-dupe events keyed by (direction, started_at rounded to second, dialed_number)
      // in case both Dial 9 poller and Zoiper webhook wrote the same call.
      const seen = new Set<string>();
      const list = (eventsByAgent[a.id] || []).filter(e => {
        const key = `${e.direction}|${e.dialed_number || ''}|${Math.round(new Date(e.started_at).getTime() / 1000)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const inShift = list.filter(e => isInShift(e.started_at));
      const outShift = list.filter(e => !isInShift(e.started_at));
      // Missed = truly unanswered calls only (inbound rings the agent didn't
      // pick up, or outbound with no_answer). Busy/failed/cancelled are noise
      // — usually the agent hanging up before ring, so we exclude them.
      const missed = list.filter(e => ['missed', 'no_answer'].includes(e.status));
      const answered = list.filter(e => e.status === 'answered');
      // Talk time = only answered calls (missed calls have no talk).
      const talkSec = answered.reduce((sum, e) => sum + (e.talk_seconds ?? 0), 0);
      const inShiftTalk = answered
        .filter(e => isInShift(e.started_at))
        .reduce((sum, e) => sum + (e.talk_seconds ?? 0), 0);
      const longest = answered.reduce((m, e) => Math.max(m, e.talk_seconds ?? 0), 0);
      const avgLen = answered.length ? Math.round(talkSec / answered.length) : 0;
      // Call-length buckets (answered calls only)
      const buckets = { under1: 0, oneToFive: 0, fiveToFifteen: 0, overFifteen: 0 };
      answered.forEach(e => {
        const s = e.talk_seconds ?? 0;
        if (s < 60) buckets.under1++;
        else if (s < 300) buckets.oneToFive++;
        else if (s < 900) buckets.fiveToFifteen++;
        else buckets.overFifteen++;
      });
      return {
        agent: a,
        team: teamByAgent[a.id],
        total: list.length,
        inShift: inShift.length,
        outShift: outShift.length,
        missed: missed.length,
        answered: answered.length,
        talkSec,
        inShiftTalk,
        avgLen,
        longest,
        buckets,
        list,
      };
    });
    const cmp = (a: typeof built[number], b: typeof built[number]) => {
      switch (sortBy) {
        case 'total-desc': return b.total - a.total;
        case 'missed-desc': return b.missed - a.missed;
        case 'talk-desc': return b.talkSec - a.talkSec;
        case 'inshift-desc':
        default:
          return b.inShift - a.inShift || b.total - a.total;
      }
    };
    return built.sort(cmp);
  }, [filteredAgents, eventsByAgent, teamByAgent, sortBy]);

  const totals = useMemo(() => {
    const t = rows.reduce((acc, r) => ({
      dials: acc.dials + r.total,
      inShift: acc.inShift + r.inShift,
      missed: acc.missed + r.missed,
      talk: acc.talk + r.talkSec,
    }), { dials: 0, inShift: 0, missed: 0, talk: 0 });
    return t;
  }, [rows]);

  const exportCsv = () => {
    const header = ['Agent', 'Email', 'Extension', 'Team', 'Total dials', 'In-shift dials', 'Out-of-shift', 'Missed', 'Answered', 'Avg call', '<1m', '1-5m', '5-15m', '>15m', 'Total talk (s)', 'In-shift talk (s)', 'Longest (s)'];
    const lines = [header.join(',')];
    rows.forEach(r => {
      lines.push([
        agentName(r.agent),
        r.agent.email,
        r.agent.sip_extension || '',
        r.team?.name || '',
        r.total, r.inShift, r.outShift, r.missed, r.answered,
        r.avgLen,
        r.buckets.under1, r.buckets.oneToFive, r.buckets.fiveToFifteen, r.buckets.overFifteen,
        r.talkSec, r.inShiftTalk, r.longest,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-stats-${format(dateFrom, 'yyyy-MM-dd')}_to_${format(dateTo, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="w-6 h-6" /> {selfView ? 'My call stats' : 'Call Stats'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selfView
              ? 'Your own dials, missed calls and talk time — live today, or pick any past day or date range below. Shift hours: 08:00–19:00 UK time (highlighted).'
              : 'Dial counts, missed calls and talk time from Zoiper. Shift hours: 08:00–19:00 UK time (highlighted).'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <UnifiedDateFilter
            scope="signup"
            period={period}
            customRange={customRange}
            availableScopes={['signup']}
            showLabel={false}
            hideQuickLinks
            onChange={({ period: p, customRange: r }) => {
              setPeriod(p);
              setCustomRange(r);
            }}
          />
          {!restrictToAgentIds && (
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="blue-red">Blue + Red</SelectItem>
              <SelectItem value="all">All teams</SelectItem>
              {availableTeams.map(t => (
                <SelectItem key={t.name} value={t.name.toLowerCase()}>{t.name}</SelectItem>
              ))}
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
          )}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9 w-[210px]">
              <Timer className="w-3.5 h-3.5 mr-1.5 opacity-60" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inshift-desc">Sort: In-shift dials (high → low)</SelectItem>
              <SelectItem value="total-desc">Total dials (high → low)</SelectItem>
              <SelectItem value="talk-desc">Total talk time (high → low)</SelectItem>
              <SelectItem value="missed-desc">Missed (high → low)</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={exportCsv} disabled={!rows.length}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <PhoneCall className="w-3.5 h-3.5" /> Total dials
            </div>
            <div className="text-2xl font-semibold mt-1">{totals.dials}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-amber-800">
              <PhoneCall className="w-3.5 h-3.5" /> In-shift dials (8–7 UK)
            </div>
            <div className="text-2xl font-semibold mt-1 text-amber-800">{totals.inShift}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50/50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-red-700">
              <PhoneMissed className="w-3.5 h-3.5" /> Missed
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-red-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Calls Dial 9 recorded as not connected — unanswered inbound
                    rings and outbound dials that returned no answer (including
                    calls that went to voicemail).
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-2xl font-semibold mt-1 text-red-700">{totals.missed}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50/50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-emerald-700">
              <Phone className="w-3.5 h-3.5" /> Total talk time
            </div>
            <div className="text-2xl font-semibold mt-1 text-emerald-700">{fmtSecs(totals.talk)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Per-agent breakdown
            <Badge variant="secondary" className="text-[10px]">{rows.length} agents</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
              No agents match the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-2 px-2 font-medium"></th>
                    <th className="py-2 px-3 font-medium">Agent</th>
                    <th className="py-2 px-3 font-medium">Team</th>
                    <th className="py-2 px-3 font-medium">Ext.</th>
                    <th className="py-2 px-3 font-medium text-right">Total dials</th>
                    <th className="py-2 px-3 font-medium text-right bg-amber-50/60 text-amber-900">In-shift</th>
                    <th className="py-2 px-3 font-medium text-right">Out-of-shift</th>
                    <th className="py-2 px-3 font-medium text-right" title="Calls Dial 9 recorded as not connected (no answer / voicemail).">Missed</th>
                    <th className="py-2 px-3 font-medium text-right">Answered</th>
                    <th className="py-2 px-3 font-medium text-right">Avg call</th>
                    <th className="py-2 px-3 font-medium text-right bg-slate-50 text-slate-700" title="Answered calls shorter than 1 minute">&lt;1m</th>
                    <th className="py-2 px-3 font-medium text-right bg-slate-50 text-slate-700" title="Answered calls 1–5 minutes">1–5m</th>
                    <th className="py-2 px-3 font-medium text-right bg-slate-50 text-slate-700" title="Answered calls 5–15 minutes">5–15m</th>
                    <th className="py-2 px-3 font-medium text-right bg-slate-50 text-slate-700" title="Answered calls over 15 minutes">&gt;15m</th>
                    <th className="py-2 px-3 font-medium text-right bg-emerald-50/60 text-emerald-900">Total talk</th>
                    <th className="py-2 px-3 font-medium text-right">Longest</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const isOpen = !!expanded[r.agent.id];
                    return (
                      <React.Fragment key={r.agent.id}>
                        <tr className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => toggle(r.agent.id)}>
                          <td className="py-2 px-2 align-middle">
                            {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          </td>
                          <td className="py-2 px-3 font-medium">{agentName(r.agent)}</td>
                          <td className="py-2 px-3">
                            {r.team ? (
                              <Badge
                                variant="outline"
                                className={cn('text-[10px]',
                                  r.team.name.toLowerCase() === 'blue' && 'border-blue-400 text-blue-700 bg-blue-50',
                                  r.team.name.toLowerCase() === 'red' && 'border-red-400 text-red-700 bg-red-50',
                                )}
                              >
                                {r.team.name}
                              </Badge>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{r.agent.sip_extension || '—'}</td>
                          <td className="py-2 px-3 text-right">{r.total}</td>
                          <td className="py-2 px-3 text-right bg-amber-50/40 font-semibold text-amber-900">{r.inShift}</td>
                          <td className="py-2 px-3 text-right text-muted-foreground">{r.outShift}</td>
                          <td className="py-2 px-3 text-right">
                            {r.missed > 0 ? <span className="text-red-600 font-medium">{r.missed}</span> : 0}
                          </td>
                          <td className="py-2 px-3 text-right">{r.answered}</td>
                          <td className="py-2 px-3 text-right text-xs">{fmtSecs(r.avgLen)}</td>
                          <td className="py-2 px-3 text-right text-xs bg-slate-50">{r.buckets.under1 || <span className="text-muted-foreground">0</span>}</td>
                          <td className="py-2 px-3 text-right text-xs bg-slate-50">{r.buckets.oneToFive || <span className="text-muted-foreground">0</span>}</td>
                          <td className="py-2 px-3 text-right text-xs bg-slate-50">{r.buckets.fiveToFifteen || <span className="text-muted-foreground">0</span>}</td>
                          <td className="py-2 px-3 text-right text-xs bg-slate-50">{r.buckets.overFifteen || <span className="text-muted-foreground">0</span>}</td>
                          <td className="py-2 px-3 text-right bg-emerald-50/40 font-semibold text-emerald-900">{fmtSecs(r.talkSec)}</td>
                          <td className="py-2 px-3 text-right text-xs">{fmtSecs(r.longest)}</td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-muted/10">
                            <td colSpan={16} className="p-3">
                              {r.list.length === 0 ? (
                                <div className="text-xs text-muted-foreground">No calls in range.</div>
                              ) : (
                                <div className="max-h-80 overflow-y-auto border rounded">
                                  <table className="w-full text-xs">
                                    <thead className="bg-muted/40 text-muted-foreground">
                                      <tr className="text-left">
                                        <th className="py-1 px-2 font-medium">When</th>
                                        <th className="py-1 px-2 font-medium">Number</th>
                                        <th className="py-1 px-2 font-medium">Direction</th>
                                        <th className="py-1 px-2 font-medium">Status</th>
                                        <th className="py-1 px-2 font-medium text-right">Talk</th>
                                        <th className="py-1 px-2 font-medium">In shift</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {r.list.slice(0, 200).map(e => (
                                        <tr key={e.id} className="border-t">
                                          <td className="py-1 px-2 whitespace-nowrap">
                                            {new Date(e.started_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
                                          </td>
                                          <td className="py-1 px-2 font-mono">{e.dialed_number || e.agent_extension || '—'}</td>
                                          <td className="py-1 px-2">{e.direction}</td>
                                          <td className="py-1 px-2">
                                            <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                                          </td>
                                          <td className="py-1 px-2 text-right">{fmtSecs(e.talk_seconds)}</td>
                                          <td className="py-1 px-2">
                                            {isInShift(e.started_at)
                                              ? <span className="text-amber-800 font-medium">Yes</span>
                                              : <span className="text-muted-foreground">No</span>}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-lead speed-to-dial + Time to contact table (replaces the per-agent response panel). */}

      {/* Per-lead speed-to-dial table — 250/page, mirrors New Leads status pills. */}
      <LeadSpeedTable dateFrom={dateFrom} dateTo={dateTo} teamFilter={teamFilter} />



      <Card className="bg-blue-50/40 border-blue-200">
        <CardContent className="p-4 text-xs text-blue-900 flex gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-1">Setup — Zoiper webhook</div>
            <div>Point your Zoiper Biz / SIP PBX CDR webhook at:</div>
            <code className="block mt-1 p-2 bg-white/70 border border-blue-200 rounded font-mono">
              POST https://mzlpuxzwyrcyrgrongeb.functions.supabase.co/zoiper-cdr-webhook
              <br />Header: x-zoiper-secret: &lt;the secret you saved&gt;
            </code>
            <div className="mt-2">
              Each staff member's Zoiper extension needs to be set on their admin profile (<code>sip_extension</code>) so calls resolve to the right agent. Emails work as a fallback.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CallStatsTab;
