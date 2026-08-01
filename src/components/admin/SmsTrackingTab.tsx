import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, RefreshCw, MessageSquare, CheckCircle2, XCircle, PoundSterling, AlertTriangle } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

type SmsRow = {
  id: string;
  phone: string;
  message: string | null;
  message_type: string | null;
  success: boolean | null;
  http_status: number | null;
  clicksend_status: string | null;
  clicksend_message_id: string | null;
  cost: number | null;
  error_message: string | null;
  triggered_by: string | null;
  created_at: string;
};

const PRESETS: { key: string; label: string; range: () => DateRange }[] = [
  { key: 'today', label: 'Today', range: () => ({ from: new Date(), to: new Date() }) },
  { key: 'yesterday', label: 'Yesterday', range: () => ({ from: subDays(new Date(), 1), to: subDays(new Date(), 1) }) },
  { key: '7days', label: 'Last 7 days', range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { key: '30days', label: 'Last 30 days', range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { key: 'month', label: 'This month', range: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
];

const money = (n: number) => `£${n.toFixed(2)}`;

export const SmsTrackingTab: React.FC = () => {
  const [preset, setPreset] = useState('7days');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({ from: subDays(new Date(), 6), to: new Date() }));
  const [rows, setRows] = useState<SmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchRows = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('sms_send_log')
      .select('id, phone, message, message_type, success, http_status, clicksend_status, clicksend_message_id, cost, error_message, triggered_by, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (dateRange?.from) q = q.gte('created_at', startOfDay(dateRange.from).toISOString());
    if (dateRange?.to) q = q.lte('created_at', endOfDay(dateRange.to).toISOString());

    const { data, error } = await q;
    if (error) {
      console.error('[SmsTrackingTab] fetch error', error);
      setRows([]);
    } else {
      setRows((data || []) as SmsRow[]);
    }
    setLastRefresh(new Date());
    setLoading(false);
  }, [dateRange]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Live updates
  useEffect(() => {
    const channel = supabase
      .channel('sms-send-log-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sms_send_log' }, () => {
        fetchRows();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRows]);

  // Fallback poll every 30s
  useEffect(() => {
    const t = setInterval(() => fetchRows(), 30000);
    return () => clearInterval(t);
  }, [fetchRows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const sent = rows.filter(r => r.success).length;
    const failed = total - sent;
    const cost = rows.reduce((s, r) => s + (Number(r.cost) || 0), 0);
    const byType = rows.reduce<Record<string, number>>((acc, r) => {
      const k = r.message_type || 'unknown';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const byDay = Object.entries(rows.reduce<Record<string, { ok: number; failed: number }>>((acc, r) => {
      const d = format(new Date(r.created_at), 'yyyy-MM-dd');
      acc[d] = acc[d] || { ok: 0, failed: 0 };
      if (r.success) acc[d].ok += 1; else acc[d].failed += 1;
      return acc;
    }, {})).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    const lastSuccess = rows.find(r => r.success)?.created_at || null;
    const lastFailure = rows.find(r => !r.success);
    return { total, sent, failed, cost, byType, byDay, lastSuccess, lastFailure };
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter === 'sent' && !r.success) return false;
      if (statusFilter === 'failed' && r.success) return false;
      if (!s) return true;
      return (
        (r.phone || '').toLowerCase().includes(s) ||
        (r.message_type || '').toLowerCase().includes(s) ||
        (r.triggered_by || '').toLowerCase().includes(s) ||
        (r.message || '').toLowerCase().includes(s)
      );
    });
  }, [rows, search, statusFilter]);

  // Health: are recent sends failing with auth errors?
  const authBroken = stats.failed > 0 && rows.slice(0, 10).every(r => !r.success) &&
    rows.slice(0, 10).some(r => r.http_status === 401 || (r.clicksend_status || '').toUpperCase().includes('UNAUTHORIZED'));

  const applyPreset = (key: string) => {
    setPreset(key);
    const p = PRESETS.find(x => x.key === key);
    if (p) setDateRange(p.range());
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" /> ClickSend SMS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live view of every SMS the system sends through ClickSend — volume, delivery status, failures and cost.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Updated {format(lastRefresh, 'HH:mm:ss')}</span>
          <Button variant="outline" size="sm" onClick={fetchRows} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      {/* Connection health */}
      <Card className={cn('border-2', authBroken ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50')}>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          {authBroken ? (
            <>
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div className="text-sm">
                <p className="font-semibold text-red-800">ClickSend is not sending — authentication rejected (HTTP 401)</p>
                <p className="text-red-700">
                  Every recent attempt was refused by ClickSend. The <code>CLICKSEND_USERNAME</code> / <code>CLICKSEND_API_KEY</code> credentials
                  need to be updated (or the ClickSend account topped up / re-enabled).
                </p>
              </div>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div className="text-sm">
                <p className="font-semibold text-green-800">ClickSend is sending normally</p>
                <p className="text-green-700">
                  Last successful send: {stats.lastSuccess ? format(new Date(stats.lastSuccess), 'dd MMM yyyy HH:mm') : '—'}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Date selectors */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(p => (
          <Button
            key={p.key}
            size="sm"
            variant={preset === p.key ? 'default' : 'outline'}
            onClick={() => applyPreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant={preset === 'custom' ? 'default' : 'outline'}>
              <CalendarIcon className="h-4 w-4 mr-1" />
              {dateRange?.from
                ? `${format(dateRange.from, 'dd MMM')} – ${dateRange.to ? format(dateRange.to, 'dd MMM yyyy') : '…'}`
                : 'Custom range'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(r) => { setPreset('custom'); setDateRange(r); }}
              numberOfMonths={2}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total SMS attempted</CardDescription></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-green-600" /> Sent successfully</CardDescription></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">{stats.sent}</div>
            <p className="text-xs text-muted-foreground">{stats.total ? Math.round((stats.sent / stats.total) * 100) : 0}% success rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><XCircle className="h-4 w-4 text-red-600" /> Failed</CardDescription></CardHeader>
          <CardContent><div className="text-3xl font-bold text-red-700">{stats.failed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><PoundSterling className="h-4 w-4" /> Spend</CardDescription></CardHeader>
          <CardContent><div className="text-3xl font-bold">{money(stats.cost)}</div></CardContent>
        </Card>
      </div>

      {/* Per day + per type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Sends per day</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.byDay.length === 0 && <p className="text-sm text-muted-foreground">No SMS in this period.</p>}
            {stats.byDay.map(([day, v]) => (
              <div key={day} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 font-medium">{format(new Date(day), 'dd MMM')}</span>
                <div className="flex-1 flex h-4 rounded overflow-hidden bg-muted">
                  <div className="bg-green-500" style={{ width: `${(v.ok / Math.max(1, v.ok + v.failed)) * 100}%` }} />
                  <div className="bg-red-500" style={{ width: `${(v.failed / Math.max(1, v.ok + v.failed)) * 100}%` }} />
                </div>
                <span className="w-28 shrink-0 text-right tabular-nums">
                  <span className="text-green-700 font-semibold">{v.ok}</span>
                  {' / '}
                  <span className="text-red-700 font-semibold">{v.failed}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">By message type</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(stats.byType).length === 0 && <p className="text-sm text-muted-foreground">No SMS in this period.</p>}
            {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-sm border-b last:border-0 py-1">
                <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Send log</CardTitle>
            <CardDescription>{filtered.length} of {rows.length} messages</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search phone, type, message…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            {(['all', 'sent', 'failed'] as const).map(s => (
              <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'} onClick={() => setStatusFilter(s)} className="capitalize">
                {s}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Triggered by</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 300).map(r => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">{format(new Date(r.created_at), 'dd MMM HH:mm')}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{r.phone}</TableCell>
                  <TableCell className="capitalize text-xs">{(r.message_type || 'unknown').replace(/_/g, ' ')}</TableCell>
                  <TableCell>
                    {r.success ? (
                      <Badge className="bg-green-600 hover:bg-green-600">Sent</Badge>
                    ) : (
                      <Badge variant="destructive">Failed{r.http_status ? ` (${r.http_status})` : ''}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-xs">{r.cost != null ? money(Number(r.cost)) : '—'}</TableCell>
                  <TableCell className="text-xs">{r.triggered_by || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[280px] truncate" title={r.error_message || r.clicksend_status || r.message || ''}>
                    {r.error_message || r.clicksend_status || r.message || '—'}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    {loading ? 'Loading…' : 'No SMS messages for this period.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SmsTrackingTab;
