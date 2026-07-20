import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PoundSterling, X } from 'lucide-react';

interface Props {
  userRole?: string | null;
  onNavigate?: (tab: string) => void;
}

const MANAGEMENT = new Set(['admin', 'super_admin', 'sales_manager', 'performance_manager']);
const DISMISS_KEY = 'collect_payments_banner_dismissed_at_count';

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

export const CollectPaymentsBanner: React.FC<Props> = ({ userRole, onNavigate }) => {
  const [overdue, setOverdue] = useState(0);
  const [today, setToday] = useState(0);
  const [dismissedCount, setDismissedCountState] = useState<number>(getDismissedCount);

  const load = async () => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('customers')
      .select('payment_due_date')
      .not('payment_due_date', 'is', null)
      .lte('payment_due_date', todayStr);
    if (error) return;
    let o = 0;
    let t = 0;
    (data || []).forEach((r: any) => {
      if (r.payment_due_date === todayStr) t += 1;
      else o += 1;
    });
    setOverdue(o);
    setToday(t);
  };

  useEffect(() => {
    if (!MANAGEMENT.has(userRole || '')) return;
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [userRole]);

  const total = overdue + today;

  const handleDismiss = () => {
    setDismissedCount(total);
    setDismissedCountState(total);
  };

  if (!MANAGEMENT.has(userRole || '')) return null;
  if (total === 0) return null;
  // Only re-show if there are MORE items than when the manager dismissed it.
  if (dismissedCount >= 0 && total <= dismissedCount) return null;

  return (
    <div className="border-b-2 border-red-400 bg-red-50 px-4 py-3 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
            <PoundSterling className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-red-900">
              {total} payment{total === 1 ? '' : 's'} to collect
              {overdue > 0 && (
                <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  {overdue} overdue
                </span>
              )}
              {today > 0 && (
                <span className="ml-1 rounded bg-orange-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  {today} due today
                </span>
              )}
            </div>
            <div className="text-xs text-red-800">
              Customers who agreed to pay by today or earlier. Chase up and mark collected.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => onNavigate?.('collect-payments')}
          >
            Collect payments
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-red-700 hover:bg-red-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollectPaymentsBanner;
