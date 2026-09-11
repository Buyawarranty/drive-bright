import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Phone, Copy, Mail, X, ChevronDown, ChevronUp, UserCircle2 } from 'lucide-react';
import { setVisibleInterval } from '@/lib/visibilityInterval';
import { isTestStruggle } from '@/lib/checkoutStruggleTest';
import { getContactCadence } from '@/lib/checkoutContactCadence';
import { AlertRailSlot, ALERT_RAIL_ORDER } from '@/components/admin/AlertRail';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';

const DISMISSED_IDS_KEY = 'stuck-checkout-alert-dismissed-ids';

const tail9 = (p?: string | null) => (p || '').replace(/\D/g, '').slice(-9);

/** alert id → the admin_user id that owns the matching lead (null = unassigned/none). */
type OwnerMap = Record<string, string | null>;

interface StuckRow {
  id: string;
  signal_type: string;
  status: string;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_reg: string | null;
  device_type: string | null;
  payment_method: string | null;
  plan_name: string | null;
  amount: number | null;
}

const SIGNAL_LABELS: Record<string, string> = {
  idle_timeout: 'idle on checkout',
  long_dwell: 'stuck on checkout',
  payment_failed: 'payment failed',
  multi_attempt: 'multiple payment attempts',
  method_thrash: 'toggling payment methods',
  bumper_cancelled: 'cancelled Bumper checkout',
};

const minsAgo = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

const readDismissed = (): string[] => {
  try {
    const raw = localStorage.getItem(DISMISSED_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Live "customer stuck on checkout" pop-up.
 *
 * Portals into the single left-hand alert rail (same place as the new-lead
 * cards, ordered BELOW them so it never covers one) so every agent sees it
 * whatever tab or section of the dashboard they are on.
 */
export const StuckCheckoutAlert: React.FC = () => {
  const [rows, setRows] = useState<StuckRow[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => readDismissed());
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('checkout_struggle_alerts')
      .select('id, signal_type, status, created_at, customer_name, customer_email, customer_phone, vehicle_reg, device_type, payment_method, plan_name, amount')
      .in('status', ['active', 'acknowledged'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50);
    setRows((data as StuckRow[]) || []);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('stuck-checkout-alert')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkout_struggle_alerts' }, () => load())
      .subscribe();
    const stop = setVisibleInterval(load, 45_000);
    return () => {
      supabase.removeChannel(channel);
      stop();
    };
  }, [load]);

  const live = useMemo(
    () => rows.filter((r) => !isTestStruggle(r) && !dismissedIds.includes(r.id)),
    [rows, dismissedIds],
  );

  const dismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = [...new Set([...prev, id])].slice(-200);
      try { localStorage.setItem(DISMISSED_IDS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const dismissAll = () => {
    live.forEach((r) => dismiss(r.id));
  };

  if (live.length === 0) return null;

  const readyToCall = live.filter((r) => getContactCadence(r.created_at).canCall).length;

  return (
    <AlertRailSlot order={ALERT_RAIL_ORDER.stuckCheckout}>
      <div className="rounded-lg border-2 border-red-500 bg-red-600 text-white shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-2 px-3 py-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-start gap-2 text-left min-w-0"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">
                {live.length === 1 ? 'Customer stuck on checkout' : `${live.length} customers stuck on checkout`}
              </p>
              <p className="text-[11px] text-red-100">{readyToCall} ready to call now</p>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 mt-0.5 shrink-0" /> : <ChevronDown className="h-4 w-4 mt-0.5 shrink-0" />}
          </button>
          <button
            onClick={dismissAll}
            className="p-1 rounded hover:bg-red-700 shrink-0"
            title="Close"
            aria-label="Close stuck checkout alert"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {expanded && (
          <ul className="bg-white text-gray-900 divide-y divide-red-100 max-h-[45vh] overflow-y-auto">
            {live.slice(0, 6).map((r) => {
              const cadence = getContactCadence(r.created_at);
              const phone = (r.customer_phone || '').replace(/\s/g, '');
              const mailto = r.customer_email
                ? `mailto:${r.customer_email}?subject=${encodeURIComponent('Need any help finishing your warranty purchase?')}&body=${encodeURIComponent(
                    'Hi,\n\nWe noticed you were part-way through your warranty purchase. Need any help completing it? We are here if you have any questions.\n\nBuy A Warranty',
                  )}`
                : null;
              return (
                <li key={r.id} className="px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {r.customer_name || r.customer_email || r.customer_phone || 'Customer'}
                      </p>
                      <p className="text-[11px] text-red-700 font-medium truncate">
                        {SIGNAL_LABELS[r.signal_type] || r.signal_type} · {minsAgo(r.created_at)}m ago
                      </p>
                      <p className="text-[11px] text-gray-600 truncate">
                        {[r.vehicle_reg ? r.vehicle_reg.toUpperCase() : null, r.plan_name, r.amount ? `£${r.amount}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <span className={`inline-block mt-1 text-[10px] font-semibold border rounded-full px-2 py-0.5 ${cadence.chipClass}`}>
                        {cadence.label}
                      </span>
                    </div>
                    <button
                      onClick={() => dismiss(r.id)}
                      className="p-1 rounded hover:bg-red-50 shrink-0"
                      title="Dismiss"
                      aria-label="Dismiss this alert"
                    >
                      <X className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {phone && cadence.canCall && (
                      <a
                        href={`tel:${phone}`}
                        className="inline-flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded hover:bg-red-700"
                      >
                        <Phone className="h-3 w-3" /> Call now
                      </a>
                    )}
                    {phone && !cadence.canCall && (
                      <span className="text-[11px] text-gray-500" title={cadence.action}>
                        {cadence.stage === 'lead' ? 'No more calls' : 'Too early to call'}
                      </span>
                    )}
                    {mailto && !cadence.canCall && (
                      <a
                        href={mailto}
                        className="inline-flex items-center gap-1 bg-white text-amber-900 border border-amber-300 text-xs font-semibold px-2 py-1 rounded hover:bg-amber-50"
                      >
                        <Mail className="h-3 w-3" /> Nudge
                      </a>
                    )}
                    {phone && (
                      <button
                        onClick={() => navigator.clipboard.writeText(phone).catch(() => {})}
                        className="p-1 rounded border border-red-200 bg-white hover:bg-red-50"
                        title="Copy phone number"
                        aria-label="Copy phone number"
                      >
                        <Copy className="h-3.5 w-3.5 text-red-700" />
                      </button>
                    )}
                    {!phone && <span className="text-[11px] text-gray-500">No phone captured</span>}
                  </div>
                </li>
              );
            })}
            {live.length > 6 && (
              <li className="px-3 py-1.5 text-[11px] text-gray-600">+{live.length - 6} more waiting</li>
            )}
          </ul>
        )}
      </div>
    </AlertRailSlot>
  );
};

export default StuckCheckoutAlert;
