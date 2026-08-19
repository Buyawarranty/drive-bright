import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart,
} from 'recharts';
import { subDays, subMonths, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';

type Period = '7' | '30' | '90' | '180' | '365' | 'all';

const periodLabels: Record<Period, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  '180': 'Last 6 months',
  '365': 'Last 12 months',
  all: 'All time',
};

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

/** Website / self-serve online sale (not entered by a sales agent) */
function isOnlineSale(customer: any) {
  const source = customer.purchase_source?.toLowerCase() || '';
  const isManual = customer.is_manual_entry === true;
  const warrantyNum = customer.warranty_reference_number || '';
  if (isManual || warrantyNum.startsWith('BAW-S-')) return false;
  return !['quote_link', 'external', 'admin_external'].includes(source);
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function periodStart(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case '7': return startOfDay(subDays(now, 6));
    case '30': return startOfDay(subDays(now, 29));
    case '90': return startOfDay(subDays(now, 89));
    case '180': return startOfDay(subMonths(now, 6));
    case '365': return startOfDay(subMonths(now, 12));
    case 'all': return null;
  }
}

interface Props {
  customers: any[];
  sourceFilter: string;
}

export const SalesByHourPanel: React.FC<Props> = ({ customers, sourceFilter }) => {
  const [period, setPeriod] = useState<Period>('180');

  const { hours, grid, totals } = useMemo(() => {
    const from = periodStart(period);
    const hours = HOUR_LABELS.map((label, h) => ({
      hour: label,
      h,
      online: 0,
      agent: 0,
      revenue: 0,
      total: 0,
    }));
    // grid[dayIdx][hour] = sales count
    const grid: number[][] = DAY_LABELS.map(() => Array(24).fill(0));

    let overnight = 0;
    let officeHours = 0;
    let onlineTotal = 0;
    let agentTotal = 0;

    customers.forEach(customer => {
      if (isRevenueLost(customer.status)) return;
      if (!matchesSource(customer, sourceFilter)) return;
      if (!customer.signup_date) return;
      const d = new Date(customer.signup_date);
      if (Number.isNaN(d.getTime())) return;
      if (from && d < from) return;

      const h = d.getHours();
      const bucket = hours[h];
      const amount = Number(customer.final_amount) || 0;
      const online = isOnlineSale(customer);

      if (online) { bucket.online += 1; onlineTotal += 1; }
      else { bucket.agent += 1; agentTotal += 1; }
      bucket.total += 1;
      bucket.revenue += amount;

      const dayIdx = (d.getDay() + 6) % 7; // Mon = 0
      grid[dayIdx][h] += 1;

      if (h >= 22 || h < 6) overnight += 1;
      if (h >= 9 && h < 18) officeHours += 1;
    });

    hours.forEach(b => { b.revenue = Math.round(b.revenue); });

    const total = onlineTotal + agentTotal;
    const busiest = hours.reduce((best, b) => (b.total > best.total ? b : best), hours[0]);

    return {
      hours,
      grid,
      totals: {
        total,
        onlineTotal,
        agentTotal,
        overnight,
        officeHours,
        outsideHours: total - officeHours,
        busiestHour: busiest.total > 0 ? busiest.hour : '—',
        busiestCount: busiest.total,
      },
    };
  }, [customers, sourceFilter, period]);

  const maxCell = Math.max(1, ...grid.flat());

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Time of sale — 24 hour tracker</CardTitle>
          <CardDescription className="mt-1">
            What time of day sales actually land, split between online (website/self-serve) and agent-entered orders. Times are shown in UK time.
          </CardDescription>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[170px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(periodLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{totals.total.toLocaleString('en-GB')} sales</Badge>
          <Badge variant="secondary">Online {totals.onlineTotal.toLocaleString('en-GB')}</Badge>
          <Badge variant="secondary">Agent {totals.agentTotal.toLocaleString('en-GB')}</Badge>
          <Badge variant="outline">Busiest hour {totals.busiestHour} ({totals.busiestCount})</Badge>
          <Badge variant="outline">9am–6pm {totals.officeHours.toLocaleString('en-GB')}</Badge>
          <Badge variant="outline">Outside 9am–6pm {totals.outsideHours.toLocaleString('en-GB')}</Badge>
          <Badge variant="outline">Overnight 10pm–6am {totals.overnight.toLocaleString('en-GB')}</Badge>
        </div>

        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={hours}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={50} />
            <YAxis yAxisId="left" allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `£${Number(v).toLocaleString('en-GB')}`} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'revenue') return [`£${Number(value).toLocaleString('en-GB')}`, 'Revenue'];
                return [Number(value).toLocaleString('en-GB'), name === 'online' ? 'Online sales' : 'Agent sales'];
              }}
              labelStyle={{ fontWeight: 'bold' }}
              contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
            <Legend formatter={(v) => v === 'online' ? 'Online sales' : v === 'agent' ? 'Agent sales' : 'Revenue'} />
            <Bar yAxisId="left" dataKey="online" stackId="s" fill="#10b981" radius={[0, 0, 0, 0]} />
            <Bar yAxisId="left" dataKey="agent" stackId="s" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>

        <div>
          <h4 className="text-sm font-semibold mb-2">Day &amp; hour heatmap</h4>
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-[2px]">
              <thead>
                <tr>
                  <th className="w-10" />
                  {HOUR_LABELS.map((label, h) => (
                    <th key={label} className="text-[9px] font-medium text-muted-foreground w-5">
                      {String(h).padStart(2, '0')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_LABELS.map((day, dayIdx) => (
                  <tr key={day}>
                    <td className="text-[10px] font-semibold text-muted-foreground pr-1">{day}</td>
                    {grid[dayIdx].map((count, h) => (
                      <td key={h}>
                        <div
                          title={`${day} ${String(h).padStart(2, '0')}:00 — ${count} sale${count === 1 ? '' : 's'}`}
                          className="h-5 w-5 rounded-sm border border-border/50 flex items-center justify-center text-[8px] font-semibold"
                          style={{
                            backgroundColor: count === 0
                              ? 'hsl(var(--muted))'
                              : `rgba(16, 185, 129, ${0.18 + 0.82 * (count / maxCell)})`,
                            color: count / maxCell > 0.55 ? 'white' : 'hsl(var(--foreground))',
                          }}
                        >
                          {count > 0 ? count : ''}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Darker cells mean more sales in that hour of that weekday. Excludes cancelled and refunded orders.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
