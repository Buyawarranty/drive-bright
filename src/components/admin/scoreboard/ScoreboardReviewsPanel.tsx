import React, { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Star, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

const POSITIVE_BONUS = 5;
const NEGATIVE_BONUS = 10;

interface Props {
  /** Month being viewed on the scoreboard. */
  monthDate: Date;
  /** Agents currently visible on the scoreboard (team / focus filtered). */
  agents: { id: string; name: string }[];
}

type Row = { admin_user_id: string; kind: string };

/**
 * Trustpilot review bonus per agent for the selected month — positive reviews
 * they logged and negative reviews they had removed in New Leads.
 */
export const ScoreboardReviewsPanel: React.FC<Props> = ({ monthDate, agents }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const from = format(startOfMonth(monthDate), 'yyyy-MM-dd');
  const to = format(endOfMonth(monthDate), 'yyyy-MM-dd');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const { data } = await (supabase as any)
          .from('agent_review_claims')
          .select('admin_user_id, kind')
          .gte('week_start', from)
          .lte('week_start', to);
        if (!cancelled) setRows(((data as Row[]) || []).filter(Boolean));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [from, to]);

  const perAgent = useMemo(() => {
    const map = new Map<string, { positive: number; negative: number }>();
    rows.forEach(r => {
      if (!r.admin_user_id) return;
      const cur = map.get(r.admin_user_id) || { positive: 0, negative: 0 };
      if (r.kind === 'negative_removed') cur.negative += 1;
      else cur.positive += 1;
      map.set(r.admin_user_id, cur);
    });
    return agents
      .map(a => {
        const c = map.get(a.id) || { positive: 0, negative: 0 };
        return { ...a, ...c, bonus: c.positive * POSITIVE_BONUS + c.negative * NEGATIVE_BONUS };
      })
      .filter(a => a.positive > 0 || a.negative > 0)
      .sort((a, b) => b.bonus - a.bonus || b.positive - a.positive);
  }, [rows, agents]);

  const totals = useMemo(
    () => perAgent.reduce(
      (acc, a) => ({ positive: acc.positive + a.positive, negative: acc.negative + a.negative, bonus: acc.bonus + a.bonus }),
      { positive: 0, negative: 0, bonus: 0 },
    ),
    [perAgent],
  );

  return (
    <Card className="border-2 border-emerald-200/70 bg-emerald-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-current text-emerald-600" />
            Trustpilot reviews · {format(monthDate, 'MMMM yyyy')}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {totals.positive} positive · {totals.negative} negative removed · £{totals.bonus} bonus
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading review bonuses…
          </div>
        ) : perAgent.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No reviews logged this month. Reviews agents add in New Leads (positive received, or negative removed) show here.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Agent</th>
                  <th className="px-3 py-2 text-right font-medium">Positive</th>
                  <th className="px-3 py-2 text-right font-medium">Negative removed</th>
                  <th className="px-3 py-2 text-right font-medium">Bonus</th>
                </tr>
              </thead>
              <tbody>
                {perAgent.map(a => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{a.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.positive}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.negative}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">£{a.bonus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScoreboardReviewsPanel;
