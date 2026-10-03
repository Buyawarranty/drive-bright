import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { pushRecentAlert } from '@/lib/recentAlerts';
import { supabase } from '@/integrations/supabase/client';
import { Tag, Phone, X, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { setVisibleInterval } from '@/lib/visibilityInterval';
import { AlertRailSlot, ALERT_RAIL_ORDER } from '@/components/admin/AlertRail';

const DISMISSED_KEY = 'price-beat-alert-dismissed-ids';

interface Row {
  id: string;
  phone: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  cart_metadata: any;
  created_at: string;
}

const readDismissed = (): string[] => {
  try { const p = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); return Array.isArray(p) ? p : []; } catch { return []; }
};

const fmtPhone = (p: string) => {
  const d = p.replace(/\D/g, '').replace(/^44/, '0');
  return d.length === 11 ? `${d.slice(0, 5)} ${d.slice(5)}` : p;
};

/** Live Alerts card: a customer submitted the Price Beat Guarantee form. */
export const PriceBeatRequestAlert: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('abandoned_carts')
      .select('id, phone, vehicle_reg, vehicle_make, vehicle_model, cart_metadata, created_at')
      .eq('full_name', 'Price Match Request')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(30);
    setRows(((data as Row[]) || []).filter((r) => r.cart_metadata?.source === 'price_beat_banner'));
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`price-beat-alert-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'abandoned_carts' }, () => load())
      .subscribe();
    const stop = setVisibleInterval(load, 60_000);
    return () => { supabase.removeChannel(ch); stop(); };
  }, [load]);

  const live = useMemo(() => rows.filter((r) => !dismissed.includes(r.id)), [rows, dismissed]);

  const dismiss = (id: string) => {
    const r = rows.find((x) => x.id === id);
    if (r) pushRecentAlert({ key: `price-beat-${id}`, title: 'Price beat request', detail: `${r.vehicle_reg || 'No reg'} – ${r.phone || ''}`, tone: 'orange' });
    setDismissed((prev) => {
      const next = [...new Set([...prev, id])].slice(-200);
      try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  if (live.length === 0) return null;

  return (
    <AlertRailSlot order={ALERT_RAIL_ORDER.priceBeat}>
      <div className="rounded-xl border border-orange-200 border-l-4 border-l-orange-500 bg-orange-50 text-gray-900 shadow-sm overflow-hidden">
        <div className="flex items-start justify-between gap-2 px-3 py-2">
          <button onClick={() => setExpanded((v) => !v)} className="flex items-start gap-2 text-left min-w-0">
            <Tag className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">
                {live.length === 1 ? 'Price beat request' : `${live.length} price beat requests`}
              </p>
              <p className="text-[11px] text-gray-600">Customer wants us to beat a quote · call back</p>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 mt-0.5 shrink-0" /> : <ChevronDown className="h-4 w-4 mt-0.5 shrink-0" />}
          </button>
          <button onClick={() => live.forEach((r) => dismiss(r.id))} aria-label="Dismiss" className="shrink-0 rounded p-0.5 hover:bg-orange-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {expanded && (
          <div className="space-y-2 px-3 pb-3">
            {live.map((r) => {
              const m = r.cart_metadata || {};
              return (
                <div key={r.id} className="rounded bg-white border border-orange-100 px-2 py-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {r.vehicle_reg && <span className="font-mono text-[11px] bg-yellow-200 px-1.5 py-0.5 rounded">{r.vehicle_reg}</span>}
                    <span className="text-[11px] text-gray-700">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                    <button onClick={() => dismiss(r.id)} className="ml-auto text-[11px] text-gray-500 hover:underline">Dismiss</button>
                  </div>
                  <p className="text-sm font-semibold mt-1">{[r.vehicle_make, r.vehicle_model].filter(Boolean).join(' ') || 'Vehicle'}</p>
                  <p className="text-[12px] text-gray-700">
                    Competitor: {m.competitorPrice ? `£${m.competitorPrice} ${m.competitorPriceMode === 'total' ? 'total' : '/mo'}` : 'not given'}
                    {m.currentMonthlyPrice ? ` · Our quote £${m.currentMonthlyPrice}/mo` : ''}
                  </p>
                  {r.phone && (
                    <a href={`tel:${r.phone}`} className="mt-1.5 inline-flex items-center gap-1 rounded bg-orange-500 text-white text-xs font-semibold px-2 py-1 hover:bg-orange-600">
                      <Phone className="h-3 w-3" /> Call now: {fmtPhone(r.phone)}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AlertRailSlot>
  );
};
