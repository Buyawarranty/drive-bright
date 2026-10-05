import React, { useEffect, useMemo, useState } from 'react';
import { BadgePercent, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDiscountAuthRequests } from '@/hooks/useDiscountAuthRequests';
import { pushRecentAlert } from '@/lib/recentAlerts';

/**
 * Management Live Alert: a discount over 30% has been authorised but the agent
 * has not yet confirmed the payment. Clears itself once a sale for that
 * registration is recorded after the approval.
 */
const norm = (s?: string | null) => (s || '').replace(/\s/g, '').toUpperCase();
const DISMISS_KEY = 'bw:discount-pending-dismissed';

export const DiscountPaymentPendingAlert: React.FC<{ userRole?: string | null }> = ({ userRole }) => {
  const { requests } = useDiscountAuthRequests(userRole) as any;
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]'); } catch { return []; }
  });

  const approved = useMemo(
    () => ((requests || []) as any[]).filter(
      (r) => r.status === 'approved' && (r.request_type || 'discount') === 'discount' && r.registration_plate,
    ),
    [requests],
  );

  useEffect(() => {
    if (!approved.length) return;
    let cancelled = false;
    (async () => {
      const done = new Set<string>();
      for (const r of approved) {
        const { data } = await supabase
          .from('customers')
          .select('id, registration_plate')
          .ilike('registration_plate', `%${norm(r.registration_plate).split('').join('%')}%`)
          .gte('created_at', r.decided_at || r.created_at)
          .limit(1);
        if ((data || []).length) done.add(r.id);
      }
      if (!cancelled) setPaidIds(done);
    })();
    return () => { cancelled = true; };
  }, [approved]);

  const pending = approved.filter((r) => !paidIds.has(r.id) && !dismissed.includes(r.id));
  if (!pending.length) return null;

  const dismiss = (r: any) => {
    const next = [...dismissed, r.id];
    setDismissed(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next.slice(-100))); } catch { /* ignore */ }
    pushRecentAlert({
      key: `discount-pending-${r.id}`,
      title: 'Discount authorised · payment pending',
      detail: `${r.registration_plate} · ${r.requested_by_name || 'Agent'}`,
      tone: 'amber',
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {pending.map((r) => (
        <div key={r.id} className="relative rounded-xl border border-l-4 border-amber-200 border-l-amber-500 bg-amber-50 px-3 py-2 text-sm shadow-sm">
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(r)} className="absolute right-1.5 top-1.5 rounded p-1 text-amber-700 hover:bg-amber-100">
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-start gap-2 pr-5">
            <BadgePercent className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <div className="font-semibold text-amber-900">Discount authorised · payment pending</div>
              <div className="text-xs text-amber-800">
                {r.registration_plate} · {r.requested_by_name || 'Agent'}
                {r.requested_price ? ` · £${Math.round(Number(r.requested_price))}` : ''}
                {r.discount_pct ? ` (${Math.round(Number(r.discount_pct))}% off)` : ''}
              </div>
              <div className="text-[11px] text-amber-700">
                Authorised by {r.decided_by_name || 'Management'}
                {r.decided_at ? ` at ${new Date(r.decided_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}` : ''} — waiting for the agent to confirm payment.
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DiscountPaymentPendingAlert;
