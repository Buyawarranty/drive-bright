import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { History, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface AccessPeriod {
  id: string;
  admin_user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  start_date: string;
  end_date: string | null;
  reason: string | null;
}

const fmt = (d: string | null) => (d ? format(new Date(d), 'dd MMM yyyy HH:mm') : '—');

const durationDays = (start: string, end: string | null) => {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const days = Math.max(0, Math.floor((e - s) / 86_400_000));
  return `${days} day${days === 1 ? '' : 's'}`;
};

export const AdminAccessLogPanel: React.FC = () => {
  const [rows, setRows] = useState<AccessPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_user_access_periods')
        .select('id, admin_user_id, email, full_name, role, start_date, end_date, reason')
        .order('start_date', { ascending: false })
        .limit(500);
      if (!error && data) setRows(data as AccessPeriod[]);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      r.email.toLowerCase().includes(q) ||
      (r.full_name || '').toLowerCase().includes(q) ||
      r.role.toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Access log — start &amp; end dates
          </CardTitle>
          <Input
            className="max-w-xs"
            placeholder="Search by name, email or role"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Every time a user is created, deactivated, reactivated, or their role changes, a new
          period is opened or closed automatically.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No access history yet.</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Start date</TableHead>
                  <TableHead>End date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.full_name || r.email}</div>
                      {r.full_name && (
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.role}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmt(r.start_date)}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmt(r.end_date)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {durationDays(r.start_date, r.end_date)}
                    </TableCell>
                    <TableCell>
                      {r.end_date ? (
                        <Badge variant="secondary">Ended</Badge>
                      ) : (
                        <Badge className="bg-green-600 hover:bg-green-600">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs">
                      {r.reason || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminAccessLogPanel;
