import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2, MessageSquare, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BAW_PAYLATER_LABEL } from '@/lib/bawPayLater';

/**
 * BAW PayLater collections — the accounts team's list of yearly payments still to be
 * taken on 2 and 3 year cover sold on BAW PayLater. Year 1 is collected at the point
 * of sale; every later anniversary sits here until the money lands.
 */

type SStatus = 'pending' | 'paid' | 'cancelled';

const gbp = (n: number | null | undefined) => `£${Math.round(Number(n) || 0).toLocaleString('en-GB')}`;

interface Row {
  id: string;
  customer_id: string;
  warranty_reference_number: string | null;
  year_number: number;
  amount: number;
  due_date: string;
  status: SStatus;
  paid_at: string | null;
  payment_reference: string | null;
  payment_method: string | null;
  chase_count: number;
  last_chased_at: string | null;
  notes: string | null;
  customer?: {
    name: string | null;
    email: string | null;
    phone: string | null;
    registration_plate: string | null;
    baw_paylater_years: number | null;
  } | null;
}

const PAYMENT_METHODS = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'bumper', label: 'Bumper' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card_machine', label: 'Card / phone payment' },
  { value: 'other', label: 'Other' },
];

const BawPayLaterTab: React.FC = () => {
  const adminUserId = useCurrentAdminId();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | SStatus | 'overdue'>('pending');
  const [search, setSearch] = useState('');
  const [payRow, setPayRow] = useState<Row | null>(null);
  const [payReference, setPayReference] = useState('');
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payNote, setPayNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('baw_paylater_schedules')
      .select('*, customer:customers(name, email, phone, registration_plate, baw_paylater_years)')
      .order('due_date', { ascending: true })
      .limit(1000);
    if (error) {
      toast.error('Could not load the PayLater collections');
      setRows([]);
    } else {
      setRows((data || []) as unknown as Row[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = startOfDay(new Date());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const overdue = r.status === 'pending' && differenceInCalendarDays(new Date(r.due_date), today) < 0;
      if (statusFilter === 'overdue' && !overdue) return false;
      if (statusFilter !== 'all' && statusFilter !== 'overdue' && r.status !== statusFilter) return false;
      if (!q) return true;
      return [
        r.customer?.name, r.customer?.email, r.customer?.phone,
        r.customer?.registration_plate, r.warranty_reference_number,
      ].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [rows, statusFilter, search, today]);

  const totals = useMemo(() => {
    const pending = rows.filter((r) => r.status === 'pending');
    const overdue = pending.filter((r) => differenceInCalendarDays(new Date(r.due_date), today) < 0);
    const next30 = pending.filter((r) => {
      const d = differenceInCalendarDays(new Date(r.due_date), today);
      return d >= 0 && d <= 30;
    });
    const sum = (list: Row[]) => list.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    return {
      pendingCount: pending.length, pendingValue: sum(pending),
      overdueCount: overdue.length, overdueValue: sum(overdue),
      next30Count: next30.length, next30Value: sum(next30),
    };
  }, [rows, today]);

  const openPay = (row: Row) => {
    setPayRow(row);
    setPayReference('');
    setPayMethod('bank_transfer');
    setPayNote('');
  };

  const markPaid = async () => {
    if (!payRow) return;
    setSaving(true);
    const { error } = await supabase
      .from('baw_paylater_schedules')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_amount: payRow.amount,
        payment_reference: payReference.trim() || null,
        payment_method: payMethod,
        notes: [payRow.notes, payNote.trim() ? `Payment note: ${payNote.trim()}` : ''].filter(Boolean).join('\n'),
        updated_by: adminUserId,
      } as any)
      .eq('id', payRow.id);
    setSaving(false);
    if (error) {
      toast.error('Could not save that payment');
      return;
    }
    toast.success(`Year ${payRow.year_number} payment recorded`);
    setPayRow(null);
    load();
  };

  const logChase = async (row: Row) => {
    const { error } = await supabase
      .from('baw_paylater_schedules')
      .update({
        chase_count: (row.chase_count || 0) + 1,
        last_chased_at: new Date().toISOString(),
        updated_by: adminUserId,
      } as any)
      .eq('id', row.id);
    if (error) {
      toast.error('Could not log the chase');
      return;
    }
    toast.success('Chase logged');
    load();
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-xl font-semibold">{BAW_PAYLATER_LABEL} collections</h2>
        <p className="text-sm text-muted-foreground">
          Yearly payments still to be taken on 2 and 3 year cover sold on BAW PayLater. The first year is
          collected at the point of sale — every anniversary after that is chased here.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Still to collect</div>
          <div className="text-2xl font-bold">{gbp(totals.pendingValue)}</div>
          <div className="text-xs text-muted-foreground">{totals.pendingCount} payments</div>
        </div>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <div className="text-xs font-semibold uppercase text-destructive">Overdue</div>
          <div className="text-2xl font-bold text-destructive">{gbp(totals.overdueValue)}</div>
          <div className="text-xs text-muted-foreground">{totals.overdueCount} payments</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Due next 30 days</div>
          <div className="text-2xl font-bold">{gbp(totals.next30Value)}</div>
          <div className="text-xs text-muted-foreground">{totals.next30Count} payments</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name, email, phone, reg or warranty number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">To collect</SelectItem>
            <SelectItem value="overdue">Overdue only</SelectItem>
            <SelectItem value="paid">Collected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading collections…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Nothing to show here.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const days = differenceInCalendarDays(new Date(r.due_date), today);
            const overdue = r.status === 'pending' && days < 0;
            return (
              <div
                key={r.id}
                className={cn(
                  'rounded-lg border bg-card p-3',
                  overdue && 'border-destructive/50 bg-destructive/5',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-[240px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.customer?.name || 'Customer'}</span>
                      <Badge variant="outline">Year {r.year_number} of {r.customer?.baw_paylater_years || '—'}</Badge>
                      {r.status === 'paid' && (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Collected</Badge>
                      )}
                      {overdue && (
                        <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />{Math.abs(days)} days overdue</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {[r.customer?.registration_plate, r.warranty_reference_number, r.customer?.email, r.customer?.phone]
                        .filter(Boolean).join(' · ')}
                    </div>
                    {r.chase_count > 0 && (
                      <div className="mt-1 text-xs text-amber-700">
                        Chased {r.chase_count}×{r.last_chased_at ? ` — last ${format(new Date(r.last_chased_at), 'd MMM yyyy')}` : ''}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{gbp(r.amount)}</div>
                    <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" />
                      {r.status === 'paid' && r.paid_at
                        ? `Paid ${format(new Date(r.paid_at), 'd MMM yyyy')}`
                        : `Due ${format(new Date(r.due_date), 'd MMM yyyy')}`}
                    </div>
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => logChase(r)}>
                        <MessageSquare className="mr-1 h-4 w-4" /> Log chase
                      </Button>
                      <Button size="sm" onClick={() => openPay(r)}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Mark collected
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!payRow} onOpenChange={(o) => !o && setPayRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record year {payRow?.year_number} payment</DialogTitle>
            <DialogDescription>
              {payRow ? `${gbp(payRow.amount)} from ${payRow.customer?.name || 'the customer'}.` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>How it was paid</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reference</Label>
              <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="Payment or transaction reference" />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea value={payNote} onChange={(e) => setPayNote(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayRow(null)}>Cancel</Button>
            <Button onClick={markPaid} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BawPayLaterTab;
