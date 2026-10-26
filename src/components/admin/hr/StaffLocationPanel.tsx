import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, ShieldAlert, Laptop, Globe2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { formatCrmAuditTime, type CrmAuditZone } from '@/lib/crmAuditTime';
import { staffLocationReview } from '@/lib/staffLocationReview';

interface LocationRow {
  id: string;
  admin_user_id: string;
  email: string;
  session_date: string;
  ip_address: string;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  timezone: string | null;
  isp: string | null;
  is_vpn: boolean;
  device_type: string | null;
  ping_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

interface StaffName {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

const RANGES = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
];

export const StaffLocationPanel: React.FC<{ zone?: CrmAuditZone; from?: string; to?: string; staffIds?: string[] }> = ({ zone = 'UTC', from: selectedFrom, to: selectedTo, staffIds }) => {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [staff, setStaff] = useState<Record<string, StaffName>>({});
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(0);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const staffKey = staffIds?.join(',');

  const load = async () => {
    setLoading(true);
    const from = new Date();
    from.setDate(from.getDate() - rangeDays);
    const fromDate = selectedFrom || from.toISOString().slice(0, 10);
    const toDate = selectedTo || new Date().toISOString().slice(0, 10);
    try {
      const all: LocationRow[] = [];
      if (staffIds?.length === 0) { setRows([]); return; }
      for (let offset = 0; ; offset += 500) {
        let request = supabase.from('staff_work_locations').select('*').gte('session_date', fromDate).lte('session_date', toDate).order('last_seen_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 499);
        if (staffIds) request = request.in('admin_user_id', staffIds);
        const { data, error: requestError } = await request;
        if (requestError) throw requestError;
        all.push(...(data || []) as LocationRow[]);
        if ((data?.length || 0) < 500) break;
      }
      const { data: users, error: staffError } = await supabase.from('admin_users').select('id, first_name, last_name, role');
      if (staffError) throw staffError;
      setRows(all);
      const map: Record<string, StaffName> = {};
      (users || []).forEach(u => { map[u.id] = u; });
      setStaff(map); setError('');
    } catch { setError('Locations could not refresh. Previous records may be out of date.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    setRows([]); void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 30000);
    return () => clearInterval(timer);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [rangeDays, selectedFrom, selectedTo, staffKey]);

  const name = (row: LocationRow) => {
    const u = staff[row.admin_user_id];
    const full = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '';
    return full || row.email;
  };

  const reviews = useMemo(() => staffLocationReview(rows), [rows]);
  const filtered = useMemo(() => {
    const candidates = reviewOnly ? rows.filter(row => reviews.get(row.admin_user_id)?.review) : rows;
    if (!query.trim()) return candidates;
    const q = query.toLowerCase();
    return candidates.filter((r) =>
      name(r).toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.city || '').toLowerCase().includes(q) ||
      (r.country || '').toLowerCase().includes(q) ||
      (r.isp || '').toLowerCase().includes(q) ||
      r.ip_address.includes(q)
    );
  }, [rows, query, staff, reviewOnly, reviews]);

  const stats = useMemo(() => {
    const people = new Set(filtered.map((r) => r.admin_user_id));
    const places = new Set(filtered.filter(r => r.city || r.country).map((r) => `${r.city || ''}-${r.country || ''}`));
    const outsideUk = filtered.filter((r) => r.country_code && r.country_code !== 'GB').length;
    const flagged = filtered.filter((r) => r.is_vpn).length;
    return { people: people.size, places: places.size, outsideUk, flagged };
  }, [filtered]);

  const locationLabel = (r: LocationRow) => {
    const parts = [r.city, r.region, r.country].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Unknown location';
  };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 border-l-4 border-destructive pl-3"><span className="font-semibold">{[...reviews.values()].filter(value => value.review).length} accounts with multiple recorded networks, locations or device types</span><Button size="sm" variant={reviewOnly ? 'default' : 'outline'} onClick={() => setReviewOnly(value => !value)} aria-pressed={reviewOnly}>Review flagged accounts</Button></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Staff seen</p>
          <p className="text-2xl font-semibold">{stats.people}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Distinct locations</p>
          <p className="text-2xl font-semibold">{stats.places}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Sessions outside UK</p>
          <p className="text-2xl font-semibold">{stats.outsideUk}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">VPN / hosting flagged</p>
          <p className="text-2xl font-semibold">{stats.flagged}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" /> Where staff are working from
              </CardTitle>
              <CardDescription>
                Approximate location from the network each staff member signs in on. City-level only — no precise
                GPS tracking.
                {' '}Times: {zone === 'UTC' ? 'GMT / UTC' : 'UK local time (GMT / BST)'}. Locations are recorded on opening the CRM and every 30 minutes, not a live location tracker. VPN or outside-UK flags are review signals, not proof of hacking.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {!selectedFrom && RANGES.map((r) => (
                <Button
                  key={r.label}
                  size="sm"
                  variant={rangeDays === r.days ? 'default' : 'outline'}
                  onClick={() => setRangeDays(r.days)}
                >
                  {r.label}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={load}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Input
            className="max-w-sm mt-3"
            aria-label="Search staff locations"
            placeholder="Search staff, city, country, network or IP"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p className="text-sm text-muted-foreground mt-3">A changed IP, VPN or device type does not prove a different computer or person. These are recorded work-location observations, not exact locations for every sign-in. Blocking duplicate access is not active yet.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No sign-in locations recorded yet for this period. Locations are captured the next time each staff
              member opens the admin dashboard.
            </p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Network / ISP</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>First seen</TableHead>
                    <TableHead>Last seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{name(r)}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                        {reviews.get(r.admin_user_id)?.review && <Badge variant="destructive" className="mt-1">Multiple destinations · review</Badge>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(r.session_date), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Globe2 className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span>{locationLabel(r)}</span>
                          {r.country_code && r.country_code !== 'GB' && (
                            <Badge variant="destructive">Outside UK</Badge>
                          )}
                        </div>
                        {r.timezone && (
                          <div className="text-xs text-muted-foreground mt-0.5">{r.timezone}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]">{r.isp || '—'}</span>
                          {r.is_vpn && (
                            <Badge variant="outline" className="gap-1">
                              <ShieldAlert className="w-3 h-3" /> VPN?
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Laptop className="w-3.5 h-3.5 text-muted-foreground" />
                          {r.device_type || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.ip_address}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatCrmAuditTime(r.first_seen_at, zone)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatCrmAuditTime(r.last_seen_at, zone)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffLocationPanel;
