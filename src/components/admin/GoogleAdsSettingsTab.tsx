import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, subDays, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { DateRangeFilter } from './DateRangeFilter';
import {
  CheckCircle2, XCircle, AlertTriangle, Upload, RefreshCw, Zap,
  Key, Shield, Database, TrendingUp, Clock, ArrowUpRight, Search, ShoppingCart, CalendarIcon, Users
} from 'lucide-react';

// Required secrets for the upload-google-conversions edge function
const REQUIRED_SECRETS = [
  { key: 'GOOGLE_ADS_DEVELOPER_TOKEN', label: 'Developer Token', description: 'From Google Ads API Center' },
  { key: 'GOOGLE_ADS_CUSTOMER_ID', label: 'Customer ID', description: 'Your Google Ads account ID (no dashes)' },
  { key: 'GOOGLE_ADS_CONVERSION_ACTION_ID', label: 'Conversion Action ID', description: 'The "Closed Sale" conversion action ID' },
  { key: 'GOOGLE_ADS_CLIENT_ID', label: 'OAuth2 Client ID', description: 'From Google Cloud Console' },
  { key: 'GOOGLE_ADS_CLIENT_SECRET', label: 'OAuth2 Client Secret', description: 'From Google Cloud Console' },
  { key: 'GOOGLE_ADS_REFRESH_TOKEN', label: 'OAuth2 Refresh Token', description: 'Generated via OAuth2 flow' },
];

export const GoogleAdsSettingsTab: React.FC<{ hideHeader?: boolean }> = ({ hideHeader }) => {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [salesSearch, setSalesSearch] = useState('');
  const [salesFilter, setSalesFilter] = useState<'all' | 'with_gclid' | 'no_gclid' | 'uploaded' | 'pending'>('all');
  const [salesPage, setSalesPage] = useState(0);
  const [leadsDateRange, setLeadsDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const SALES_PER_PAGE = 25;


  // Fetch conversion upload stats
  const { data: conversionStats, isLoading: statsLoading } = useQuery({
    queryKey: ['google-ads-conversion-stats'],
    queryFn: async () => {
      const [customersResult, bumperResult, pendingCustomers, pendingBumper] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }).not('gclid', 'is', null).not('google_ads_conversion_uploaded_at', 'is', null),
        supabase.from('bumper_transactions').select('id', { count: 'exact', head: true }).not('gclid', 'is', null).not('google_ads_conversion_uploaded_at', 'is', null),
        supabase.from('customers').select('id', { count: 'exact', head: true }).not('gclid', 'is', null).is('google_ads_conversion_uploaded_at', null).in('status', ['active', 'Active']).eq('is_deleted', false),
        supabase.from('bumper_transactions').select('id', { count: 'exact', head: true }).not('gclid', 'is', null).is('google_ads_conversion_uploaded_at', null).eq('status', 'completed'),
      ]);
      return {
        uploaded: (customersResult.count || 0) + (bumperResult.count || 0),
        pending: (pendingCustomers.count || 0) + (pendingBumper.count || 0),
        totalWithGclid: (customersResult.count || 0) + (bumperResult.count || 0) + (pendingCustomers.count || 0) + (pendingBumper.count || 0),
      };
    },
  });

  // Fetch recent upload attempts
  const { data: recentUploads } = useQuery({
    queryKey: ['google-ads-recent-uploads'],
    queryFn: async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, email, final_amount, gclid, google_ads_conversion_status, google_ads_conversion_uploaded_at, created_at')
        .not('gclid', 'is', null)
        .not('google_ads_conversion_status', 'is', null)
        .order('google_ads_conversion_uploaded_at', { ascending: false, nullsFirst: false })
        .limit(10);
      return data || [];
    },
  });

  // Fetch total GCLID captures
  const { data: gclidStats } = useQuery({
    queryKey: ['gclid-capture-stats'],
    queryFn: async () => {
      const [customers, bumper, pageViews] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }).not('gclid', 'is', null),
        supabase.from('bumper_transactions').select('id', { count: 'exact', head: true }).not('gclid', 'is', null),
        supabase.from('page_views').select('id', { count: 'exact', head: true }).not('gclid', 'is', null),
      ]);
      return {
        customers: customers.count || 0,
        bumper: bumper.count || 0,
        pageViews: pageViews.count || 0,
      };
    },
  });

  // Fetch WEBSITE-ONLY sales from customers table (BAW- prefix, excludes BAW-S-, ADM-, cancelled/refunded)
  // Bumper sales already appear in the customers table so we only query customers to avoid double-counting
  const { data: allSalesData, isLoading: salesLoading } = useQuery({
    queryKey: ['google-ads-all-sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, email, first_name, last_name, final_amount, gclid, google_ads_conversion_status, google_ads_conversion_uploaded_at, created_at, status, warranty_number, registration_plate, phone, payment_type')
        .eq('is_deleted', false)
        .in('status', ['active', 'Active'])
        .like('warranty_number', 'BAW-%')
        .not('warranty_number', 'like', 'BAW-S-%')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      return (data || []).map(c => ({
        id: c.id,
        email: c.email || '',
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        amount: c.final_amount || 0,
        gclid: c.gclid,
        conversionStatus: c.google_ads_conversion_status,
        uploadedAt: c.google_ads_conversion_uploaded_at,
        createdAt: c.created_at,
        ref: c.warranty_number || '',
        reg: c.registration_plate || '',
        phone: c.phone || '',
        source: (c.payment_type === 'bumper' ? 'bumper' : 'stripe') as 'bumper' | 'stripe',
      }));
    },
    refetchInterval: 60000,
  });

  // Filter and search sales
  const filteredSales = useMemo(() => {
    if (!allSalesData) return [];
    let result = allSalesData;
    if (salesFilter === 'with_gclid') result = result.filter(s => !!s.gclid);
    else if (salesFilter === 'no_gclid') result = result.filter(s => !s.gclid);
    else if (salesFilter === 'uploaded') result = result.filter(s => s.conversionStatus === 'uploaded');
    else if (salesFilter === 'pending') result = result.filter(s => s.gclid && !s.uploadedAt);
    if (salesSearch.trim()) {
      const q = salesSearch.toLowerCase();
      result = result.filter(s => s.email.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.ref.toLowerCase().includes(q) || s.reg.toLowerCase().includes(q));
    }
    return result;
  }, [allSalesData, salesFilter, salesSearch]);

  const paginatedSales = filteredSales.slice(salesPage * SALES_PER_PAGE, (salesPage + 1) * SALES_PER_PAGE);
  const totalSalesPages = Math.ceil(filteredSales.length / SALES_PER_PAGE);

  const salesSummary = useMemo(() => {
    if (!allSalesData) return { total: 0, totalValue: 0, withGclid: 0, uploaded: 0, pending: 0, noGclid: 0 };
    return {
      total: allSalesData.length,
      totalValue: allSalesData.reduce((sum, s) => sum + (s.amount || 0), 0),
      withGclid: allSalesData.filter(s => !!s.gclid).length,
      uploaded: allSalesData.filter(s => s.conversionStatus === 'uploaded').length,
      pending: allSalesData.filter(s => s.gclid && !s.uploadedAt).length,
      noGclid: allSalesData.filter(s => !s.gclid).length,
    };
  }, [allSalesData]);


  // Date range for Google Ads leads
  const leadsDateFrom = useMemo(() => {
    if (!leadsDateRange?.from) return startOfDay(subDays(new Date(), 365 * 5));
    return startOfDay(leadsDateRange.from);
  }, [leadsDateRange]);

  const leadsDateTo = useMemo(() => {
    if (!leadsDateRange?.to) return endOfDay(new Date());
    return endOfDay(leadsDateRange.to);
  }, [leadsDateRange]);

  // Fetch Google Ads leads from sales_leads (lead_source = google_ad) with GCLID from abandoned_carts
  const { data: googleAdsLeads, isLoading: gLeadsLoading } = useQuery({
    queryKey: ['google-ads-leads', leadsDateFrom.toISOString(), leadsDateTo.toISOString()],
    queryFn: async () => {
      // Get leads with google_ad source
      const { data: leads, error } = await supabase
        .from('sales_leads')
        .select('id, first_name, last_name, email, phone, status, vehicle_reg, vehicle_make, vehicle_model, created_at, abandoned_cart_id, lead_source')
        .eq('lead_source', 'google_ad')
        .gte('created_at', leadsDateFrom.toISOString())
        .lte('created_at', leadsDateTo.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      // Get the GCLIDs from abandoned_carts for these leads
      const cartIds = (leads || []).map(l => l.abandoned_cart_id).filter(Boolean);
      let gclidMap: Record<string, string> = {};
      if (cartIds.length > 0) {
        const { data: carts } = await supabase
          .from('abandoned_carts')
          .select('id, cart_metadata')
          .in('id', cartIds);
        (carts || []).forEach(c => {
          const meta = c.cart_metadata as Record<string, any> | null;
          if (meta?.gclid) gclidMap[c.id] = meta.gclid;
        });
      }
      
      return (leads || []).map(l => ({
        ...l,
        gclid: l.abandoned_cart_id ? (gclidMap[l.abandoned_cart_id] || '') : '',
      }));
    },
  });

  const triggerUpload = async () => {
    setIsUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('upload-google-conversions');
      if (error) throw error;
      
      toast({
        title: 'Upload complete',
        description: `Uploaded: ${data?.uploaded || 0}, Failed: ${data?.failed || 0}`,
      });
      queryClient.invalidateQueries({ queryKey: ['google-ads-conversion-stats'] });
      queryClient.invalidateQueries({ queryKey: ['google-ads-recent-uploads'] });
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Check that all secrets are configured.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div>
          <h2 className="text-2xl font-bold">Google Ads — Conversion & ROAS Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage offline conversion uploads, GCLID tracking, and Target ROAS optimisation
          </p>
        </div>
      )}

      {/* Top-level Leads Summary with Date Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border border-emerald-200 bg-emerald-50/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Users className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Google Ads Leads: {gLeadsLoading ? '...' : (googleAdsLeads?.length || 0)}
            </p>
            <p className="text-xs text-muted-foreground">Leads from Google Ads in selected period</p>
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


      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Target ROAS Strategy
          </CardTitle>
          <CardDescription>
            Maximize Conversion Value by uploading actual sale values back to Google Ads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <p className="font-medium">1. Capture GCLID</p>
              <p className="text-muted-foreground">Automatically captured on every CTA & form submission</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">2. Track Closed Sales</p>
              <p className="text-muted-foreground">Actual policy values uploaded as offline conversions</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">3. Optimise Bidding</p>
              <p className="text-muted-foreground">Google uses real revenue data to maximise ROAS</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">GCLIDs Captured</p>
                <p className="text-2xl font-bold">
                  {gclidStats ? (gclidStats.customers + gclidStats.bumper + gclidStats.pageViews).toLocaleString() : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {gclidStats?.customers || 0} customers · {gclidStats?.bumper || 0} bumper · {gclidStats?.pageViews || 0} page views
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Upload className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Conversions Uploaded</p>
                <p className="text-2xl font-bold">{conversionStats?.uploaded?.toLocaleString() || '0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Pending Upload</p>
                <p className="text-2xl font-bold">{conversionStats?.pending?.toLocaleString() || '0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Database className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total w/ GCLID</p>
                <p className="text-2xl font-bold">{conversionStats?.totalWithGclid?.toLocaleString() || '0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Google Ads Leads — Full Detail Table */}
      <Card className="border-emerald-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-700" />
                Google Ads Leads — Full Details
              </CardTitle>
              <CardDescription>Every lead from Google Ads with name, phone, date & GCLID tracking code</CardDescription>
            </div>
            <DateRangeFilter
              dateRange={leadsDateRange}
              onDateRangeChange={setLeadsDateRange}
            />
          </div>
        </CardHeader>
        <CardContent>
          {gLeadsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading Google Ads leads...</span>
            </div>
          ) : (googleAdsLeads?.length || 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No Google Ads leads in this period</p>
          ) : (
            <div className="overflow-auto">
              <p className="text-xs text-muted-foreground mb-2">{googleAdsLeads?.length} leads found</p>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-[11px] font-semibold uppercase">Date & Time</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase">Name</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase">Phone</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase">Email</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase">Vehicle</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase">Status</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase">GCLID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {googleAdsLeads?.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(lead.created_at), 'dd/MM/yy HH:mm')}</TableCell>
                      <TableCell className="text-sm font-medium">{`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '-'}</TableCell>
                      <TableCell className="text-sm">{lead.phone || '-'}</TableCell>
                      <TableCell className="text-sm">{lead.email}</TableCell>
                      <TableCell className="text-sm">{lead.vehicle_reg || `${lead.vehicle_make || ''} ${lead.vehicle_model || ''}`.trim() || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{lead.status || 'new'}</Badge>
                      </TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground max-w-[200px] truncate" title={lead.gclid}>
                        {lead.gclid ? lead.gclid.substring(0, 25) + '…' : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Credentials
            </CardTitle>
            <CardDescription>
              These secrets must be set in{' '}
              <a
                href="https://supabase.com/dashboard/project/mzlpuxzwyrcyrgrongeb/settings/functions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-0.5"
              >
                Supabase Edge Function Secrets <ArrowUpRight className="h-3 w-3" />
              </a>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {REQUIRED_SECRETS.map((secret) => (
              <div
                key={secret.key}
                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
              >
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium truncate">{secret.key}</p>
                  <p className="text-xs text-muted-foreground">{secret.label} — {secret.description}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            💡 Secrets are encrypted and not visible here. The upload function will fail with a clear error if any are missing.
          </p>
        </CardContent>
      </Card>

      {/* Manual Upload Trigger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Offline Conversion Upload
          </CardTitle>
          <CardDescription>
            Uploads pending conversions (customers & Bumper with GCLID) to Google Ads.
            This runs automatically but can be triggered manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={triggerUpload}
            disabled={isUploading || (conversionStats?.pending === 0)}
            className="gap-2"
          >
            {isUploading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isUploading ? 'Uploading...' : `Upload ${conversionStats?.pending || 0} Pending Conversions`}
          </Button>

          {/* Recent uploads table */}
          {recentUploads && recentUploads.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Recent Upload History</p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentUploads.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-sm">{row.email || '—'}</TableCell>
                        <TableCell className="text-sm">
                          {row.final_amount ? `£${row.final_amount.toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell>
                          {row.google_ads_conversion_status === 'uploaded' ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Uploaded
                            </Badge>
                          ) : row.google_ads_conversion_status?.startsWith('failed') ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
                              <XCircle className="h-3 w-3" /> Failed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" /> {row.google_ads_conversion_status || 'Pending'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.google_ads_conversion_uploaded_at
                            ? new Date(row.google_ads_conversion_uploaded_at).toLocaleDateString()
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Website Sales — Live Data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Website Sales Only — Live Conversion Data
          </CardTitle>
          <CardDescription>
            Direct website sales only (BAW- prefix). Excludes Staff Purchases (BAW-S), Admin/Quotes (ADM), and Cancelled/Refunded. Auto-refreshes every 60 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <p className="text-2xl font-bold">{salesSummary.total}</p>
              <p className="text-xs text-muted-foreground">Total Sales</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <p className="text-2xl font-bold">£{salesSummary.totalValue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Value</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <p className="text-2xl font-bold text-primary">{salesSummary.withGclid}</p>
              <p className="text-xs text-muted-foreground">With GCLID</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <p className="text-2xl font-bold text-green-600">{salesSummary.uploaded}</p>
              <p className="text-xs text-muted-foreground">Uploaded</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <p className="text-2xl font-bold text-amber-600">{salesSummary.pending}</p>
              <p className="text-xs text-muted-foreground">Pending Upload</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <p className="text-2xl font-bold text-muted-foreground">{salesSummary.noGclid}</p>
              <p className="text-xs text-muted-foreground">No GCLID</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, ref, or reg..."
                  value={salesSearch}
                  onChange={e => { setSalesSearch(e.target.value); setSalesPage(0); }}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={salesFilter} onValueChange={(v: any) => { setSalesFilter(v); setSalesPage(0); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sales</SelectItem>
                <SelectItem value="with_gclid">With GCLID</SelectItem>
                <SelectItem value="no_gclid">No GCLID</SelectItem>
                <SelectItem value="uploaded">Uploaded</SelectItem>
                <SelectItem value="pending">Pending Upload</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sales table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reg</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Ref</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>GCLID</TableHead>
                  <TableHead>Conversion Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Loading sales data...
                    </TableCell>
                  </TableRow>
                ) : paginatedSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No sales found
                    </TableCell>
                  </TableRow>
                ) : paginatedSales.map(sale => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(sale.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      {sale.reg ? (
                        <span className="inline-block px-2 py-0.5 bg-yellow-100 border border-yellow-400 rounded text-xs font-bold tracking-wider uppercase">{sale.reg}</span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{sale.name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{sale.email}</div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{sale.ref || '—'}</TableCell>
                    <TableCell className="text-sm font-semibold">£{sale.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sale.source === 'bumper' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                        {sale.source === 'bumper' ? 'Bumper' : 'Stripe'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sale.gclid ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" /> Yes
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground gap-1 text-xs">
                          <XCircle className="h-3 w-3" /> No
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {sale.conversionStatus === 'uploaded' ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" /> Uploaded
                        </Badge>
                      ) : sale.conversionStatus?.startsWith('failed') ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1 text-xs">
                          <XCircle className="h-3 w-3" /> Failed
                        </Badge>
                      ) : sale.gclid && !sale.uploadedAt ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-xs">
                          <Clock className="h-3 w-3" /> Pending
                        </Badge>
                      ) : !sale.gclid ? (
                        <span className="text-xs text-muted-foreground">No GCLID</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalSalesPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {salesPage * SALES_PER_PAGE + 1}–{Math.min((salesPage + 1) * SALES_PER_PAGE, filteredSales.length)} of {filteredSales.length}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSalesPage(p => p - 1)} disabled={salesPage === 0}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setSalesPage(p => p + 1)} disabled={salesPage >= totalSalesPages - 1}>Next</Button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            💡 This data refreshes automatically every 60 seconds. Sales with a GCLID can be uploaded to Google Ads for offline conversion tracking. Sales without GCLID came from non-Google Ads traffic (organic, direct, etc.).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5" />
            GCLID Capture Pipeline — How It Works
          </CardTitle>
          <CardDescription>
            The complete flow from Google Ad click → offline conversion upload
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Step 1 */}
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-green-50/50">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Step 1: Capture GCLID</p>
              <p className="text-xs text-muted-foreground">
                <code className="bg-muted px-1 rounded">gclidCapture.ts</code> extracts the Google Click ID
                (e.g. <code className="bg-muted px-1 rounded">CjwK1234abcd5678xyz</code>) from URL params on every
                page load and stores it in localStorage for 90 days. Captured on every CTA & form submission.
              </p>
            </div>
          </div>
          {/* Step 2 */}
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-green-50/50">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Step 2: Store with Lead / Sale</p>
              <p className="text-xs text-muted-foreground">
                PageViewLogger logs GCLID to <code className="bg-muted px-1 rounded">page_views</code>.
                Checkout passes it as Stripe metadata → saved to <code className="bg-muted px-1 rounded">customers.gclid</code>.
                Sales leads also store GCLID via <code className="bg-muted px-1 rounded">sales_leads.gclid</code>.
              </p>
            </div>
          </div>
          {/* Step 3 */}
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-green-50/50">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Step 3: Bumper Flow</p>
              <p className="text-xs text-muted-foreground">
                <code className="bg-muted px-1 rounded">bumper_transactions</code> also stores GCLID from the
                checkout session. Both Stripe webhook and Bumper success handler fire server-side conversions.
              </p>
            </div>
          </div>
          {/* Step 4 */}
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-blue-50/50">
            <Upload className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Step 4: Upload Offline Conversions (Google Ads API)</p>
              <p className="text-xs text-muted-foreground">
                The <code className="bg-muted px-1 rounded">upload-google-conversions</code> edge function queries
                <code className="bg-muted px-1 rounded">customers</code> and <code className="bg-muted px-1 rounded">bumper_transactions</code> for
                records with a GCLID that haven't been uploaded yet. It sends actual sale values
                (<code className="bg-muted px-1 rounded">final_amount</code>) via the Google Ads API as "Closed Sale / Purchase"
                conversions. Duplicates are tracked via <code className="bg-muted px-1 rounded">google_ads_conversion_uploaded_at</code>.
                Schedule via cron for daily automated uploads.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-5 w-5" />
            Setup Steps for Offline Conversion Import
          </CardTitle>
          <CardDescription>
            What you need to configure before the automated upload works
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">1</span>
              <div>
                <p className="font-medium">Google Ads Developer Token</p>
                <p className="text-xs text-muted-foreground">From your Google Ads Manager Account → Tools & Settings → API Center</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">2</span>
              <div>
                <p className="font-medium">OAuth2 Credentials (Client ID, Client Secret, Refresh Token)</p>
                <p className="text-xs text-muted-foreground">Create in Google Cloud Console → APIs & Services → Credentials. Use OAuth2 Playground to generate refresh token.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">3</span>
              <div>
                <p className="font-medium">Google Ads Customer ID</p>
                <p className="text-xs text-muted-foreground">Your account number (format: 123-456-7890, store without dashes as 1234567890)</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">4</span>
              <div>
                <p className="font-medium">Conversion Action ID</p>
                <p className="text-xs text-muted-foreground">Create a "Closed Sale / Purchase" conversion action in Google Ads. Use the numeric ID.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">5</span>
              <div>
                <p className="font-medium">Set Bidding to "Maximize Conversion Value" with Target ROAS</p>
                <p className="text-xs text-muted-foreground">Once conversions start uploading, switch your campaign bidding strategy. Google will optimise towards actual revenue.</p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Predicted Lead Values */}
      <Card className="border-amber-200/50 bg-amber-50/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-600" />
            Predicted Lead Values (Bootstrap Phase)
          </CardTitle>
          <CardDescription>
            Until enough real sales data accumulates, assign predicted values to leads so Google can start learning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Since every user fills the form, you can assign a predicted conversion value based on vehicle type,
              age, and mileage. This lets Google's Target ROAS algorithm start optimising immediately — even before
              offline sales data is complete.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-background">
                <p className="font-medium">High-Value Vehicles</p>
                <p className="text-xs text-muted-foreground">Premium/luxury cars, newer models, low mileage</p>
                <p className="text-lg font-bold text-primary mt-1">~£500 predicted</p>
              </div>
              <div className="p-3 rounded-lg border bg-background">
                <p className="font-medium">Standard Vehicles</p>
                <p className="text-xs text-muted-foreground">Older models, higher mileage, economy segment</p>
                <p className="text-lg font-bold text-primary mt-1">~£200 predicted</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              💡 As actual offline conversions are uploaded, Google will replace predicted values with real revenue data
              and the bidding model will improve over time.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleAdsSettingsTab;
