import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns';
import { Loader2, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Manager view of the same figures each agent sees on their own "My progress"
 * strip — target, attendance, break, lead access and reviews — for every agent
 * in one table. Read-only: nothing here changes allocation or targets.
 */

const gbp = (n: number) => `£${Math.round(n || 0).toLocaleString('en-GB')}`;

interface AgentRow {
  adminUserId: string;
  name: string;
  revenue: number;
  target: number | null;
  pct: number | null;
  daysMarked: number;
  weekDays: Record<string, string>;
  onBreak: boolean;
  breakStatus: string;
  breakMinutesToday: number;
  breakSessionsToday: number;
  paused: boolean;
  freezeReason: string | null;
  lastSaleAt: string | null;
  lastSaleProof: string | null;
  weekPositives: number;
  weekRemoved: number;
  monthReviews: number;
}

const DEAD_STATUSES = ['cancelled', 'canceled', 'refunded'];
const REVIEW_MONTH_TARGET = 10;
const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface ReconRow {
  bucket: string;
  label: string;
  revenue: number;
  sales_count: number;
}

export const AllAgentsProgressPanel: React.FC = () => {
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recon, setRecon] = useState<ReconRow[]>([]);

  const now = new Date();
  const weekStart = useMemo(() => startOfWeek(now, { weekStartsOn: 1 }), [now.toDateString()]);
  const monthStart = useMemo(() => startOfMonth(now), [now.getMonth()]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

      const settled = await Promise.allSettled([
        supabase.rpc('get_team_scoreboard', {
          p_start: monthStart.toISOString(),
          p_end: endOfMonth(now).toISOString(),
        }),
        (supabase as any)
          .from('agent_working_days')
          .select('admin_user_id, work_date, day_type')
          .gte('work_date', weekStartStr)
          .lte('work_date', weekEndStr),
        (supabase as any).from('agent_break_status').select('admin_user_id, status'),
        (supabase as any)
          .from('agent_break_log')
          .select('admin_user_id, minutes, started_at')
          .gte('started_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()),
        (supabase as any).from('agent_review_claims').select('admin_user_id, kind, week_start, created_at').gte('created_at', monthStart.toISOString()),
        (supabase as any).from('agent_distribution_caps').select('admin_user_id, paused, freeze_reason'),
        supabase
          .from('customers')
          .select('signup_date, name, registration_plate, final_amount, status, sale_credit_admin_user_id, payment_confirmed_by, quote_sent_by, assigned_to')
          .eq('is_deleted', false)
          .gte('signup_date', addDays(now, -120).toISOString())
          .order('signup_date', { ascending: false })
          .limit(2000),
      ]);

      const val = (i: number): any => (settled[i].status === 'fulfilled' ? (settled[i] as any).value : null);
      const [scoreRes, daysRes, breakRes, breakLogRes, reviewRes, capsRes, salesRes] = [0, 1, 2, 3, 4, 5, 6].map(val);

      const score = ((scoreRes?.data || []) as any[]).filter((r) => r.admin_user_id);

      const daysByAgent = new Map<string, Record<string, string>>();
      ((daysRes?.data || []) as any[]).forEach((r) => {
        const m = daysByAgent.get(r.admin_user_id) || {};
        m[String(r.work_date)] = r.day_type || 'worked';
        daysByAgent.set(r.admin_user_id, m);
      });

      const breakByAgent = new Map<string, string>();
      ((breakRes?.data || []) as any[]).forEach((r) => breakByAgent.set(r.admin_user_id, r.status || 'available'));

      const breakMinsByAgent = new Map<string, number>();
      const breakSessionsByAgent = new Map<string, number>();
      ((breakLogRes?.data || []) as any[]).forEach((r) => {
        breakMinsByAgent.set(r.admin_user_id, (breakMinsByAgent.get(r.admin_user_id) || 0) + (Number(r.minutes) || 0));
        breakSessionsByAgent.set(r.admin_user_id, (breakSessionsByAgent.get(r.admin_user_id) || 0) + 1);
      });

      const capsByAgent = new Map<string, { paused: boolean; freeze_reason: string | null }>();
      ((capsRes?.data || []) as any[]).forEach((r) =>
        capsByAgent.set(r.admin_user_id, { paused: r.paused === true, freeze_reason: r.freeze_reason ?? null }),
      );

      const weekPos = new Map<string, number>();
      const weekRem = new Map<string, number>();
      const monthTot = new Map<string, number>();
      ((reviewRes?.data || []) as any[]).forEach((r) => {
        monthTot.set(r.admin_user_id, (monthTot.get(r.admin_user_id) || 0) + 1);
        if (String(r.week_start) !== weekStartStr) return;
        if (r.kind === 'positive') weekPos.set(r.admin_user_id, (weekPos.get(r.admin_user_id) || 0) + 1);
        if (r.kind === 'negative_removed') weekRem.set(r.admin_user_id, (weekRem.get(r.admin_user_id) || 0) + 1);
      });

      // Last sale per agent, using the same four credit columns Customer
      // Management uses so the figures always agree.
      const lastSale = new Map<string, { at: string; proof: string | null }>();
      ((salesRes?.data || []) as any[]).forEach((s) => {
        if (!s.signup_date) return;
        const st = String(s.status || '').toLowerCase();
        if (DEAD_STATUSES.some((d) => st.includes(d))) return;
        const proof =
          [s.name, s.registration_plate, s.final_amount != null ? gbp(Number(s.final_amount)) : null]
            .filter(Boolean)
            .join(' · ') || null;
        const ids = [s.sale_credit_admin_user_id, s.payment_confirmed_by, s.quote_sent_by, s.assigned_to].filter(Boolean);
        new Set(ids as string[]).forEach((id) => {
          const cur = lastSale.get(id);
          if (!cur || new Date(s.signup_date) > new Date(cur.at)) lastSale.set(id, { at: s.signup_date, proof });
        });
      });

      const built: AgentRow[] = score.map((r: any) => {
        const id = r.admin_user_id as string;
        const week = daysByAgent.get(id) || {};
        const status = breakByAgent.get(id) || 'available';
        const caps = capsByAgent.get(id);
        const sale = lastSale.get(id) || null;
        const revenue = Number(r.revenue) || 0;
        const target = r.revenue_target != null ? Number(r.revenue_target) : null;
        return {
          adminUserId: id,
          name: r.agent_name || 'Unnamed agent',
          revenue,
          target,
          pct: target && target > 0 ? Math.min(100, Math.round((revenue / target) * 100)) : null,
          daysMarked: Object.keys(week).length,
          weekDays: week,
          onBreak: status !== 'available' && status !== 'off',
          breakStatus: status,
          breakMinutesToday: breakMinsByAgent.get(id) || 0,
          breakSessionsToday: breakSessionsByAgent.get(id) || 0,
          paused: caps?.paused === true,
          freezeReason: caps?.freeze_reason ?? null,
          lastSaleAt: sale?.at ?? null,
          lastSaleProof: sale?.proof ?? null,
          weekPositives: weekPos.get(id) || 0,
          weekRemoved: weekRem.get(id) || 0,
          monthReviews: monthTot.get(id) || 0,
        };
      });

      built.sort((a, b) => b.revenue - a.revenue);
      setRows(built);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.toDateString()]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-orange-600" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          All agents · progress summary · {format(now, 'MMMM')}
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Managers only
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Agent</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">Attendance · this week</th>
              <th className="px-3 py-2 font-medium">Break</th>
              <th className="px-3 py-2 font-medium">Lead access</th>
              <th className="px-3 py-2 font-medium">Last sale</th>
              <th className="px-3 py-2 font-medium">Reviews</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No agent figures for this month yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.adminUserId} className="border-b border-border last:border-0 align-top">
                <td className="px-3 py-2 font-medium whitespace-nowrap">{r.name}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="font-semibold">
                    {gbp(r.revenue)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {r.target ? `of ${gbp(r.target)}${r.pct != null ? ` · ${r.pct}%` : ''}` : 'no target set'}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-32 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-orange-500" style={{ width: `${r.pct ?? 0}%` }} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.target ? `${gbp(Math.max(0, r.target - r.revenue))} to go` : '—'}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {dayLabels.map((d, i) => {
                      const key = format(addDays(weekStart, i), 'yyyy-MM-dd');
                      const type = r.weekDays[key];
                      return (
                        <span
                          key={i}
                          title={`${format(addDays(weekStart, i), 'EEE d MMM')} · ${type ? type.replace('_', ' ') : 'not marked'}`}
                          className={`h-5 w-5 rounded text-[10px] font-semibold flex items-center justify-center ${
                            !type
                              ? 'bg-muted text-muted-foreground'
                              : type === 'full_day' || type === 'worked'
                                ? 'bg-emerald-600 text-primary-foreground'
                                : 'bg-emerald-600/50 text-primary-foreground'
                          }`}
                        >
                          {d}
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{r.daysMarked} days marked</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      r.onBreak ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {r.onBreak ? `On break${r.breakStatus !== 'break' ? ` (${r.breakStatus})` : ''}` : 'On duty'}
                  </span>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.breakSessionsToday > 0
                      ? `${Math.round(r.breakMinutesToday)} min total · ${r.breakSessionsToday} today`
                      : 'No breaks logged today'}
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      r.paused ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {r.paused ? 'Leads paused by a manager' : 'Receiving leads'}
                  </span>
                  {r.paused && r.freezeReason && (
                    <div className="mt-0.5 max-w-[16rem] text-[11px] text-muted-foreground">{r.freezeReason}</div>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.lastSaleAt ? (
                    <>
                      <div className="text-xs">{format(new Date(r.lastSaleAt), 'EEE d MMM yyyy, HH:mm')}</div>
                      {r.lastSaleProof && <div className="text-[11px] text-muted-foreground">{r.lastSaleProof}</div>}
                      <div className="text-[11px] text-muted-foreground">
                        {(() => {
                          const days = Math.floor((Date.now() - new Date(r.lastSaleAt).getTime()) / 86400000);
                          return days <= 0 ? 'Sold today' : `${days} day${days === 1 ? '' : 's'} ago`;
                        })()}
                      </div>
                    </>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">No sale in the last 120 days</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="text-xs">
                    {r.weekPositives} positive · {r.weekRemoved} removed ·{' '}
                    <span className="font-medium">{gbp(r.weekPositives * 5 + r.weekRemoved * 10)} bonus</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.monthReviews}/{REVIEW_MONTH_TARGET} this month
                    {r.monthReviews < REVIEW_MONTH_TARGET
                      ? ` · ${REVIEW_MONTH_TARGET - r.monthReviews} more to hit the minimum`
                      : ' · minimum hit'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AllAgentsProgressPanel;
