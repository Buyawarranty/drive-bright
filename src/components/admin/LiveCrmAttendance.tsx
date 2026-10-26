import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Clock, LogIn, LogOut, RefreshCw, Search, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedDateFilter, periodToRange, type PeriodKey } from './UnifiedDateFilter';
import type { DateRange } from 'react-day-picker';
import { canViewStaffSigninAudit, crmAttendanceStatus } from '@/lib/crmAttendanceRules';
import { withTimeout } from '@/lib/withTimeout';
import { formatCrmAuditTime, type CrmAuditZone } from '@/lib/crmAuditTime';
import StaffLocationPanel from './hr/StaffLocationPanel';
import AdminAccessLogPanel from './AdminAccessLogPanel';
import StaffSigninAudit from './StaffSigninAudit';
import { useAuth } from '@/hooks/useAuth';
import StaffDeviceSecurityPanel from './StaffDeviceSecurityPanel';
import CrmDailySessions from './CrmDailySessions';
import { AttendanceReportRequests } from '@/lib/attendanceReportRequests';
import { firstCrmPresence } from '@/lib/crmFirstPresence';

interface Staff { id: string; email: string; first_name: string | null; last_name: string | null; role: string }
interface AttendanceDay { admin_user_id: string; day: string; active_seconds: number; first_activity_at: string | null; last_activity_at: string | null }
interface AttendanceSession { id: string; admin_user_id: string; started_at: string; last_seen_at: string; first_activity_at: string | null; last_activity_at: string | null; ended_at: string | null; end_reason: string | null; current_tab: string | null; visible: boolean }
interface Observation { admin_user_id: string; first_seen_at: string }
interface Report { staff: Staff[]; days: AttendanceDay[]; sessions: AttendanceSession[]; measured_at: string; observations?: Observation[]; observationsUnavailable?: boolean }

const ukDate = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const duration = (seconds: number) => `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
const staffName = (staff: Staff) => `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || staff.email;

export default function LiveCrmAttendance({ filterRoles }: { filterRoles?: string[] }) {
  const { userRole } = useAuth();
  const canSeeAudit = canViewStaffSigninAudit(userRole);
  const [view, setView] = useState('attendance');
  const [zone, setZone] = useState<CrmAuditZone>('UTC');
  const time = (iso: string | null | undefined) => formatCrmAuditTime(iso, zone);
  const [period, setPeriod] = useState<PeriodKey>(() => {
    const value = new URLSearchParams(window.location.search).get('ltPeriod');
    return ['all', 'today', 'yesterday', 'this_week', '7days', 'last_week', '14days', 'this_month', '30days', 'last_month'].includes(value || '') ? value as PeriodKey : 'today';
  });
  const [customRange, setCustomRange] = useState<DateRange>();
  const [team, setTeam] = useState('all');
  const [search, setSearch] = useState('');
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const requests = useRef(new AttendanceReportRequests());
  const range = period === 'custom' ? customRange : periodToRange(period);
  const from = range?.from ? ukDate(range.from) : period === 'all' ? ukDate(new Date(Date.now() - 366 * 86400000)) : ukDate(new Date());
  const to = range?.to ? ukDate(range.to) : period === 'all' ? ukDate(new Date()) : from;
  const today = ukDate(new Date());
  const live = from <= today && to >= today;
  const requestKey = `${from}:${to}`;
  requests.current.select(requestKey);
  const load = useCallback(async () => {
    if (document.hidden) return;
    const ticket = requests.current.begin(requestKey);
    if (!ticket) return;
    setLoading(true);
    try {
      const loadObservations = async () => {
        const observations: Observation[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await withTimeout(supabase.from('staff_work_locations').select('admin_user_id, first_seen_at').gte('session_date', from).lte('session_date', to).order('first_seen_at').order('id').range(offset, offset + 499), 12000, 'First CRM observations');
          if (error) throw error;
          observations.push(...(data || []));
          if ((data?.length || 0) < 500) return observations;
        }
      };
      const [response, observationResult] = await Promise.all([
        withTimeout(supabase.functions.invoke('crm-attendance', { body: { action: 'report', from, to } }), 12000, 'Attendance report'),
        loadObservations().then(observations => ({ observations, observationsUnavailable: false })).catch(() => ({ observations: [], observationsUnavailable: true })),
      ]);
      const { data, error: requestError } = response;
      if (requestError || data?.error) throw new Error(data?.error || 'Unable to load attendance');
      if (requests.current.isCurrent(requestKey, ticket)) { setReport({ ...data, ...observationResult } as Report); setError(''); setNow(Date.now()); }
    } catch {
      if (requests.current.isCurrent(requestKey, ticket)) setError('Attendance could not refresh. The last successful figures are kept.');
    } finally {
      if (requests.current.isCurrent(requestKey, ticket)) setLoading(false);
      requests.current.finish(requestKey, ticket);
    }
  }, [from, to, requestKey]);
  useEffect(() => {
    setReport(undefined);
    setError('');
    void load();
    const timer = setInterval(() => { if (!document.hidden) { setNow(Date.now()); void load(); } }, 15000);
    const refresh = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);

  const rows = useMemo(() => (report?.staff || []).filter(staff => {
    if (filterRoles && !filterRoles.includes(staff.role)) return false;
    if (team === 'sales' && !['sales', 'sales_lead', 'sales_manager'].includes(staff.role)) return false;
    return `${staffName(staff)} ${staff.email}`.toLowerCase().includes(search.toLowerCase());
  }).map(staff => {
    const sessions = (report?.sessions || []).filter(session => session.admin_user_id === staff.id);
    const latest = [...sessions].sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))[0];
    const days = (report?.days || []).filter(day => day.admin_user_id === staff.id);
    const starts = days.flatMap(day => day.first_activity_at ? [day.first_activity_at] : []).sort();
    const finishes = days.flatMap(day => day.last_activity_at ? [day.last_activity_at] : []).sort();
    const active = days.reduce((sum, day) => sum + day.active_seconds, 0);
    const status = live ? sessions.reduce<'offline' | 'idle' | 'active'>((best, session) => {
      const next = crmAttendanceStatus(session, now);
      return best === 'active' || next === 'active' ? 'active' : best === 'idle' || next === 'idle' ? 'idle' : 'offline';
    }, 'offline') : 'offline';
    const presence = firstCrmPresence(sessions, (report?.observations || []).filter(item => item.admin_user_id === staff.id));
    return { staff, sessions, latest, active, presence, first: starts[0], last: finishes[finishes.length - 1], status };
  }).sort((a, b) => ({ active: 0, idle: 1, offline: 2 }[a.status] - { active: 0, idle: 1, offline: 2 }[b.status]) || b.active - a.active), [report, search, team, filterRoles, live, now]);

  const selected = rows.find(row => row.staff.id === selectedStaff);
  return <section className="space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="h-6 w-6 text-primary" />Staff access &amp; security log</h1>
        <p className="text-sm text-muted-foreground mt-1">All staff, including offline accounts · {zone === 'UTC' ? 'GMT / UTC' : 'UK local time (GMT / BST)'}{report ? ` · Updated ${time(report.measured_at)}` : ''}</p></div>
      <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
    </header>
    {canSeeAudit && <StaffDeviceSecurityPanel from={today} to={today} alertsOnly />}
    {!filterRoles && <Tabs value={view} onValueChange={setView}><TabsList className="h-auto flex flex-wrap justify-start"><TabsTrigger value="attendance">Live attendance</TabsTrigger><TabsTrigger value="locations">Work locations</TabsTrigger>{canSeeAudit && <><TabsTrigger value="devices">Devices &amp; login attempts</TabsTrigger><TabsTrigger value="signins">Sign-in history</TabsTrigger><TabsTrigger value="access">Account access history</TabsTrigger></>}</TabsList></Tabs>}
    <Tabs value={zone} onValueChange={value => setZone(value as CrmAuditZone)}><TabsList><TabsTrigger value="UTC">GMT / UTC</TabsTrigger><TabsTrigger value="Europe/London">UK local time</TabsTrigger></TabsList></Tabs>
    {view === 'attendance' && <>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-y py-4">
      {[{ label: 'Staff', value: rows.length, icon: Users }, { label: 'Active now', value: rows.filter(row => row.status === 'active').length, icon: Activity }, { label: 'Idle / connected', value: rows.filter(row => row.status === 'idle').length, icon: Clock }, { label: 'Real CRM time', value: duration(rows.reduce((sum, row) => sum + row.active, 0)), icon: Clock }].map(item => <div key={item.label}><div className="flex items-center gap-2 text-muted-foreground text-sm"><item.icon className="h-4 w-4" />{item.label}</div><div className="text-2xl font-semibold mt-1">{item.value}</div></div>)}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      {!filterRoles && <Tabs value={team} onValueChange={setTeam}><TabsList><TabsTrigger value="all">All staff</TabsTrigger><TabsTrigger value="sales">Sales team</TabsTrigger></TabsList></Tabs>}
      <UnifiedDateFilter className="flex-wrap" scope="signup" period={period} customRange={customRange} availableScopes={['signup']} onChange={next => { setPeriod(next.period); setCustomRange(next.customRange); }} showLabel={false} />
      <div className="relative ml-auto w-full sm:w-64"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search staff" placeholder="Search staff" value={search} onChange={event => setSearch(event.target.value)} className="pl-9" /></div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {report?.observationsUnavailable && <p role="alert" className="text-sm text-destructive">Earlier CRM observations could not load. First recorded presence currently uses detailed sessions only.</p>}
    <p className="text-sm text-muted-foreground">Saved sign-in is not continuous attendance. Online means a recent CRM connection; idle means connected without recent real use. Computer locks are not recorded — paused or missing connections show last seen, not a confirmed sign-out.</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="border-b text-muted-foreground text-left"><tr>{['Staff member', 'Status', 'Recorded active time', 'First recorded CRM presence', 'First recorded interaction', 'Last recorded interaction', 'Signed out / last seen', 'Current section', 'Sessions'].map(label => <th key={label} className="py-3 px-2 font-medium">{label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.staff.id} className="border-b hover:bg-muted/40">
        <td className="p-2 py-4"><div className="font-medium">{staffName(row.staff)}</div><div className="text-xs text-muted-foreground">{row.staff.email}</div><div className="text-xs text-muted-foreground">{row.staff.role.replaceAll('_', ' ')}</div></td>
        <td className="p-2"><Badge variant={row.status === 'active' ? 'default' : 'secondary'}>{!live ? 'Historical' : row.status === 'active' ? 'Online · active' : row.status === 'idle' ? 'Online · idle' : 'Offline'}</Badge></td>
        <td className="p-2 font-semibold tabular-nums">{duration(row.active)}</td>
        <td className="p-2 tabular-nums">{time(row.presence?.at)}<div className="text-xs text-muted-foreground">{row.presence?.source || 'No observation recorded'}</div></td>
        <td className="p-2 tabular-nums">{time(row.first)}</td><td className="p-2 tabular-nums">{time(row.last)}</td>
        <td className="p-2 tabular-nums">{time(row.latest?.ended_at || row.latest?.last_seen_at)}<div className="text-xs text-muted-foreground">{row.latest ? row.latest.end_reason === 'logout' ? 'Signed out' : row.latest.ended_at ? 'Left CRM' : row.status === 'offline' ? 'Connection ended (estimated)' : 'Last connection' : '—'}</div></td>
        <td className="p-2 capitalize">{row.status !== 'offline' ? row.latest?.current_tab?.replaceAll('-', ' ') || '—' : '—'}</td>
        <td className="p-2"><Button variant="ghost" size="sm" disabled={!row.sessions.length} onClick={() => setSelectedStaff(selectedStaff === row.staff.id ? null : row.staff.id)} aria-expanded={selectedStaff === row.staff.id}>{row.sessions.length}<LogIn className="ml-2 h-4 w-4" /></Button></td>
      </tr>)}{!rows.length && <tr><td colSpan={9} className="py-12 text-center text-muted-foreground">{loading ? 'Loading staff attendance…' : error ? 'Attendance unavailable.' : 'No staff match this filter.'}</td></tr>}</tbody></table></div>
    {selected && <section className="space-y-3 border-t pt-5"><h2 className="font-semibold flex items-center gap-2"><LogOut className="h-4 w-4" />{staffName(selected.staff)} · session log</h2><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="text-left text-muted-foreground">{['Date', 'CRM opened', 'First real use', 'Last real use', 'Session ended', 'Outcome'].map(label => <th className="py-2 font-medium" key={label}>{label}</th>)}</tr></thead><tbody>{selected.sessions.map(session => <tr className="border-t" key={session.id}><td className="py-3">{ukDate(new Date(session.started_at))}</td><td>{time(session.started_at)}</td><td>{time(session.first_activity_at)}</td><td>{time(session.last_activity_at)}</td><td>{time(session.ended_at || (crmAttendanceStatus(session, now) === 'offline' ? session.last_seen_at : null))}</td><td>{session.end_reason === 'logout' ? 'Signed out' : session.ended_at ? 'Left CRM' : crmAttendanceStatus(session, now) === 'offline' ? 'Connection ended (estimated)' : session.visible ? 'Connected' : 'Tab hidden'}</td></tr>)}</tbody></table></div></section>}
    <CrmDailySessions staff={rows.map(row => row.staff)} sessions={report?.sessions || []} from={from} to={to} now={now} zone={zone} />
    <StaffLocationPanel zone={zone} from={from} to={to} staffIds={rows.map(row => row.staff.id)} />
    {period === 'all' && <p className="text-sm text-muted-foreground">Attendance covers the last 366 days. Choose a custom period for older records, up to one year at a time.</p>}
    </>}
    {view === 'locations' && <><UnifiedDateFilter className="flex-wrap" scope="signup" period={period} customRange={customRange} availableScopes={['signup']} onChange={next => { setPeriod(next.period); setCustomRange(next.customRange); }} showLabel={false} /><StaffLocationPanel zone={zone} from={from} to={to} staffIds={rows.map(row => row.staff.id)} /></>}
    {canSeeAudit && view === 'signins' && <><UnifiedDateFilter scope="signup" period={period} customRange={customRange} availableScopes={['signup']} onChange={next => { setPeriod(next.period); setCustomRange(next.customRange); }} showLabel={false} /><StaffSigninAudit from={from} to={to} zone={zone} /></>}
    {canSeeAudit && view === 'access' && <AdminAccessLogPanel zone={zone} />}
    {canSeeAudit && view === 'devices' && <><UnifiedDateFilter scope="signup" period={period} customRange={customRange} availableScopes={['signup']} onChange={next => { setPeriod(next.period); setCustomRange(next.customRange); }} showLabel={false} /><StaffDeviceSecurityPanel from={from} to={to} zone={zone} /></>}
  </section>;
}