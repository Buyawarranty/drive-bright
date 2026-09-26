import React, { useCallback, useEffect, useState } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { CheckCircle2, Loader2, PoundSterling } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { confirmCustomerPaymentReceived } from './confirmPaymentReceived';

const gbp = (n: number) => `£${(Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const METHOD_LABEL: Record<string, string> = {
  stripe: 'Stripe', bumper: 'Bumper', payment_assist: 'Payment Assist', bank_transfer: 'Bank transfer',
  card: 'Card', card_machine: 'Card / phone', cash: 'Cash', manual: 'Manual', other: 'Other',
};
const methodLabel = (m: string) => METHOD_LABEL[m] || m.replace(/_/g, ' ');

export interface PartRow {
  planId: string;
  customerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  reg: string | null;
  total: number;
  paid: number;
  outstanding: number;
  sources: string[];
  dueDate: string | null;
  takenAt: string | null;
}

interface Props {
  onLoaded?: (rows: PartRow[]) => void;
  onChanged?: () => void;
}

/** Top section of Payments pending: every sale with a part payment and a balance still to collect. */
export const PartPaymentSection: React.FC<Props> = ({ onLoaded, onChanged }) => {
  const [rows, setRows] = useState<PartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmRow, setConfirmRow] = useState<PartRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: plans, error } = await supabase
        .from('customer_part_payment_plans')
        .select('id, customer_id, total_due, next_due_date, status, created_at')
        .neq('status', 'completed')
        .limit(500);
      if (error) throw error;
      const ids = (plans || []).map((p: any) => p.customer_id);
      if (!ids.length) { setRows([]); onLoaded?.([]); return; }
      const [{ data: custs }, { data: pays }] = await Promise.all([
        supabase.from('customers').select('id, name, email, phone, registration_plate, status').in('id', ids),
        supabase.from('customer_part_payments').select('customer_id, amount, payment_method').in('customer_id', ids),
      ]);
      const cMap = new Map((custs || []).map((c: any) => [c.id, c]));
      const list: PartRow[] = (plans || [])
        .map((p: any) => {
          const c: any = cMap.get(p.customer_id) || {};
          const mine = (pays || []).filter((x: any) => x.customer_id === p.customer_id);
          const paid = mine.reduce((a: number, x: any) => a + Number(x.amount || 0), 0);
          const total = Number(p.total_due || 0);
          return {
            planId: p.id, customerId: p.customer_id, name: c.name || 'Unknown customer', email: c.email ?? null,
            phone: c.phone ?? null, reg: c.registration_plate ?? null, total, paid,
            outstanding: Math.max(total - paid, 0),
            sources: Array.from(new Set(mine.map((x: any) => methodLabel(String(x.payment_method || 'other'))))),
            dueDate: p.next_due_date, takenAt: p.created_at,
            _dead: /cancel|refund/i.test(String(c.status || '')),
          } as PartRow & { _dead: boolean };
        })
        .filter((r: any) => !r._dead && r.paid > 0 && r.outstanding > 0)
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
      setRows(list);
      onLoaded?.(list);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load part payments');
    } finally {
      setLoading(false);
    }
  }, [onLoaded]);

  useEffect(() => { load(); }, [load]);

  const confirm = async () => {
    if (!confirmRow) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error: pErr } = await supabase.from('customer_part_payments').insert({
        customer_id: confirmRow.customerId, amount: confirmRow.outstanding, payment_method: 'manual',
        paid_on: new Date().toISOString().slice(0, 10), notes: 'Balance confirmed received (Payments pending)',
        recorded_by: u?.user?.id ?? null,
      } as any);
      if (pErr) throw pErr;
      const { error } = await supabase.from('customer_part_payment_plans')
        .update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', confirmRow.planId);
      if (error) throw error;
      await confirmCustomerPaymentReceived(confirmRow.customerId, {
        source: 'part_payment', ref: `part-payment balance ${gbp(confirmRow.outstanding)}`,
      });
      toast.success('Balance received — sale confirmed, scoreboard and customer dashboards updated');
      setConfirmRow(null);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || 'Could not confirm payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border-2 border-amber-400 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-amber-50 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1"><PoundSterling className="h-4 w-4" /> Part payments</h3>
          <p className="text-[11px] text-muted-foreground">Sales where some money is in and a balance is still to collect.</p>
        </div>
        <div className="text-xs text-muted-foreground">
          {rows.length} sale{rows.length === 1 ? '' : 's'} · {gbp(rows.reduce((a, r) => a + r.outstanding, 0))} still due
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Paid so far</th>
              <th className="px-3 py-2 font-medium">Paid via</th>
              <th className="px-3 py-2 font-medium">Still due</th>
              <th className="px-3 py-2 font-medium">Due date</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No part-payment balances outstanding.</td></tr>
            )}
            {!loading && rows.map((r) => {
              const d = r.dueDate ? differenceInCalendarDays(new Date(r.dueDate), new Date()) : null;
              return (
                <tr key={r.planId} className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground select-text">{r.email} {r.phone ? `· ${r.phone}` : ''}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.reg || '—'}{r.takenAt ? ` · taken ${format(new Date(r.takenAt), 'd MMM yyyy')}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-semibold">{gbp(r.paid)}</div>
                    <div className="text-[11px] text-muted-foreground">of {gbp(r.total)}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.sources.join(', ') || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-semibold text-red-700">{gbp(r.outstanding)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {r.dueDate ? format(new Date(r.dueDate), 'd MMM yyyy') : <span className="text-muted-foreground">No date set</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {d == null ? <Badge variant="outline">Payment due</Badge>
                      : d < 0 ? <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{Math.abs(d)}d overdue</Badge>
                      : <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{d === 0 ? 'Due today' : `Due in ${d}d`}</Badge>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" onClick={() => setConfirmRow(r)}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Payment received
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!confirmRow} onOpenChange={(o) => !o && setConfirmRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure the balance has been received?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRow?.name} · {gbp(confirmRow?.outstanding || 0)} balance. This marks the sale as paid in full,
              adds it to the agent's scoreboard and updates the customer record and the customer's own login dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>No, go back</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirm(); }} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Yes, confirm payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
