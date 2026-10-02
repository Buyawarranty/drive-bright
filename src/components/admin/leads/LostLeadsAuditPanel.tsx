import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, RefreshCw, RotateCcw, Archive } from 'lucide-react';
import { toast } from 'sonner';

type ClosedStatus = 'lost' | 'archived' | 'not_interested';

interface LostLeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  vehicle_reg: string | null;
  lead_source: string | null;
  status: string;
  lost_at: string | null;
  lost_reason: string | null;
  updated_at: string | null;
}

const STATUS_LABELS: Record<ClosedStatus, string> = {
  lost: 'Lost',
  archived: 'Archived',
  not_interested: 'Not interested',
};

const SOURCE_LABELS: Record<string, string> = {
  website: 'Direct / organic', google_ad: 'Google Ads', bing_ad: 'Bing Ads',
  social_ad: 'Facebook / Meta', tiktok_ad: 'TikTok', referral: 'Referral',
  phone: 'Phone', email: 'Email', partner: 'Partner', other: 'Other',
};

interface Props {
  currentAdminId: string | null;
}

export const LostLeadsAuditPanel: React.FC<Props> = ({ currentAdminId }) => {
  const [rows, setRows] = useState<LostLeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | ClosedStatus>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [restoring, setRestoring] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales_leads')
      .select('id, first_name, last_name, email, phone, vehicle_reg, lead_source, status, lost_at, lost_reason, updated_at')
      .in('status', ['lost', 'archived', 'not_interested'] as any)
      .order('updated_at', { ascending: false })
      .limit(2000);
    if (error) toast.error('Could not load closed leads');
    setRows((data || []) as LostLeadRow[]);
    setSelected(new Set());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.first_name, r.last_name, r.email, r.phone, r.vehicle_reg]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }, [rows, statusFilter, search]);

  const counts = useMemo(() => ({
    all: rows.length,
    lost: rows.filter(r => r.status === 'lost').length,
    archived: rows.filter(r => r.status === 'archived').length,
    not_interested: rows.filter(r => r.status === 'not_interested').length,
  }), [rows]);

  const allChecked = filtered.length > 0 && filtered.every(r => selected.has(r.id));
  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allChecked) filtered.forEach(r => next.delete(r.id));
      else filtered.forEach(r => next.add(r.id));
      return next;
    });
  };
  const toggleOne = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const restore = async (ids: string[]) => {
    if (ids.length === 0) return;
    setRestoring(true);
    try {
      const byId = new Map(rows.map(r => [r.id, r]));
      const { error } = await supabase
        .from('sales_leads')
        .update({
          status: 'new',
          lost_at: null,
          lost_reason: null,
          fake_marked_by: null,
          fake_marked_at: null,
          fake_reason: null,
          fake_reason_note: null,
          pool_status: 'new',
        } as any)
        .in('id', ids);
      if (error) throw error;

      const activities = ids.map(id => ({
        lead_id: id,
        activity_type: 'system',
        description: `Restored to New via Lost Leads panel (was ${STATUS_LABELS[(byId.get(id)?.status as ClosedStatus)] || byId.get(id)?.status || 'closed'})`,
        performed_by: currentAdminId,
      }));
      const { error: actErr } = await supabase.from('lead_activities').insert(activities);
      if (actErr) console.error('Restore audit log failed', actErr);

      toast.success(`${ids.length} lead${ids.length === 1 ? '' : 's'} restored to New`);
      await fetchData();
    } catch (e: any) {
      toast.error(`Restore failed: ${e?.message || 'unknown error'}`);
    } finally {
      setRestoring(false);
      setConfirmIds(null);
    }
  };

  const name = (r: LostLeadRow) => [r.first_name, r.last_name].filter(Boolean).join(' ') || '—';
  const when = (r: LostLeadRow) => r.lost_at || r.updated_at;

  return (
    <Card className="border-2 border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Restore lost, archived and not interested leads</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button size="sm" disabled={selected.size === 0 || restoring} onClick={() => setConfirmIds(Array.from(selected))}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore selected ({selected.size})
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'lost', 'archived', 'not_interested'] as const).map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : STATUS_LABELS[s]} ({counts[s]})
            </Button>
          ))}
          <Input className="h-8 max-w-xs ml-auto" placeholder="Search name, phone, email, reg" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No closed leads found.</p>
        ) : (
          <div className="max-h-[520px] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" /></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Reg</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={`Select ${name(r)}`} /></TableCell>
                    <TableCell className="font-medium">{name(r)}</TableCell>
                    <TableCell className="text-xs">{r.phone || '—'}</TableCell>
                    <TableCell className="text-xs">{r.email || '—'}</TableCell>
                    <TableCell className="text-xs font-mono">{r.vehicle_reg || '—'}</TableCell>
                    <TableCell className="text-xs">{SOURCE_LABELS[r.lead_source || ''] || r.lead_source || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{STATUS_LABELS[r.status as ClosedStatus] || r.status}</Badge></TableCell>
                    <TableCell className="text-xs whitespace-nowrap" title={when(r) ? format(parseISO(when(r)!), 'dd MMM yyyy HH:mm') : ''}>
                      {when(r) ? formatDistanceToNow(parseISO(when(r)!), { addSuffix: true }) : '—'}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={r.lost_reason || ''}>{r.lost_reason || '—'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={restoring} onClick={() => setConfirmIds([r.id])}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirmIds} onOpenChange={o => !o && setConfirmIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore {confirmIds?.length} lead{confirmIds?.length === 1 ? '' : 's'} to New?</AlertDialogTitle>
            <AlertDialogDescription>
              They go back into New Leads with their lost and fake markings cleared. Each restore is recorded in the lead's history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={restoring} onClick={(e) => { e.preventDefault(); confirmIds && restore(confirmIds); }}>
              {restoring && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default LostLeadsAuditPanel;
