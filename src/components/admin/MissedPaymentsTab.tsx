import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, RefreshCw, CheckCircle2 } from 'lucide-react';

// Missed payments: everyone who clicked the Stripe or Bumper pay button on step 4.
// Rows where a sale now exists (matched by email or reg) are highlighted as paid.

type Row = {
  key: string;
  clickedAt: string;
  method: 'stripe' | 'bumper';
  email: string;
  reg: string;
  name: string;
  phone: string;
  amount: number | null;
  paid: boolean;
  paidAt?: string;
  failed?: string;
  ownerName?: string;
  leadStatus?: string;
};

const norm = (s?: string | null) => (s || '').trim().toLowerCase();
const normReg = (s?: string | null) => (s || '').replace(/\s+/g, '').toUpperCase();
const DAYS = [7, 30, 90];

const MissedPaymentsTab: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [clicksRes, bumperRes, failRes] = await Promise.all([
      supabase.from('payment_button_clicks').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(2000),
      supabase.from('bumper_transactions').select('id, created_at, customer_data, vehicle_data, final_amount, status').gte('created_at', since).order('created_at', { ascending: false }).limit(2000),
      (supabase as any).from('stripe_payment_failures').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(2000),
    ]);

    const raw: Row[] = [];
    for (const c of clicksRes.data || []) {
      raw.push({ key: `c-${c.id}`, clickedAt: c.created_at, method: c.payment_method === 'bumper' ? 'bumper' : 'stripe',
        email: norm(c.email), reg: normReg(c.vehicle_reg), name: '', phone: '', amount: c.amount, paid: false });
    }
    for (const f of (failRes.data || []) as any[]) {
      raw.push({ key: `f-${f.id}`, clickedAt: f.created_at, method: 'stripe',
        email: norm(f.email), reg: normReg(f.vehicle_reg), name: '', phone: f.phone || '', amount: f.amount, paid: false,
        failed: f.event_type === 'checkout.session.expired' ? 'Abandoned checkout' : `Declined${f.failure_message ? `: ${f.failure_message}` : ''}` });
    }
    for (const b of bumperRes.data || []) {
      const cd: any = b.customer_data || {};
      const vd: any = b.vehicle_data || {};
      raw.push({ key: `b-${b.id}`, clickedAt: b.created_at, method: 'bumper',
        email: norm(cd.email), reg: normReg(vd.regNumber || vd.reg || cd.vehicle_reg),
        name: [cd.first_name, cd.last_name].filter(Boolean).join(' ') || cd.fullName || cd.name || '',
        phone: cd.mobile || cd.phone || '', amount: b.final_amount, paid: false,
        failed: norm((b as any).status) === 'failed' ? 'Bumper declined' : undefined });
    }

    // One row per customer (email or reg), keep the latest click, merge details.
    const byId = new Map<string, Row>();
    for (const r of raw) {
      const id = r.email || r.reg;
      if (!id) continue;
      const ex = byId.get(id);
      if (!ex) { byId.set(id, r); continue; }
      ex.name ||= r.name; ex.phone ||= r.phone; ex.reg ||= r.reg; ex.email ||= r.email; ex.failed ||= r.failed;
      if (r.clickedAt > ex.clickedAt) { ex.clickedAt = r.clickedAt; ex.method = r.method; ex.amount = r.amount ?? ex.amount; }
    }
    const list = Array.from(byId.values());
    const emails = [...new Set(list.map(r => r.email).filter(Boolean))];
    const regs = [...new Set(list.map(r => r.reg).filter(Boolean))];

    const chunk = <T,>(a: T[], n = 150) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
    const custs: any[] = [];
    const carts: any[] = [];
    await Promise.all([
      ...chunk(emails).map(async e => {
        const { data } = await supabase.from('customers').select('email, registration_plate, name, phone, signup_date, status').in('email', e);
        custs.push(...(data || []));
        const { data: cd } = await supabase.from('abandoned_carts').select('email, full_name, phone, vehicle_reg').in('email', e);
        carts.push(...(cd || []));
      }),
      ...chunk(regs).map(async r => {
        const { data } = await supabase.from('customers').select('email, registration_plate, name, phone, signup_date, status').in('registration_plate', r);
        custs.push(...(data || []));
      }),
    ]);

    for (const r of list) {
      const sale = custs.find(c =>
        (r.email && norm(c.email) === r.email) || (r.reg && normReg(c.registration_plate) === r.reg));
      const validSale = sale && !['cancelled', 'refunded'].includes(norm(sale.status));
      if (validSale && (sale.signup_date || '') >= r.clickedAt.slice(0, 10)) { r.paid = true; r.paidAt = sale.signup_date; }
      if (sale) { r.name ||= sale.name || ''; r.phone ||= sale.phone || ''; }
      const cart = carts.find(c => norm(c.email) === r.email);
      if (cart) { r.name ||= cart.full_name || ''; r.phone ||= cart.phone || ''; r.reg ||= normReg(cart.vehicle_reg); }
    }
    if (emails.length) {
      const { data: leads } = await supabase.from('sales_leads').select('email, assigned_to, status, created_at').in('email', emails.slice(0, 500)).order('created_at', { ascending: false });
      const ids = [...new Set((leads || []).map((l: any) => l.assigned_to).filter(Boolean))] as string[];
      const { data: admins } = ids.length ? await supabase.from('admin_users').select('id, first_name, last_name, email').in('id', ids) : { data: [] as any[] };
      for (const r of list) {
        const l: any = (leads || []).find((x: any) => norm(x.email) === r.email);
        if (!l) continue;
        const a: any = (admins || []).find((x: any) => x.id === l.assigned_to);
        r.ownerName = a ? ([a.first_name, a.last_name].filter(Boolean).join(' ') || a.email) : 'Unassigned';
        r.leadStatus = l.status;
      }
    }
    list.sort((a, b) => b.clickedAt.localeCompare(a.clickedAt));
    setRows(list);
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => (filter === 'all' || (filter === 'paid') === r.paid))
      .filter(r => !q || [r.name, r.email, r.reg, r.phone].some(v => v.toLowerCase().includes(q)));
  }, [rows, filter, search]);

  const unpaid = rows.filter(r => !r.paid).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Missed payments</h2>
          <p className="text-sm text-muted-foreground">Customers who clicked Stripe or Bumper to pay. Call the ones still unpaid.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Clicked to pay</div><div className="text-2xl font-semibold">{rows.length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Not paid yet</div><div className="text-2xl font-semibold text-destructive">{unpaid}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Payment made</div><div className="text-2xl font-semibold text-primary">{rows.length - unpaid}</div></Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {(['unpaid', 'paid', 'all'] as const).map(f => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
            {f === 'unpaid' ? 'Not paid' : f === 'paid' ? 'Paid' : 'All'}
          </Button>
        ))}
        <span className="mx-2 text-muted-foreground">|</span>
        {DAYS.map(d => (
          <Button key={d} size="sm" variant={days === d ? 'default' : 'outline'} onClick={() => setDays(d)}>Last {d} days</Button>
        ))}
        <Input className="max-w-xs ml-auto" placeholder="Search name, email, reg, phone" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">Clicked</th><th className="p-2">Button</th><th className="p-2">Name</th>
              <th className="p-2">Phone</th><th className="p-2">Email</th><th className="p-2">Reg</th>
              <th className="p-2">Amount</th><th className="p-2">Lead owner</th><th className="p-2">Lead status</th><th className="p-2">Payment</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Loading…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">No customers here.</td></tr>
            ) : shown.map(r => (
              <tr key={r.key} className={`border-t ${r.paid ? 'bg-primary/10' : ''}`}>
                <td className="p-2 whitespace-nowrap">{new Date(r.clickedAt).toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="p-2"><Badge variant="outline">{r.method === 'stripe' ? 'Stripe' : 'Bumper'}</Badge></td>
                <td className="p-2">{r.name || '—'}</td>
                <td className="p-2 whitespace-nowrap">
                  {r.phone ? <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="h-3 w-3" />{r.phone}</a> : '—'}
                </td>
                <td className="p-2">{r.email || '—'}</td>
                <td className="p-2 font-mono">{r.reg || '—'}</td>
                <td className="p-2">{r.amount != null ? `£${Number(r.amount).toFixed(2)}` : '—'}</td>
                <td className="p-2 whitespace-nowrap">{r.ownerName || '—'}</td>
                <td className="p-2 capitalize">{r.leadStatus ? r.leadStatus.replace(/_/g, ' ') : '—'}</td>
                <td className="p-2">
                  {r.paid
                    ? <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Payment already made</Badge>
                    : r.failed
                      ? <div className="flex flex-col gap-1"><Badge variant="destructive">{r.method === 'stripe' ? 'Failed Stripe payment' : 'Failed Bumper payment'}</Badge><span className="text-xs text-muted-foreground" title={r.failed}>{r.failed.length > 40 ? r.failed.slice(0, 40) + '…' : r.failed}</span></div>
                      : <Badge variant="destructive">Not paid — call</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default MissedPaymentsTab;
