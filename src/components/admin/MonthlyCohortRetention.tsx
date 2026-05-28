import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { Card } from '@/components/ui/card';
import { format, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

interface MilestoneCell {
  retained: number;
  cancelled: number;
  pct: number;
  ready: boolean; // true if cohort has had enough elapsed time to evaluate
}

interface CohortRow {
  monthKey: string;       // YYYY-MM
  monthLabel: string;     // "Mar"
  year: number;
  sold: number;
  active: number;         // current still-active
  cancelled: number;      // total cancelled to date
  retentionPct: number;   // current
  d30: MilestoneCell;
  d60: MilestoneCell;
  d90: MilestoneCell;
}

const JUNK_STATUSES = new Set([
  'fake lead', 'fake_lead', 'duplicate', 'converted_lead',
]);

const emptyCell = (): MilestoneCell => ({ retained: 0, cancelled: 0, pct: 0, ready: false });

interface Props {
  /** Optional: limit history in months. Omit to show every month since first signup. */
  months?: number;
}

export const MonthlyCohortRetention: React.FC<Props> = ({ months }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await fetchAllRows<any>(() => {
          let q = supabase
            .from('customers')
            .select('id, signup_date, created_at, updated_at, status, is_deleted, deleted_at, cancellation_note_updated_at, is_test_cancellation, final_amount')
            .order('signup_date', { ascending: true });
          if (months) {
            const earliest = startOfMonth(new Date());
            earliest.setMonth(earliest.getMonth() - (months - 1));
            q = q.gte('signup_date', earliest.toISOString());
          }
          return q;
        });
        if (error) throw error;

        const now = new Date();
        const buckets = new Map<string, CohortRow>();

        (data || []).forEach((r: any) => {
          const status = (r.status || '').toLowerCase();
          if (JUNK_STATUSES.has(status)) return;
          if (r.is_test_cancellation) return;
          if ((r.final_amount || 0) < 20) return;

          const signupRaw = r.signup_date || r.created_at;
          if (!signupRaw) return;
          const signupDate = new Date(signupRaw);
          if (isNaN(signupDate.getTime())) return;
          const monthStart = startOfMonth(signupDate);
          const key = format(monthStart, 'yyyy-MM');

          let bucket = buckets.get(key);
          if (!bucket) {
            bucket = {
              monthKey: key,
              monthLabel: format(monthStart, 'MMM'),
              year: monthStart.getFullYear(),
              sold: 0, active: 0, cancelled: 0, retentionPct: 0,
              d30: emptyCell(), d60: emptyCell(), d90: emptyCell(),
            };
            buckets.set(key, bucket);
          }

          bucket.sold += 1;
          const isCancelled =
            status === 'cancelled' || status === 'refunded' || r.is_deleted === true;
          if (isCancelled) {
            bucket.cancelled += 1;
            // Determine cancellation date
            const cancelRaw = r.deleted_at || r.cancellation_note_updated_at || r.updated_at;
            const cancelDate = cancelRaw ? new Date(cancelRaw) : null;
            if (cancelDate && !isNaN(cancelDate.getTime())) {
              const daysToCancel = (cancelDate.getTime() - signupDate.getTime()) / 86400000;
              if (daysToCancel <= 30) bucket.d30.cancelled += 1;
              if (daysToCancel <= 60) bucket.d60.cancelled += 1;
              if (daysToCancel <= 90) bucket.d90.cancelled += 1;
            }
          } else {
            bucket.active += 1;
          }

          // Mark milestone readiness based on signup age — cohort is "ready" once
          // the latest sale in the month has had the full window to mature.
          // Use end-of-month + window as the bar.
          const cohortMatureBase = endOfMonth(signupDate);
          if (addDays(cohortMatureBase, 30) <= now) bucket.d30.ready = true;
          if (addDays(cohortMatureBase, 60) <= now) bucket.d60.ready = true;
          if (addDays(cohortMatureBase, 90) <= now) bucket.d90.ready = true;
        });

        // Fill in any missing months between earliest and now so gaps show as 0
        if (buckets.size > 0) {
          const keys = Array.from(buckets.keys()).sort();
          const [minY, minM] = keys[0].split('-').map(Number);
          const cursor = new Date(minY, minM - 1, 1);
          const end = new Date(now.getFullYear(), now.getMonth(), 1);
          while (cursor <= end) {
            const k = format(cursor, 'yyyy-MM');
            if (!buckets.has(k)) {
              buckets.set(k, {
                monthKey: k,
                monthLabel: format(cursor, 'MMM'),
                year: cursor.getFullYear(),
                sold: 0, active: 0, cancelled: 0, retentionPct: 0,
                d30: emptyCell(), d60: emptyCell(), d90: emptyCell(),
              });
            }
            cursor.setMonth(cursor.getMonth() + 1);
          }
        }

        const result = Array.from(buckets.values())
          .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
          .map(b => {
            const finalize = (cell: MilestoneCell): MilestoneCell => {
              const retained = Math.max(0, b.sold - cell.cancelled);
              return {
                ...cell,
                retained,
                pct: b.sold > 0 ? (retained / b.sold) * 100 : 0,
              };
            };
            return {
              ...b,
              retentionPct: b.sold > 0 ? (b.active / b.sold) * 100 : 0,
              d30: finalize(b.d30),
              d60: finalize(b.d60),
              d90: finalize(b.d90),
            };
          });

        setRows(result);
      } catch (err) {
        console.error('Error loading monthly cohort:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [months]);

  const grouped = useMemo(() => {
    const byYear = new Map<number, CohortRow[]>();
    rows.forEach(r => {
      if (!byYear.has(r.year)) byYear.set(r.year, []);
      byYear.get(r.year)!.push(r);
    });
    return Array.from(byYear.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, months]) => {
        const sold = months.reduce((s, m) => s + m.sold, 0);
        const active = months.reduce((s, m) => s + m.active, 0);
        const cancelled = months.reduce((s, m) => s + m.cancelled, 0);
        return {
          year,
          months,
          sold,
          active,
          cancelled,
          retention: sold ? (active / sold) * 100 : 0,
        };
      });
  }, [rows]);

  const totals = useMemo(() => {
    const sold = rows.reduce((s, r) => s + r.sold, 0);
    const active = rows.reduce((s, r) => s + r.active, 0);
    const cancelled = rows.reduce((s, r) => s + r.cancelled, 0);
    return { sold, active, cancelled, retention: sold ? (active / sold) * 100 : 0 };
  }, [rows]);

  const toggleYear = (year: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  };

  const renderMilestone = (cell: MilestoneCell, sold: number) => {
    if (sold === 0) return <span className="text-muted-foreground">—</span>;
    if (!cell.ready) {
      // Partial data — show with a "pending" hint
      return (
        <span className="text-muted-foreground" title="Cohort hasn't fully matured yet">
          {cell.pct.toFixed(1)}%<span className="text-[10px] ml-1">*</span>
        </span>
      );
    }
    return <span className="font-semibold">{cell.pct.toFixed(1)}%</span>;
  };

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold">Monthly cohort retention</h2>
          <p className="text-xs text-muted-foreground">
            Every signup month since launch, grouped by year. 30/60/90-day columns show the % of that month's cohort still active at each milestone. An asterisk (*) means the cohort hasn't fully matured yet for that window. Test cancellations and sub-£20 historical test orders are excluded.
          </p>
        </div>
        {!loading && (
          <div className="text-right text-xs text-muted-foreground">
            <div><span className="font-semibold text-foreground">{totals.sold}</span> sold all-time</div>
            <div><span className="font-semibold text-emerald-600">{totals.active}</span> active · <span className="font-semibold text-destructive">{totals.cancelled}</span> cancelled</div>
            <div className="font-semibold text-foreground">{totals.retention.toFixed(1)}% retained today</div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading cohort data…
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground text-sm">No customer data found.</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(g => {
            const isCollapsed = collapsed.has(g.year);
            return (
              <div key={g.year} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleYear(g.year)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted text-left"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <span className="font-semibold">{g.year}</span>
                    <span className="text-xs text-muted-foreground">({g.months.length} months)</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3">
                    <span><span className="font-semibold text-foreground">{g.sold}</span> sold</span>
                    <span><span className="font-semibold text-emerald-600">{g.active}</span> active</span>
                    <span><span className="font-semibold text-destructive">{g.cancelled}</span> cancelled</span>
                    <span className="font-semibold text-foreground">{g.retention.toFixed(1)}% retained today</span>
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-muted-foreground border-b">
                        <tr>
                          <th className="text-left py-2 pr-3 pl-3">Month</th>
                          <th className="text-right py-2 pr-3">Sold</th>
                          <th className="text-right py-2 pr-3">30d retained</th>
                          <th className="text-right py-2 pr-3">60d retained</th>
                          <th className="text-right py-2 pr-3">90d retained</th>
                          <th className="text-right py-2 pr-3">Still active today</th>
                          <th className="text-right py-2 pr-3">Cancelled total</th>
                          <th className="text-right py-2 pr-3">% retained today</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.months.map(r => (
                          <tr key={r.monthKey} className="border-b last:border-0 hover:bg-muted/40">
                            <td className="py-2 pr-3 pl-3 font-medium">{r.monthLabel}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{r.sold}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{renderMilestone(r.d30, r.sold)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{renderMilestone(r.d60, r.sold)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{renderMilestone(r.d90, r.sold)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-emerald-700 font-semibold">{r.active}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-destructive font-semibold">{r.cancelled}</td>
                            <td className="py-2 pr-3 text-right tabular-nums font-semibold">
                              {r.sold > 0 ? `${r.retentionPct.toFixed(1)}%` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
