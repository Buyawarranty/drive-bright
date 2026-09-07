import React, { useEffect, useMemo, useState } from 'react';
import { buildSaleCreditResolver, fetchSalesCreditAgentIds } from '@/lib/saleCredit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart,
} from 'recharts';
import { DateRangeFilter } from '../DateRangeFilter';
import { DateRange } from 'react-day-picker';
import { format, subDays, differenceInCalendarDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { toast } from 'sonner';

const MAX_DAYS = 31;

const LOST_STATUSES = ['cancelled', 'refunded'];

function isRevenueLost(status?: string | null) {
  const s = (status || '').toLowerCase();
  return LOST_STATUSES.some(l => s.includes(l));
}

function matchesSource(customer: any, sourceFilter: string) {
  if (sourceFilter === 'all') return true;
  const source = customer.purchase_source?.toLowerCase() || '';
  const isManual = customer.is_manual_entry === true;
  const warrantyNum = customer.warranty_reference_number || '';
  if (sourceFilter === 'website') {
    const isBawS = warrantyNum.startsWith('BAW-S-');
    return !isBawS && !isManual && (
      source === 'website' || source === 'stripe' || source === 'bumper' ||
      source === 'bumper_portal' || source === 'google_ads' || source === 'facebook_ads' || source === ''
    );
  }
  if (sourceFilter === 'staff_purchase') return warrantyNum.startsWith('BAW-S-');
  if (sourceFilter === 'sales_team') {
    return isManual || source === 'quote_link' || source === 'external' || source === 'admin_external';
  }
  return true;
}

// Distinct, readable series colours for the stacked bars.
const PALETTE = [
  '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444',
  '#14b8a6', '#ec4899', '#84cc16', '#0ea5e9', '#f97316',
  '#6366f1', '#22c55e',
];

interface AdminUserLike {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface Props {
  customers: any[];
  sourceFilter: string;
  adminUsers: AdminUserLike[];
}

export const DailyAgentRevenuePanel: React.FC<Props> = ({ customers, sourceFilter, adminUsers }) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 13),
    to: new Date(),
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // Back-office staff (support@, accounts@, admins) often confirm a payment on an
  // agent's behalf — they must never take the sale, so credit falls through to the
  // sales agent who actually worked the deal.
  const [salesAgentIds, setSalesAgentIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    fetchSalesCreditAgentIds().then(ids => {
      if (!cancelled) setSalesAgentIds(ids);
    });
    return () => { cancelled = true; };
  }, []);

  const handleChange = (range: DateRange | undefined) => {
    setSelectedDay(null);
    if (!range?.from) {
      setDateRange({ from: subDays(new Date(), 13), to: new Date() });
      return;
    }
    if (!range.to) {
      setDateRange({ from: range.from, to: undefined });
      return;
    }
    const to = range.to;
    if (differenceInCalendarDays(to, range.from) + 1 > MAX_DAYS) {
      toast.error(`Maximum ${MAX_DAYS} days — showing the last ${MAX_DAYS} days of that selection`);
      setDateRange({ from: subDays(to, MAX_DAYS - 1), to });
      return;
    }
    setDateRange({ from: range.from, to });
  };

  const agentName = (id: string) => {
    const u = adminUsers.find(a => a.id === id);
    if (!u) return 'Unknown';
    const full = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    return full || u.email || 'Unknown';
  };

  const { data, agents, rows, totals } = useMemo(() => {
    const resolveSaleCredit = buildSaleCreditResolver(salesAgentIds);
    const from = startOfDay(dateRange?.from || subDays(new Date(), 13));
    const to = startOfDay(dateRange?.to || dateRange?.from || new Date());

    const days = eachDayOfInterval({ start: from, end: to }).map(d => ({
      key: format(d, 'yyyy-MM-dd'),
      day: `${format(d, 'EEE')} ${format(d, 'd MMM')}`,
    }));
    const dayKeys = new Set(days.map(d => d.key));

    // day -> agent -> { revenue, deals }
    const grid = new Map<string, Map<string, { revenue: number; deals: number }>>();
    days.forEach(d => grid.set(d.key, new Map()));
    const agentTotals = new Map<string, { revenue: number; deals: number }>();

    customers.forEach(c => {
      if (isRevenueLost(c.status)) return;
      if (!matchesSource(c, sourceFilter)) return;
      if (!c.final_amount || !c.signup_date) return;
      const key = format(new Date(c.signup_date), 'yyyy-MM-dd');
      if (!dayKeys.has(key)) return;

      const agentId = resolveSaleCredit(c) || 'website';

      const amount = Number(c.final_amount) || 0;
      const dayMap = grid.get(key)!;
      const cell = dayMap.get(agentId) || { revenue: 0, deals: 0 };
      cell.revenue += amount;
      cell.deals += 1;
      dayMap.set(agentId, cell);

      const t = agentTotals.get(agentId) || { revenue: 0, deals: 0 };
      t.revenue += amount;
      t.deals += 1;
      agentTotals.set(agentId, t);
    });

    const agentList = Array.from(agentTotals.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([id], i) => ({
        id,
        label: id === 'website' ? 'Website (no agent)' : agentName(id),
        colour: PALETTE[i % PALETTE.length],
      }));

    const chart = days.map(d => {
      const row: Record<string, any> = { day: d.day, key: d.key, total: 0 };
      const dayMap = grid.get(d.key)!;
      agentList.forEach(a => {
        const cell = dayMap.get(a.id);
        row[a.label] = cell ? Math.round(cell.revenue * 100) / 100 : 0;
        row[`${a.label}__deals`] = cell?.deals || 0;
        row.total += cell?.revenue || 0;
      });
      row.total = Math.round(row.total * 100) / 100;
      return row;
    });

    const tableRows = agentList.map(a => {
      const t = agentTotals.get(a.id)!;
      const byDay = days.map(d => {
        const cell = grid.get(d.key)!.get(a.id);
        return { key: d.key, day: d.day, revenue: cell?.revenue || 0, deals: cell?.deals || 0 };
      });
      return {
        ...a,
        revenue: Math.round(t.revenue * 100) / 100,
        deals: t.deals,
        aov: t.deals > 0 ? Math.round(t.revenue / t.deals) : 0,
        byDay,
      };
    });

    const revenue = tableRows.reduce((s, r) => s + r.revenue, 0);
    const deals = tableRows.reduce((s, r) => s + r.deals, 0);

    return {
      data: chart,
      agents: agentList,
      rows: tableRows,
      totals: {
        revenue: Math.round(revenue * 100) / 100,
        deals,
        aov: deals > 0 ? Math.round(revenue / deals) : 0,
        dayCount: days.length,
      },
    };
  }, [customers, sourceFilter, dateRange, adminUsers]);

  const dayView = useMemo(() => {
    if (!selectedDay) return null;
    const label = data.find(d => d.key === selectedDay)?.day || selectedDay;
    const list = rows
      .map(r => {
        const cell = r.byDay.find(d => d.key === selectedDay);
        return { label: r.label, colour: r.colour, revenue: Math.round((cell?.revenue || 0) * 100) / 100, deals: cell?.deals || 0 };
      })
      .filter(r => r.deals > 0)
      .sort((a, b) => b.revenue - a.revenue);
    return { label, list, revenue: list.reduce((s, r) => s + r.revenue, 0), deals: list.reduce((s, r) => s + r.deals, 0) };
  }, [selectedDay, rows, data]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Daily revenue by agent</CardTitle>
          <CardDescription className="mt-1">
            Click any day to see who sold what. Pick any date range up to {MAX_DAYS} days.
          </CardDescription>
        </div>
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={handleChange} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Revenue £{totals.revenue.toLocaleString('en-GB')}</Badge>
          <Badge variant="secondary">{totals.deals.toLocaleString('en-GB')} deals</Badge>
          <Badge variant="secondary">AOV £{totals.aov.toLocaleString('en-GB')}</Badge>
          <Badge variant="outline">{totals.dayCount} days</Badge>
          <Badge variant="outline">{agents.length} sellers</Badge>
        </div>

        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No sales in this date range.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={data} onClick={(e: any) => setSelectedDay(e?.activePayload?.[0]?.payload?.key ?? null)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={(v) => `£${Number(v).toLocaleString()}`} />
                <Tooltip
                  formatter={(value: number, name: string) => [`£${Number(value).toLocaleString('en-GB')}`, name]}
                  labelStyle={{ fontWeight: 'bold' }}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {agents.map((a, i) => (
                  <Bar
                    key={a.id}
                    dataKey={a.label}
                    stackId="revenue"
                    fill={a.colour}
                    radius={i === agents.length - 1 ? [4, 4, 0, 0] : undefined}
                    cursor="pointer"
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>

            {dayView && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {dayView.label} — £{dayView.revenue.toLocaleString('en-GB')} from {dayView.deals} {dayView.deals === 1 ? 'deal' : 'deals'}
                  </p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedDay(null)}>
                    Clear day
                  </Button>
                </div>
                {dayView.list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sales on this day.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {dayView.list.map(r => (
                      <span key={r.label} className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.colour }} />
                        {r.label} · £{r.revenue.toLocaleString('en-GB')} · {r.deals} {r.deals === 1 ? 'deal' : 'deals'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Agent</th>
                    <th className="py-2 pr-3 text-right">Revenue</th>
                    <th className="py-2 pr-3 text-right">Deals</th>
                    <th className="py-2 pr-3 text-right">AOV</th>
                    <th className="py-2 pr-3 text-right">Best day</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const best = r.byDay.reduce((w, d) => (!w || d.revenue > w.revenue ? d : w), r.byDay[0]);
                    return (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.colour }} />
                            {r.label}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-medium">£{r.revenue.toLocaleString('en-GB')}</td>
                        <td className="py-2 pr-3 text-right">{r.deals}</td>
                        <td className="py-2 pr-3 text-right">£{r.aov.toLocaleString('en-GB')}</td>
                        <td className="py-2 pr-3 text-right text-xs text-muted-foreground">
                          {best && best.revenue > 0 ? `${best.day} · £${Math.round(best.revenue).toLocaleString('en-GB')}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyAgentRevenuePanel;
