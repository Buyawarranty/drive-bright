import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsManagement } from '@/hooks/useIsManagement';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

type ReviewRow = {
  id: string;
  policy_id: string;
  customer_id: string;
  renewal_year: number;
  reasons: string[];
  claim_count: number;
  status: 'pending' | 'approved' | 'do_not_renew';
  manager_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  customer_policies: {
    policy_number: string | null;
    warranty_number: string | null;
    policy_end_date: string | null;
    plan_type: string | null;
  } | null;
  customers: {
    first_name: string | null;
    last_name: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    registration_plate: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
  } | null;
};

const reasonLabels: Record<string, string> = {
  claim_made: 'Claim made',
  cancelled_or_refunded: 'Cancelled or refunded',
  misrepresented_claim: 'Misrepresentation',
  payment_disputed: 'Payment disputed',
  open_complaint: 'Open complaint',
  contact_restricted: 'Contact restricted',
  unsubscribed: 'Unsubscribed',
  no_customer: 'Customer record missing',
  no_contact_details: 'Contact details missing',
};

export const RenewalApprovalTab: React.FC = () => {
  const { isManagement, loading: checkingAccess } = useIsManagement();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ row: ReviewRow; decision: 'approve' | 'do_not_renew' } | null>(null);

  const fetchRows = useCallback(async () => {
    if (!isManagement) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase.from('renewal_reviews') as any)
      .select('id, policy_id, customer_id, renewal_year, reasons, claim_count, status, manager_note, reviewed_at, created_at, customer_policies(policy_number, warranty_number, policy_end_date, plan_type), customers(first_name, last_name, name, email, phone, registration_plate, vehicle_make, vehicle_model)')
      .in('status', ['pending', 'do_not_renew'])
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) toast.error('Could not load renewal approvals', { description: error.message });
    setRows((data as ReviewRow[]) || []);
    setLoading(false);
  }, [isManagement]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const customer = row.customers;
      return [customer?.first_name, customer?.last_name, customer?.name, customer?.email,
        customer?.phone, customer?.registration_plate, row.customer_policies?.policy_number,
        row.customer_policies?.warranty_number]
        .some((value) => (value || '').toLowerCase().includes(needle));
    });
  }, [rows, search]);

  const decide = async () => {
    if (!confirm) return;
    setSavingId(confirm.row.id);
    const { error } = await (supabase as any).rpc('review_renewal', {
      p_review_id: confirm.row.id,
      p_decision: confirm.decision,
      p_note: notes[confirm.row.id]?.trim() || null,
    });
    if (error) {
      toast.error('Could not save the renewal decision', { description: error.message });
    } else {
      toast.success(confirm.decision === 'approve' ? 'Renewal approved and sent to New Leads' : 'Customer marked do not renew');
      setConfirm(null);
      await fetchRows();
    }
    setSavingId(null);
  };

  if (checkingAccess || loading) {
    return <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading renewal approvals…</div>;
  }
  if (!isManagement) return null;

  const pendingCount = rows.filter((row) => row.status === 'pending').length;
  const blockedCount = rows.filter((row) => row.status === 'do_not_renew').length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /> Renewal approval</h2>
          <p className="text-sm text-muted-foreground mt-1">Claim-history customers wait here for a manager. Cancelled or refunded customers remain excluded.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, reg or policy…" className="w-[260px]" />
          <Button variant="outline" size="icon" onClick={() => void fetchRows()} title="Refresh"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-xl">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Awaiting decision</div><div className="text-2xl font-semibold">{pendingCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Do not renew</div><div className="text-2xl font-semibold">{blockedCount}</div></CardContent></Card>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><CheckCircle2 className="h-8 w-8 mx-auto mb-2" />No held renewals match this view.</CardContent></Card>
      ) : (
        <div className="border rounded-md overflow-x-auto bg-card">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr><th className="p-3 text-left">Customer</th><th className="p-3 text-left">Vehicle</th><th className="p-3 text-left">Policy</th><th className="p-3 text-left">Expiry</th><th className="p-3 text-left">Reason</th><th className="p-3 text-left">Manager note</th><th className="p-3 text-left">Decision</th></tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const customer = row.customers;
                const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') || customer?.name || 'Customer';
                const hardBlocked = row.reasons.some((reason) => reason !== 'claim_made' && reason !== 'cancelled_or_refunded');
                return (
                  <tr key={row.id} className="border-t align-top">
                    <td className="p-3"><div className="font-medium">{name}</div><div className="text-xs text-muted-foreground">{customer?.email || '—'}</div><div className="text-xs text-muted-foreground">{customer?.phone || ''}</div></td>
                    <td className="p-3"><div className="font-medium">{customer?.registration_plate || '—'}</div><div className="text-xs text-muted-foreground">{[customer?.vehicle_make, customer?.vehicle_model].filter(Boolean).join(' ')}</div></td>
                    <td className="p-3"><div>{row.customer_policies?.policy_number || row.customer_policies?.warranty_number || '—'}</div><div className="text-xs text-muted-foreground">{row.customer_policies?.plan_type || ''}</div></td>
                    <td className="p-3">{row.customer_policies?.policy_end_date ? format(new Date(row.customer_policies.policy_end_date), 'd MMM yyyy') : '—'}</td>
                    <td className="p-3"><div className="flex flex-wrap gap-1">{row.reasons.map((reason) => <Badge key={reason} variant={reason === 'claim_made' ? 'secondary' : 'destructive'}>{reasonLabels[reason] || reason.replace(/_/g, ' ')}</Badge>)}</div>{row.claim_count > 0 && <div className="text-xs text-muted-foreground mt-1">{row.claim_count} claim{row.claim_count === 1 ? '' : 's'} found</div>}</td>
                    <td className="p-3"><Textarea rows={2} value={notes[row.id] ?? row.manager_note ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Optional reason or evidence" /></td>
                    <td className="p-3"><div className="flex flex-col gap-2 min-w-[150px]">{!hardBlocked && row.status === 'pending' && <Button size="sm" onClick={() => setConfirm({ row, decision: 'approve' })}>Approve renewal</Button>}<Button size="sm" variant="outline" onClick={() => setConfirm({ row, decision: 'do_not_renew' })}><ShieldX className="h-4 w-4 mr-1" />Do not renew</Button>{hardBlocked && <span className="text-xs text-muted-foreground">Automatic renewal blocked</span>}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => { if (!open && !savingId) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.decision === 'approve' ? 'Approve this claim-history renewal?' : 'Mark this customer as do not renew?'}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.decision === 'approve' ? 'This creates or attaches a renewal lead and sends it into New Leads. The manager decision is recorded.' : 'This customer will remain outside the automatic renewal flow. The manager decision is recorded.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={Boolean(savingId)}>Cancel</AlertDialogCancel><AlertDialogAction disabled={Boolean(savingId)} onClick={(event) => { event.preventDefault(); void decide(); }}>{savingId ? 'Saving…' : 'Yes, confirm'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};