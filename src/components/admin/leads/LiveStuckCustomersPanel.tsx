import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Phone, RefreshCw, Copy } from 'lucide-react';
import { setVisibleInterval } from '@/lib/visibilityInterval';
import { isTestStruggle } from '@/lib/checkoutStruggleTest';

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

// Sandbox / staff test traffic — never shown as a live stuck customer.
const isTestRow = (r: StuckRow): boolean => isTestStruggle(r);

const minsAgo = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

/**
 * Live customers stuck in checkout right now — real website traffic only.
 * Visible to every agent, read-only (only managers resolve, via the top banner).
 */
export const LiveStuckCustomersPanel: React.FC = () => {
  const [rows, setRows] = useState<StuckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('checkout_struggle_alerts')
      .select('id, signal_type, status, created_at, customer_name, customer_email, customer_phone, vehicle_reg, device_type, payment_method, plan_name, amount')
      .in('status', ['active', 'acknowledged'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50);
    setRows((data as StuckRow[]) || []);
    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('live-stuck-customers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkout_struggle_alerts' }, () => load())
      .subscribe();
    const stop = setVisibleInterval(load, 45_000);
    return () => {
      supabase.removeChannel(channel);
      stop();
    };
  }, [load]);

  const live = useMemo(() => rows.filter((r) => !isTestRow(r)), [rows]);

  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50/60 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-red-200 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div>
            <h3 className="text-base font-bold text-red-800">Live customers stuck on checkout</h3>
            <p className="text-xs text-red-700/80">
              Real website visitors from the last hour — test and sandbox traffic is filtered out. Any agent can call.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-red-800 bg-red-100 border border-red-200 rounded px-2 py-1">
            {live.length} live
          </span>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-800 border border-red-300 bg-white rounded px-2 py-1 hover:bg-red-100"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          {updatedAt && (
            <span className="text-[11px] text-red-700/70">updated {updatedAt.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-4 text-sm text-red-800/70">Loading live checkouts…</div>
      ) : live.length === 0 ? (
        <div className="px-4 py-4 text-sm text-red-800/70">
          No live customers stuck on checkout right now.
        </div>
      ) : (
        <ul className="divide-y divide-red-200">
          {live.map((r) => {
            const tel = r.customer_phone ? `tel:${r.customer_phone.replace(/\s/g, '')}` : null;
            return (
              <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {r.customer_name || r.customer_email || r.customer_phone || 'Customer'}
                    <span className="ml-2 font-medium text-red-700">
                      {SIGNAL_LABELS[r.signal_type] || r.signal_type}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 truncate">
                    {[
                      r.vehicle_reg ? r.vehicle_reg.toUpperCase() : null,
                      r.plan_name,
                      r.payment_method,
                      r.device_type,
                      r.amount ? `£${r.amount}` : null,
                      `${minsAgo(r.created_at)}m ago`,
                      r.status === 'acknowledged' ? 'already picked up' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {r.customer_email && (
                    <div className="text-xs text-gray-500 truncate">{r.customer_email}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tel ? (
                    <>
                      <a
                        href={tel}
                        className="inline-flex items-center gap-1.5 bg-red-600 text-white text-sm font-bold px-3 py-1.5 rounded hover:bg-red-700"
                      >
                        <Phone className="h-3.5 w-3.5" /> Call now
                      </a>
                      <button
                        onClick={() => navigator.clipboard.writeText((r.customer_phone || '').replace(/\s/g, '')).catch(() => {})}
                        className="p-1.5 rounded border border-red-300 bg-white hover:bg-red-100"
                        title="Copy phone number"
                        aria-label="Copy phone number"
                      >
                        <Copy className="h-4 w-4 text-red-700" />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500">No phone captured</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default LiveStuckCustomersPanel;
