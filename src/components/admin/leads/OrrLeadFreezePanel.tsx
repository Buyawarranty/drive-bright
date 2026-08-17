import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { Snowflake, ShieldCheck, Unlock, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type DayType = 'full_day' | 'half_day' | string;

interface AgentRow {
  id: string;
  name: string;
  serviceDays: string[]; // yyyy-MM-dd, most recent last
  salesByDay: Record<string, number>;
  monthSales: number;
  monthRevenue: number;
  target: number | null;
}

type FreezeKind = 'none' | 'one_day' | 'two_day';

interface Assessment {
  kind: FreezeKind;
  reason: string;
  window: string[];
  salesInWindow: number;
  targetMet: boolean;
}

const POLICY_ROWS: { condition: string; action: string; extra: string }[] = [
  {
    condition: 'No more than one completed and validated sale across any two consecutive agreed service days.',
    action:
      'The Company will normally apply a one-service-day Lead Freeze on the next agreed service day. New live, high-intent and newly allocated leads will stop while existing and management-assigned recovery opportunities are worked.',
    extra: 'The operational measure is described in Section 7.1.',
  },
  {
    condition: 'Before a Lead Freeze is applied.',
    action: 'The Company may hold a one-to-one meeting with the Sales Agent to understand the circumstances.',
    extra:
      'A lack of sales alone will not automatically constitute a material breach, but an unsupported assertion of poor leads or bad luck will not automatically prevent the operational freeze.',
  },
  {
    condition: 'No more than one completed and validated sale across any three consecutive agreed service days.',
    action:
      'The Company will normally apply a fixed two-service-day Lead Freeze beginning on the next agreed service day. The freeze will not end early because a sale is completed during it.',
    extra:
      'Normal new-lead allocation will normally resume after the fixed period once management confirms availability. Reallocated leads will not automatically be returned.',
  },
  {
    condition: 'The Sales Agent has already achieved or exceeded the monthly revenue target.',
    action: 'A Lead Freeze will not always be applied automatically.',
    extra:
      "Management may decide whether to apply it after considering the Sales Agent's overall monthly performance. The final decision lies with management, acting reasonably.",
  },
  {
    condition:
      'Repeated Lead Freeze triggers, repeated failure to meet the call minimum, repeated failure to progress leads, repeated unavailability or inaccurate CRM records.',
    action: 'The Company may take further formal service-performance or contractual action where appropriate.',
    extra:
      'The matter may be managed under the service-performance process or as a material breach, depending on the circumstances. The final decision lies with management, acting reasonably and after considering the available evidence.',
  },
];

const assess = (row: AgentRow): Assessment => {
  const days = row.serviceDays.slice(-3);
  const targetMet = row.target != null && row.monthRevenue >= row.target;
  const sum = (ds: string[]) => ds.reduce((s, d) => s + (row.salesByDay[d] || 0), 0);

  const last3 = days.slice(-3);
  const last2 = days.slice(-2);

  if (last3.length === 3 && sum(last3) <= 1) {
    return {
      kind: 'two_day',
      reason: 'One sale or fewer across the last three consecutive agreed service days.',
      window: last3,
      salesInWindow: sum(last3),
      targetMet,
    };
  }
  if (last2.length === 2 && sum(last2) <= 1) {
    return {
      kind: 'one_day',
      reason: 'One sale or fewer across the last two consecutive agreed service days.',
      window: last2,
      salesInWindow: sum(last2),
      targetMet,
    };
  }
  return {
    kind: 'none',
    reason: 'Sales pattern is within policy — leads keep flowing.',
    window: last2,
    salesInWindow: sum(last2),
    targetMet,
  };
};

/**
 * Auto block & unblock leads (Lead Freeze) — ORR Test Lab.
 * Read-only assessment: it reads real sales and rota data to show what the policy
 * WOULD do, but never blocks, unblocks or reassigns a live lead. Manager overrides
 * here are practice-only and live in browser memory.
 */
export const OrrLeadFreezePanel: React.FC = () => {
  const [rows, setRows] = React.useState<AgentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [overrides, setOverrides] = React.useState<Record<string, 'freeze' | 'unfreeze'>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const from = subDays(now, 21);
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const { data: admins } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active')
        .in('role', ['sales', 'sales_lead'])
        .eq('is_active', true)
        .is('archived_at', null);

      const agents = (admins || []) as any[];
      const ids = agents.map(a => a.id);
      if (!ids.length) {
        setRows([]);
        return;
      }

      const [{ data: workDays }, { data: sales }, { data: targets }] = await Promise.all([
        supabase
          .from('agent_working_days')
          .select('admin_user_id, work_date, day_type')
          .in('admin_user_id', ids)
          .gte('work_date', format(from, 'yyyy-MM-dd'))
          .lte('work_date', format(now, 'yyyy-MM-dd')),
        supabase
          .from('customers')
          .select('id, assigned_to, payment_confirmed_by, quote_sent_by, sale_credit_admin_user_id, final_amount, signup_date')
          .eq('is_deleted', false)
          .ilike('status', 'active')
          .gte('signup_date', from.toISOString())
          .lte('signup_date', monthEnd.toISOString()),
        supabase
          .from('sales_targets')
          .select('admin_user_id, revenue_target, target_amount, start_date')
          .in('admin_user_id', ids)
          .eq('target_period', 'monthly')
          .gte('start_date', monthStart.toISOString())
          .lte('start_date', monthEnd.toISOString()),
      ]);

      const targetMap = new Map<string, number>();
      (targets || []).forEach((t: any) => {
        const val = Number(t.revenue_target ?? t.target_amount);
        if (t.admin_user_id && Number.isFinite(val)) targetMap.set(t.admin_user_id, val);
      });

      const creditOf = (c: any) =>
        c.sale_credit_admin_user_id || c.payment_confirmed_by || c.quote_sent_by || c.assigned_to;

      const built: AgentRow[] = agents.map(a => {
        const days = (workDays || [])
          .filter((w: any) => w.admin_user_id === a.id && (w.day_type as DayType) !== 'off')
          .map((w: any) => String(w.work_date))
          .sort();
        const serviceDays = Array.from(new Set(days));

        const mine = (sales || []).filter((c: any) => creditOf(c) === a.id);
        const salesByDay: Record<string, number> = {};
        let monthSales = 0;
        let monthRevenue = 0;
        mine.forEach((c: any) => {
          const d = new Date(c.signup_date);
          const key = format(d, 'yyyy-MM-dd');
          salesByDay[key] = (salesByDay[key] || 0) + 1;
          if (d >= monthStart && d <= monthEnd) {
            monthSales += 1;
            monthRevenue += Number(c.final_amount) || 0;
          }
        });

        return {
          id: a.id,
          name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || String(a.email).split('@')[0],
          serviceDays,
          salesByDay,
          monthSales,
          monthRevenue,
          target: targetMap.get(a.id) ?? 35000,
        };
      });

      setRows(built);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const gbp = (n: number) => `£${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-4">
      <div className="border-l-4 border-sky-500/60 pl-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-semibold text-foreground">Auto block &amp; unblock leads (Lead Freeze)</h2>
          <span className="inline-flex items-center rounded-md bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
            Practice mode
          </span>
          <span className="inline-flex items-center rounded-md border border-emerald-500 text-emerald-700 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
            Read-only
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
          Shows what the Lead Freeze policy would do based on completed, validated sales across each agent's agreed
          service days. Nothing is blocked, unblocked or reassigned from here — manager overrides below are practice
          only and reset when you leave the page.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Snowflake className="h-4 w-4 text-sky-600" />
            Agent freeze assessment
          </CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Loading sales and rota data…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No active sales agents found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                    <th className="py-2 pr-3">Agent</th>
                    <th className="py-2 pr-3">Last 3 service days</th>
                    <th className="py-2 pr-3">Sales in window</th>
                    <th className="py-2 pr-3">Month to date</th>
                    <th className="py-2 pr-3">Policy outcome</th>
                    <th className="py-2 pr-3">Manager override (practice)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const a = assess(row);
                    const ov = overrides[row.id];
                    const effective: FreezeKind = ov === 'unfreeze' ? 'none' : ov === 'freeze' ? (a.kind === 'none' ? 'one_day' : a.kind) : a.kind;
                    return (
                      <tr key={row.id} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-3 font-medium">{row.name}</td>
                        <td className="py-2 pr-3">
                          {row.serviceDays.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No rota days recorded</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {row.serviceDays.slice(-3).map(d => (
                                <span
                                  key={d}
                                  className="inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] bg-muted/40"
                                >
                                  {format(new Date(d), 'EEE d MMM')} · {row.salesByDay[d] || 0}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3">{a.salesInWindow}</td>
                        <td className="py-2 pr-3">
                          <div>{row.monthSales} sales · {gbp(row.monthRevenue)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Target {row.target != null ? gbp(row.target) : '—'}
                            {a.targetMet && ' · met'}
                          </div>
                        </td>
                        <td className="py-2 pr-3 max-w-[260px]">
                          {effective === 'none' ? (
                            <Badge variant="outline" className="border-emerald-500 text-emerald-700">
                              No freeze
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={
                                effective === 'two_day'
                                  ? 'border-rose-500 text-rose-700'
                                  : 'border-amber-500 text-amber-700'
                              }
                            >
                              {effective === 'two_day' ? 'Two-service-day freeze' : 'One-service-day freeze'}
                            </Badge>
                          )}
                          <div className="text-[11px] text-muted-foreground mt-1">{a.reason}</div>
                          {a.kind !== 'none' && a.targetMet && (
                            <div className="text-[11px] text-sky-700 mt-1">
                              Monthly target already met — management decides whether to apply.
                            </div>
                          )}
                          {a.kind !== 'none' && (
                            <div className="text-[11px] text-muted-foreground mt-1">
                              A one-to-one may be held before any freeze is applied.
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              variant={ov === 'unfreeze' ? 'default' : 'outline'}
                              onClick={() =>
                                setOverrides(p => ({ ...p, [row.id]: p[row.id] === 'unfreeze' ? undefined as any : 'unfreeze' }))
                              }
                            >
                              <Unlock className="h-3.5 w-3.5 mr-1.5" />
                              Keep leads on
                            </Button>
                            <Button
                              size="sm"
                              variant={ov === 'freeze' ? 'default' : 'outline'}
                              onClick={() =>
                                setOverrides(p => ({ ...p, [row.id]: p[row.id] === 'freeze' ? undefined as any : 'freeze' }))
                              }
                            >
                              <Snowflake className="h-3.5 w-3.5 mr-1.5" />
                              Apply freeze
                            </Button>
                          </div>
                          {ov && (
                            <div className="text-[11px] text-muted-foreground mt-1">
                              Override recorded in practice mode only.
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Lead Freeze policy — Section 8: Service availability, unavailability and lead distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border">
              <thead>
                <tr className="bg-muted/60 text-left">
                  <th className="p-2 border font-semibold w-[26%]">Condition or review point</th>
                  <th className="p-2 border font-semibold w-[37%]">Lead allocation action</th>
                  <th className="p-2 border font-semibold">Additional provisions or possible outcome</th>
                </tr>
              </thead>
              <tbody>
                {POLICY_ROWS.map((r, i) => (
                  <tr key={i} className={i % 2 ? 'bg-muted/20' : undefined}>
                    <td className="p-2 border align-top">{r.condition}</td>
                    <td className="p-2 border align-top">{r.action}</td>
                    <td className="p-2 border align-top">{r.extra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            A freeze stops new live, high-intent and newly allocated leads only. Existing leads and
            management-assigned recovery opportunities continue to be worked throughout.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrrLeadFreezePanel;
