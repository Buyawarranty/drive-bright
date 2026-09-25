import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, ArrowDownAZ, ArrowUpAZ, BadgePoundSterling, CalendarClock, CheckCircle2, HelpCircle, Loader2, RefreshCw, Search } from 'lucide-react';
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { toast } from 'sonner';

/**
 * Payments pending — the accounts team's checklist of sales where a sale was
 * confirmed but no payment evidence has been verified yet.
 *
 * A sale lands here when payment_verification_status is 'pending'. For every row
 * we show whatever payment evidence the system does hold (Stripe session, Bumper
 * order, Payment Assist application, a payments row), so accounts can tick it
 * off, flag it as missing, or raise a query — with a reference and a note.
 */

type VStatus = 'pending' | 'verified' | 'missing' | 'queried';

const gbp = (n: number | null | undefined) => `£${Math.round(Number(n) || 0).toLocaleString('en-GB')}`;

const DEAD_STATUSES = ['cancelled', 'canceled', 'refunded'];

const plateOf = (s: string) => s.replace(/\s+/g, '');

const SOURCES = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'bumper', label: 'Bumper' },
  { value: 'payment_assist', label: 'Payment Assist' },
  { value: 'paybetter', label: 'PayBetter' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card_machine', label: 'Card / phone payment' },
  { value: 'other', label: 'Other' },
];

interface Row {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  registration_plate: string | null;
  warranty_reference_number: string | null;
  signup_date: string | null;
  payment_due_date: string | null;
  final_amount: number | null;
  payment_type: string | null;
  purchase_source: string | null;
  status: string | null;
  stripe_session_id: string | null;
  bumper_order_id: string | null;
  payment_confirmed_by: string | null;
  assigned_to: string | null;
  payment_verification_status: VStatus;
  payment_verification_source: string | null;
  payment_verification_ref: string | null;
  payment_verification_note: string | null;
  payment_verified_at: string | null;
  payment_verified_by: string | null;
}

interface Evidence {
  stripePayments: number;
  bumper: string | null;
  paymentAssist: string | null;
}

export const PaymentsPendingTab: React.FC = () => {
  const currentAdminId = useCurrentAdminId();
  const [rows, setRows] = useState<Row[]>([]);
  const [evidence, setEvidence] = useState<Record<string, Evidence>>({});
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<VStatus | 'all' | 'open'>('open');
  const [search, setSearch] = useState('');
  const [days, setDays] = useState('120');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [dialogRow, setDialogRow] = useState<Row | null>(null);
  const [dialogAction, setDialogAction] = useState<VStatus>('verified');
  const [formSource, setFormSource] = useState('stripe');
  const [formRef, setFormRef] = useState('');
  const [formNote, setFormNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since = days === 'all' ? null : new Date(Date.now() - Number(days) * 86400000).toISOString();

      let q = supabase
        .from('customers')
        .select(
          'id, name, email, phone, registration_plate, warranty_reference_number, signup_date, payment_due_date, final_amount, payment_type, purchase_source, status, stripe_session_id, bumper_order_id, payment_confirmed_by, assigned_to, payment_verification_status, payment_verification_source, payment_verification_ref, payment_verification_note, payment_verified_at, payment_verified_by',
        )
        .eq('is_deleted', false)
        .order('signup_date', { ascending: false })
        .limit(2000);

      if (since) q = q.gte('signup_date', since);

      if (statusFilter === 'open') q = q.in('payment_verification_status', ['pending', 'queried', 'missing']);
      else if (statusFilter !== 'all') q = q.eq('payment_verification_status', statusFilter);

      const { data, error } = await q;
      if (error) throw error;

      const list = ((data || []) as any[])
        .filter((c) => !DEAD_STATUSES.some((d) => String(c.status || '').toLowerCase().includes(d)))
        .map((c) => ({ ...c, payment_verification_status: (c.payment_verification_status || 'pending') as VStatus })) as Row[];
      setRows(list);

      const ids = list.map((r) => r.id);
      const emails = Array.from(new Set(list.map((r) => (r.email || '').toLowerCase()).filter(Boolean)));

      const [payRes, bumperRes, paRes, staffRes] = await Promise.all([
        ids.length
          ? supabase.from('payments').select('customer_id, stripe_payment_id').in('customer_id', ids.slice(0, 300))
          : Promise.resolve({ data: [] } as any),
        emails.length
          ? (supabase as any)
              .from('bumper_transactions')
              .select('transaction_id, status, customer_data')
              .order('created_at', { ascending: false })
              .limit(500)
          : Promise.resolve({ data: [] } as any),
        emails.length
          ? (supabase as any)
              .from('payment_assist_transactions')
              .select('customer_email, status, reference')
              .in('customer_email', emails.slice(0, 300))
          : Promise.resolve({ data: [] } as any),
        supabase.from('admin_users').select('id, first_name, last_name, email'),
      ]);

      const byEmailBumper = new Map<string, string>();
      ((bumperRes as any)?.data || []).forEach((b: any) => {
        const em = String(b?.customer_data?.email || b?.customer_data?.customer_email || '').toLowerCase();
        if (em && !byEmailBumper.has(em)) byEmailBumper.set(em, `${b.status || 'unknown'} · ${b.transaction_id || ''}`.trim());
      });

      const byEmailPa = new Map<string, string>();
      ((paRes as any)?.data || []).forEach((p: any) => {
        const em = String(p.customer_email || '').toLowerCase();
        if (em && !byEmailPa.has(em)) byEmailPa.set(em, `${p.status || 'unknown'}${p.reference ? ` · ${p.reference}` : ''}`);
      });

      const payCount = new Map<string, number>();
      ((payRes as any)?.data || []).forEach((p: any) => payCount.set(p.customer_id, (payCount.get(p.customer_id) || 0) + 1));

      const ev: Record<string, Evidence> = {};
      list.forEach((r) => {
        const em = (r.email || '').toLowerCase();
        ev[r.id] = {
          stripePayments: payCount.get(r.id) || 0,
          bumper: byEmailBumper.get(em) || null,
          paymentAssist: byEmailPa.get(em) || null,
        };
      });
      setEvidence(ev);

      const map: Record<string, string> = {};
      ((staffRes as any)?.data || []).forEach((u: any) => {
        map[u.id] = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
      });
      setStaff(map);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load pending payments');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, days]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = !q
      ? rows
      : rows.filter((r) =>
          [r.name, r.email, r.phone, r.warranty_reference_number].some((v) => String(v || '').toLowerCase().includes(q)) ||
          String(r.registration_plate || '').toLowerCase().replace(/\s+/g, '').includes(plateOf(q)),
        );

    const dueTime = (r: Row) => {
      const d = r.payment_due_date || r.signup_date;
      const t = d ? new Date(d).getTime() : NaN;
      return Number.isFinite(t) ? t : null;
    };

    return [...base].sort((a, b) => {
      const ta = dueTime(a);
      const tb = dueTime(b);
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return sortDir === 'asc' ? ta - tb : tb - ta;
    });
  }, [rows, search, sortDir]);

  const sections = useMemo(
    () => [
      {
        key: 'long',
        title: '24 & 36 month payments',
        blurb: 'Longer cover — yearly or extended instalment collections.',
        rows: filtered.filter((r) => getWarrantyDurationInMonths(r.payment_type || '') >= 24),
      },
      {
        key: 'short',
        title: '12 month payments',
        blurb: 'One year cover.',
        rows: filtered.filter((r) => getWarrantyDurationInMonths(r.payment_type || '') < 24),
      },
    ],
    [filtered],
  );

  const counts = useMemo(() => {
    const c = { pending: 0, missing: 0, queried: 0, verified: 0, value: 0 };
    rows.forEach((r) => {
      c[r.payment_verification_status] = (c[r.payment_verification_status] || 0) + 1;
      if (r.payment_verification_status !== 'verified') c.value += Number(r.final_amount) || 0;
    });
    return c;
  }, [rows]);

  const openDialog = (row: Row, action: VStatus) => {
    setDialogRow(row);
    setDialogAction(action);
    setFormSource(
      row.stripe_session_id
        ? 'stripe'
        : row.bumper_order_id
          ? 'bumper'
          : row.purchase_source?.includes('assist')
            ? 'payment_assist'
            : row.purchase_source?.includes('bumper')
              ? 'bumper'
              : 'stripe',
    );
    setFormRef(row.payment_verification_ref || row.stripe_session_id || row.bumper_order_id || '');
    setFormNote(row.payment_verification_note || '');
  };

  const save = async () => {
    if (!dialogRow) return;
    if (dialogAction === 'verified' && !formRef.trim()) {
      toast.error('Add the payment reference you verified this against');
      return;
    }
    if (dialogAction !== 'verified' && !formNote.trim()) {
      toast.error('Add a short note so sales know what is outstanding');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          payment_verification_status: dialogAction,
          payment_verified: dialogAction === 'verified',
          payment_verified_at: new Date().toISOString(),
          payment_verified_by: currentAdminId || null,
          payment_verification_source: dialogAction === 'verified' ? formSource : null,
          payment_verification_ref: formRef.trim() || null,
          payment_verification_note: formNote.trim() || null,
        } as any)
        .eq('id', dialogRow.id);
      if (error) throw error;
      toast.success(
        dialogAction === 'verified'
          ? 'Payment marked as verified'
          : dialogAction === 'missing'
            ? 'Flagged as payment missing'
            : 'Query raised on this payment',
      );
      setDialogRow(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not save that');
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (s: VStatus) =>
    s === 'verified' ? (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Verified</Badge>
    ) : s === 'missing' ? (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Payment missing</Badge>
    ) : s === 'queried' ? (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Queried</Badge>
    ) : (
      <Badge variant="outline">Pending</Badge>
    );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BadgePoundSterling className="h-5 w-5 text-orange-600" />
          Payments pending
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sales where payment was confirmed by an agent but no payment has been verified against Stripe, Bumper,
          Payment Assist or the bank. Accounts can verify each one, or flag it as missing or queried so sales can chase it.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Pending', value: counts.pending },
          { label: 'Queried', value: counts.queried },
          { label: 'Payment missing', value: counts.missing },
          { label: 'Verified', value: counts.verified },
          { label: 'Unverified value', value: gbp(counts.value) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className="text-lg font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 w-64"
            placeholder="Name, email, phone or reg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Needs checking (all open)</SelectItem>
            <SelectItem value="pending">Pending only</SelectItem>
            <SelectItem value="queried">Queried</SelectItem>
            <SelectItem value="missing">Payment missing</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="all">All sales</SelectItem>
          </SelectContent>
        </Select>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="60">Last 60 days</SelectItem>
            <SelectItem value="120">Last 120 days</SelectItem>
            <SelectItem value="365">Last 12 months</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          title="Sort by when payment is due"
        >
          <CalendarClock className="h-4 w-4 mr-1" />
          Payment due
          {sortDir === 'asc' ? <ArrowUpAZ className="h-4 w-4 ml-1" /> : <ArrowDownAZ className="h-4 w-4 ml-1" />}
        </Button>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1">Refresh</span>
        </Button>
      </div>

      {sections.map((section) => (
      <div key={section.key} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">{section.title}</h3>
            <p className="text-[11px] text-muted-foreground">{section.blurb}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            {section.rows.length} sale{section.rows.length === 1 ? '' : 's'} ·{' '}
            {gbp(section.rows.reduce((a, r) => a + (Number(r.final_amount) || 0), 0))}
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Sale</th>
              <th className="px-3 py-2 font-medium">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 uppercase hover:text-foreground"
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                >
                  Payment due
                  {sortDir === 'asc' ? <ArrowUpAZ className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />}
                </button>
              </th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Confirmed by</th>
              <th className="px-3 py-2 font-medium">Payment evidence on system</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {!loading && section.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Nothing outstanding in this section.
                </td>
              </tr>
            )}
            {section.rows.map((r) => {
              const ev = evidence[r.id];
              const hasAny = !!(r.stripe_session_id || r.bumper_order_id || ev?.stripePayments || ev?.bumper || ev?.paymentAssist);
              return (
                <tr key={r.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name || 'Unnamed'}</div>
                    <div className="text-[11px] text-muted-foreground select-text">
                      {r.email} {r.phone ? `· ${r.phone}` : ''}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.registration_plate || '—'} · {r.warranty_reference_number || 'no policy no.'} ·{' '}
                      {r.signup_date ? format(new Date(r.signup_date), 'd MMM yyyy, HH:mm') : '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {r.payment_due_date ? (
                      <span className="font-medium">{format(new Date(r.payment_due_date), 'd MMM yyyy')}</span>
                    ) : (
                      <span className="text-muted-foreground">No date set</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-semibold">{gbp(r.final_amount)}</div>
                    <div className="text-[11px] text-muted-foreground">{r.payment_type || '—'}</div>
                    <div className="text-[11px] text-muted-foreground">{r.purchase_source || 'source not set'}</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {staff[r.payment_confirmed_by || ''] || staff[r.assigned_to || ''] || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {hasAny ? (
                      <div className="space-y-0.5">
                        {r.stripe_session_id && <div>Stripe session: <span className="select-text">{r.stripe_session_id}</span></div>}
                        {!!ev?.stripePayments && <div>{ev.stripePayments} Stripe payment record(s)</div>}
                        {r.bumper_order_id && <div>Bumper order: <span className="select-text">{r.bumper_order_id}</span></div>}
                        {ev?.bumper && <div>Bumper application: {ev.bumper}</div>}
                        {ev?.paymentAssist && <div>Payment Assist: {ev.paymentAssist}</div>}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5" /> No payment record found
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {statusBadge(r.payment_verification_status)}
                    {r.payment_verification_status !== 'pending' && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground max-w-[14rem]">
                        {r.payment_verification_source ? `${r.payment_verification_source} · ` : ''}
                        {r.payment_verification_ref || ''}
                        {r.payment_verified_at ? ` · ${format(new Date(r.payment_verified_at), 'd MMM HH:mm')}` : ''}
                        {r.payment_verified_by && staff[r.payment_verified_by] ? ` · ${staff[r.payment_verified_by]}` : ''}
                        {r.payment_verification_note ? ` · ${r.payment_verification_note}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="inline-flex gap-1">
                      <Button size="sm" onClick={() => openDialog(r, 'verified')}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Verify
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openDialog(r, 'queried')}>
                        <HelpCircle className="h-4 w-4 mr-1" /> Query
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openDialog(r, 'missing')}>
                        Missing
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      ))}


      <Dialog open={!!dialogRow} onOpenChange={(o) => !o && setDialogRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'verified'
                ? 'Verify payment'
                : dialogAction === 'missing'
                  ? 'Flag payment as missing'
                  : 'Raise a query on this payment'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {dialogRow?.name} · {gbp(dialogRow?.final_amount)} · {dialogRow?.registration_plate || '—'}
            </div>
            {dialogAction === 'verified' && (
              <div className="space-y-1">
                <label className="text-xs font-medium">Where did you verify it?</label>
                <Select value={formSource} onValueChange={setFormSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium">
                Payment reference {dialogAction === 'verified' && <span className="text-red-600">*</span>}
              </label>
              <Input value={formRef} onChange={(e) => setFormRef(e.target.value)} placeholder="Stripe / Bumper / bank reference" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">
                Note {dialogAction !== 'verified' && <span className="text-red-600">*</span>}
              </label>
              <Textarea
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder={
                  dialogAction === 'verified'
                    ? 'Optional — anything the team should know'
                    : 'What is outstanding, e.g. no Bumper application found for this customer'
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogRow(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentsPendingTab;
