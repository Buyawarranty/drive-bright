import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Facebook, Eye, Users, ShoppingCart, TrendingUp, MousePointerClick, RefreshCw, Clock, ArrowRight, PoundSterling, Target, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRange } from 'react-day-picker';
import { DateRangeFilter } from './DateRangeFilter';

const AUTO_REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour

export const FacebookAdsTab: React.FC = () => {
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

  // Auto-refresh every hour
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['fb-page-views'] });
      queryClient.invalidateQueries({ queryKey: ['fb-leads'] });
      queryClient.invalidateQueries({ queryKey: ['fb-step2-attempts'] });
      queryClient.invalidateQueries({ queryKey: ['fb-paid-customers'] });
      queryClient.invalidateQueries({ queryKey: ['fb-reconciliation'] });
      setLastRefresh(new Date());
    }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [queryClient]);

  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['fb-page-views'] });
    queryClient.invalidateQueries({ queryKey: ['fb-leads'] });
    queryClient.invalidateQueries({ queryKey: ['fb-step2-attempts'] });
    queryClient.invalidateQueries({ queryKey: ['fb-paid-customers'] });
    queryClient.invalidateQueries({ queryKey: ['fb-reconciliation'] });
    setLastRefresh(new Date());
  };

  // Fetch Facebook page views - use server-side count + paginated fetch for breakdowns
  const { data: fbPageViews, isLoading: pvLoading } = useQuery({
    queryKey: ['fb-page-views', dateRange],
    queryFn: async () => {
      // Get accurate total count via server
      const { count: totalCount, error: countError } = await supabase
        .from('page_views')
        .select('*', { count: 'exact', head: true })
        .eq('is_facebook_ads', true)
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString());
      if (countError) throw countError;

      // Fetch all rows in batches for breakdowns (visitor_id, utm, page_path)
      const allRows: any[] = [];
      const batchSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('page_views')
          .select('visitor_id, page_path, utm_source, utm_medium, utm_campaign, utm_content, created_at')
          .eq('is_facebook_ads', true)
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

  // Fetch Facebook leads (abandoned carts with fbclid in metadata)
  const { data: fbLeads, isLoading: leadsLoading } = useQuery({
    queryKey: ['fb-leads', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('abandoned_carts')
        .select('*')
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Filter for FB leads client-side (cart_metadata contains fbclid or utm_source=facebook/fb/ig)
      return (data || []).filter((lead) => {
        const meta = lead.cart_metadata as Record<string, any> | null;
        if (!meta) return false;
        if (meta.fbclid) return true;
        const src = (meta.utm_source || '').toLowerCase();
        return src === 'facebook' || src === 'fb' || src === 'ig';
      });
    },
  });

  // Separate query for the leads summary bar (driven by leadsDateRange)
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
    queryKey: ['fb-leads-summary', leadsDateFrom?.toISOString(), leadsDateTo?.toISOString()],
    queryFn: async () => {
      if (!leadsDateFrom || !leadsDateTo) return 0;
      // Query sales_leads with social_ad source (consistent with how Google Ads tab works)
      const { count, error } = await supabase
        .from('sales_leads')
        .select('*', { count: 'exact', head: true })
        .eq('lead_source', 'social_ad')
        .gte('created_at', leadsDateFrom.toISOString())
        .lte('created_at', leadsDateTo.toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!leadsDateFrom && !!leadsDateTo,
  });

  // Fetch Step 2 attempts in the period
  const { data: step2Attempts, isLoading: attemptsLoading } = useQuery({
    queryKey: ['fb-step2-attempts', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('step2_submission_attempts')
        .select('*')
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch PAID customers attributed to Facebook Ads
  const { data: fbPaidCustomers, isLoading: paidLoading } = useQuery({
    queryKey: ['fb-paid-customers', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, plan_type, signup_date, status, final_amount, warranty_reference_number, purchase_source, vehicle_make, vehicle_model, registration_plate')
        .eq('purchase_source', 'facebook_ads')
        .gte('signup_date', dateFrom.toISOString())
        .lte('signup_date', dateTo.toISOString())
        .not('status', 'ilike', '%cancelled%')
        .not('status', 'ilike', '%refunded%')
        .order('signup_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch ALL-TIME FB paid customers for total metrics
  const { data: fbAllTimePaid } = useQuery({
    queryKey: ['fb-paid-customers-alltime'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, final_amount, signup_date')
        .eq('purchase_source', 'facebook_ads')
        .not('status', 'ilike', '%cancelled%')
        .not('status', 'ilike', '%refunded%');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch lead reconciliation data: sales_leads with social_ad source + terminal-blocked logs
  const { data: fbReconciliation } = useQuery({
    queryKey: ['fb-reconciliation', dateRange],
    queryFn: async () => {
      const { data: socialLeads, error: slErr } = await supabase
        .from('sales_leads')
        .select('id, status')
        .eq('lead_source', 'social_ad')
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString());
      if (slErr) throw slErr;

      const { count: blockedCount, error: blErr } = await supabase
        .from('system_event_logs')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'lead_blocked_by_terminal')
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString());
      if (blErr) console.error('Error fetching blocked count:', blErr);

      const { data: allCarts, error: acErr } = await supabase
        .from('abandoned_carts')
        .select('id, cart_metadata')
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString());
      if (acErr) throw acErr;

      const noMetadataCount = (allCarts || []).filter(c => !c.cart_metadata).length;
      const leads = socialLeads || [];
      const statusBreakdown = {
        new: leads.filter(l => l.status === 'new').length,
        contacted: leads.filter(l => l.status === 'contacted').length,
        follow_up: leads.filter(l => l.status === 'follow_up').length,
        converted: leads.filter(l => l.status === 'converted').length,
        lost: leads.filter(l => l.status === 'lost').length,
        fake: leads.filter(l => l.status === 'fake_lead').length,
        other: leads.filter(l => !['new', 'contacted', 'follow_up', 'converted', 'lost', 'fake_lead'].includes(l.status)).length,
      };

      return {
        totalSalesLeads: leads.length,
        liveLeads: leads.filter(l => !['lost', 'fake_lead'].includes(l.status)).length,
        blockedByTerminal: blockedCount || 0,
        noMetadata: noMetadataCount,
        statusBreakdown,
      };
    },
  });

  // Count conversions from FB leads
  const fbConvertedLeads = useMemo(() => {
    return (fbLeads || []).filter(l => l.is_converted);
  }, [fbLeads]);

  // Step 2 stats
  const step2Stats = useMemo(() => {
    const attempts = step2Attempts || [];
    return {
      total: attempts.length,
      success: attempts.filter(a => a.attempt_status === 'success').length,
      failed: attempts.filter(a => a.attempt_status === 'failed').length,
      pending: attempts.filter(a => a.attempt_status === 'attempted').length,
    };
  }, [step2Attempts]);

  // Revenue metrics
  const revenueStats = useMemo(() => {
    const customers = fbPaidCustomers || [];
    const totalRevenue = customers.reduce((sum, c) => sum + (c.final_amount || 0), 0);
    const avgOrderValue = customers.length > 0 ? totalRevenue / customers.length : 0;
    return {
      totalRevenue,
      avgOrderValue,
      paidCount: customers.length,
    };
  }, [fbPaidCustomers]);

  const allTimeStats = useMemo(() => {
    const customers = fbAllTimePaid || [];
    const totalRevenue = customers.reduce((sum, c) => sum + ((c as any).final_amount || 0), 0);
    return {
      totalRevenue,
      totalCustomers: customers.length,
    };
  }, [fbAllTimePaid]);

  // Summary stats
  const totalPageViews = fbPageViews?.totalCount || 0;
  const uniqueVisitors = new Set(fbPageViews?.rows?.map(pv => pv.visitor_id)).size;
  const totalLeads = fbLeads?.length || 0;
  const totalConversions = fbConvertedLeads.length;
  const conversionRate = uniqueVisitors > 0 ? ((totalLeads / uniqueVisitors) * 100).toFixed(1) : '0';
  const purchaseRate = totalLeads > 0 ? ((revenueStats.paidCount / totalLeads) * 100).toFixed(1) : '0';

  // Page breakdown
  const pageBreakdown = useMemo(() => {
    const rows = fbPageViews?.rows;
    if (!rows) return [];
    const counts: Record<string, number> = {};
    rows.forEach(pv => {
      const path = pv.page_path || '/';
      counts[path] = (counts[path] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([path, views]) => ({ path, views }));
  }, [fbPageViews]);

  // UTM breakdown
  const utmBreakdown = useMemo(() => {
    const rows = fbPageViews?.rows;
    if (!rows) return [];
    const campaigns: Record<string, { views: number; campaign: string; medium: string; content: string }> = {};
    rows.forEach(pv => {
      const campaign = pv.utm_campaign || '(none)';
      const key = campaign;
      if (!campaigns[key]) {
        campaigns[key] = {
          campaign,
          medium: pv.utm_medium || '(none)',
          content: pv.utm_content || '(none)',
          views: 0,
        };
      }
      campaigns[key].views++;
    });
    return Object.values(campaigns).sort((a, b) => b.views - a.views);
  }, [fbPageViews]);

  // Daily breakdown for funnel
  const dailyFunnel = useMemo(() => {
    const rows = fbPageViews?.rows;
    if (!rows) return [];
    const days: Record<string, { visitors: Set<string>; views: number; leads: number; conversions: number; revenue: number }> = {};
    
    rows.forEach(pv => {
      const day = format(new Date(pv.created_at), 'yyyy-MM-dd');
      if (!days[day]) days[day] = { visitors: new Set(), views: 0, leads: 0, conversions: 0, revenue: 0 };
      days[day].views++;
      if (pv.visitor_id) days[day].visitors.add(pv.visitor_id);
    });
    
    (fbLeads || []).forEach(lead => {
      const day = format(new Date(lead.created_at), 'yyyy-MM-dd');
      if (!days[day]) days[day] = { visitors: new Set(), views: 0, leads: 0, conversions: 0, revenue: 0 };
      days[day].leads++;
      if (lead.is_converted) days[day].conversions++;
    });

    (fbPaidCustomers || []).forEach(customer => {
      const day = format(new Date(customer.signup_date), 'yyyy-MM-dd');
      if (!days[day]) days[day] = { visitors: new Set(), views: 0, leads: 0, conversions: 0, revenue: 0 };
      days[day].revenue += customer.final_amount || 0;
    });
    
    return Object.entries(days)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, data]) => ({
        date,
        visitors: data.visitors.size,
        views: data.views,
        leads: data.leads,
        conversions: data.conversions,
        revenue: data.revenue,
        formRate: data.visitors.size > 0 ? ((data.leads / data.visitors.size) * 100).toFixed(1) : '0',
      }));
  }, [fbPageViews, fbLeads, fbPaidCustomers]);

  const isLoading = pvLoading || leadsLoading || attemptsLoading || paidLoading;

  return (
    <div className="space-y-6">
      {/* Top-level Leads Summary with Date Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Facebook className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900">
              Facebook Leads: {summaryLeadsLoading ? '...' : (summaryLeadsCount ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">Leads from Facebook/Instagram ads in selected period</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={leadsDateRange?.from && leadsDateRange?.to && 
              startOfDay(leadsDateRange.from).getTime() === startOfDay(new Date()).getTime() && 
              startOfDay(leadsDateRange.to).getTime() === startOfDay(new Date()).getTime() ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLeadsDateRange({ from: new Date(), to: new Date() })}
            className="text-xs"
          >
            Today
          </Button>
          <Button
            variant={leadsDateRange?.from && leadsDateRange?.to && 
              startOfDay(leadsDateRange.from).getTime() === startOfDay(subDays(new Date(), 1)).getTime() && 
              startOfDay(leadsDateRange.to).getTime() === startOfDay(subDays(new Date(), 1)).getTime() ? 'default' : 'outline'}
            size="sm"
            onClick={() => { const y = subDays(new Date(), 1); setLeadsDateRange({ from: y, to: y }); }}
            className="text-xs"
          >
            Yesterday
          </Button>
          <DateRangeFilter
            dateRange={leadsDateRange}
            onDateRangeChange={setLeadsDateRange}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            Facebook & Instagram Ads Performance
          </h3>
          <p className="text-sm text-muted-foreground">
            Live revenue, leads & conversions from Meta ads · Auto-refreshes hourly
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(lastRefresh, 'HH:mm')}
          </span>
          <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
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
        </div>
      </div>

      {/* Revenue & ROI Summary - NEW */}
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PoundSterling className="h-4 w-4 text-green-700" />
            Facebook Ads Revenue (Period)
          </CardTitle>
          <CardDescription>Paid customers attributed to Facebook/Instagram ads via FBCLID or UTM</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-background rounded-lg border">
              <p className="text-3xl font-bold text-green-700">
                {isLoading ? '...' : `£${revenueStats.totalRevenue.toFixed(0)}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Total Revenue</p>
            </div>
            <div className="text-center p-4 bg-background rounded-lg border">
              <p className="text-3xl font-bold">{isLoading ? '...' : revenueStats.paidCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Paid Customers</p>
            </div>
            <div className="text-center p-4 bg-background rounded-lg border">
              <p className="text-3xl font-bold">
                {isLoading ? '...' : `£${revenueStats.avgOrderValue.toFixed(0)}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Avg Order Value</p>
            </div>
            <div className="text-center p-4 bg-background rounded-lg border">
              <p className="text-3xl font-bold text-blue-700">{isLoading ? '...' : `${purchaseRate}%`}</p>
              <p className="text-xs text-muted-foreground mt-1">Lead → Sale Rate</p>
            </div>
          </div>
          {/* All-time summary */}
          <div className="mt-3 p-3 rounded-lg bg-muted/50 border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">All-time Facebook Ads:</span>
            <span className="text-sm font-semibold">
              {allTimeStats.totalCustomers} customers · £{allTimeStats.totalRevenue.toFixed(0)} revenue
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Funnel */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">📊 Facebook Conversion Funnel</CardTitle>
          <CardDescription>Visitor → Form Completion → Paid Customer pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {/* Visitors */}
            <div className="text-center p-4 bg-background rounded-lg border min-w-[120px]">
              <p className="text-3xl font-bold">{isLoading ? '...' : uniqueVisitors}</p>
              <p className="text-xs text-muted-foreground mt-1">FB Visitors</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
            {/* Form Completions */}
            <div className="text-center p-4 bg-background rounded-lg border min-w-[120px]">
              <p className="text-3xl font-bold">{isLoading ? '...' : totalLeads}</p>
              <p className="text-xs text-muted-foreground mt-1">Form Completions</p>
              <p className="text-xs font-medium text-blue-600 mt-0.5">{conversionRate}% of visitors</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
            {/* Paid Customers */}
            <div className="text-center p-4 bg-background rounded-lg border min-w-[120px] border-green-200">
              <p className="text-3xl font-bold text-green-700">{isLoading ? '...' : revenueStats.paidCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Paid Customers</p>
              <p className="text-xs font-medium text-green-600 mt-0.5">{purchaseRate}% of leads</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
            {/* Revenue */}
            <div className="text-center p-4 bg-background rounded-lg border min-w-[120px] border-green-300">
              <p className="text-3xl font-bold text-green-700">{isLoading ? '...' : `£${revenueStats.totalRevenue.toFixed(0)}`}</p>
              <p className="text-xs text-muted-foreground mt-1">Revenue</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lead Reconciliation Card */}
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            Lead Reconciliation — Facebook vs CRM
          </CardTitle>
          <CardDescription>
            Explains why Facebook Ads Manager count differs from CRM numbers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="p-3 rounded-lg border bg-blue-50 text-center">
              <p className="text-2xl font-bold text-blue-700">{isLoading ? '...' : totalLeads}</p>
              <p className="text-xs text-muted-foreground mt-1">Carts with FBCLID</p>
              <p className="text-[10px] text-muted-foreground">(abandoned_carts)</p>
            </div>
            <div className="p-3 rounded-lg border bg-background text-center">
              <p className="text-2xl font-bold">{isLoading ? '...' : fbReconciliation?.totalSalesLeads ?? '...'}</p>
              <p className="text-xs text-muted-foreground mt-1">Sales Leads Created</p>
              <p className="text-[10px] text-muted-foreground">(social_ad source)</p>
            </div>
            <div className="p-3 rounded-lg border bg-emerald-50 text-center">
              <p className="text-2xl font-bold text-emerald-700">{isLoading ? '...' : fbReconciliation?.liveLeads ?? '...'}</p>
              <p className="text-xs text-muted-foreground mt-1">Live Leads</p>
              <p className="text-[10px] text-muted-foreground">(excl. lost/fake)</p>
            </div>
            <div className="p-3 rounded-lg border bg-red-50 text-center">
              <p className="text-2xl font-bold text-red-700">{isLoading ? '...' : fbReconciliation?.blockedByTerminal ?? '...'}</p>
              <p className="text-xs text-muted-foreground mt-1">Blocked (Terminal)</p>
              <p className="text-[10px] text-muted-foreground">(repeat visitors)</p>
            </div>
            <div className="p-3 rounded-lg border bg-gray-50 text-center">
              <p className="text-2xl font-bold text-gray-600">{isLoading ? '...' : fbReconciliation?.noMetadata ?? '...'}</p>
              <p className="text-xs text-muted-foreground mt-1">No Metadata</p>
              <p className="text-[10px] text-muted-foreground">(missing attribution)</p>
            </div>
          </div>

          {/* Status breakdown */}
          {fbReconciliation && (
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">New: {fbReconciliation.statusBreakdown.new}</Badge>
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Contacted: {fbReconciliation.statusBreakdown.contacted}</Badge>
              <Badge className="bg-purple-100 text-purple-800 border-purple-200">Follow-up: {fbReconciliation.statusBreakdown.follow_up}</Badge>
              <Badge className="bg-green-100 text-green-800 border-green-200">Converted: {fbReconciliation.statusBreakdown.converted}</Badge>
              <Badge className="bg-gray-100 text-gray-800 border-gray-200">Lost: {fbReconciliation.statusBreakdown.lost}</Badge>
              <Badge className="bg-red-100 text-red-800 border-red-200">Fake: {fbReconciliation.statusBreakdown.fake}</Badge>
              {fbReconciliation.statusBreakdown.other > 0 && (
                <Badge className="bg-muted text-muted-foreground">Other: {fbReconciliation.statusBreakdown.other}</Badge>
              )}
            </div>
          )}

          {/* Timezone note */}
          <div className="p-3 rounded-lg bg-muted/50 border flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Why numbers differ from Facebook Ads Manager:</strong></p>
              <p>• <strong>CRM uses UK/London timezone</strong> (currently BST, UTC+1). Facebook Ads Manager may use a different timezone for your ad account, causing 1–2 lead differences at day boundaries.</p>
              <p>• <strong>Deduplication:</strong> The CRM merges repeat submissions from the same email/phone into one lead. Facebook counts every form interaction separately.</p>
              <p>• <strong>Terminal guard:</strong> Returning visitors who already have a Sold/Lost/Fake lead are blocked from creating new leads (logged above as "Blocked").</p>
              <p>• <strong>Missing attribution:</strong> Some carts are created without FBCLID metadata attached, so they don't appear in the Facebook filter even though the visitor came from FB.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Eye className="h-4 w-4" /> Page Views
            </div>
            <p className="text-2xl font-bold">{isLoading ? '...' : totalPageViews}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" /> Unique Visitors
            </div>
            <p className="text-2xl font-bold">{isLoading ? '...' : uniqueVisitors}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <MousePointerClick className="h-4 w-4" /> FB Leads
            </div>
            <p className="text-2xl font-bold">{isLoading ? '...' : totalLeads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ShoppingCart className="h-4 w-4" /> Paid Sales
            </div>
            <p className="text-2xl font-bold text-green-700">{isLoading ? '...' : revenueStats.paidCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" /> Form Rate
            </div>
            <p className="text-2xl font-bold">{isLoading ? '...' : `${conversionRate}%`}</p>
          </CardContent>
        </Card>
      </div>

      {/* FB Paid Customers Table - NEW */}
      <Card className="border-green-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-green-700" />
            Facebook Ads — Paid Customers
          </CardTitle>
          <CardDescription>Customers who purchased via Facebook/Instagram ads (purchase_source = facebook_ads)</CardDescription>
        </CardHeader>
        <CardContent>
          {(fbPaidCustomers?.length || 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No paid Facebook customers in this period</p>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Warranty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fbPaidCustomers?.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="text-xs">{format(new Date(customer.signup_date), 'dd/MM/yy')}</TableCell>
                      <TableCell className="text-sm font-medium">{customer.name || customer.email}</TableCell>
                      <TableCell className="text-sm">{customer.registration_plate || `${customer.vehicle_make || ''} ${customer.vehicle_model || ''}`.trim() || '-'}</TableCell>
                      <TableCell className="text-sm">{customer.plan_type || '-'}</TableCell>
                      <TableCell className="text-right font-semibold text-green-700">
                        £{(customer.final_amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{customer.warranty_reference_number || '-'}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
                          {customer.status || 'Active'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2 Attempt Tracking */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">🔍 Step 2 Submission Attempts (All Traffic)</CardTitle>
          <CardDescription>Track attempted form submissions that succeed or fail — identifies technical drop-offs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <p className="text-2xl font-bold">{isLoading ? '...' : step2Stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Attempts</p>
            </div>
            <div className="p-3 rounded-lg border bg-green-50 text-center">
              <p className="text-2xl font-bold text-green-700">{isLoading ? '...' : step2Stats.success}</p>
              <p className="text-xs text-muted-foreground">Successful</p>
            </div>
            <div className="p-3 rounded-lg border bg-red-50 text-center">
              <p className="text-2xl font-bold text-red-700">{isLoading ? '...' : step2Stats.failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
            <div className="p-3 rounded-lg border bg-yellow-50 text-center">
              <p className="text-2xl font-bold text-yellow-700">{isLoading ? '...' : step2Stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending/Abandoned</p>
            </div>
          </div>
          {step2Stats.failed > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-red-600 mb-2">⚠️ Failed submissions:</p>
              <div className="max-h-[200px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(step2Attempts || [])
                      .filter(a => a.attempt_status === 'failed')
                      .slice(0, 20)
                      .map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">{format(new Date(a.created_at), 'dd/MM HH:mm')}</TableCell>
                          <TableCell className="text-sm">{a.email || '-'}</TableCell>
                          <TableCell className="text-sm">{a.vehicle_reg || '-'}</TableCell>
                          <TableCell className="text-xs text-red-600 max-w-[200px] truncate">{a.error_message || '-'}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Funnel Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">📅 Daily Facebook Funnel</CardTitle>
          <CardDescription>Visitors → Leads → Paid Sales → Revenue by day</CardDescription>
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
                  <TableHead className="text-right">Page Views</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Paid Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Form Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyFunnel.map(row => (
                  <TableRow key={row.date}>
                    <TableCell className="font-medium">{format(new Date(row.date), 'dd MMM')}</TableCell>
                    <TableCell className="text-right">{row.visitors}</TableCell>
                    <TableCell className="text-right">{row.views}</TableCell>
                    <TableCell className="text-right">{row.leads}</TableCell>
                    <TableCell className="text-right font-semibold text-green-700">{row.conversions > 0 || row.revenue > 0 ? (fbPaidCustomers || []).filter(c => format(new Date(c.signup_date), 'yyyy-MM-dd') === row.date).length : 0}</TableCell>
                    <TableCell className="text-right font-semibold text-green-700">
                      {row.revenue > 0 ? `£${row.revenue.toFixed(0)}` : '-'}
                    </TableCell>
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

      {/* UTM Campaign Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Campaign Breakdown</CardTitle>
          <CardDescription>Traffic by UTM campaign from Facebook/Instagram</CardDescription>
        </CardHeader>
        <CardContent>
          {utmBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No campaign data in this period</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Medium</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {utmBreakdown.map((row) => (
                  <TableRow key={row.campaign}>
                    <TableCell className="font-medium">{row.campaign}</TableCell>
                    <TableCell>{row.medium}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{row.content}</TableCell>
                    <TableCell className="text-right">{row.views}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Top Pages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top Pages (Facebook Traffic)</CardTitle>
          <CardDescription>Which pages Facebook visitors are landing on</CardDescription>
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

      {/* Facebook Leads — Full Detail Table */}
      <Card className="border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Facebook className="h-4 w-4 text-blue-600" />
                Facebook Leads — Full Details
              </CardTitle>
              <CardDescription>Every lead from Facebook/Instagram ads with name, phone, date & FBCLID tracking code</CardDescription>
            </div>
            <DateRangeFilter
              dateRange={leadsDateRange}
              onDateRangeChange={setLeadsDateRange}
            />
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const filteredLeads = (fbLeads || []).filter(lead => {
              if (!leadsDateRange?.from) return true;
              const d = new Date(lead.created_at);
              if (d < startOfDay(leadsDateRange.from)) return false;
              if (leadsDateRange.to && d > endOfDay(leadsDateRange.to)) return false;
              return true;
            });
            return filteredLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No Facebook leads in this period</p>
          ) : (
            <div className="overflow-auto">
              <p className="text-xs text-muted-foreground mb-2">{filteredLeads.length} leads found</p>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-[11px] font-semibold uppercase">Date & Time</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase">Name</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase">Phone</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase">Email</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase">Vehicle</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase">Step</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase">Status</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase">FBCLID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => {
                    const meta = lead.cart_metadata as Record<string, any> | null;
                    const fbclid = meta?.fbclid || '';
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="text-xs whitespace-nowrap">{format(new Date(lead.created_at), 'dd/MM/yy HH:mm')}</TableCell>
                        <TableCell className="text-sm font-medium">{lead.full_name || '-'}</TableCell>
                        <TableCell className="text-sm">{lead.phone || '-'}</TableCell>
                        <TableCell className="text-sm">{lead.email}</TableCell>
                        <TableCell className="text-sm">{lead.vehicle_reg || `${lead.vehicle_make || ''} ${lead.vehicle_model || ''}`.trim() || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">Step {lead.step_abandoned}</Badge>
                        </TableCell>
                        <TableCell>
                          {lead.is_converted ? (
                            <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">Converted</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">{lead.contact_status || 'New'}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-[10px] font-mono text-muted-foreground max-w-[200px] truncate" title={fbclid}>
                          {fbclid ? fbclid.substring(0, 20) + '…' : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
          })()}
        </CardContent>
      </Card>

      {/* Tracking Setup Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Facebook className="h-4 w-4 text-blue-600" />
            Tracking Setup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">1</span>
              <div>
                <p className="font-medium">FBCLID Capture</p>
                <p className="text-muted-foreground">Automatically captured from URL parameters and stored in localStorage for 90 days. Now attached to abandoned carts on Step 2 submission.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">2</span>
              <div>
                <p className="font-medium">UTM Parameters</p>
                <p className="text-muted-foreground">utm_source, utm_medium, utm_campaign, utm_content are tracked on every page view and stored with lead data.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">3</span>
              <div>
                <p className="font-medium">Revenue Attribution</p>
                <p className="text-muted-foreground">Paid customers with <code className="bg-muted px-1 rounded">purchase_source = 'facebook_ads'</code> are tracked via FBCLID or UTM source matching at checkout.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">4</span>
              <div>
                <p className="font-medium">Meta Pixel Events</p>
                <p className="text-muted-foreground">Fires <code className="bg-muted px-1 rounded">ViewContent</code> on homepage, <code className="bg-muted px-1 rounded">Lead</code> on Step 2, <code className="bg-muted px-1 rounded">AddToCart</code> on pricing, <code className="bg-muted px-1 rounded">InitiateCheckout</code> on Step 4, and <code className="bg-muted px-1 rounded">Purchase</code> on completion.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FacebookAdsTab;
