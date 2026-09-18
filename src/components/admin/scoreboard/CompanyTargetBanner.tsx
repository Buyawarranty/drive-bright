import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format, differenceInCalendarDays } from 'date-fns';

interface Row {
  team_id: string;
  team_name: string;
  team_sort: number;
  admin_user_id: string;
  agent_name: string;
  revenue: number;
  revenue_target: number | null;
  full_month_target: number | null;
  team_revenue: number;
}

const gbp = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n || 0);

const teamPill = (name: string) => {
  const n = (name || '').toLowerCase();
  if (n.includes('red')) return 'bg-red-100 text-red-800 border-red-300';
  if (n.includes('blue')) return 'bg-blue-100 text-blue-800 border-blue-300';
  if (n.includes('green')) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  return 'bg-muted text-foreground border-border';
};

/**
 * Management-only band at the very top of the scoreboard: the whole team's target for the
 * month, how much has been sold against it and what is still to come. Pro-rata targets
 * (agents working part of the month) are summed, with the full-month figure shown alongside.
 */
export const CompanyTargetBanner: React.FC<{ monthDate?: Date }> = ({ monthDate }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const month = monthDate ?? new Date();

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_team_scoreboard', {
      p_start: startOfMonth(month).toISOString(),
      p_end: endOfMonth(month).toISOString(),
    });
    if (error) setError(error.message);
    else {
      setError(null);
      setRows((data || []) as unknown as Row[]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month.getFullYear(), month.getMonth()]);

  useEffect(() => { load(); }, [load]);

  // Keep in step with target changes made by another manager.
  useEffect(() => {
    const channel = supabase
      .channel(`company-target-banner-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_targets' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const totals = useMemo(() => {
    const target = rows.reduce((s, r) => s + (Number(r.revenue_target) || 0), 0);
    const fullMonth = rows.reduce((s, r) => s + (Number(r.full_month_target ?? r.revenue_target) || 0), 0);
    const revenue = rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
    const withTarget = rows.filter(r => r.revenue_target != null).length;
    const pct = target > 0 ? Math.round((revenue / target) * 100) : null;
    return { target, fullMonth, revenue, pct, gap: Math.max(0, target - revenue), agents: rows.length, withTarget };
  }, [rows]);

  const teams = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sort: number; target: number; revenue: number }>();
    for (const r of rows) {
      const t = map.get(r.team_id) ?? { id: r.team_id, name: r.team_name, sort: r.team_sort ?? 0, target: 0, revenue: 0 };
      t.target += Number(r.revenue_target) || 0;
      t.revenue += Number(r.revenue) || 0;
      map.set(r.team_id, t);
    }
    return Array.from(map.values()).sort((a, b) => a.sort - b.sort);
  }, [rows]);

  const daysLeft = Math.max(0, differenceInCalendarDays(endOfMonth(month), new Date()));
  const perDay = daysLeft > 0 ? totals.gap / daysLeft : totals.gap;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-primary" />
            Full team target — {format(month, 'MMMM yyyy')}
          </p>
          <Badge variant="outline" className="bg-background text-xs">
            Managers and admins only
          </Badge>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading the team target…</p>}
        {!loading && error && <p className="text-sm text-destructive">Could not load the team target: {error}</p>}

        {!loading && !error && totals.target === 0 && (
          <p className="text-sm text-muted-foreground">
            No targets have been set for this month yet — set them in "Set targets" below and the team figure will appear here.
          </p>
        )}

        {!loading && !error && totals.target > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Target for the month</p>
                <p className="text-2xl font-bold tracking-tight">{gbp(totals.target)}</p>
                {totals.fullMonth > totals.target && (
                  <p className="text-[11px] text-muted-foreground">Full month if everyone worked every day: {gbp(totals.fullMonth)}</p>
                )}
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Sold so far</p>
                <p className="text-2xl font-bold tracking-tight">{gbp(totals.revenue)}</p>
                <p className="text-[11px] text-muted-foreground">{totals.withTarget} of {totals.agents} agents have a target</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Still to go</p>
                <p className="text-2xl font-bold tracking-tight">{gbp(totals.gap)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {daysLeft > 0 ? `${gbp(perDay)} a day over the ${daysLeft} days left` : 'Last day of the month'}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Achieved</p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{totals.pct != null ? `${totals.pct}%` : '—'}</p>
                <Progress
                  value={Math.min(totals.pct ?? 0, 100)}
                  className={`mt-2 h-2 ${(totals.pct ?? 0) >= 100 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-sky-500'}`}
                />
              </div>
            </div>

            {teams.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {teams.map(t => (
                  <Badge key={t.id} variant="outline" className={`${teamPill(t.name)} text-xs font-medium`}>
                    {t.name}: {gbp(t.revenue)} of {gbp(t.target)}
                    {t.target > 0 ? ` · ${Math.round((t.revenue / t.target) * 100)}%` : ''}
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
