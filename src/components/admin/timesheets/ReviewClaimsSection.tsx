import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Star, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ReviewClaimsSectionProps {
  currentMonth: Date;
  /** Auth user id of the staff member whose timesheet is being viewed. */
  viewingUserId?: string;
}

type ClaimRow = {
  id: string;
  kind: string;
  week_start: string;
  customer_name: string | null;
  registration_plate?: string | null;
  channel: string | null;
  notes: string | null;
  created_at: string;
};

const POSITIVE_BONUS = 5;
const NEGATIVE_BONUS = 10;

const KIND_LABEL: Record<string, string> = {
  positive: 'Positive review',
  negative_removed: 'Negative removed',
};

const KIND_CHIP: Record<string, string> = {
  positive: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  negative_removed: 'bg-sky-50 text-sky-800 border-sky-200',
};

/**
 * Trustpilot review claims journalled into the timesheet — every named review an
 * agent logged (or negative review removed) in New Leads, with its bonus value.
 */
export const ReviewClaimsSection: React.FC<ReviewClaimsSectionProps> = ({ currentMonth, viewingUserId }) => {
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let adminId: string | null = null;
      const authUserId = viewingUserId || (await supabase.auth.getUser()).data.user?.id || null;
      if (authUserId) {
        const { data } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', authUserId)
          .maybeSingle();
        adminId = (data as any)?.id ?? null;
      }
      if (!adminId) {
        setRows([]);
        return;
      }
      const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const { data } = await (supabase as any)
        .from('agent_review_claims')
        .select('id, kind, week_start, customer_name, registration_plate, channel, notes, created_at')
        .eq('admin_user_id', adminId)
        .gte('week_start', from)
        .lte('week_start', to)
        .order('created_at', { ascending: false });
      setRows(((data as ClaimRow[]) || []).filter(Boolean));
    } finally {
      setLoading(false);
    }
  }, [currentMonth, viewingUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const positive = rows.filter((r) => r.kind === 'positive').length;
    const negative = rows.filter((r) => r.kind === 'negative_removed').length;
    return { positive, negative, bonus: positive * POSITIVE_BONUS + negative * NEGATIVE_BONUS };
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            Review bonus log
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {format(currentMonth, 'MMMM yyyy')} · {rows.length} logged · £{totals.bonus}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading review log…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No reviews logged this month. Reviews you tick in New Leads (named reviews you asked for, or negative
            reviews removed) appear here with their bonus value.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium', KIND_CHIP.positive)}>
                Positive · {totals.positive} × £{POSITIVE_BONUS}
              </span>
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium', KIND_CHIP.negative_removed)}>
                Negative removed · {totals.negative} × £{NEGATIVE_BONUS}
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Logged</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Week</th>
                    <th className="px-3 py-2 text-right font-medium">Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{format(new Date(r.created_at), 'EEE d MMM')}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                            KIND_CHIP[r.kind] ?? KIND_CHIP.positive,
                          )}
                        >
                          {KIND_LABEL[r.kind] ?? r.kind}
                        </span>
                        {r.customer_name ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {r.customer_name}
                            {r.registration_plate ? ` · ${r.registration_plate}` : ''}
                          </span>
                        ) : null}
                        {r.channel ? <span className="ml-2 text-xs text-muted-foreground">· {r.channel}</span> : null}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        w/c {format(new Date(r.week_start), 'd MMM')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        £{r.kind === 'negative_removed' ? NEGATIVE_BONUS : POSITIVE_BONUS}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ReviewClaimsSection;
