import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CheckoutStruggle {
  id: string;
  signal_type: string;
  status: string;
  created_at: string;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_reg: string | null;
}

const normEmail = (v?: string | null) => (v || '').trim().toLowerCase();
const normPhone = (v?: string | null) => (v || '').replace(/\D/g, '').replace(/^44/, '0');
const normReg = (v?: string | null) => (v || '').replace(/\s/g, '').toUpperCase();

/**
 * Fetch checkout struggle alerts from the last 24h (any status).
 * Useful for badging Live Leads rows that match by email/phone/reg.
 */
export function useActiveCheckoutStruggles(windowMinutes = 60 * 24) {
  const [struggles, setStruggles] = useState<CheckoutStruggle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('checkout_struggle_alerts')
      .select('id, signal_type, status, created_at, customer_email, customer_phone, vehicle_reg')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);
    setStruggles((data as CheckoutStruggle[]) || []);
    setLoading(false);
  }, [windowMinutes]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('active-checkout-struggles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checkout_struggle_alerts' },
        () => fetchData()
      )
      .subscribe();
    const t = window.setInterval(fetchData, 60_000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(t);
    };
  }, [fetchData]);

  return { struggles, loading, refresh: fetchData };
}

/**
 * Build a Map from lead.id -> most-recent struggle, matched by normalized
 * email / phone / vehicle_reg.
 */
export function buildStruggleByLeadId<
  L extends { id: string; email: string | null; phone: string | null; vehicle_reg: string | null }
>(leads: L[], struggles: CheckoutStruggle[]): Map<string, CheckoutStruggle> {
  const byEmail = new Map<string, CheckoutStruggle>();
  const byPhone = new Map<string, CheckoutStruggle>();
  const byReg = new Map<string, CheckoutStruggle>();
  // struggles already ordered newest first; keep the first occurrence per key
  for (const s of struggles) {
    const e = normEmail(s.customer_email);
    const p = normPhone(s.customer_phone);
    const r = normReg(s.vehicle_reg);
    if (e && !byEmail.has(e)) byEmail.set(e, s);
    if (p && !byPhone.has(p)) byPhone.set(p, s);
    if (r && !byReg.has(r)) byReg.set(r, s);
  }
  const out = new Map<string, CheckoutStruggle>();
  for (const l of leads) {
    const match =
      byEmail.get(normEmail(l.email)) ||
      byPhone.get(normPhone(l.phone)) ||
      byReg.get(normReg(l.vehicle_reg));
    if (match) out.set(l.id, match);
  }
  return out;
}
