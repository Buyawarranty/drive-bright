import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bar,

  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from 'recharts';
import { AlertTriangle, Download, Gauge, Monitor, RefreshCw, Users } from 'lucide-react';
import { describeEnvironment } from '@/lib/systemEnvironment';
import { LOAD_OPTIONS, PROBLEM_OPTIONS, RATING_LABELS } from '@/components/admin/feedback/SystemCheckInForm';

/**
 * Staff System Reports — what sales staff say about how the dashboard performs
 * on their own machine, turned into something a manager can act on.
 */

type Report = {
  id: string;
  admin_user_id: string | null;
  admin_email: string | null;
  admin_name: string | null;
  role: string | null;
  speed_rating: number;
  screen: string | null;
  problem_type: string | null;
  load_bucket: string | null;
  description: string | null;
  browser: string | null;
  browser_version: string | null;
  os: string | null;
  device_type: string | null;
  screen_size: string | null;
  connection_type: string | null;
  downlink_mbps: number | null;
  device_memory_gb: number | null;
  cpu_cores: number | null;
  page_load_ms: number | null;
  route: string | null;
  created_at: string;
};

const RANGES = [
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
] as const;

const BAD_PROBLEMS = new Set(['froze', 'crashed', 'blank', 'not_saving']);

const problemLabel = (v: string | null) => PROBLEM_OPTIONS.find((p) => p.value === v)?.label || 'Not stated';
const loadLabel = (v: string | null) => LOAD_OPTIONS.find((p) => p.value === v)?.label || 'Not stated';

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Europe/London' });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London' });

const ratingTone = (avg: number) => {
  if (avg < 2.5) return 'bg-destructive/10 text-destructive border-destructive/30';
  if (avg < 3.5) return 'bg-amber-100 text-amber-800 border-amber-300';
  return 'bg-emerald-100 text-emerald-800 border-emerald-300';
};

const groupCount = (rows: Report[], key: (r: Report) => string | null) => {
  const map = new Map<string, { label: string; count: number; ratingSum: number }>();
  rows.forEach((r) => {
    const label = key(r) || 'Not reported';
    const entry = map.get(label) || { label, count: 0, ratingSum: 0 };
    entry.count += 1;
    entry.ratingSum += r.speed_rating;
    map.set(label, entry);
  });
  return Array.from(map.values())
    .map((e) => ({ ...e, avg: e.ratingSum / e.count }))
    .sort((a, b) => b.count - a.count);
};

export const StaffSystemReportsTab: React.FC = () => {
  const [rangeId, setRangeId] = useState<(typeof RANGES)[number]['id']>('30d');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const days = RANGES.find((r) => r.id === rangeId)?.days ?? 30;
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data, error } = await (supabase as any)
        .from('staff_system_reports')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      setReports((data || []) as Report[]);
    } catch (e) {
      console.warn('[StaffSystemReportsTab] load failed', e);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [rangeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const total = reports.length;
    const avg = total ? reports.reduce((s, r) => s + r.speed_rating, 0) / total : null;
    const problems = reports.filter((r) => BAD_PROBLEMS.has(r.problem_type || '')).length;
    const people = new Set(reports.map((r) => r.admin_user_id || r.admin_email || 'unknown')).size;
    return { total, avg, problems, people };
  }, [reports]);

  const byAgent = useMemo(() => {
    const map = new Map<
      string,
      { name: string; role: string | null; count: number; ratingSum: number; problems: number; last: string }
    >();
    reports.forEach((r) => {
      const key = r.admin_user_id || r.admin_email || 'unknown';
      const entry =
        map.get(key) || {
          name: r.admin_name || r.admin_email || 'Unknown',
          role: r.role,
          count: 0,
          ratingSum: 0,
          problems: 0,
          last: r.created_at,
        };
      entry.count += 1;
      entry.ratingSum += r.speed_rating;
      if (BAD_PROBLEMS.has(r.problem_type || '')) entry.problems += 1;
      if (r.created_at > entry.last) entry.last = r.created_at;
      map.set(key, entry);
    });
    return Array.from(map.values())
      .map((e) => ({ ...e, avg: e.ratingSum / e.count }))
      .sort((a, b) => a.avg - b.avg || b.problems - a.problems);
  }, [reports]);

  const byScreen = useMemo(() => groupCount(reports, (r) => r.screen), [reports]);
  const byBrowser = useMemo(
    () => groupCount(reports, (r) => (r.browser ? `${r.browser}${r.browser_version ? ` ${r.browser_version.split('.')[0]}` : ''}` : null)),
    [reports],
  );
  const byOs = useMemo(() => groupCount(reports, (r) => r.os), [reports]);
  const byDevice = useMemo(() => groupCount(reports, (r) => r.device_type), [reports]);
  const byConnection = useMemo(() => groupCount(reports, (r) => r.connection_type), [reports]);

  const trend = useMemo(() => {
    const map = new Map<string, { day: string; label: string; count: number; ratingSum: number; problems: number }>();
    reports.forEach((r) => {
      const day = r.created_at.slice(0, 10);
      const entry = map.get(day) || { day, label: fmtDay(r.created_at), count: 0, ratingSum: 0, problems: 0 };
      entry.count += 1;
      entry.ratingSum += r.speed_rating;
      if (BAD_PROBLEMS.has(r.problem_type || '')) entry.problems += 1;
      map.set(day, entry);
    });
    return Array.from(map.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((e) => ({ label: e.label, reports: e.count, problems: e.problems, avgRating: +(e.ratingSum / e.count).toFixed(2) }));
  }, [reports]);

  const exportCsv = () => {
    const headers = [
      'Date (UK)',
      'Staff member',
      'Role',
      'Speed rating',
      'Screen',
      'What happened',
      'Load time',
      'Notes',
      'Browser',
      'Operating system',
      'Device',
      'Screen size',
      'Connection',
      'Mbps',
      'CPU cores',
      'Memory GB',
      'Measured page load (ms)',
    ];
    const rows = reports.map((r) => [
      fmtDateTime(r.created_at),
      r.admin_name || r.admin_email || '',
      r.role || '',
      `${r.speed_rating} (${RATING_LABELS[r.speed_rating] || ''})`,
      r.screen || '',
      problemLabel(r.problem_type),
      loadLabel(r.load_bucket),
      (r.description || '').replace(/\s+/g, ' '),
      `${r.browser || ''} ${r.browser_version || ''}`.trim(),
      r.os || '',
      r.device_type || '',
      r.screen_size || '',
      r.connection_type || '',
      r.downlink_mbps ?? '',
      r.cpu_cores ?? '',
      r.device_memory_gb ?? '',
      r.page_load_ms ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `staff-system-reports-${rangeId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const breakdownCard = (
    title: string,
    icon: React.ReactNode,
    rows: Array<{ label: string; count: number; avg: number }>,
  ) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No reports yet.</p>
        ) : (
          rows.slice(0, 8).map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{r.label}</span>
              <span className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={ratingTone(r.avg)}>
                  {r.avg.toFixed(1)}
                </Badge>
                <span className="text-xs text-muted-foreground">{r.count}</span>
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Staff System Reports
          </h2>
          <p className="text-sm text-muted-foreground">
            What sales staff tell us about how the dashboard performs on their own computer.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {RANGES.map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant={rangeId === r.id ? 'default' : 'outline'}
              onClick={() => setRangeId(r.id)}
            >
              {r.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={reports.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Reports received</p>
            <p className="text-2xl font-semibold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Average speed rating</p>
            <p className="text-2xl font-semibold">{summary.avg ? summary.avg.toFixed(1) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Freezes, crashes, blank screens</p>
            <p className="text-2xl font-semibold">{summary.problems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Staff who reported</p>
            <p className="text-2xl font-semibold">{summary.people}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Day by day</CardTitle>
          <CardDescription>Number of reports and problems, with the average speed rating.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {trend.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">No reports in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis yAxisId="left" fontSize={12} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 5]} fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="reports" name="Reports" fill="hsl(var(--primary))" />
                <Bar yAxisId="left" dataKey="problems" name="Problems" fill="hsl(var(--destructive))" />
                <Line yAxisId="right" type="monotone" dataKey="avgRating" name="Avg rating" stroke="#8b5cf6" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            By staff member
          </CardTitle>
          <CardDescription>Lowest rating first — that is who is struggling most.</CardDescription>
        </CardHeader>
        <CardContent>
          {byAgent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No reports in this period.</p>
          ) : (
            <div className="rounded-md border divide-y">
              {byAgent.map((a) => (
                <div key={a.name} className="px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <Badge variant="outline" className={ratingTone(a.avg)}>
                    {a.avg.toFixed(1)} · {RATING_LABELS[Math.round(a.avg)] || ''}
                  </Badge>
                  <span className="font-medium min-w-[10rem]">{a.name}</span>
                  <span className="text-xs text-muted-foreground">{a.role || ''}</span>
                  <span className="text-xs text-muted-foreground">{a.count} report{a.count === 1 ? '' : 's'}</span>
                  {a.problems > 0 && (
                    <span className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {a.problems} serious
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">Last: {fmtDateTime(a.last)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {breakdownCard('By screen', <Monitor className="h-4 w-4" />, byScreen)}
        {breakdownCard('By browser', <Monitor className="h-4 w-4" />, byBrowser)}
        {breakdownCard('By operating system', <Monitor className="h-4 w-4" />, byOs)}
        {breakdownCard('By device', <Monitor className="h-4 w-4" />, byDevice)}
        {breakdownCard('By connection', <Monitor className="h-4 w-4" />, byConnection)}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Every report</CardTitle>
          <CardDescription>Click a row to see the computer and connection it came from.</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No reports in this period.</p>
          ) : (
            <div className="rounded-md border divide-y">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge variant="outline" className={ratingTone(r.speed_rating)}>
                      {r.speed_rating} · {RATING_LABELS[r.speed_rating] || ''}
                    </Badge>
                    <span className="font-medium">{r.admin_name || r.admin_email || 'Unknown'}</span>
                    <span className="text-xs text-muted-foreground">{r.screen || 'Screen not stated'}</span>
                    <span className={`text-xs ${BAD_PROBLEMS.has(r.problem_type || '') ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {problemLabel(r.problem_type)}
                    </span>
                    <span className="text-xs text-muted-foreground">{loadLabel(r.load_bucket)}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{fmtDateTime(r.created_at)}</span>
                  </div>
                  {r.description && <p className="mt-1 text-sm">{r.description}</p>}
                  {expanded === r.id && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {describeEnvironment(r)}
                      {r.page_load_ms ? ` · page took ${(r.page_load_ms / 1000).toFixed(1)}s` : ''}
                      {r.route ? ` · ${r.route}` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffSystemReportsTab;
