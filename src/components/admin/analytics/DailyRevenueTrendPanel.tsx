import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart,
} from 'recharts';
import { DateRangeFilter } from '../DateRangeFilter';
import { DateRange } from 'react-day-picker';
import { format, subDays, differenceInCalendarDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { toast } from 'sonner';

const MAX_DAYS = 30;

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

interface Props {
  customers: any[];
  sourceFilter: string;
}

export const DailyRevenueTrendPanel: React.FC<Props> = ({ customers, sourceFilter }) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 13),
    to: new Date(),
  });

  const handleChange = (range: DateRange | undefined) => {
    if (!range?.from) {
      setDateRange({ from: subDays(new Date(), 13), to: new Date() });
      return;
    }
    // First click of a new range: keep it open so the next click sets the end date
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


  const { data, totals } = useMemo(() => {
    const from = startOfDay(dateRange?.from || subDays(new Date(), 13));
    const to = startOfDay(dateRange?.to || dateRange?.from || new Date());
    const days = eachDayOfInterval({ start: from, end: to }).map(d => ({
      key: format(d, 'yyyy-MM-dd'),
      day: format(d, 'd MMM'),
      revenue: 0,
      salesCount: 0,
      aov: 0,
    }));
    const map = new Map(days.map(d => [d.key, d]));

    customers.forEach(customer => {
      if (isRevenueLost(customer.status)) return;
      if (!matchesSource(customer, sourceFilter)) return;
      if (!customer.final_amount || !customer.signup_date) return;
      const key = format(new Date(customer.signup_date), 'yyyy-MM-dd');
      const bucket = map.get(key);
      if (!bucket) return;
      bucket.revenue += Number(customer.final_amount) || 0;
      bucket.salesCount += 1;
    });

    days.forEach(d => {
      d.revenue = Math.round(d.revenue * 100) / 100;
      d.aov = d.salesCount > 0 ? Math.round(d.revenue / d.salesCount) : 0;
    });

    const revenue = days.reduce((s, d) => s + d.revenue, 0);
    const salesCount = days.reduce((s, d) => s + d.salesCount, 0);
    return {
      data: days,
      totals: {
        revenue,
        salesCount,
        aov: salesCount > 0 ? Math.round(revenue / salesCount) : 0,
        dayCount: days.length,
      },
    };
  }, [customers, sourceFilter, dateRange]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Revenue &amp; AOV by Day</CardTitle>
          <CardDescription className="mt-1">
            Pick any date range up to {MAX_DAYS} days (e.g. 12 Jun – 23 Jun) to see daily trends
          </CardDescription>
        </div>
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={handleChange} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Revenue £{totals.revenue.toLocaleString('en-GB')}</Badge>
          <Badge variant="secondary">{totals.salesCount.toLocaleString('en-GB')} deals</Badge>
          <Badge variant="secondary">AOV £{totals.aov.toLocaleString('en-GB')}</Badge>
          <Badge variant="outline">{totals.dayCount} days</Badge>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis yAxisId="left" tickFormatter={(v) => `£${Number(v).toLocaleString()}`} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `£${v}`} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'salesCount') return [Number(value).toLocaleString('en-GB'), 'Warranties Sold'];
                const label = name === 'revenue' ? 'Revenue' : name === 'aov' ? 'Avg Order Value' : name;
                return [`£${Number(value).toLocaleString('en-GB')}`, label];
              }}
              labelStyle={{ fontWeight: 'bold' }}
              contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
            <Legend formatter={(value) => value === 'revenue' ? 'Revenue' : value === 'aov' ? 'Avg Order Value' : value === 'salesCount' ? 'Warranties Sold' : value} />
            <Bar yAxisId="left" dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="aov" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', r: 3 }} />
            <Line yAxisId="right" type="monotone" dataKey="salesCount" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
