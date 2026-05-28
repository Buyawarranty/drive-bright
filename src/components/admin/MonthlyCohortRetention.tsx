import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { format, startOfMonth, subMonths } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface CohortRow {
  monthKey: string;       // YYYY-MM
  monthLabel: string;     // "Mar 2026"
  sold: number;
  active: number;
  cancelled: number;
  retentionPct: number;
}

const JUNK_STATUSES = new Set([
  'fake lead', 'fake_lead', 'duplicate', 'converted_lead',
]);

interface Props {
  /** Months of history to show (default 12) */
  months?: number;
  /** Show financial role (£ values) — not used here but kept for parity */
  isFinancialRole?: boolean;
}

export const MonthlyCohortRetention: React.FC<Props> = ({ months = 12 }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CohortRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Cut-off = first day of the earliest month we want to show, in UTC.
        const now = new Date();
        const earliest = startOfMonth(subMonths(now, months - 1));
        earliest.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
          .from('customers')
          .select('id, signup_date, created_at, status, is_deleted, is_test_cancellation, final_amount')
          .gte('signup_date', earliest.toISOString())
          .limit(20000);

        if (error) throw error;

        // Initialize bucket map for every month in the window (so empty months still show)
        const buckets = new Map<string, CohortRow>();
        for (let i = months - 1; i >= 0; i--) {
          const d = startOfMonth(subMonths(now, i));
          const key = format(d, 'yyyy-MM');
          buckets.set(key, {
            monthKey: key,
            monthLabel: format(d, 'MMM yyyy'),
            sold: 0,
            active: 0,
            cancelled: 0,
            retentionPct: 0,
          });
        }

        (data || []).forEach((r: any) => {
          const status = (r.status || '').toLowerCase();
          if (JUNK_STATUSES.has(status)) return;
          // Hide test cancellations and trivial historical "test" purchases (< £20)
          if (r.is_test_cancellation) return;
          if ((r.final_amount || 0) < 20) return;

          const signupRaw = r.signup_date || r.created_at;
          if (!signupRaw) return;
          const signupDate = new Date(signupRaw);
          const key = format(startOfMonth(signupDate), 'yyyy-MM');
          const bucket = buckets.get(key);
          if (!bucket) return;

          bucket.sold += 1;
          const isCancelled =
            status === 'cancelled' || status === 'refunded' || r.is_deleted === true;
          if (isCancelled) bucket.cancelled += 1;
          else bucket.active += 1;
        });

        const result = Array.from(buckets.values())
          .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
          .map(b => ({
            ...b,
            retentionPct: b.sold > 0 ? (b.active / b.sold) * 100 : 0,
          }));

        setRows(result);
      } catch (err) {
        console.error('Error loading monthly cohort:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [months]);

  const totals = useMemo(() => {
    const sold = rows.reduce((s, r) => s + r.sold, 0);
    const active = rows.reduce((s, r) => s + r.active, 0);
    const cancelled = rows.reduce((s, r) => s + r.cancelled, 0);
    return { sold, active, cancelled, retention: sold ? (active / sold) * 100 : 0 };
  }, [rows]);

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold">Monthly cohort retention</h2>
          <p className="text-xs text-muted-foreground">
            For each signup month: how many policies are still active vs cancelled (cancelled, refunded, or deleted). Test cancellations and sub-£20 historical test orders are excluded.
          </p>
        </div>
        {!loading && (
          <div className="text-right text-xs text-muted-foreground">
            <div><span className="font-semibold text-foreground">{totals.sold}</span> sold</div>
            <div><span className="font-semibold text-emerald-600">{totals.active}</span> active · <span className="font-semibold text-destructive">{totals.cancelled}</span> cancelled</div>
            <div className="font-semibold text-foreground">{totals.retention.toFixed(1)}% retained</div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading cohort data…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2 pr-3">Signup month</th>
                <th className="text-right py-2 pr-3">Sold</th>
                <th className="text-right py-2 pr-3">Still active</th>
                <th className="text-right py-2 pr-3">Cancelled</th>
                <th className="text-right py-2 pr-3">% retained</th>
                <th className="text-left py-2 pl-3 w-[28%]">Retention</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.monthKey} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2 pr-3 font-medium">{r.monthLabel}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.sold}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-emerald-700 font-semibold">{r.active}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-destructive font-semibold">{r.cancelled}</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold">
                    {r.sold > 0 ? `${r.retentionPct.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-2 pl-3">
                    <div className="h-2 w-full bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${r.sold > 0 ? r.retentionPct : 0}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No data in the last {months} months.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
