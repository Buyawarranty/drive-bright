import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Wifi, WifiOff, Clock, RefreshCw, Search, AlertCircle, Phone, Activity } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { UnifiedDateFilter, periodToRange, type PeriodKey } from '@/components/admin/UnifiedDateFilter';
import { DateRange } from 'react-day-picker';

interface AdminUserRow {
  id: string;
  user_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
}

interface Presence {
  admin_user_id: string;
  status: string;
  last_seen_at: string | null;
  last_activity_at: string | null;
  last_interaction_at: string | null;
  current_tab: string | null;
  session_started_at: string | null;
}

interface RawOnlineDay {
  admin_user_id: string;
  total_online_seconds: number;
  first_online_at: string | null;
  last_online_at: string | null;
  session_count: number;
  date?: string;
}

interface AggregatedOnlineDay {
  admin_user_id: string;
  total_online_seconds: number;
  first_online_at: string | null;
  last_online_at: string | null;
  session_count: number;
}

const ROLE_LABELS: Record<string, string> = {
  sales: 'Sales',
  sales_lead: 'Sales Lead',
  sales_manager: 'Sales Manager',
  performance_manager: 'Perf Manager',
  claims_agent: 'Claims',
  claims_manager: 'Claims Manager',
  lead_gen: 'Lead Gen',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
};

const timeAgo = (iso: string | null): string => {
  if (!iso) return 'Never';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const liveStatus = (p?: Presence | null, latestWork?: string | null): 'active' | 'idle' | 'offline' => {
  // Consider ANY signal: heartbeat (last_activity_at), real interaction (last_interaction_at),
  // or a work event logged today (dial, note, status change). Whichever is most recent wins.
  const candidates = [p?.last_activity_at, p?.last_interaction_at, latestWork].filter(Boolean) as string[];
  if (candidates.length === 0) return 'offline';
  const latest = Math.max(...candidates.map((iso) => new Date(iso).getTime()));
  const elapsed = (Date.now() - latest) / 1000;
  if (elapsed < 180) return 'active';       // < 3 min = active
  if (elapsed < 900) return 'idle';          // 3–15 min = idle
  return 'offline';
};

interface AttendanceTabProps {
  filterRoles?: string[];
}

interface WorkStats {
  dials: number;
  notes: number;
  actions: number;
  last: string | null;
}

export const AttendanceTab: React.FC<AttendanceTabProps> = ({ filterRoles }) => {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [onlineDays, setOnlineDays] = useState<AggregatedOnlineDay[]>([]);
  const [workByUser, setWorkByUser] = useState<Map<string, WorkStats>>(new Map());
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('sales');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const activeRange = useMemo<DateRange | undefined>(() => {
    if (period === 'custom') return customRange;
    return periodToRange(period);
  }, [period, customRange]);

  const date = useMemo(() => activeRange?.from ?? new Date(), [activeRange]);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isSingleDay = useMemo(
    () => !activeRange?.to || isSameDay(activeRange.from, activeRange.to),
    [activeRange]
  );
  const isTodayView = useMemo(
    () => isSingleDay && format(date, 'yyyy-MM-dd') === todayStr,
    [isSingleDay, date, todayStr]
  );

  const dateStr = format(date, 'yyyy-MM-dd');

  const load = useCallback(async () => {
    setLoading(true);

    const rangeStartStr = activeRange?.from ? format(activeRange.from, 'yyyy-MM-dd') : dateStr;
    const rangeEndStr = activeRange?.to ? format(activeRange.to, 'yyyy-MM-dd') : dateStr;
    const rangeStartIso = new Date(`${rangeStartStr}T00:00:00.000Z`).toISOString();
    const rangeEndIso = new Date(`${rangeEndStr}T23:59:59.999Z`).toISOString();

    const [u, p, d, actsRes, leadNotesRes, claimNotesRes] = await Promise.all([
      supabase
        .from('admin_users')
        .select('id, user_id, email, first_name, last_name, role, is_active')
        .eq('is_active', true),
      isTodayView
        ? supabase
            .from('user_presence')
            .select(
              'admin_user_id, status, last_seen_at, last_activity_at, last_interaction_at, current_tab, session_started_at'
            )
        : Promise.resolve({ data: [], error: null } as any),
      isSingleDay
        ? supabase
            .from('user_daily_online_time')
            .select('admin_user_id, total_online_seconds, first_online_at, last_online_at, session_count')
            .eq('date', dateStr)
        : supabase
            .from('user_daily_online_time')
            .select('admin_user_id, total_online_seconds, first_online_at, last_online_at, session_count, date')
            .gte('date', rangeStartStr)
            .lte('date', rangeEndStr),
      supabase
        .from('lead_activities')
        .select('performed_by, activity_type, created_at')
        .gte('created_at', rangeStartIso)
        .lte('created_at', rangeEndIso)
        .not('performed_by', 'is', null),
      supabase
        .from('lead_quick_notes')
        .select('created_by, created_at')
        .gte('created_at', rangeStartIso)
        .lte('created_at', rangeEndIso)
        .not('created_by', 'is', null),
      supabase
        .from('claim_notes')
        .select('created_by, created_at')
        .gte('created_at', rangeStartIso)
        .lte('created_at', rangeEndIso)
        .not('created_by', 'is', null),
    ]);

    if (u.data) setUsers(u.data as AdminUserRow[]);
    if (p.data) setPresences(p.data as Presence[]);

    // Aggregate work signals per admin_user_id
    const work = new Map<string, { dials: number; notes: number; actions: number; last: string | null }>();
    const bump = (uid: string, field: 'dials' | 'notes' | 'actions', ts: string) => {
      const cur = work.get(uid) || { dials: 0, notes: 0, actions: 0, last: null };
      cur[field] += 1;
      if (!cur.last || ts > cur.last) cur.last = ts;
      work.set(uid, cur);
    };
    (actsRes.data || []).forEach((row: any) => {
      const uid = row.performed_by;
      if (!uid) return;
      const isDial = row.activity_type === 'call' || row.activity_type === 'call_attempt';
      bump(uid, isDial ? 'dials' : 'actions', row.created_at);
    });
    (leadNotesRes.data || []).forEach((row: any) => row.created_by && bump(row.created_by, 'notes', row.created_at));
    (claimNotesRes.data || []).forEach((row: any) => row.created_by && bump(row.created_by, 'notes', row.created_at));
    setWorkByUser(work);

    if (d.data) {
      if (isSingleDay) {
        setOnlineDays(d.data as AggregatedOnlineDay[]);
      } else {
        const agg = new Map<string, AggregatedOnlineDay>();
        (d.data as RawOnlineDay[]).forEach((row) => {
          const existing = agg.get(row.admin_user_id);
          if (existing) {
            existing.total_online_seconds += row.total_online_seconds || 0;
            existing.session_count += row.session_count || 0;
            if (row.first_online_at && (!existing.first_online_at || row.first_online_at < existing.first_online_at)) {
              existing.first_online_at = row.first_online_at;
            }
            if (row.last_online_at && (!existing.last_online_at || row.last_online_at > existing.last_online_at)) {
              existing.last_online_at = row.last_online_at;
            }
          } else {
            agg.set(row.admin_user_id, {
              admin_user_id: row.admin_user_id,
              total_online_seconds: row.total_online_seconds || 0,
              first_online_at: row.first_online_at,
              last_online_at: row.last_online_at,
              session_count: row.session_count || 0,
            });
          }
        });
        setOnlineDays(Array.from(agg.values()));
      }
    }
    setLoading(false);
  }, [dateStr, isSingleDay, isTodayView, activeRange]);

  useEffect(() => {
    load();
  }, [load]);

  // Live tick for "active now" computations
  useEffect(() => {
    if (!isTodayView) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [isTodayView]);

  // Realtime presence updates
  useEffect(() => {
    if (!isTodayView) return;
    const channel = supabase
      .channel('attendance-presence')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence' },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isTodayView, load]);

  const presenceById = useMemo(() => {
    const m = new Map<string, Presence>();
    presences.forEach((p) => m.set(p.admin_user_id, p));
    return m;
  }, [presences]);

  const onlineById = useMemo(() => {
    const m = new Map<string, AggregatedOnlineDay>();
    onlineDays.forEach((o) => m.set(o.admin_user_id, o));
    return m;
  }, [onlineDays]);

  const filteredUsers = useMemo(() => {
    let list = users;
    const baseRoles =
      filterRoles ??
      (roleFilter === 'sales'
        ? ['sales', 'sales_lead', 'sales_manager', 'performance_manager', 'lead_gen']
        : roleFilter === 'claims'
        ? ['claims_agent', 'claims_manager']
        : null);
    if (baseRoles) list = list.filter((u) => baseRoles.includes(u.role));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.first_name || '').toLowerCase().includes(q) ||
          (u.last_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, search, roleFilter, filterRoles]);

  const computeOnlineSeconds = (userId: string): number => {
    const od = onlineById.get(userId);
    let total = od?.total_online_seconds || 0;
    if (isTodayView) {
      const p = presenceById.get(userId);
      if (p && liveStatus(p, workByUser.get(userId)?.last || null) !== 'offline' && p.last_activity_at) {
        const elapsed = Math.floor((now - new Date(p.last_activity_at).getTime()) / 1000);
        if (elapsed > 0 && elapsed < 86400) total += elapsed;
      }
    }
    return total;
  };

  const rows = useMemo(() => {
    return filteredUsers
      .map((u) => {
        const p = presenceById.get(u.id);
        const work = workByUser.get(u.id) || { dials: 0, notes: 0, actions: 0, last: null };
        const status = isTodayView ? liveStatus(p, work.last) : 'offline';
        const onlineSec = computeOnlineSeconds(u.id);
        return { user: u, presence: p, status, onlineSec, day: onlineById.get(u.id), work };
      })
      .sort((a, b) => {
        const order = { active: 0, idle: 1, offline: 2 } as const;
        const so = order[a.status] - order[b.status];
        if (so !== 0) return so;
        const workDiff = (b.work.dials + b.work.notes + b.work.actions) - (a.work.dials + a.work.notes + a.work.actions);
        if (workDiff !== 0) return workDiff;
        return b.onlineSec - a.onlineSec;
      });
  }, [filteredUsers, presenceById, onlineById, workByUser, isTodayView, now]);

  const summary = useMemo(() => {
    const counts = { active: 0, idle: 0, offline: 0 };
    rows.forEach((r) => {
      counts[r.status as keyof typeof counts]++;
    });
    return counts;
  }, [rows]);

  const renderStatusBadge = (status: string) => {
    if (status === 'active')
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
          <Wifi className="h-3 w-3" /> Active
        </Badge>
      );
    if (status === 'idle')
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
          <Clock className="h-3 w-3" /> Idle
        </Badge>
      );
    return (
      <Badge variant="secondary" className="gap-1 text-muted-foreground">
        <WifiOff className="h-3 w-3" /> Offline
      </Badge>
    );
  };

  const onlineTimeLabel = isTodayView
    ? 'Online today'
    : isSingleDay
    ? 'Online that day'
    : 'Online time';

  const handleDateFilterChange = useCallback(
    ({ period: p, customRange: cr }: { scope: any; period: PeriodKey; customRange: DateRange | undefined }) => {
      setPeriod(p);
      setCustomRange(cr);
    },
    []
  );

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live view of who is in the CRM, idle, or offline. Activity is measured by real
            interaction (clicks, typing, scroll) — not just an open tab.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Active now</p>
                <p className="text-2xl font-bold text-green-600">{summary.active}</p>
              </div>
              <Wifi className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Idle</p>
                <p className="text-2xl font-bold text-amber-600">{summary.idle}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Offline</p>
                <p className="text-2xl font-bold text-slate-500">{summary.offline}</p>
              </div>
              <WifiOff className="h-8 w-8 text-slate-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {!filterRoles && (
                <Tabs value={roleFilter} onValueChange={setRoleFilter}>
                  <TabsList>
                    <TabsTrigger value="sales">Sales team</TabsTrigger>
                    <TabsTrigger value="claims">Claims team</TabsTrigger>
                    <TabsTrigger value="all">Everyone</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              <UnifiedDateFilter
                scope="signup"
                period={period}
                customRange={customRange}
                availableScopes={['signup']}
                onChange={handleDateFilterChange}
                showLabel={false}
              />
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search by name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="pb-3 font-medium">Agent</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">{onlineTimeLabel}</th>
                  <th className="pb-3 font-medium" title="Outbound dial attempts">Dials</th>
                  <th className="pb-3 font-medium" title="Notes added on leads or claims">Notes</th>
                  <th className="pb-3 font-medium" title="Assignments, status changes, other CRM actions">Actions</th>
                  <th className="pb-3 font-medium">First in</th>
                  <th className="pb-3 font-medium">Last activity</th>
                  <th className="pb-3 font-medium">Currently on</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ user, presence, status, onlineSec, day, work }) => {
                  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
                  const candidateIsos = [
                    presence?.last_interaction_at,
                    presence?.last_activity_at,
                    work.last,
                    day?.last_online_at,
                  ].filter(Boolean) as string[];
                  const lastIso = candidateIsos.length
                    ? candidateIsos.sort().slice(-1)[0]
                    : null;
                  const offlineFor =
                    isTodayView && status === 'offline' && lastIso
                      ? timeAgo(lastIso)
                      : null;
                  const numCell = (n: number, tone: string) => {
                    const cls =
                      n === 0
                        ? 'bg-slate-100 text-slate-400'
                        : tone === 'orange'
                        ? 'bg-orange-100 text-orange-700'
                        : tone === 'blue'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-200 text-slate-700';
                    return (
                      <span className={`inline-flex items-center justify-center min-w-[28px] px-1.5 h-6 rounded text-xs font-semibold ${cls}`}>
                        {n}
                      </span>
                    );
                  };
                  return (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3">
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="py-3">
                        <Badge variant="outline" className="text-xs">
                          {ROLE_LABELS[user.role] || user.role}
                        </Badge>
                      </td>
                      <td className="py-3">{renderStatusBadge(status)}</td>
                      <td className="py-3">
                        <span
                          className={`font-medium ${
                            onlineSec >= 14400
                              ? 'text-green-600'
                              : onlineSec >= 3600
                              ? 'text-slate-700'
                              : onlineSec > 0
                              ? 'text-amber-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatDuration(onlineSec)}
                        </span>
                        {day && day.session_count > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({day.session_count} sess.)
                          </span>
                        )}
                      </td>
                      <td className="py-3">{numCell(work.dials, 'orange')}</td>
                      <td className="py-3">{numCell(work.notes, 'blue')}</td>
                      <td className="py-3">{numCell(work.actions, 'slate')}</td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {day?.first_online_at
                          ? format(new Date(day.first_online_at), 'HH:mm')
                          : '—'}
                      </td>
                      <td className="py-3 text-xs">
                        {lastIso ? (
                          <div>
                            <div>{timeAgo(lastIso)}</div>
                            <div className="text-muted-foreground">
                              {format(new Date(lastIso), 'HH:mm')}
                            </div>
                            {offlineFor && (
                              <div className="flex items-center gap-1 text-red-600 text-[11px] mt-0.5">
                                <AlertCircle className="h-3 w-3" />
                                Offline {offlineFor}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never seen</span>
                        )}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground capitalize">
                        {isTodayView && status !== 'offline'
                          ? presence?.current_tab?.replace(/-/g, ' ') || '—'
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted-foreground">
                      {loading ? 'Loading attendance…' : 'No team members match this filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            <strong>How this works:</strong> Active means signed in with a heartbeat, real click,
            dial, or note in the last 3 minutes. Idle is 3 to 15 minutes without activity. Offline
            means no signal for 15 plus minutes or signed out. Dials counts outbound call attempts,
            Notes counts lead and claim notes added, and Actions covers assignments, status
            changes and other CRM work in the selected date range.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceTab;
