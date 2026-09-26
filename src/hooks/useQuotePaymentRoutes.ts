import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Agent-confirmed sales land in `customers` without a stripe_session_id or
 * bumper_order_id, so the Payment column used to label every one of them
 * "Manual" — even when the customer actually paid on a Stripe link, Bumper or
 * Payment Assist. The real route is recorded on the matching `live_quotes` row
 * (payment_source from Confirm External Payment, payment_method from paid quote
 * links), so we look it up by registration plate and surface it.
 *
 * Display only — no pricing, payment or fulfilment logic is affected.
 */

const normReg = (reg?: string | null) => (reg || '').toUpperCase().replace(/\s+/g, '');

export const PAYMENT_ROUTE_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  stripe_dashboard: 'Stripe',
  bumper: 'Bumper',
  bumper_portal: 'Bumper',
  payment_assist: 'Payment Assist',
  paybetter: 'PayBetter',
  klarna: 'Klarna',
  ivendi: 'iVendi',
  zopa: 'Zopa',
  payl8r: 'Payl8r',
  paypal: 'PayPal',
  bank_transfer: 'Bank transfer',
  phone_card: 'Card by phone',
  dealer_portal: 'Dealer portal',
  external: 'Manual',
  other: 'Manual',
};

export function labelForRoute(route?: string | null): string | null {
  if (!route) return null;
  const key = String(route).toLowerCase();
  return PAYMENT_ROUTE_LABELS[key] ?? null;
}

export function useQuotePaymentRoutes(regs: (string | null | undefined)[]) {
  const [routes, setRoutes] = useState<Record<string, string>>({});
  const key = Array.from(new Set(regs.map(normReg).filter(Boolean))).sort().join(',');

  useEffect(() => {
    const plates = key ? key.split(',') : [];
    if (plates.length === 0) {
      setRoutes({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('live_quotes')
          .select('vehicle_reg, payment_source, payment_method, status, paid_at')
          .in('status', ['paid', 'paid_externally'])
          .order('paid_at', { ascending: false, nullsFirst: false })
          .limit(2000);
        if (cancelled) return;
        const wanted = new Set(plates);
        const map: Record<string, string> = {};
        (data ?? []).forEach((q: any) => {
          const reg = normReg(q.vehicle_reg);
          if (!reg || !wanted.has(reg) || map[reg]) return;
          const route = labelForRoute(q.payment_source) || labelForRoute(q.payment_method);
          if (route) map[reg] = route;
        });
        setRoutes(map);
      } catch {
        // Non-critical: fall back to the existing badge behaviour.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { routeForReg: (reg?: string | null) => routes[normReg(reg)] ?? null };
}
