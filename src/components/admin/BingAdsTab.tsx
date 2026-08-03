import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Search, Eye, Users, ShoppingCart, TrendingUp, MousePointerClick, RefreshCw, Clock, PoundSterling } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRange } from 'react-day-picker';
import { DateRangeFilter } from './DateRangeFilter';

const AUTO_REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour

const QUERY_KEYS = ['bing-page-views', 'bing-leads', 'bing-paid-customers', 'bing-leads-summary', 'bing-reconciliation'];

export const BingAdsTab: React.FC = () => {
  const [dateRange, setDateRange] = useState<string>('last7');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [leadsDateRange, setLeadsDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const queryClient = useQueryClient();

  const dateFrom = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case 'today': return startOfDay(now);
      case 'yesterday': return startOfDay(subDays(now, 1));
      case 'last7': return startOfDay(subDays(now, 7));
      case 'last30': return startOfDay(subDays(now, 30));
      case 'last90': return startOfDay(subDays(now, 90));
      default: return startOfDay(subDays(now, 7));
    }
  }, [dateRange]);

  const dateTo = useMemo(() => {
    if (dateRange === 'yesterday') return endOfDay(subDays(new Date(), 1));
    return endOfDay(new Date());
  }, [dateRange]);

  const refreshAll = () => {
    QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    setLastRefresh(new Date());
  };

  useEffect(() => {
    const interval = setInterval(refreshAll, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  // Bing page views (msclkid present or utm_source bing/microsoft/msn)
  const { data: bingPageViews, isLoading: pvLoading } = useQuery({
    queryKey: ['bing-page-views', dateRange],
    queryFn: async () => {
      const { count: totalCount, error: countError } = await supabase
        .from('page_views')
        .select('*', { count: 'exact', head: true })
        .eq('is_bing_ads', true)
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString());
      if (countError) throw countError;

      const allRows: any[] = [];
      const batchSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('page_views')
          .select('visitor_id, page_path, utm_source, utm_medium, utm_campaign, utm_content, msclkid, created_at')
          .eq('is_bing_ads', true)
          .gte('created_at', dateFrom.toISOString())
          .lte('created_at', dateTo.toISOString())
          .range(from, from + batchSize - 1)
          .order('created_at', { ascending: false });
        if (error) throw error;
        allRows.push(...(batch || []));
        hasMore = (batch?.length || 0) === batchSize;
        from += batchSize;
      }

      return { totalCount: totalCount || 0, rows: allRows };
    },
  });

  // Bing leads (abandoned carts with msclkid or bing utm_source)
  const { data: bingLeads, isLoading: leadsLoading } = useQuery({
    queryKey: ['bing-leads', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('abandoned_carts')
        .select('*')
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).filter((lead) => {
        const meta = lead.cart_metadata as Record<string, any> | null;
        if (!meta) return false;
        if (meta.msclkid) return true;
        const src = (meta.utm_source || '').toLowerCase();
        return src === 'bing' || src === 'microsoft' || src === 'msn';
      });
    },
  });

  const leadsDateFrom = useMemo(() => {
    if (!leadsDateRange?.from) return null;
    const d = new Date(leadsDateRange.from);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [leadsDateRange]);

  const leadsDateTo = useMemo(() => {
    if (!leadsDateRange?.to) {
      if (!leadsDateRange?.from) return null;
      const d = new Date(leadsDateRange.from);
      d.setHours(23, 59, 59, 999);
      return d;
    }
    const d = new Date(leadsDateRange.to);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [leadsDateRange]);

  const { data: summaryLeadsCount, isLoading: summaryLeadsLoading } = useQuery({
    queryKey: ['bing-leads-summary', leadsDateFrom?.toISOString(), leadsDateTo?.toISOString()],
    queryFn: async () => {
      if (!leadsDateFrom || !leadsDateTo) return 0;
      const { count, error } = await supabase
        .from('sales_leads')
        .select('*', { count: 'exact', head: true })
        .eq('lead_source', 'bing_ad')
        .gte('created_at', leadsDateFrom.toISOString())
        .lte('created_at', leadsDateTo.toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!leadsDateFrom && !!leadsDateTo,
  });

  // Paid customers attributed to Bing Ads
  const { data: bingPaidCustomers, isLoading: paidLoading } = useQuery({
    queryKey: ['bing-paid-customers', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, plan_type, signup_date, status, final_amount, warranty_reference_number, purchase_source, vehicle_make, vehicle_model, registration_plate')
        .eq('purchase_source', 'bing_ads')
        .gte('signup_date', dateFrom.toISOString())
        .lte('signup_date', dateTo.toISOString())
        .not('status', 'ilike', '%cancelled%')
        .not('status', 'ilike', '%refunded%')
        .order('signup_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: bingReconciliation } = useQuery({
    queryKey: ['bing-reconciliation', dateRange],
    queryFn: async () => {
      const { data: leads, error } = await supabase
        .from('sales_leads')
        .select('id, status')
        .eq('lead_source', 'bing_ad')
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString());
      if (error) throw error;
      const rows = leads || [];
      return {
        totalSalesLeads: rows.length,
        liveLeads: rows.filter(l => !['lost', 'fake_lead'].includes(l.status)).length,
        statusBreakdown: {
          new: rows.filter(l => l.status === 'new').length,
          contacted: rows.filter(l => l.status === 'contacted').length,
          follow_up: rows.filter(l => l.status === 'follow_up').length,
          converted: rows.filter(l => l.status === 'converted').length,
          lost: rows.filter(l => l.status === 'lost').length,
          fake: rows.filter(l => l.status === 'fake_lead').length,
        },
      };
    },
  });

  const uniqueVisitors = useMemo(() => {
    const set = new Set((bingPageViews?.rows || []).map(r => r.visitor_id).filter(Boolean));
    return set.size;
  }, [bingPageViews]);

  const convertedLeads = useMemo(() => (bingLeads || []).filter(l => l.is_converted), [bingLeads]);

  const revenue = useMemo(
    () => (bingPaidCustomers || []).reduce((sum, c: any) => sum + (Number(c.final_amount) || 0), 0),
    [bingPaidCustomers]
  );

  const totalViews = bingPageViews?.totalCount || 0;
  const leadCount = (bingLeads || []).length;
  const saleCount = (bingPaidCustomers || []).length;
  const viewToLead = totalViews > 0 ? (leadCount / totalViews) * 100 : 0;
  const leadToSale = leadCount > 0 ? (saleCount / leadCount) * 100 : 0;

  const campaignBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    (bingPageViews?.rows || []).forEach((r) => {
      const key = r.utm_campaign || '(no campaign)';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [bingPageViews]);

  const isLoading = pvLoading || leadsLoading || paidLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Search className="h-5 w-5 text-teal-600" />
            Bing Ads (Microsoft Advertising)
          </h3>
          <p className="text-sm text-muted-foreground">
            Traffic, leads and sales attributed to Bing via <code>msclkid</code> and Bing UTM tags
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="last7">Last 7 days</SelectItem>
              <SelectItem value="last30">Last 30 days</SelectItem>
              <SelectItem value="last90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Last updated {format(lastRefresh, 'HH:mm')} — auto refreshes hourly
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-teal-600" /> Page views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '—' : totalViews.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-600" /> Unique visitors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '—' : uniqueVisitors.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-teal-600" /> Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '—' : leadCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{viewToLead.toFixed(1)}% of views</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-teal-600" /> Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '—' : saleCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{leadToSale.toFixed(1)}% of leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PoundSterling className="h-4 w-4 text-teal-600" /> Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{revenue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Leads counter with its own date picker */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base">Bing leads in period</CardTitle>
            <CardDescription>Leads recorded in the CRM with source Bing Ads</CardDescription>
          </div>
          <DateRangeFilter dateRange={leadsDateRange} onDateRangeChange={setLeadsDateRange} />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{summaryLeadsLoading ? '—' : (summaryLeadsCount || 0).toLocaleString()}</div>
        </CardContent>
      </Card>

      {/* Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Bing funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground">Visits</div>
            <div className="text-xl font-bold">{totalViews.toLocaleString()}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground">Leads</div>
            <div className="text-xl font-bold">{leadCount.toLocaleString()}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground">Converted leads</div>
            <div className="text-xl font-bold">{convertedLeads.length.toLocaleString()}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground">Paid customers</div>
            <div className="text-xl font-bold">{saleCount.toLocaleString()}</div>
          </div>
        </CardContent>
      </Card>

      {/* Lead status reconciliation */}
      {bingReconciliation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CRM lead status breakdown</CardTitle>
            <CardDescription>
              {bingReconciliation.totalSalesLeads} Bing leads · {bingReconciliation.liveLeads} live
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(bingReconciliation.statusBreakdown).map(([status, count]) => (
              <Badge key={status} variant="outline" className="capitalize">
                {status.replace('_', ' ')}: {count as number}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Campaign breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Bing campaigns</CardTitle>
          <CardDescription>By tracked page views in the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {campaignBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Bing traffic recorded in this period yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignBreakdown.map(([campaign, count]) => (
                  <TableRow key={campaign}>
                    <TableCell>{campaign}</TableCell>
                    <TableCell className="text-right font-medium">{count.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Paid customers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bing Ads sales</CardTitle>
          <CardDescription>Customers attributed to Bing in the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {(bingPaidCustomers || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No Bing-attributed sales in this period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(bingPaidCustomers || []).map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {[c.vehicle_make, c.vehicle_model].filter(Boolean).join(' ') || '—'}
                      <div className="text-xs text-muted-foreground">{c.registration_plate || ''}</div>
                    </TableCell>
                    <TableCell className="text-sm">{c.plan_type || '—'}</TableCell>
                    <TableCell className="text-sm">
                      {c.signup_date ? format(new Date(c.signup_date), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      £{Number(c.final_amount || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BingAdsTab;
