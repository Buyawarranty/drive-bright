import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type FailedPayment = {
  key: string;
  at: string;
  method: 'stripe' | 'bumper';
  email: string;
  reg: string;
  name: string;
  phone: string;
  amount: number | null;
  reason: string;
  leadId?: string;
  ownerName?: string;
  leadStatus?: string;
};

const norm = (s?: string | null) => (s || '').trim().toLowerCase();
const normReg = (s?: string | null) => (s || '').replace(/\s+/g, '').toUpperCase();

/** Failed Stripe + Bumper payments since `sinceMs`, with the lead owner resolved. */
export async function fetchFailedPayments(sinceMs: number): Promise<FailedPayment[]> {
  const since = new Date(sinceMs).toISOString();
  const [sRes, bRes] = await Promise.all([
    (supabase as any).from('stripe_payment_failures').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
    supabase.from('bumper_transactions').select('id, created_at, customer_data, vehicle_data, final_amount, status')
      .eq('status', 'failed').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
  ]);
  const list: FailedPayment[] = [];
  for (const f of (sRes.data || []) as any[]) {
    list.push({
      key: `s-${f.id}`, at: f.created_at, method: 'stripe', email: norm(f.email), reg: normReg(f.vehicle_reg),
      name: '', phone: f.phone || '', amount: f.amount,
      reason: f.event_type === 'checkout.session.expired' ? 'Abandoned checkout' : (f.failure_message || 'Card declined'),
    });
  }
  for (const b of (bRes.data || []) as any[]) {
    const cd: any = b.customer_data || {}; const vd: any = b.vehicle_data || {};
    list.push({
      key: `b-${b.id}`, at: b.created_at, method: 'bumper', email: norm(cd.email),
      reg: normReg(vd.regNumber || vd.reg || cd.vehicle_reg),
      name: [cd.first_name, cd.last_name].filter(Boolean).join(' ') || cd.fullName || cd.name || '',
      phone: cd.mobile || cd.phone || '', amount: b.final_amount, reason: 'Bumper declined',
    });
  }
  const emails = [...new Set(list.map(r => r.email).filter(Boolean))];
  if (emails.length) {
    const { data: leads } = await supabase.from('sales_leads')
      .select('id, email, first_name, last_name, assigned_to, status, created_at')
      .in('email', emails.slice(0, 300)).order('created_at', { ascending: false });
    const ownerIds = [...new Set((leads || []).map((l: any) => l.assigned_to).filter(Boolean))];
    const { data: admins } = ownerIds.length
      ? await supabase.from('admin_users').select('id, first_name, last_name, email').in('id', ownerIds as string[])
      : { data: [] as any[] };
    const nameOf = (id?: string | null) => {
      const a: any = (admins || []).find((x: any) => x.id === id);
      return a ? ([a.first_name, a.last_name].filter(Boolean).join(' ') || a.email) : undefined;
    };
    for (const r of list) {
      const l: any = (leads || []).find((x: any) => norm(x.email) === r.email);
      if (!l) continue;
      r.leadId = l.id; r.leadStatus = l.status; r.ownerName = nameOf(l.assigned_to);
      r.name ||= [l.first_name, l.last_name].filter(Boolean).join(' ');
    }
  }
  return list.sort((a, b) => b.at.localeCompare(a.at));
}

export function useFailedPayments(sinceMs: number, pollMs = 60000) {
  const [items, setItems] = useState<FailedPayment[]>([]);
  const load = useCallback(async () => {
    try { setItems(await fetchFailedPayments(sinceMs)); } catch { /* ignore */ }
  }, [sinceMs]);
  useEffect(() => {
    load();
    const t = window.setInterval(load, pollMs);
    return () => window.clearInterval(t);
  }, [load, pollMs]);
  return { items, reload: load };
}
