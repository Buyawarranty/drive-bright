import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Facebook, PoundSterling, ShoppingCart, TrendingUp, Calendar } from 'lucide-react';
import { startOfMonth, startOfDay, endOfDay, subDays, subMonths, format } from 'date-fns';

type DatePreset = 'this_month' | 'last_month' | 'today' | 'yesterday' | 'last7' | 'last30' | 'last90';

const presetLabels: Record<DatePreset, string> = {
  this_month: 'This Month',
  last_month: 'Last Month',
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 Days',
  last30: 'Last 30 Days',
  last90: 'Last 90 Days',
};

function getDateRange(preset: DatePreset): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case 'this_month': return { from: startOfMonth(now), to: endOfDay(now) };
    case 'last_month': {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfDay(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)) };
    }
    case 'today': return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case 'last7': return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
    case 'last30': return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    case 'last90': return { from: startOfDay(subDays(now, 90)), to: endOfDay(now) };
  }
}

export const MarketingOverviewCards: React.FC = () => {
  const [preset, setPreset] = useState<DatePreset>('this_month');

  const { from, to } = useMemo(() => getDateRange(preset), [preset]);

  // Google Ads deals (purchase_source = 'google_ads')
  const { data: googleData, isLoading: gLoading } = useQuery({
    queryKey: ['marketing-overview-google', preset],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, final_amount')
        .eq('purchase_source', 'google_ads')
        .eq('is_deleted', false)
        .not('status', 'ilike', '%cancelled%')
        .not('status', 'ilike', '%refunded%')
        .gte('signup_date', from.toISOString())
        .lte('signup_date', to.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  // Facebook Ads deals (purchase_source = 'facebook_ads')
  const { data: facebookData, isLoading: fLoading } = useQuery({
    queryKey: ['marketing-overview-facebook', preset],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, final_amount')
        .eq('purchase_source', 'facebook_ads')
        .eq('is_deleted', false)
        .not('status', 'ilike', '%cancelled%')
        .not('status', 'ilike', '%refunded%')
        .gte('signup_date', from.toISOString())
        .lte('signup_date', to.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  const googleStats = useMemo(() => {
    const items = googleData || [];
    return {
      deals: items.length,
      revenue: items.reduce((sum, c) => sum + (c.final_amount || 0), 0),
    };
  }, [googleData]);

  const facebookStats = useMemo(() => {
    const items = facebookData || [];
    return {
      deals: items.length,
      revenue: items.reduce((sum, c) => sum + (c.final_amount || 0), 0),
    };
  }, [facebookData]);

  const totalDeals = googleStats.deals + facebookStats.deals;
  const totalRevenue = googleStats.revenue + facebookStats.revenue;
  const isLoading = gLoading || fLoading;

  return (
    <div className="space-y-3">
      {/* Date range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {format(from, 'd MMM')} – {format(to, 'd MMM yyyy')}
          </span>
        </div>
        <Select value={preset} onValueChange={(v) => setPreset(v as DatePreset)}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(presetLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Google Ads Deals */}
        <Card className="border-blue-200/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-100 rounded-md">
                <Target className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Google Ads</span>
            </div>
            <p className="text-2xl font-bold">{isLoading ? '…' : googleStats.deals}</p>
            <p className="text-xs text-muted-foreground">deals closed</p>
          </CardContent>
        </Card>

        {/* Google Ads Revenue */}
        <Card className="border-blue-200/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-100 rounded-md">
                <PoundSterling className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Google Revenue</span>
            </div>
            <p className="text-2xl font-bold">{isLoading ? '…' : `£${googleStats.revenue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`}</p>
            <p className="text-xs text-muted-foreground">income generated</p>
          </CardContent>
        </Card>

        {/* Facebook Ads Deals */}
        <Card className="border-indigo-200/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-indigo-100 rounded-md">
                <Facebook className="h-4 w-4 text-indigo-600" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Facebook Ads</span>
            </div>
            <p className="text-2xl font-bold">{isLoading ? '…' : facebookStats.deals}</p>
            <p className="text-xs text-muted-foreground">deals closed</p>
          </CardContent>
        </Card>

        {/* Facebook Ads Revenue */}
        <Card className="border-indigo-200/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-indigo-100 rounded-md">
                <PoundSterling className="h-4 w-4 text-indigo-600" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Facebook Revenue</span>
            </div>
            <p className="text-2xl font-bold">{isLoading ? '…' : `£${facebookStats.revenue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`}</p>
            <p className="text-xs text-muted-foreground">income generated</p>
          </CardContent>
        </Card>

        {/* Combined Total */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-primary/10 rounded-md">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Combined</span>
            </div>
            <p className="text-2xl font-bold">{isLoading ? '…' : totalDeals} <span className="text-sm font-normal text-muted-foreground">deals</span></p>
            <p className="text-sm font-semibold text-primary">{isLoading ? '…' : `£${totalRevenue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
