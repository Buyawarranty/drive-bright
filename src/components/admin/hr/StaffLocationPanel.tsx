import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, ShieldAlert, Laptop, Globe2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

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

export const StaffLocationPanel: React.FC = () => {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [staff, setStaff] = useState<Record<string, StaffName>>({});
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(0);
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    const from = new Date();
    from.setDate(from.getDate() - rangeDays);
    const fromDate = from.toISOString().slice(0, 10);

    const [{ data: locs }, { data: users }] = await Promise.all([
      supabase
        .from('staff_work_locations')
        .select('*')
        .gte('session_date', fromDate)
        .order('last_seen_at', { ascending: false })
        .limit(1000),
      supabase.from('admin_users').select('id, first_name, last_name, role'),
    ]);

    setRows((locs || []) as LocationRow[]);
    const map: Record<string, StaffName> = {};
    (users || []).forEach((u: any) => { map[u.id] = u; });
    setStaff(map);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rangeDays]);

  const name = (row: LocationRow) => {
    const u = staff[row.admin_user_id];
    const full = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '';
    return full || row.email;
  };

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      name(r).toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.city || '').toLowerCase().includes(q) ||
      (r.country || '').toLowerCase().includes(q) ||
      (r.isp || '').toLowerCase().includes(q) ||
      r.ip_address.includes(q)
    );
  }, [rows, query, staff]);

  const stats = useMemo(() => {
    const people = new Set(filtered.map((r) => r.admin_user_id));
    const places = new Set(filtered.map((r) => `${r.city || '?'}-${r.country || '?'}`));
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
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {RANGES.map((r) => (
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
            placeholder="Search staff, city, country, network or IP"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
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
                        {format(new Date(r.first_seen_at), 'HH:mm')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(r.last_seen_at), 'dd MMM HH:mm')}
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
