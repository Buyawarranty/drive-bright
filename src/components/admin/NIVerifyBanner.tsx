import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import { isNorthernIrelandPlate } from '@/lib/niPlate';
import { setVisibleInterval } from '@/lib/visibilityInterval';

interface Props {
  userRole?: string | null;
  onNavigate?: (tab: string) => void;
}

const ALLOWED = new Set([
  'admin', 'super_admin', 'sales_manager', 'performance_manager',
  'sales_lead', 'sales', 'claims', 'claims_manager',
]);

const DISMISS_KEY = 'ni_verify_banner_dismissed_at_count';

const getDismissedCount = (): number => {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    return v !== null ? parseInt(v, 10) : -1;
  } catch {
    return -1;
  }
};

const setDismissedCount = (n: number) => {
  try { localStorage.setItem(DISMISS_KEY, String(n)); } catch {}
};

/**
 * PERFORMANCE: this count comes from a leading-wildcard `ilike` on `customers`,
 * which can only be answered by scanning the table — and it ran every 60s in
 * every open CRM tab (100k+ calls in the query stats). The number of NI vehicles
 * awaiting verification changes a handful of times a day, so the result is now
 * shared across every mounted banner and refreshed every 10 minutes.
 */
const NI_CACHE_TTL_MS = 10 * 60_000;
let _niCache: { at: number; count: number } | null = null;
let _niInflight: Promise<number> | null = null;

const fetchNiCount = (): Promise<number> => {
  if (_niCache && Date.now() - _niCache.at < NI_CACHE_TTL_MS) {
    return Promise.resolve(_niCache.count);
  }
  if (_niInflight) return _niInflight;
  _niInflight = (async () => {
    try {
      // NI plates start with letters containing I or Z. Do a broad server-side
      // filter (contains I or Z anywhere) then refine client-side with regex.
      const { data, error } = await supabase
        .from('customers')
        .select('registration_plate')
        .eq('ni_verified', false)
        .eq('is_deleted', false)
        .or('registration_plate.ilike.%I%,registration_plate.ilike.%Z%')
        .limit(1000);
      if (error) return _niCache?.count ?? 0;
      const n = (data || []).filter((r: any) => isNorthernIrelandPlate(r.registration_plate)).length;
      _niCache = { at: Date.now(), count: n };
      return n;
    } finally {
      _niInflight = null;
    }
  })();
  return _niInflight;
};

export const NIVerifyBanner: React.FC<Props> = ({ userRole, onNavigate }) => {
  const [count, setCount] = useState(_niCache?.count ?? 0);
  const [dismissedCount, setDismissedCountState] = useState<number>(getDismissedCount);

  useEffect(() => {
    if (!ALLOWED.has(userRole || '')) return;
    let cancelled = false;
    const load = async () => {
      const n = await fetchNiCount();
      if (!cancelled) setCount(n);
    };
    load();
    const stop = setVisibleInterval(load, NI_CACHE_TTL_MS);
    return () => { cancelled = true; stop(); };
  }, [userRole]);

  const handleDismiss = () => {
    setDismissedCount(count);
    setDismissedCountState(count);
  };

  if (!ALLOWED.has(userRole || '')) return null;
  if (count === 0) return null;
  // Only re-show if there are MORE NI vehicles than when it was dismissed.
  if (dismissedCount >= 0 && count <= dismissedCount) return null;

  return (
    <div className="border-b-2 border-amber-500 bg-amber-50 px-4 py-3 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-amber-900">
              {count} Northern Ireland vehicle{count === 1 ? '' : 's'} to VERIFY
            </div>
            <div className="text-xs text-amber-800">
              NI plates aren't on DVLA — manually confirm make/model/year with the customer,
              then click <span className="font-semibold">Mark verified</span> on the row.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => onNavigate?.('customers')}
          >
            Review NI vehicles
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-amber-800 hover:bg-amber-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NIVerifyBanner;
