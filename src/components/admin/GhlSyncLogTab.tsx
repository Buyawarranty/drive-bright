import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Search, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface SyncLogRow {
  id: string;
  email: string | null;
  contact_id: string | null;
  sync_type: string;
  status: string;
  http_status: number | null;
  payload: any;
  response: string | null;
  error: string | null;
  created_at: string;
}

const statusBadge = (status: string) => {
  if (status === 'success') return <Badge className="bg-green-600 hover:bg-green-700">Success</Badge>;
  if (status === 'queued') return <Badge className="bg-amber-500 hover:bg-amber-600">Queued</Badge>;
  return <Badge variant="destructive">Error</Badge>;
};

export const GhlSyncLogTab: React.FC = () => {
  const [rows, setRows] = useState<SyncLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selected, setSelected] = useState<SyncLogRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('ghl_sync_log' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (typeFilter !== 'all') q = q.eq('sync_type', typeFilter);
    if (search.trim()) q = q.ilike('email', `%${search.trim()}%`);

    const { data, error } = await q;
    if (error) console.error('Failed to load GHL sync log:', error);
    setRows((data as any) || []);
    setLoading(false);
  }, [search, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const counts = rows.reduce(
    (acc, r) => {
      acc.total++;
      if (r.status === 'success') acc.success++;
      else if (r.status === 'queued') acc.queued++;
      else acc.failed++;
      return acc;
    },
    { total: 0, success: 0, queued: 0, failed: 0 }
  );

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>GoHighLevel sync log</CardTitle>
          <CardDescription>
            Every push to GHL (contacts and pipeline opportunities) with the payload sent and any error returned. Showing the latest 500 entries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-semibold">{counts.total}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Success</div><div className="text-2xl font-semibold text-green-600">{counts.success}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Queued</div><div className="text-2xl font-semibold text-amber-600">{counts.queued}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Errors</div><div className="text-2xl font-semibold text-destructive">{counts.failed}</div></CardContent></Card>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email…"
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="failed">Error</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sync types</SelectItem>
                <SelectItem value="contact">Contact</SelectItem>
                <SelectItem value="opportunity">Opportunity</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2 font-medium">When</th>
                  <th className="text-left p-2 font-medium">Type</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="text-left p-2 font-medium">HTTP</th>
                  <th className="text-left p-2 font-medium">Email</th>
                  <th className="text-left p-2 font-medium">Contact ID</th>
                  <th className="text-left p-2 font-medium">Error</th>
                  <th className="text-right p-2 font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading && (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No sync log entries yet.</td></tr>
                )}
                {rows.map(r => (
                  <tr key={r.id} className="border-t hover:bg-muted/40">
                    <td className="p-2 whitespace-nowrap">{format(new Date(r.created_at), 'd MMM yyyy HH:mm:ss')}</td>
                    <td className="p-2 capitalize">{r.sync_type}</td>
                    <td className="p-2">{statusBadge(r.status)}</td>
                    <td className="p-2 font-mono text-xs">{r.http_status ?? '—'}</td>
                    <td className="p-2">{r.email ?? '—'}</td>
                    <td className="p-2 font-mono text-xs">{r.contact_id ?? '—'}</td>
                    <td className="p-2 max-w-[300px] truncate text-destructive" title={r.error ?? ''}>{r.error ?? ''}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                        Details <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sync attempt details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">When</div><div>{format(new Date(selected.created_at), 'd MMM yyyy HH:mm:ss')}</div></div>
                <div><div className="text-xs text-muted-foreground">Status</div><div>{statusBadge(selected.status)}</div></div>
                <div><div className="text-xs text-muted-foreground">Type</div><div className="capitalize">{selected.sync_type}</div></div>
                <div><div className="text-xs text-muted-foreground">HTTP status</div><div className="font-mono">{selected.http_status ?? '—'}</div></div>
                <div><div className="text-xs text-muted-foreground">Email</div><div>{selected.email ?? '—'}</div></div>
                <div><div className="text-xs text-muted-foreground">Contact ID</div><div className="font-mono break-all">{selected.contact_id ?? '—'}</div></div>
              </div>
              {selected.error && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Error</div>
                  <pre className="bg-destructive/10 text-destructive p-3 rounded text-xs whitespace-pre-wrap break-words">{selected.error}</pre>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Payload sent</div>
                <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap break-words max-h-72 overflow-auto">{JSON.stringify(selected.payload, null, 2)}</pre>
              </div>
              {selected.response && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Response</div>
                  <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap break-words max-h-72 overflow-auto">{selected.response}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GhlSyncLogTab;
