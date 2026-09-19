import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import {
  AlertTriangle, CalendarClock, CheckCircle2, Clock, Link2, Loader2, Mail,
  MessageSquare, RefreshCw, Search, XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useIsManagement } from '@/hooks/useIsManagement';
import { invokeWithFreshSession } from '@/lib/invokeWithFreshSession';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Pending payment — orders taken with "Start warranty and payment later".
 *
 * The customer has completed the whole order and agreed two dates: when cover
 * starts and when they pay. Nothing is activated until the money lands, so the
 * agent who took the deal must chase it. Managers see every order; a sales agent
 * only sees their own.
 */

type DStatus = 'pending_payment' | 'paid' | 'cancelled';

const gbp = (n: number | null | undefined) => `£${Math.round(Number(n) || 0).toLocaleString('en-GB')}`;

interface Row {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  registration_plate: string | null;
  warranty_reference_number: string | null;
  plan_type: string | null;
  payment_type: string | null;
  final_amount: number | null;
  status: string | null;
  deferred_status: DStatus | null;
  deferred_start_date: string | null;
  deferred_payment_due_date: string | null;
  deferred_created_by: string | null;
  deferred_created_at: string | null;
  deferred_last_chased_at: string | null;
  deferred_chase_count: number | null;
  deferred_payment_link: string | null;
  deferred_paid_at: string | null;
  assigned_to: string | null;
  sale_credit_admin_user_id: string | null;
}

const TERM_LABEL: Record<string, string> = {
  yearly: '1 year',
  '2-Year': '2 years',
  '3-Year': '3 years',
};

type ActionKind = 'chase' | 'dates' | 'paid' | 'cancel' | null;

export const PendingPaymentTab: React.FC = () => {
  const currentAdminId = useCurrentAdminId();
  const { isManagement } = useIsManagement();

  const [rows, setRows] = useState<Row[]>([]);
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DStatus | 'all'>('pending_payment');
  const [search, setSearch] = useState('');

  const [dialogRow, setDialogRow] = useState<Row | null>(null);
  const [action, setAction] = useState<ActionKind>(null);
  const [note, setNote] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newDue, setNewDue] = useState('');
  const [saving, setSaving] = useState(false);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('customers')
        .select(
          'id, name, email, phone, registration_plate, warranty_reference_number, plan_type, payment_type, final_amount, status, deferred_status, deferred_start_date, deferred_payment_due_date, deferred_created_by, deferred_created_at, deferred_last_chased_at, deferred_chase_count, deferred_payment_link, deferred_paid_at, assigned_to, sale_credit_admin_user_id',
        )
        .not('deferred_status', 'is', null)
        .order('deferred_payment_due_date', { ascending: true })
        .limit(500);

      if (statusFilter !== 'all') q = q.eq('deferred_status', statusFilter);

      const { data, error } = await q;
      if (error) throw error;

      let list = (data || []) as unknown as Row[];

      // A sales agent only ever sees the orders they took.
      if (!isManagement && currentAdminId) {
        list = list.filter(
          (r) =>
            r.deferred_created_by === currentAdminId ||
            r.sale_credit_admin_user_id === currentAdminId ||
            r.assigned_to === currentAdminId,
        );
      }
      setRows(list);

      const ids = Array.from(
        new Set(list.map((r) => r.deferred_created_by || r.sale_credit_admin_user_id).filter(Boolean) as string[]),
      );
      if (ids.length) {
        const { data: s } = await supabase.from('admin_users').select('id, name, email').in('id', ids);
        const map: Record<string, string> = {};
        (s || []).forEach((u: any) => { map[u.id] = u.name || u.email; });
        setStaff(map);
      }
    } catch (e: any) {
      console.error('Pending payment load error', e);
      toast.error('Could not load pending payment orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, isManagement, currentAdminId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return rows;
    const plain = t.replace(/\s+/g, '');
    return rows.filter((r) =>
      [r.name, r.email, r.phone, r.warranty_reference_number].some((v) => (v || '').toLowerCase().includes(t)) ||
      (r.registration_plate || '').toLowerCase().replace(/\s+/g, '').includes(plain),
    );
  }, [rows, search]);

  const dueState = (r: Row) => {
    if (!r.deferred_payment_due_date) return { tone: 'grey', label: 'No date' };
    const days = differenceInCalendarDays(startOfDay(new Date(r.deferred_payment_due_date)), startOfDay(new Date()));
    if (days < 0) return { tone: 'red', label: `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue` };
    if (days === 0) return { tone: 'amber', label: 'Due today' };
    if (days <= 2) return { tone: 'amber', label: `Due in ${days} day${days === 1 ? '' : 's'}` };
    return { tone: 'green', label: `Due in ${days} days` };
  };

  const toneClasses: Record<string, string> = {
    red: 'bg-red-100 text-red-800 border-red-300',
    amber: 'bg-amber-100 text-amber-900 border-amber-300',
    green: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    grey: 'bg-gray-100 text-gray-700 border-gray-300',
  };

  const openDialog = (row: Row, kind: ActionKind) => {
    setDialogRow(row);
    setAction(kind);
    setNote('');
    setNewStart(row.deferred_start_date || '');
    setNewDue(row.deferred_payment_due_date || '');
  };

  const closeDialog = () => { setDialogRow(null); setAction(null); setNote(''); };

  const addNote = async (customerId: string, text: string) => {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from('admin_notes').insert({
      customer_id: customerId,
      note: text,
      created_by: auth?.user?.id || null,
    });
  };

  /** Create a payment link and email it to the customer, logging the chase. */
  const sendPaymentLink = async (row: Row) => {
    if (!row.email) { toast.error('This order has no email address'); return; }
    setLinkBusyId(row.id);
    try {
      const amount = Math.round(Number(row.final_amount) || 0);
      const { data, error } = await invokeWithFreshSession('worldpay-create-payment-page', {
        flow: 'link',
        amount_pence: amount * 100,
        description: `Warranty payment — ${row.registration_plate || row.warranty_reference_number || 'order'}`.slice(0, 200),
        customer_id: row.id,
        customer_email: row.email,
        customer_phone: row.phone || null,
      });
      if (error) throw error;
      const url = (data as any)?.payment_url;
      if (!url) throw new Error('No payment link returned');

      const { error: emailError } = await supabase.functions.invoke('send-deferred-order-email', {
        body: { customerId: row.id, kind: 'payment_link', paymentUrl: url },
      });
      if (emailError) throw emailError;

      await supabase
        .from('customers')
        .update({
          deferred_payment_link: url,
          deferred_last_chased_at: new Date().toISOString(),
          deferred_chase_count: (row.deferred_chase_count || 0) + 1,
        })
        .eq('id', row.id);
      await addNote(row.id, `💳 Payment link sent to ${row.email} for ${gbp(amount)}.`);

      toast.success('Payment link emailed to the customer');
      load();
    } catch (e: any) {
      console.error('Send payment link error', e);
      toast.error(e?.message || 'Could not send the payment link');
    } finally {
      setLinkBusyId(null);
    }
  };

  const submit = async () => {
    if (!dialogRow || !action) return;
    setSaving(true);
    try {
      if (action === 'chase') {
        if (!note.trim()) { toast.error('Add a short note about the chase'); setSaving(false); return; }
        await supabase
          .from('customers')
          .update({
            deferred_last_chased_at: new Date().toISOString(),
            deferred_chase_count: (dialogRow.deferred_chase_count || 0) + 1,
          })
          .eq('id', dialogRow.id);
        await addNote(dialogRow.id, `📞 Payment chase: ${note.trim()}`);
        toast.success('Chase logged');
      }

      if (action === 'dates') {
        if (!newStart || !newDue) { toast.error('Both dates are needed'); setSaving(false); return; }
        if (startOfDay(new Date(newDue)) > startOfDay(new Date(newStart))) {
          toast.error('Payment must be due on or before the warranty start date');
          setSaving(false);
          return;
        }
        const { error } = await supabase
          .from('customers')
          .update({ deferred_start_date: newStart, deferred_payment_due_date: newDue })
          .eq('id', dialogRow.id);
        if (error) throw error;
        await addNote(
          dialogRow.id,
          `📅 Pay later dates changed — cover starts ${format(new Date(newStart), 'd MMM yyyy')}, payment due ${format(new Date(newDue), 'd MMM yyyy')}${note.trim() ? `\n${note.trim()}` : ''}`,
        );
        toast.success('Dates updated');
      }

      if (action === 'paid') {
        const startDate = dialogRow.deferred_start_date ? new Date(dialogRow.deferred_start_date) : new Date();
        const startsInFuture = startOfDay(startDate) > startOfDay(new Date());
        const { data: auth } = await supabase.auth.getUser();

        const { error } = await supabase
          .from('customers')
          .update({
            deferred_status: 'paid',
            deferred_paid_at: new Date().toISOString(),
            status: 'Active',
            payment_verified: true,
            payment_verification_status: 'verified',
            payment_verified_at: new Date().toISOString(),
            signup_date: new Date().toISOString(),
          })
          .eq('id', dialogRow.id);
        if (error) throw error;

        const { data: policy } = await supabase
          .from('customer_policies')
          .select('id')
          .eq('customer_id', dialogRow.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (policy?.id) {
          await supabase
            .from('customer_policies')
            .update({
              status: startsInFuture ? 'scheduled' : 'active',
              payment_verified: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', policy.id);

          // Now the money is in, the customer gets their documents and login.
          supabase.functions
            .invoke('send-welcome-email-manual', { body: { policyId: policy.id, customerId: dialogRow.id } })
            .catch((e) => console.warn('Welcome email invoke error (server may still succeed):', e));
        }

        await addNote(
          dialogRow.id,
          `✅ Pay later payment received — warranty ${startsInFuture ? `scheduled to start ${format(startDate, 'd MMM yyyy')}` : 'activated'}.${note.trim() ? `\n${note.trim()}` : ''}`,
        );
        void auth;
        toast.success(startsInFuture ? 'Payment recorded — cover scheduled' : 'Payment recorded — warranty activated');
      }

      if (action === 'cancel') {
        if (!note.trim()) { toast.error('Add the reason for cancelling'); setSaving(false); return; }
        const { error } = await supabase
          .from('customers')
          .update({ deferred_status: 'cancelled', status: 'Cancelled' })
          .eq('id', dialogRow.id);
        if (error) throw error;
        const { data: policy } = await supabase
          .from('customer_policies')
          .select('id')
          .eq('customer_id', dialogRow.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (policy?.id) {
          await supabase.from('customer_policies').update({ status: 'cancelled' }).eq('id', policy.id);
        }
        await addNote(dialogRow.id, `🚫 Pay later order cancelled — payment never received.\nReason: ${note.trim()}`);
        toast.success('Order cancelled');
      }

      closeDialog();
      load();
    } catch (e: any) {
      console.error('Pending payment action error', e);
      toast.error(e?.message || 'Could not save that');
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(() => {
    const open = filtered.filter((r) => r.deferred_status === 'pending_payment');
    const overdue = open.filter(
      (r) => r.deferred_payment_due_date && startOfDay(new Date(r.deferred_payment_due_date)) < startOfDay(new Date()),
    );
    return {
      count: open.length,
      value: open.reduce((s, r) => s + (Number(r.final_amount) || 0), 0),
      overdue: overdue.length,
      overdueValue: overdue.reduce((s, r) => s + (Number(r.final_amount) || 0), 0),
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-6 h-6 text-amber-600" />
          Pending payment
        </h1>
        <p className="text-gray-600 mt-1 text-sm">
          Orders where the customer agreed to pay later. The warranty is not active until the payment is received —
          chase it, send a payment link, then record the payment to switch cover on.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-700">Awaiting payment</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{totals.count}</p>
          <p className="text-xs text-amber-700">{gbp(totals.value)} outstanding</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium text-red-700">Overdue</p>
          <p className="mt-1 text-2xl font-bold text-red-900">{totals.overdue}</p>
          <p className="text-xs text-red-700">{gbp(totals.overdueValue)} past the agreed date</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500">Showing</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">
              {isManagement ? 'All agents' : 'Your orders only'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, registration or warranty number"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending_payment">Awaiting payment</SelectItem>
            <SelectItem value="paid">Paid &amp; activated</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Customer</th>
              <th className="text-left px-3 py-2 font-medium">Vehicle</th>
              <th className="text-left px-3 py-2 font-medium">Cover</th>
              <th className="text-right px-3 py-2 font-medium">Amount</th>
              <th className="text-left px-3 py-2 font-medium">Warranty starts</th>
              <th className="text-left px-3 py-2 font-medium">Payment due</th>
              <th className="text-left px-3 py-2 font-medium">Chases</th>
              <th className="text-left px-3 py-2 font-medium">Agent</th>
              <th className="text-right px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-500">
                Nothing here — no orders are waiting on payment.
              </td></tr>
            ) : filtered.map((r) => {
              const st = dueState(r);
              const isOpen = r.deferred_status === 'pending_payment';
              return (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/70">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-gray-900">{r.name || '—'}</div>
                    <div className="text-xs text-gray-500">{r.email}</div>
                    <div className="text-xs text-gray-500">{r.phone}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-mono font-semibold">{r.registration_plate || '—'}</div>
                    <div className="text-xs text-gray-500">{r.warranty_reference_number}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{r.plan_type || 'Platinum'}</div>
                    <div className="text-xs text-gray-500">{TERM_LABEL[r.payment_type || ''] || r.payment_type}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{gbp(r.final_amount)}</td>
                  <td className="px-3 py-2">
                    {r.deferred_start_date ? format(new Date(r.deferred_start_date), 'd MMM yyyy') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div>{r.deferred_payment_due_date ? format(new Date(r.deferred_payment_due_date), 'd MMM yyyy') : '—'}</div>
                    {isOpen && (
                      <Badge variant="outline" className={cn('mt-1 text-[11px]', toneClasses[st.tone])}>{st.label}</Badge>
                    )}
                    {r.deferred_status === 'paid' && (
                      <Badge variant="outline" className="mt-1 text-[11px] bg-emerald-100 text-emerald-800 border-emerald-300">
                        Paid{r.deferred_paid_at ? ` ${format(new Date(r.deferred_paid_at), 'd MMM')}` : ''}
                      </Badge>
                    )}
                    {r.deferred_status === 'cancelled' && (
                      <Badge variant="outline" className="mt-1 text-[11px] bg-gray-100 text-gray-700 border-gray-300">Cancelled</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div>{r.deferred_chase_count || 0}</div>
                    {r.deferred_last_chased_at && (
                      <div className="text-xs text-gray-500">{format(new Date(r.deferred_last_chased_at), 'd MMM HH:mm')}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {staff[r.deferred_created_by || ''] || staff[r.sale_credit_admin_user_id || ''] || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1 justify-end">
                      {isOpen && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => sendPaymentLink(r)} disabled={linkBusyId === r.id}>
                            {linkBusyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                            <span className="ml-1">Payment link</span>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openDialog(r, 'chase')}>
                            <MessageSquare className="w-3.5 h-3.5 mr-1" />Log chase
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openDialog(r, 'dates')}>
                            <CalendarClock className="w-3.5 h-3.5 mr-1" />Dates
                          </Button>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openDialog(r, 'paid')}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Payment received
                          </Button>
                          {isManagement && (
                            <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => openDialog(r, 'cancel')}>
                              <XCircle className="w-3.5 h-3.5 mr-1" />Cancel
                            </Button>
                          )}
                        </>
                      )}
                      {r.deferred_payment_link && (
                        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(r.deferred_payment_link!); toast.success('Payment link copied'); }}>
                          <Mail className="w-3.5 h-3.5 mr-1" />Copy link
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!dialogRow} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {action === 'chase' && 'Log a payment chase'}
              {action === 'dates' && 'Change the agreed dates'}
              {action === 'paid' && 'Record the payment'}
              {action === 'cancel' && 'Cancel this order'}
            </DialogTitle>
            <DialogDescription>
              {dialogRow?.name} · {dialogRow?.registration_plate} · {gbp(dialogRow?.final_amount)}
            </DialogDescription>
          </DialogHeader>

          {action === 'dates' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Warranty starts</Label>
                <Input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Payment due</Label>
                <Input type="date" value={newDue} max={newStart || undefined} onChange={(e) => setNewDue(e.target.value)} />
              </div>
            </div>
          )}

          {action === 'paid' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              This switches the warranty on. Documents and login details are emailed to the customer, and the sale
              counts from today. {dialogRow?.deferred_start_date && startOfDay(new Date(dialogRow.deferred_start_date)) > startOfDay(new Date())
                ? `Cover is scheduled to start ${format(new Date(dialogRow.deferred_start_date), 'd MMM yyyy')} as agreed.`
                : 'Cover starts straight away.'}
            </div>
          )}

          {action === 'cancel' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              The order is marked cancelled and kept on the customer record with your reason. Nothing is deleted.
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">
              {action === 'cancel' ? 'Reason *' : action === 'chase' ? 'What happened? *' : 'Note (optional)'}
            </Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              placeholder={action === 'chase' ? 'Called, left voicemail, will pay Friday…' : 'Anything worth recording…'} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving} className={action === 'cancel' ? 'bg-red-600 hover:bg-red-700' : undefined}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {action === 'paid' ? 'Record payment & activate' : action === 'cancel' ? 'Cancel order' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingPaymentTab;
