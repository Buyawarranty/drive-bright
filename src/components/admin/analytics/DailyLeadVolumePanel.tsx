import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart,
} from 'recharts';
import { DateRange } from 'react-day-picker';
import {
  format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear,
} from 'date-fns';
import { DateRangeFilter } from '../DateRangeFilter';

type Granularity = 'day' | 'week' | 'month' | 'year';

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: 'day', label: 'By day' },
  { key: 'week', label: 'By week' },
  { key: 'month', label: 'By month' },
  { key: 'year', label: 'By year' },
];

// Statuses that mean the lead is not real work for an agent.
const NON_WORKABLE: { key: string; label: string }[] = [
  { key: 'fake_lead', label: 'Fake' },
  { key: 'archived', label: 'Archived' },
  { key: 'do_not_contact', label: 'Do not contact' },
  { key: 'unsubscribed', label: 'Unsubscribed' },
  { key: 'not_eligible', label: 'Not eligible' },
  { key: 'wrong_number', label: 'Wrong number' },
  { key: 'bought_elsewhere', label: 'Bought elsewhere' },
  { key: 'vehicle_sold', label: 'Vehicle sold' },
];

const DEFAULT_EXCLUDED = ['fake_lead', 'archived', 'do_not_contact', 'unsubscribed', 'not_eligible', 'wrong_number'];

function bucketKey(date: Date, granularity: Granularity) {
  if (granularity === 'week') return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  if (granularity === 'month') return format(startOfMonth(date), 'yyyy-MM');
  if (granularity === 'year') return format(startOfYear(date), 'yyyy');
  return format(date, 'yyyy-MM-dd');
}

function bucketLabel(date: Date, granularity: Granularity) {
  if (granularity === 'week') return `w/c ${format(startOfWeek(date, { weekStartsOn: 1 }), 'd MMM')}`;
  if (granularity === 'month') return format(date, 'MMM yyyy');
  if (granularity === 'year') return format(date, 'yyyy');
  return format(date, 'EEE d MMM');
}

export const DailyLeadVolumePanel: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [excluded, setExcluded] = useState<string[]>(DEFAULT_EXCLUDED);

  const from = startOfDay(dateRange?.from || subDays(new Date(), 29));
  const to = endOfDay(dateRange?.to || dateRange?.from || new Date());
  const rangeKey = `${from.toISOString()}_${to.toISOString()}`;

  const { data: leads, isLoading } = useQuery({
    queryKey: ['daily-lead-volume', rangeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_leads')
        .select('id, created_at, status')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .limit(50000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const toggle = (key: string) =>
    setExcluded(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const { chartData, totals, statusBreakdown } = useMemo(() => {
    const rows = leads || [];
    const map = new Map<string, { key: string; label: string; sort: string; received: number; live: number }>();
    const breakdown = new Map<string, number>();

    rows.forEach((lead: any) => {
      const created = new Date(lead.created_at);
      const key = bucketKey(created, granularity);
      if (!map.has(key)) {
        map.set(key, { key, label: bucketLabel(created, granularity), sort: key, received: 0, live: 0 });
      }
      const bucket = map.get(key)!;
      bucket.received += 1;
      const status = (lead.status || '').toLowerCase();
      if (!excluded.includes(status)) bucket.live += 1;
      if (status) breakdown.set(status, (breakdown.get(status) || 0) + 1);
    });

    const chart = Array.from(map.values()).sort((a, b) => a.sort.localeCompare(b.sort));
    const received = chart.reduce((s, d) => s + d.received, 0);
    const live = chart.reduce((s, d) => s + d.live, 0);

    return {
      chartData: chart,
      totals: {
        received,
        live,
        removed: received - live,
        buckets: chart.length,
        avgPerBucket: chart.length ? Math.round((received / chart.length) * 10) / 10 : 0,
      },
      statusBreakdown: Array.from(breakdown.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [leads, granularity, excluded]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Lead volume — received vs live</CardTitle>
          <CardDescription className="mt-1">
            Green is every lead that came in. Blue is what is left after removing the statuses you untick below —
            the leads agents are actually working.
          </CardDescription>
        </div>
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {GRANULARITIES.map(g => (
            <Button
              key={g.key}
              size="sm"
              variant={granularity === g.key ? 'default' : 'outline'}
              className="h-8 text-xs"
              onClick={() => setGranularity(g.key)}
            >
              {g.label}
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Remove from live count</p>
          <div className="flex flex-wrap gap-2">
            {NON_WORKABLE.map(s => (
              <Button
                key={s.key}
                size="sm"
                variant={excluded.includes(s.key) ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={() => toggle(s.key)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{totals.received.toLocaleString('en-GB')} leads received</Badge>
          <Badge variant="secondary">{totals.live.toLocaleString('en-GB')} live leads</Badge>
          <Badge variant="outline">{totals.removed.toLocaleString('en-GB')} removed</Badge>
          <Badge variant="outline">Avg {totals.avgPerBucket} per {granularity}</Badge>
        </div>

        {isLoading ? (
          <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
            Loading lead volume…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  Number(value).toLocaleString('en-GB'),
                  name === 'received' ? 'Leads received' : 'Live leads',
                ]}
                labelStyle={{ fontWeight: 'bold' }}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend formatter={(value) => (value === 'received' ? 'Leads received' : 'Live leads')} />
              <Bar dataKey="received" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="live" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {statusBreakdown.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Status mix in this range</p>
            <div className="flex flex-wrap gap-2">
              {statusBreakdown.map(([status, count]) => (
                <Badge
                  key={status}
                  variant={excluded.includes(status) ? 'outline' : 'secondary'}
                  className="text-xs"
                >
                  {status.replace(/_/g, ' ')}: {count.toLocaleString('en-GB')}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
