import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardCheck, CalendarIcon, TrendingUp, ArrowRight } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, subMonths, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

type LeadPeriod = 'today' | 'yesterday' | 'last_week' | 'last_month' | 'custom';

const getLeadPeriodDates = (period: LeadPeriod, customDate?: { from: Date; to: Date }) => {
  const now = new Date();
  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now), label: format(now, 'dd MMM yyyy') };
    case 'yesterday':
      return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)), label: format(subDays(now, 1), 'dd MMM yyyy') };
    case 'last_week':
      return { from: startOfWeek(subDays(now, 7), { weekStartsOn: 1 }), to: endOfDay(subDays(startOfWeek(now, { weekStartsOn: 1 }), 1)), label: `${format(startOfWeek(subDays(now, 7), { weekStartsOn: 1 }), 'dd MMM')} – ${format(subDays(startOfWeek(now, { weekStartsOn: 1 }), 1), 'dd MMM')}` };
    case 'last_month':
      return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)), label: format(subMonths(now, 1), 'MMMM yyyy') };
    case 'custom':
      if (customDate) {
        return { from: startOfDay(customDate.from), to: endOfDay(customDate.to), label: `${format(customDate.from, 'dd MMM')} – ${format(customDate.to, 'dd MMM')}` };
      }
      return { from: startOfDay(now), to: endOfDay(now), label: format(now, 'dd MMM yyyy') };
  }
};

export const LeadFormCompletionsCard: React.FC = () => {
  const [period, setPeriod] = useState<LeadPeriod>('today');
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date }>({ from: new Date(), to: new Date() });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarSelection, setCalendarSelection] = useState<{ from?: Date; to?: Date }>({});

  const { from, to, label } = getLeadPeriodDates(period, customRange);

  const { data, isLoading } = useQuery({
    queryKey: ['lead-form-completions', from.toISOString(), to.toISOString()],
    queryFn: async () => {
      // Count abandoned_carts where step_abandoned >= 3 (completed step 2 lead form)
      // We use updated_at because step_abandoned gets updated as users progress
      // But created_at is when the record was first created (step 1)
      // We need records that REACHED step 3+ within our date range
      // The most accurate: query abandoned_carts created in range with step >= 3
      const [cartsRes, leadsRes] = await Promise.all([
        supabase
          .from('abandoned_carts')
          .select('id, full_name, email, phone, vehicle_reg, step_abandoned, created_at, is_converted')
          .gte('created_at', from.toISOString())
          .lte('created_at', to.toISOString())
          .gte('step_abandoned', 3)
          .order('created_at', { ascending: false }),
        supabase
          .from('sales_leads')
          .select('id')
          .gte('created_at', from.toISOString())
          .lte('created_at', to.toISOString()),
      ]);
      
      if (cartsRes.error) throw cartsRes.error;
      const carts = cartsRes.data;
      const uniqueLeads = leadsRes.data?.length || 0;
      
      const total = carts?.length || 0;
      const converted = carts?.filter(c => c.is_converted).length || 0;
      const step3 = carts?.filter(c => c.step_abandoned === 3).length || 0;
      const step4 = carts?.filter(c => c.step_abandoned >= 4).length || 0;
      
      // Daily breakdown
      const dayMap = new Map<string, number>();
      carts?.forEach(c => {
        const day = format(new Date(c.created_at), 'dd MMM');
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      });
      const dailyBreakdown = Array.from(dayMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { total, uniqueLeads, converted, step3, step4, dailyBreakdown, records: carts || [] };
    },
  });

  const periods: { key: LeadPeriod; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'last_week', label: 'Last Week' },
    { key: 'last_month', label: 'Last Month' },
  ];

  const handleCalendarSelect = (range: any) => {
    setCalendarSelection(range || {});
  };

  const applyCustomRange = () => {
    if (calendarSelection.from) {
      setCustomRange({
        from: calendarSelection.from,
        to: calendarSelection.to || calendarSelection.from,
      });
      setPeriod('custom');
      setCalendarOpen(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50/20">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ClipboardCheck className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-base">Lead Form Completions</CardTitle>
              <CardDescription className="text-xs">
                People who completed Step 2 (name, email, phone) and proceeded to Step 3
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {periods.map(p => (
              <Button
                key={p.key}
                variant={period === p.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p.key)}
                className={cn('text-xs h-8', period === p.key ? 'bg-orange-500 hover:bg-orange-600' : '')}
              >
                {p.label}
              </Button>
            ))}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={period === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  className={cn('text-xs h-8 gap-1.5', period === 'custom' ? 'bg-orange-500 hover:bg-orange-600' : '')}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {period === 'custom' ? label : 'Custom'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="end">
                <Calendar
                  mode="range"
                  selected={calendarSelection as any}
                  onSelect={handleCalendarSelect}
                  numberOfMonths={1}
                  disabled={(date) => date > new Date()}
                />
                <div className="flex justify-end mt-2">
                  <Button size="sm" className="text-xs bg-orange-500 hover:bg-orange-600" onClick={applyCustomRange} disabled={!calendarSelection.from}>
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg border bg-white text-center">
                <p className="text-3xl font-bold text-gray-900">{data.total}</p>
                <p className="text-xs text-gray-500 mt-1">Total Completions</p>
                <p className="text-[10px] text-gray-400">Incl. re-submissions</p>
              </div>
              <div className="p-3 rounded-lg border bg-orange-50 text-center">
                <p className="text-3xl font-bold text-orange-600">{data.uniqueLeads}</p>
                <p className="text-xs text-orange-700 mt-1">Unique Leads</p>
                <p className="text-[10px] text-orange-500">De-duplicated</p>
              </div>
              <div className="p-3 rounded-lg border bg-white text-center">
                <p className="text-3xl font-bold text-blue-600">{data.step3}</p>
                <p className="text-xs text-gray-500 mt-1">Stopped at Step 3</p>
                <p className="text-[10px] text-gray-400">Viewed pricing</p>
              </div>
              <div className="p-3 rounded-lg border bg-white text-center">
                <p className="text-3xl font-bold text-purple-600">{data.step4}</p>
                <p className="text-xs text-gray-500 mt-1">Reached Step 4</p>
                <p className="text-[10px] text-gray-400">Checkout</p>
              </div>
              <div className="p-3 rounded-lg border bg-green-50 text-center">
                <p className="text-3xl font-bold text-green-600">{data.converted}</p>
                <p className="text-xs text-green-700 mt-1">Converted</p>
                <p className="text-[10px] text-green-600">
                  {data.total > 0 ? `${((data.converted / data.total) * 100).toFixed(1)}%` : '0%'} rate
                </p>
              </div>
            </div>

            {/* Funnel visualization */}
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-gray-500">
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                Step 2 Form ✓ ({data.total})
              </Badge>
              <ArrowRight className="h-3.5 w-3.5" />
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Step 3 Pricing ({data.step3 + data.step4})
              </Badge>
              <ArrowRight className="h-3.5 w-3.5" />
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                Step 4 Checkout ({data.step4})
              </Badge>
              <ArrowRight className="h-3.5 w-3.5" />
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Converted ({data.converted})
              </Badge>
            </div>

            {/* Daily breakdown if multi-day period */}
            {data.dailyBreakdown.length > 1 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Daily Breakdown</p>
                <div className="flex flex-wrap gap-2">
                  {data.dailyBreakdown.map(d => (
                    <div key={d.date} className="px-3 py-1.5 rounded-md border bg-white text-center min-w-[70px]">
                      <p className="text-sm font-bold text-gray-900">{d.count}</p>
                      <p className="text-[10px] text-gray-500">{d.date}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
