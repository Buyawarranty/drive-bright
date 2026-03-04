import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Users, Globe, TrendingUp, ArrowUpRight, Search, Leaf, Zap, CheckCircle2, AlertCircle, Upload, Clock, RefreshCw, Key, ExternalLink, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { LeadFormCompletionsCard } from './LeadFormCompletionsCard';
import { toast } from 'sonner';
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, BarChart, Bar } from 'recharts';
import { Input } from '@/components/ui/input';
const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f59e0b'];

const SEARCH_ENGINES = ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'ecosia', 'yandex', 'ask'];

type Period = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year';

const getPeriodDates = (period: Period) => {
  const now = new Date();
  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday':
      return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case 'this_week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case 'this_month':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case 'last_month':
      return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
    case 'this_year':
      return { from: startOfYear(now), to: endOfDay(now) };
  }
};

const isSearchEngineReferrer = (referrer: string | null): boolean => {
  if (!referrer) return false;
  try {
    const hostname = new URL(referrer).hostname.toLowerCase();
    return SEARCH_ENGINES.some(engine => hostname.includes(engine));
  } catch {
    return false;
  }
};

const isOrganic = (pv: any): boolean => {
  if (pv.gclid) return false;
  if (pv.utm_source || pv.utm_medium || pv.utm_campaign) return false;
  // No paid markers — either direct (no referrer) or from a search engine
  return !pv.referrer || isSearchEngineReferrer(pv.referrer);
};

// Exclude internal/admin routes — only show public website & blog pages
const EXCLUDED_PATH_PREFIXES = [
  '/auth',
  '/admin',
  '/customer-dashboard',
  '/forgot-password',
  '/quote/',
  '/reset-password',
  '/login',
  '/register',
  '/signup',
];

const isPublicPage = (pagePath: string): boolean => {
  if (!pagePath) return false;
  const lower = pagePath.toLowerCase();
  return !EXCLUDED_PATH_PREFIXES.some(prefix => lower.startsWith(prefix));
};

export const PageAnalyticsTab: React.FC = () => {
  const [period, setPeriod] = useState<Period>('this_week');
  const [searchQuery, setSearchQuery] = useState('');
  const { from, to } = getPeriodDates(period);

  const { data: pageViews, isLoading } = useQuery({
    queryKey: ['page-analytics', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('page_views')
        .select('*')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    if (!pageViews) return null;

    // Filter to public pages only (exclude admin, auth, quotes, customer dashboard)
    const publicPageViews = pageViews.filter(pv => isPublicPage(pv.page_path));

    const totalViews = publicPageViews.length;
    const uniqueVisitors = new Set(publicPageViews.map(pv => pv.visitor_id)).size;
    const uniqueSessions = new Set(publicPageViews.map(pv => pv.session_id)).size;
    const googleAdsViews = publicPageViews.filter(pv => pv.is_google_ads).length;

    // Organic
    const organicViews = publicPageViews.filter(isOrganic);
    const totalOrganic = organicViews.length;
    const uniqueOrganicVisitors = new Set(organicViews.map(pv => pv.visitor_id)).size;

    // Page breakdown
    const pageMap = new Map<string, { views: number; uniqueVisitors: Set<string>; googleAds: number; organic: number }>();
    publicPageViews.forEach(pv => {
      const existing = pageMap.get(pv.page_path) || { views: 0, uniqueVisitors: new Set<string>(), googleAds: 0, organic: 0 };
      existing.views++;
      if (pv.visitor_id) existing.uniqueVisitors.add(pv.visitor_id);
      if (pv.is_google_ads) existing.googleAds++;
      if (isOrganic(pv)) existing.organic++;
      pageMap.set(pv.page_path, existing);
    });

    const pages = Array.from(pageMap.entries())
      .map(([path, data]) => ({
        path,
        views: data.views,
        uniqueVisitors: data.uniqueVisitors.size,
        googleAds: data.googleAds,
        organic: data.organic,
      }))
      .sort((a, b) => b.views - a.views);

    // Source breakdown — refined to separate organic search from direct
    const sourceMap = new Map<string, number>();
    publicPageViews.forEach(pv => {
      let source: string;
      if (pv.utm_source) {
        source = pv.utm_source;
      } else if (pv.gclid) {
        source = 'google_ads';
      } else if (pv.referrer) {
        source = isSearchEngineReferrer(pv.referrer) ? 'organic_search' : new URL(pv.referrer).hostname;
      } else {
        source = 'direct';
      }
      sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
    });
    const sources = Array.from(sourceMap.entries())
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Device breakdown
    const mobile = publicPageViews.filter(pv => (pv.screen_width || 0) < 768).length;
    const tablet = publicPageViews.filter(pv => (pv.screen_width || 0) >= 768 && (pv.screen_width || 0) < 1024).length;
    const desktop = publicPageViews.filter(pv => (pv.screen_width || 0) >= 1024).length;
    const devices = [
      { name: 'Desktop', value: desktop },
      { name: 'Tablet', value: tablet },
      { name: 'Mobile', value: mobile },
    ].filter(d => d.value > 0);

    // Daily trend (total + organic)
    const dayMap = new Map<string, { views: number; organic: number }>();
    publicPageViews.forEach(pv => {
      const day = format(new Date(pv.created_at), 'MMM dd');
      const existing = dayMap.get(day) || { views: 0, organic: 0 };
      existing.views++;
      if (isOrganic(pv)) existing.organic++;
      dayMap.set(day, existing);
    });
    const dailyTrend = Array.from(dayMap.entries())
      .map(([date, d]) => ({ date, views: d.views, organic: d.organic }))
      .reverse();

    return { totalViews, uniqueVisitors, uniqueSessions, googleAdsViews, totalOrganic, uniqueOrganicVisitors, pages, sources, devices, dailyTrend };
  }, [pageViews]);

  const filteredPages = useMemo(() => {
    if (!stats) return [];
    if (!searchQuery) return stats.pages;
    return stats.pages.filter(p => p.path.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [stats, searchQuery]);

  const periods: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'This Week' },
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'this_year', label: 'This Year' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Page Analytics</h2>
          <p className="text-sm text-gray-500">Track visitor activity across all pages of your website</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {periods.map(p => (
            <Button
              key={p.key}
              variant={period === p.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p.key)}
              className={period === p.key ? 'bg-orange-500 hover:bg-orange-600' : ''}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : stats ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Eye className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Total Views</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalViews.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Unique Visitors</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.uniqueVisitors.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Globe className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Sessions</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.uniqueSessions.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Leaf className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-green-700 font-medium">Organic Reach</p>
                    <p className="text-2xl font-bold text-green-800">{stats.totalOrganic.toLocaleString()}</p>
                    <p className="text-xs text-green-600">{stats.uniqueOrganicVisitors.toLocaleString()} unique</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Google Ads</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.googleAdsViews.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lead Form Completions */}
          <LeadFormCompletionsCard />

          {/* Daily Trend Chart */}
          {stats.dailyTrend.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daily Page Views</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={stats.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="views" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 4 }} name="Total Views" />
                    <Line type="monotone" dataKey="organic" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} name="Organic" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Source & Device Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Traffic Sources</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.sources.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={stats.sources} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(props: any) => `${props.name} (${((props.percent || 0) * 100).toFixed(0)}%)`}>
                        {stats.sources.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-400 text-center py-8">No source data yet</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Device Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.devices.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stats.devices}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-400 text-center py-8">No device data yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Pages Table */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base">All Pages ({filteredPages.length})</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search pages..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Page</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Unique Visitors</TableHead>
                      <TableHead className="text-right">Organic</TableHead>
                      <TableHead className="text-right">Google Ads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPages.slice(0, 50).map((page) => (
                      <TableRow key={page.path}>
                        <TableCell className="font-medium max-w-xs truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{page.path}</span>
                            <a
                              href={`https://buyawarranty.co.uk${page.path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 text-gray-400 hover:text-orange-500"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{page.views.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{page.uniqueVisitors.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {page.organic > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                              {page.organic}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {page.googleAds > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                              {page.googleAds}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredPages.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                          {searchQuery ? 'No pages match your search' : 'No page view data yet. Views will appear as visitors browse your site.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          {/* GCLID Tracking Pipeline */}
          <GclidPipelineCard />
        </>
      ) : null}
    </div>
  );
};

const REQUIRED_SECRETS = [
  { key: 'GOOGLE_ADS_DEVELOPER_TOKEN', label: 'Developer Token', where: 'Google Ads → Tools → API Center' },
  { key: 'GOOGLE_ADS_CUSTOMER_ID', label: 'Customer ID', where: 'Your account number (no dashes)' },
  { key: 'GOOGLE_ADS_CONVERSION_ACTION_ID', label: 'Conversion Action ID', where: 'Google Ads → Goals → Conversions' },
  { key: 'GOOGLE_ADS_CLIENT_ID', label: 'OAuth2 Client ID', where: 'Google Cloud Console → Credentials' },
  { key: 'GOOGLE_ADS_CLIENT_SECRET', label: 'OAuth2 Client Secret', where: 'Google Cloud Console → Credentials' },
  { key: 'GOOGLE_ADS_REFRESH_TOKEN', label: 'OAuth2 Refresh Token', where: 'Generated via OAuth2 playground' },
];

/** GCLID capture & conversion pipeline — full functional card */
const GclidPipelineCard: React.FC = () => {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const { data: gclidStats } = useQuery({
    queryKey: ['page-analytics-gclid-stats'],
    queryFn: async () => {
      const [customers, bumper, leads, uploaded, pending] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }).not('gclid', 'is', null),
        supabase.from('bumper_transactions').select('id', { count: 'exact', head: true }).not('gclid', 'is', null),
        supabase.from('sales_leads').select('id', { count: 'exact', head: true }).not('gclid', 'is', null),
        supabase.from('customers').select('id', { count: 'exact', head: true }).not('gclid', 'is', null).not('google_ads_conversion_uploaded_at', 'is', null),
        supabase.from('customers').select('id', { count: 'exact', head: true }).not('gclid', 'is', null).is('google_ads_conversion_uploaded_at', null).eq('status', 'active').eq('is_deleted', false),
      ]);
      return {
        customers: customers.count || 0,
        bumper: bumper.count || 0,
        leads: leads.count || 0,
        uploaded: uploaded.count || 0,
        pending: pending.count || 0,
      };
    },
  });

  // Recent upload history
  const { data: recentUploads } = useQuery({
    queryKey: ['page-analytics-recent-uploads'],
    queryFn: async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, email, final_amount, gclid, google_ads_conversion_status, google_ads_conversion_uploaded_at')
        .not('gclid', 'is', null)
        .not('google_ads_conversion_status', 'is', null)
        .order('google_ads_conversion_uploaded_at', { ascending: false, nullsFirst: false })
        .limit(5);
      return data || [];
    },
  });

  const triggerUpload = async () => {
    setIsUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('upload-google-conversions');
      if (error) throw error;
      toast.success(`Upload complete — Uploaded: ${data?.uploaded || 0}, Failed: ${data?.failed || 0}`);
      queryClient.invalidateQueries({ queryKey: ['page-analytics-gclid-stats'] });
      queryClient.invalidateQueries({ queryKey: ['page-analytics-recent-uploads'] });
    } catch (error: any) {
      toast.error(error.message || 'Upload failed — check that all API secrets are configured.');
    } finally {
      setIsUploading(false);
    }
  };

  const steps = [
    { num: 1, title: 'Capture GCLID', desc: 'gclidCapture.ts grabs Google Click ID from URL params → localStorage', done: true },
    { num: 2, title: 'Store with Lead', desc: 'PageViewLogger logs to page_views; checkout passes to Stripe metadata → customers.gclid', done: true },
    { num: 3, title: 'Bumper Flow', desc: 'bumper_transactions also stores gclid from checkout session', done: true },
    { num: 4, title: 'Upload Conversions', desc: 'upload-google-conversions edge function sends actual sale values to Google Ads API', done: (gclidStats?.uploaded || 0) > 0 },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              GCLID Tracking Pipeline
            </CardTitle>
            <CardDescription>
              How Google Click IDs flow from ads → your site → offline conversion uploads
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSetup(!showSetup)}
              className="gap-1.5 text-xs"
            >
              <Key className="h-3.5 w-3.5" />
              Setup Guide
              {showSetup ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            <Button
              size="sm"
              onClick={triggerUpload}
              disabled={isUploading || (gclidStats?.pending === 0)}
              className="gap-1.5 text-xs"
            >
              {isUploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {isUploading ? 'Uploading...' : `Upload ${gclidStats?.pending || 0} Pending`}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mini KPIs */}
        {gclidStats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <p className="text-2xl font-bold">{gclidStats.customers}</p>
              <p className="text-xs text-muted-foreground">Customers</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <p className="text-2xl font-bold">{gclidStats.bumper}</p>
              <p className="text-xs text-muted-foreground">Bumper</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <p className="text-2xl font-bold">{gclidStats.leads}</p>
              <p className="text-xs text-muted-foreground">Leads</p>
            </div>
            <div className="p-3 rounded-lg border bg-green-50 text-center">
              <p className="text-2xl font-bold text-green-700">{gclidStats.uploaded}</p>
              <p className="text-xs text-green-600">Uploaded</p>
            </div>
            <div className="p-3 rounded-lg border bg-amber-50 text-center">
              <p className="text-2xl font-bold text-amber-700">{gclidStats.pending}</p>
              <p className="text-xs text-amber-600">Pending</p>
            </div>
          </div>
        )}

        {/* 4-step pipeline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map(step => (
            <div key={step.num} className={`p-3 rounded-lg border ${step.done ? 'bg-green-50/50 border-green-200' : 'bg-amber-50/50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                )}
                <span className="font-medium text-sm">Step {step.num}: {step.title}</span>
              </div>
              <p className="text-xs text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Recent Upload History */}
        {recentUploads && recentUploads.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Recent Upload History</p>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs text-right">Value</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Uploaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentUploads.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs font-medium">{row.email || '—'}</TableCell>
                      <TableCell className="text-xs text-right">
                        {row.final_amount ? `£${Number(row.final_amount).toLocaleString()}` : '—'}
                      </TableCell>
                      <TableCell>
                        {row.google_ads_conversion_status === 'uploaded' ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs">
                            <CheckCircle2 className="h-3 w-3" /> Uploaded
                          </Badge>
                        ) : row.google_ads_conversion_status?.startsWith('failed') ? (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1 text-xs">
                            <XCircle className="h-3 w-3" /> Failed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs">
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

        {/* Collapsible Setup Guide */}
        {showSetup && (
          <div className="space-y-4 pt-2 border-t">
            <div>
              <p className="text-sm font-medium mb-2">Required API Credentials</p>
              <p className="text-xs text-muted-foreground mb-3">
                These 6 secrets must be added in{' '}
                <a
                  href="https://supabase.com/dashboard/project/mzlpuxzwyrcyrgrongeb/settings/functions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline inline-flex items-center gap-0.5"
                >
                  Supabase Edge Function Secrets <ExternalLink className="h-3 w-3" />
                </a>{' '}
                before the upload function will work.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {REQUIRED_SECRETS.map((secret) => (
                  <div key={secret.key} className="flex items-start gap-2 p-2.5 rounded-lg border bg-muted/30">
                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-medium truncate">{secret.key}</p>
                      <p className="text-xs text-muted-foreground">{secret.label} — {secret.where}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">How It Works</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2.5 rounded-lg border bg-green-50/50">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">1. GCLID Auto-Captured</p>
                    <p className="text-xs text-muted-foreground">When someone clicks your Google Ad, the GCLID (e.g. <code className="bg-muted px-1 rounded">CjwK1234abcd</code>) is automatically saved from the URL to localStorage.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2.5 rounded-lg border bg-green-50/50">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">2. Stored on Purchase</p>
                    <p className="text-xs text-muted-foreground">At checkout, the GCLID is passed as Stripe metadata and stored in <code className="bg-muted px-1 rounded">customers.gclid</code> and <code className="bg-muted px-1 rounded">bumper_transactions.gclid</code>.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2.5 rounded-lg border bg-blue-50/50">
                  <Upload className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">3. Upload to Google Ads</p>
                    <p className="text-xs text-muted-foreground">The <code className="bg-muted px-1 rounded">upload-google-conversions</code> edge function sends actual sale values back to Google Ads as offline conversions. This enables <strong>Target ROAS</strong> bidding. Use the "Upload Pending" button above or set up a daily cron job.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5">
              <Zap className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium">Full settings & configuration</p>
                <p className="text-xs text-muted-foreground">For detailed setup, predicted lead values, and conversion action management, visit the Google Ads ROAS tab in the sidebar.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PageAnalyticsTab;
