import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Search, Eye, Users, ShoppingCart, TrendingUp, MousePointerClick, RefreshCw, Clock, PoundSterling } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRange } from 'react-day-picker';
import { DateRangeFilter } from './DateRangeFilter';

const AUTO_REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour

const QUERY_KEYS = ['tiktok-page-views', 'tiktok-leads', 'tiktok-paid-customers', 'tiktok-leads-summary', 'tiktok-reconciliation'];

export const TikTokAdsTab: React.FC = () => {
  const [metricsRange, setMetricsRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 6),
    to: new Date(),
  });
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [leadsDateRange, setLeadsDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const queryClient = useQueryClient();

  const dateFrom = useMemo(
    () => startOfDay(metricsRange?.from ?? subDays(new Date(), 6)),
    [metricsRange]
  );

  const dateTo = useMemo(
    () => endOfDay(metricsRange?.to ?? metricsRange?.from ?? new Date()),
    [metricsRange]
  );

  const rangeKey = useMemo(
    () => `${dateFrom.toISOString()}_${dateTo.toISOString()}`,
    [dateFrom, dateTo]
  );

  const refreshAll = () => {
    QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    setLastRefresh(new Date());
  };

  useEffect(() => {
    const interval = setInterval(refreshAll, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  // TikTok page views (ttclid present or utm_source tiktok)
  const { data: tiktokPageViews, isLoading: pvLoading } = useQuery({
    queryKey: ['tiktok-page-views', rangeKey],
    queryFn: async () => {
      const { count: totalCount, error: countError } = await supabase
        .from('page_views')
        .select('*', { count: 'exact', head: true })
        .eq('is_tiktok_ads', true)
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
          .select('visitor_id, page_path, utm_source, utm_medium, utm_campaign, utm_content, ttclid, created_at')
          .eq('is_tiktok_ads', true)
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

  // TikTok leads (abandoned carts with ttclid or tiktok utm_source)
  const { data: tiktokLeads, isLoading: leadsLoading } = useQuery({
    queryKey: ['tiktok-leads', rangeKey],
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
        if (meta.ttclid) return true;
        const src = (meta.utm_source || '').toLowerCase();
        return src === 'tiktok' || src === 'tik_tok' || src === 'tt';
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
    queryKey: ['tiktok-leads-summary', leadsDateFrom?.toISOString(), leadsDateTo?.toISOString()],
    queryFn: async () => {
      if (!leadsDateFrom || !leadsDateTo) return 0;
      const { count, error } = await supabase
        .from('sales_leads')
        .select('*', { count: 'exact', head: true })
        .eq('lead_source', 'tiktok_ad')
        .gte('created_at', leadsDateFrom.toISOString())
        .lte('created_at', leadsDateTo.toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!leadsDateFrom && !!leadsDateTo,
  });

  // Paid customers attributed to TikTok Ads
  const { data: tiktokPaidCustomers, isLoading: paidLoading } = useQuery({
    queryKey: ['tiktok-paid-customers', rangeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, plan_type, signup_date, status, final_amount, warranty_reference_number, purchase_source, vehicle_make, vehicle_model, registration_plate')
        .eq('purchase_source', 'tiktok_ads')
        .gte('signup_date', dateFrom.toISOString())
        .lte('signup_date', dateTo.toISOString())
        .not('status', 'ilike', '%cancelled%')
        .not('status', 'ilike', '%refunded%')
        .order('signup_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tiktokReconciliation } = useQuery({
    queryKey: ['tiktok-reconciliation', rangeKey],
    queryFn: async () => {
      const { data: leads, error } = await supabase
        .from('sales_leads')
        .select('id, status')
        .eq('lead_source', 'tiktok_ad')
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
    const set = new Set((tiktokPageViews?.rows || []).map(r => r.visitor_id).filter(Boolean));
    return set.size;
  }, [tiktokPageViews]);

  const convertedLeads = useMemo(() => (tiktokLeads || []).filter(l => l.is_converted), [tiktokLeads]);

  const revenue = useMemo(
    () => (tiktokPaidCustomers || []).reduce((sum, c: any) => sum + (Number(c.final_amount) || 0), 0),
    [tiktokPaidCustomers]
  );

  const totalViews = tiktokPageViews?.totalCount || 0;
  const leadCount = (tiktokLeads || []).length;
  const saleCount = (tiktokPaidCustomers || []).length;
  const viewToLead = totalViews > 0 ? (leadCount / totalViews) * 100 : 0;
  const leadToSale = leadCount > 0 ? (saleCount / leadCount) * 100 : 0;

  const campaignBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    (tiktokPageViews?.rows || []).forEach((r) => {
      const key = r.utm_campaign || '(no campaign)';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [tiktokPageViews]);

  // Top landing pages for this channel's traffic
  const pageBreakdown = useMemo(() => {
    const rows = tiktokPageViews?.rows || [];
    const counts: Record<string, number> = {};
    rows.forEach((pv) => {
      const path = pv.page_path || '/';
      counts[path] = (counts[path] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([path, views]) => ({ path, views }));
  }, [tiktokPageViews]);

  // Daily funnel: visitors → leads → paid sales → revenue
  const dailyFunnel = useMemo(() => {
    const days: Record<string, { visitors: Set<string>; views: number; leads: number; conversions: number; sales: number; revenue: number }> = {};
    const ensure = (day: string) => {
      if (!days[day]) days[day] = { visitors: new Set(), views: 0, leads: 0, conversions: 0, sales: 0, revenue: 0 };
      return days[day];
    };

    (tiktokPageViews?.rows || []).forEach((pv) => {
      const d = ensure(format(new Date(pv.created_at), 'yyyy-MM-dd'));
      d.views++;
      if (pv.visitor_id) d.visitors.add(pv.visitor_id);
    });

    (tiktokLeads || []).forEach((lead: any) => {
      const d = ensure(format(new Date(lead.created_at), 'yyyy-MM-dd'));
      d.leads++;
      if (lead.is_converted) d.conversions++;
    });

    (tiktokPaidCustomers || []).forEach((c: any) => {
      if (!c.signup_date) return;
      const d = ensure(format(new Date(c.signup_date), 'yyyy-MM-dd'));
      d.sales++;
      d.revenue += Number(c.final_amount) || 0;
    });

    return Object.entries(days)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, data]) => ({
        date,
        visitors: data.visitors.size,
        views: data.views,
        leads: data.leads,
        conversions: data.conversions,
        sales: data.sales,
        revenue: data.revenue,
        formRate: data.visitors.size > 0 ? ((data.leads / data.visitors.size) * 100).toFixed(1) : '0',
      }));
  }, [tiktokPageViews, tiktokLeads, tiktokPaidCustomers]);

  const isLoading = pvLoading || leadsLoading || paidLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Search className="h-5 w-5 text-teal-600" />
            TikTok Ads
          </h3>
          <p className="text-sm text-muted-foreground">
            Traffic, leads and sales attributed to TikTok via <code>ttclid</code> and TikTok UTM tags
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={metricsRange?.from && metricsRange?.to &&
              startOfDay(metricsRange.from).getTime() === startOfDay(new Date()).getTime() &&
              startOfDay(metricsRange.to).getTime() === startOfDay(new Date()).getTime() ? 'default' : 'outline'}
            size="sm"
            className="text-xs"
            onClick={() => setMetricsRange({ from: new Date(), to: new Date() })}
          >
            Today
          </Button>
          <Button
            variant={metricsRange?.from && metricsRange?.to &&
              startOfDay(metricsRange.from).getTime() === startOfDay(subDays(new Date(), 1)).getTime() &&
              startOfDay(metricsRange.to).getTime() === startOfDay(subDays(new Date(), 1)).getTime() ? 'default' : 'outline'}
            size="sm"
            className="text-xs"
            onClick={() => { const y = subDays(new Date(), 1); setMetricsRange({ from: y, to: y }); }}
          >
            Yesterday
          </Button>
          <DateRangeFilter dateRange={metricsRange} onDateRangeChange={setMetricsRange} />
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
            <CardTitle className="text-base">TikTok leads in period</CardTitle>
            <CardDescription>Leads recorded in the CRM with source TikTok Ads</CardDescription>
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
            <TrendingUp className="h-4 w-4" /> TikTok funnel
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
      {tiktokReconciliation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CRM lead status breakdown</CardTitle>
            <CardDescription>
              {tiktokReconciliation.totalSalesLeads} TikTok leads · {tiktokReconciliation.liveLeads} live
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(tiktokReconciliation.statusBreakdown).map(([status, count]) => (
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
          <CardTitle className="text-base">Top TikTok campaigns</CardTitle>
          <CardDescription>By tracked page views in the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {campaignBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No TikTok traffic recorded in this period yet.</p>
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

      {/* Daily funnel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Daily TikTok funnel</CardTitle>
          <CardDescription>Visitors → leads → paid sales → revenue by day</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyFunnel.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No data in this period</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Visitors</TableHead>
                  <TableHead className="text-right">Page views</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Paid sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Form rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyFunnel.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="font-medium">{format(new Date(row.date), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="text-right">{row.visitors}</TableCell>
                    <TableCell className="text-right">{row.views}</TableCell>
                    <TableCell className="text-right">{row.leads}</TableCell>
                    <TableCell className="text-right font-semibold text-green-700">{row.sales}</TableCell>
                    <TableCell className="text-right font-semibold text-green-700">{row.revenue > 0 ? `£${row.revenue.toFixed(0)}` : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-xs">{row.formRate}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Top pages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top pages (TikTok traffic)</CardTitle>
          <CardDescription>Which pages TikTok visitors are landing on</CardDescription>
        </CardHeader>
        <CardContent>
          {pageBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No page view data in this period</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageBreakdown.map((row) => (
                  <TableRow key={row.path}>
                    <TableCell className="font-mono text-sm">{row.path}</TableCell>
                    <TableCell className="text-right">{row.views}</TableCell>
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
          <CardTitle className="text-base">TikTok Ads sales</CardTitle>
          <CardDescription>Customers attributed to TikTok in the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {(tiktokPaidCustomers || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No TikTok-attributed sales in this period.</p>
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
                {(tiktokPaidCustomers || []).map((c: any) => (
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

export default TikTokAdsTab;
