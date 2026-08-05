import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format, differenceInCalendarDays } from 'date-fns';
import {
  CalendarClock, CheckCircle2, Paperclip, Plus, Trash2, Upload, AlertTriangle, PoundSterling, BellRing,
} from 'lucide-react';


interface PartPaymentsPanelProps {
  customerId: string;
  customerName?: string | null;
  /** Order value used as the default expected total when no plan exists yet. */
  orderTotal?: number | null;
}

interface PartPayment {
  id: string;
  amount: number;
  payment_method: string;
  paid_on: string;
  reference: string | null;
  proof_url: string | null;
  notes: string | null;
  created_at: string;
}

interface PartPaymentPlan {
  id: string;
  total_due: number;
  next_due_date: string | null;
  status: string;
  completed_at: string | null;
  notes: string | null;
  reminder_note: string | null;
  reminder_enabled: boolean;
  reminder_dismissed_until: string | null;
}

const METHODS = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'bumper', label: 'Bumper' },
  { value: 'payment_assist', label: 'Payment Assist' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card_over_phone', label: 'Card over phone' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

const methodLabel = (v: string) => METHODS.find(m => m.value === v)?.label ?? v;

export const PartPaymentsPanel: React.FC<PartPaymentsPanelProps> = ({
  customerId,
  customerName,
  orderTotal,
}) => {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('stripe');
  const [paidOn, setPaidOn] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [totalDue, setTotalDue] = useState<string>('');
  const [nextDueDate, setNextDueDate] = useState<string>('');
  const [reminderNote, setReminderNote] = useState<string>('');
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(true);

  const { data: plan } = useQuery({
    queryKey: ['part-payment-plan', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_part_payment_plans')
        .select('id, total_due, next_due_date, status, completed_at, notes, reminder_note, reminder_enabled, reminder_dismissed_until')
        .eq('customer_id', customerId)
        .maybeSingle();
      if (error) throw error;
      return (data as PartPaymentPlan | null) ?? null;
    },
    enabled: !!customerId,
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['part-payments', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_part_payments')
        .select('id, amount, payment_method, paid_on, reference, proof_url, notes, created_at')
        .eq('customer_id', customerId)
        .order('paid_on', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PartPayment[];
    },
    enabled: !!customerId,
  });

  // Keep the plan fields in sync once the saved plan loads.
  React.useEffect(() => {
    if (plan) {
      setTotalDue(String(plan.total_due ?? ''));
      setNextDueDate(plan.next_due_date ?? '');
      setReminderNote(plan.reminder_note ?? '');
      setReminderEnabled(plan.reminder_enabled ?? true);
    } else if (orderTotal != null && totalDue === '') {
      setTotalDue(String(orderTotal));
    }
  }, [plan, orderTotal]);

  const paidTotal = useMemo(
    () => payments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [payments],
  );
  const expectedTotal = Number(totalDue || plan?.total_due || orderTotal || 0);
  const outstanding = Math.max(expectedTotal - paidTotal, 0);
  const fullyPaid = expectedTotal > 0 && paidTotal >= expectedTotal - 0.01;
  const pct = expectedTotal > 0 ? Math.min(100, (paidTotal / expectedTotal) * 100) : 0;

  const dueInDays = plan?.next_due_date
    ? differenceInCalendarDays(new Date(plan.next_due_date), new Date())
    : null;

  const savePlan = useMutation({
    mutationFn: async (patch?: Partial<PartPaymentPlan>) => {
      const payload = {
        customer_id: customerId,
        total_due: Number(totalDue || 0),
        next_due_date: nextDueDate || null,
        reminder_note: reminderNote.trim() || null,
        reminder_enabled: reminderEnabled,
        ...patch,
      };
      const { error } = await supabase
        .from('customer_part_payment_plans')
        .upsert(payload, { onConflict: 'customer_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['part-payment-plan', customerId] });
      toast.success('Part payment plan saved');
    },
    onError: (e: any) => toast.error(e.message || 'Could not save plan'),
  });

  const uploadProof = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${customerId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('part-payment-proofs')
      .upload(path, file, { upsert: false });
    if (error) {
      toast.error(`Proof upload failed: ${error.message}`);
      return null;
    }
    return path;
  };

  const addPayment = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error('Enter a payment amount');
      return;
    }
    setSaving(true);
    try {
      let proofPath: string | null = null;
      if (proofFile) {
        proofPath = await uploadProof(proofFile);
        if (!proofPath) {
          setSaving(false);
          return;
        }
      }
      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase.from('customer_part_payments').insert({
        customer_id: customerId,
        amount: value,
        payment_method: method,
        paid_on: paidOn,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        proof_url: proofPath,
        recorded_by: authData?.user?.id ?? null,
      });
      if (error) throw error;

      // Make sure a plan row exists so the outstanding balance and reminder persist.
      if (!plan) await savePlan.mutateAsync(undefined);

      setAmount('');
      setReference('');
      setNotes('');
      setProofFile(null);
      queryClient.invalidateQueries({ queryKey: ['part-payments', customerId] });
      toast.success('Part payment recorded');
    } catch (e: any) {
      toast.error(e.message || 'Could not record payment');
    } finally {
      setSaving(false);
    }
  };

  const deletePayment = async (id: string) => {
    const { error } = await supabase.from('customer_part_payments').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['part-payments', customerId] });
    toast.success('Payment removed');
  };

  const openProof = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('part-payment-proofs')
      .createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast.error('Could not open proof file');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const markFullyPaid = () =>
    savePlan.mutate({ status: 'completed', completed_at: new Date().toISOString(), next_due_date: null });

  const reopen = () => savePlan.mutate({ status: 'in_progress', completed_at: null });

  const isCompleted = plan?.status === 'completed';

  return (
    <div className="space-y-4">
      {/* Reconciliation summary */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <PoundSterling className="w-4 h-4" />
              Part payments {customerName ? `— ${customerName}` : ''}
            </CardTitle>
            {isCompleted ? (
              <Badge className="bg-emerald-600 text-white">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Paid in full · normal customer
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500 text-amber-700">
                <AlertTriangle className="w-3 h-3 mr-1" /> Part paid · reconciliation open
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total due</p>
              <p className="text-xl font-bold">£{expectedTotal.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Paid so far</p>
              <p className="text-xl font-bold text-emerald-700">£{paidTotal.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className={`text-xl font-bold ${outstanding > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                £{outstanding.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Payments logged</p>
              <p className="text-xl font-bold">{payments.length}</p>
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full ${fullyPaid ? 'bg-emerald-600' : 'bg-amber-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <Label htmlFor="pp-total">Total due (£)</Label>
              <Input
                id="pp-total"
                type="number"
                step="0.01"
                value={totalDue}
                onChange={(e) => setTotalDue(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pp-due">Next payment reminder date</Label>
              <Input
                id="pp-due"
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => savePlan.mutate(undefined)} disabled={savePlan.isPending}>
                Save plan
              </Button>
              {fullyPaid && !isCompleted && (
                <Button onClick={markFullyPaid} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Mark paid in full
                </Button>
              )}
              {isCompleted && (
                <Button variant="outline" onClick={reopen}>Reopen</Button>
              )}
            </div>
          </div>

          {/* Reminder banner settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end rounded-lg border bg-muted/40 p-3">
            <div className="md:col-span-2">
              <Label htmlFor="pp-reminder-note">Reminder note (shown on the top banner)</Label>
              <Input
                id="pp-reminder-note"
                placeholder="e.g. Chase £150 balance — customer paying on payday"
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="pp-reminder-on"
                  checked={reminderEnabled}
                  onCheckedChange={setReminderEnabled}
                />
                <Label htmlFor="pp-reminder-on" className="flex items-center gap-1 cursor-pointer">
                  <BellRing className="w-3.5 h-3.5" /> Banner reminder
                </Label>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  savePlan.mutate({
                    reminder_note: reminderNote.trim() || null,
                    reminder_enabled: reminderEnabled,
                    reminder_dismissed_until: null,
                  } as any)
                }
                disabled={savePlan.isPending}
              >
                Save reminder
              </Button>
            </div>
          </div>


          {plan?.next_due_date && !isCompleted && (
            <div
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                (dueInDays ?? 0) < 0
                  ? 'border-red-300 bg-red-50 text-red-800'
                  : (dueInDays ?? 0) <= 2
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <CalendarClock className="w-4 h-4" />
              Next payment due {format(new Date(plan.next_due_date), 'dd MMM yyyy')}
              {dueInDays != null && (
                <span className="font-semibold">
                  {dueInDays < 0
                    ? `· ${Math.abs(dueInDays)} day(s) overdue`
                    : dueInDays === 0
                      ? '· due today'
                      : `· in ${dueInDays} day(s)`}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record a payment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" /> Record a part payment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="pp-amount">Amount (£)</Label>
              <Input
                id="pp-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pp-date">Date paid</Label>
              <Input id="pp-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pp-ref">Reference / transaction ID</Label>
              <Input
                id="pp-ref"
                placeholder="e.g. pi_3Q… or Bumper ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pp-proof">Payment confirmation / receipt</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="pp-proof"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                />
                <Upload className="w-4 h-4 text-muted-foreground" />
              </div>
              {proofFile && (
                <p className="text-xs text-muted-foreground mt-1">{proofFile.name}</p>
              )}
            </div>
            <div>
              <Label htmlFor="pp-notes">Notes</Label>
              <Textarea
                id="pp-notes"
                rows={2}
                placeholder="e.g. first instalment via Stripe, balance set up on Bumper"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={addPayment} disabled={saving}>
            {saving ? 'Saving…' : 'Add part payment'}
          </Button>
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Payment history</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-16 animate-pulse rounded-lg bg-muted" />
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No part payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Method</th>
                    <th className="text-right py-2">Amount</th>
                    <th className="text-left py-2 pl-4">Reference</th>
                    <th className="text-left py-2">Proof</th>
                    <th className="text-left py-2">Notes</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2">{format(new Date(p.paid_on), 'dd MMM yyyy')}</td>
                      <td className="py-2">
                        <Badge variant="outline">{methodLabel(p.payment_method)}</Badge>
                      </td>
                      <td className="py-2 text-right font-semibold">£{Number(p.amount).toFixed(2)}</td>
                      <td className="py-2 pl-4 font-mono text-xs">{p.reference || '—'}</td>
                      <td className="py-2">
                        {p.proof_url ? (
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openProof(p.proof_url!)}>
                            <Paperclip className="w-3 h-3 mr-1" /> View
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">None</span>
                        )}
                      </td>
                      <td className="py-2 max-w-[220px] truncate" title={p.notes || ''}>{p.notes || '—'}</td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-600 hover:text-red-700"
                          onClick={() => deletePayment(p.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PartPaymentsPanel;
