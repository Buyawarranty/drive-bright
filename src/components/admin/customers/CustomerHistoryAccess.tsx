import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { History } from 'lucide-react';

/** Sales/sales_lead: ask a manager for 24h access to an older customer. */
export const RequestOlderCustomerButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const { data, error } = await (supabase.rpc as any)('request_customer_history_access', { _search: search, _reason: reason });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error('No customer matched, or you already have a request waiting.');
    toast.success('Request sent to your manager. Access lasts 24 hours once approved.');
    setOpen(false); setSearch(''); setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5"><History className="h-3.5 w-3.5" />Request older customer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Request an older customer</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">You can see your own customers from the last two months. For anyone older, a manager must approve access, which then lasts 24 hours.</p>
        <Input placeholder="Full registration or email" value={search} onChange={e => setSearch(e.target.value)} />
        <Input placeholder="Reason (e.g. customer called about renewal)" value={reason} onChange={e => setReason(e.target.value)} />
        <Button onClick={submit} disabled={busy || search.trim().length < 4 || reason.trim().length < 5}>Send request</Button>
      </DialogContent>
    </Dialog>
  );
};

interface Req { id: string; customer_name: string | null; registration_plate: string | null; signup_date: string | null;
  requester_name: string; search_value: string; reason: string; status: string; created_at: string; expires_at: string | null; }

/** Management: approve or decline older-customer requests. */
export const CustomerHistoryRequestsPanel: React.FC = () => {
  const [rows, setRows] = useState<Req[]>([]);
  const load = useCallback(async () => {
    const { data, error } = await (supabase.rpc as any)('list_customer_history_requests');
    if (!error) setRows((data as Req[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, approve: boolean) => {
    const { error } = await (supabase.rpc as any)('decide_customer_history_access', { _request_id: id, _approve: approve });
    if (error) return toast.error(error.message);
    toast.success(approve ? 'Approved for 24 hours' : 'Declined');
    load();
  };

  const pending = rows.filter(r => r.status === 'pending');
  if (!rows.length) return null;
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="font-semibold text-sm">Older customer requests {pending.length > 0 && <Badge variant="destructive">{pending.length} waiting</Badge>}</div>
      {rows.slice(0, 20).map(r => {
        const live = r.status === 'approved' && r.expires_at && new Date(r.expires_at) > new Date();
        return (
          <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm border-t pt-2">
            <span className="font-medium">{r.requester_name}</span>
            <span>→ {r.customer_name ?? 'Customer'} {r.registration_plate ? `(${r.registration_plate})` : ''}</span>
            {r.signup_date && <span className="text-muted-foreground">sold {new Date(r.signup_date).toLocaleDateString('en-GB')}</span>}
            <span className="text-muted-foreground italic">“{r.reason}”</span>
            {r.status === 'pending' ? (
              <span className="ml-auto flex gap-2">
                <Button size="sm" onClick={() => decide(r.id, true)}>Approve 24h</Button>
                <Button size="sm" variant="outline" onClick={() => decide(r.id, false)}>Decline</Button>
              </span>
            ) : (
              <Badge className="ml-auto" variant="outline">{live ? `Approved until ${new Date(r.expires_at!).toLocaleString('en-GB')}` : r.status === 'approved' ? 'Expired' : 'Declined'}</Badge>
            )}
          </div>
        );
      })}
    </div>
  );
};
