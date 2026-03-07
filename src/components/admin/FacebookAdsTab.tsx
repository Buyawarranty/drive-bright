import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Facebook, Eye, Users, ShoppingCart, TrendingUp, MousePointerClick } from 'lucide-react';

export const FacebookAdsTab: React.FC = () => {
  const [dateRange, setDateRange] = useState<string>('last7');

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

  // Fetch Facebook page views
  const { data: fbPageViews, isLoading: pvLoading } = useQuery({
    queryKey: ['fb-page-views', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('page_views')
        .select('*')
        .eq('is_facebook_ads', true)
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
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

  // Count conversions from FB leads
  const fbConvertedLeads = useMemo(() => {
    return (fbLeads || []).filter(l => l.is_converted);
  }, [fbLeads]);

  // Summary stats
  const totalPageViews = fbPageViews?.length || 0;
  const uniqueVisitors = new Set(fbPageViews?.map(pv => pv.visitor_id)).size;
  const totalLeads = fbLeads?.length || 0;
  const totalConversions = fbConvertedLeads.length;
  const conversionRate = totalLeads > 0 ? ((totalConversions / totalLeads) * 100).toFixed(1) : '0';

  // Page breakdown
  const pageBreakdown = useMemo(() => {
    if (!fbPageViews) return [];
    const counts: Record<string, number> = {};
    fbPageViews.forEach(pv => {
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
    if (!fbPageViews) return [];
    const campaigns: Record<string, { views: number; campaign: string; medium: string; content: string }> = {};
    fbPageViews.forEach(pv => {
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

  const isLoading = pvLoading || leadsLoading;

  return (
    <div className="space-y-6">
      {/* Header with date filter */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            Facebook & Instagram Ads Tracking
          </h3>
          <p className="text-sm text-muted-foreground">
            Track visitors, leads, and conversions from Meta ads via fbclid and UTM parameters
          </p>
        </div>
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
              <MousePointerClick className="h-4 w-4" /> Leads
            </div>
            <p className="text-2xl font-bold">{isLoading ? '...' : totalLeads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ShoppingCart className="h-4 w-4" /> Conversions
            </div>
            <p className="text-2xl font-bold">{isLoading ? '...' : totalConversions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" /> Conv. Rate
            </div>
            <p className="text-2xl font-bold">{isLoading ? '...' : `${conversionRate}%`}</p>
          </CardContent>
        </Card>
      </div>

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

      {/* Page Breakdown */}
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

      {/* Recent Facebook Leads */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Facebook Leads</CardTitle>
          <CardDescription>Leads captured from Facebook/Instagram ad traffic</CardDescription>
        </CardHeader>
        <CardContent>
          {(fbLeads?.length || 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No Facebook leads in this period</p>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fbLeads?.slice(0, 50).map((lead) => {
                    const meta = lead.cart_metadata as Record<string, any> | null;
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="text-xs">{format(new Date(lead.created_at), 'dd/MM/yy HH:mm')}</TableCell>
                        <TableCell className="text-sm">{lead.email}</TableCell>
                        <TableCell className="text-sm">{lead.full_name || '-'}</TableCell>
                        <TableCell className="text-sm">{lead.vehicle_reg || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">Step {lead.step_abandoned}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{meta?.utm_campaign || '-'}</TableCell>
                        <TableCell>
                          {lead.is_converted ? (
                            <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">Converted</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">{lead.contact_status || 'New'}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meta Pixel Setup Info */}
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
                <p className="text-muted-foreground">Automatically captured from URL parameters and stored in localStorage for 90 days. Attached to leads and page views.</p>
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
