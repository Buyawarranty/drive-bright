import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Eye, Users, Globe, TrendingUp, Monitor, Smartphone, ArrowUpRight, Search, Filter } from 'lucide-react';
import { format, subDays, subHours, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Input } from '@/components/ui/input';

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f59e0b'];

type Period = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year';

const getPeriodDates = (period: Period) => {
  const now = new Date();
  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday':
      return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case 'this_week':
      return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
    case 'this_month':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case 'last_month':
      return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
    case 'this_year':
      return { from: startOfYear(now), to: endOfDay(now) };
  }
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

    const totalViews = pageViews.length;
    const uniqueVisitors = new Set(pageViews.map(pv => pv.visitor_id)).size;
    const uniqueSessions = new Set(pageViews.map(pv => pv.session_id)).size;
    const googleAdsViews = pageViews.filter(pv => pv.is_google_ads).length;

    // Page breakdown
    const pageMap = new Map<string, { views: number; uniqueVisitors: Set<string>; googleAds: number }>();
    pageViews.forEach(pv => {
      const existing = pageMap.get(pv.page_path) || { views: 0, uniqueVisitors: new Set<string>(), googleAds: 0 };
      existing.views++;
      if (pv.visitor_id) existing.uniqueVisitors.add(pv.visitor_id);
      if (pv.is_google_ads) existing.googleAds++;
      pageMap.set(pv.page_path, existing);
    });

    const pages = Array.from(pageMap.entries())
      .map(([path, data]) => ({
        path,
        views: data.views,
        uniqueVisitors: data.uniqueVisitors.size,
        googleAds: data.googleAds,
      }))
      .sort((a, b) => b.views - a.views);

    // Source breakdown
    const sourceMap = new Map<string, number>();
    pageViews.forEach(pv => {
      const source = pv.utm_source || (pv.gclid ? 'google_ads' : pv.referrer ? new URL(pv.referrer).hostname : 'direct');
      sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
    });
    const sources = Array.from(sourceMap.entries())
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Device breakdown
    const mobile = pageViews.filter(pv => (pv.screen_width || 0) < 768).length;
    const tablet = pageViews.filter(pv => (pv.screen_width || 0) >= 768 && (pv.screen_width || 0) < 1024).length;
    const desktop = pageViews.filter(pv => (pv.screen_width || 0) >= 1024).length;
    const devices = [
      { name: 'Desktop', value: desktop },
      { name: 'Tablet', value: tablet },
      { name: 'Mobile', value: mobile },
    ].filter(d => d.value > 0);

    // Daily trend
    const dayMap = new Map<string, number>();
    pageViews.forEach(pv => {
      const day = format(new Date(pv.created_at), 'MMM dd');
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    });
    const dailyTrend = Array.from(dayMap.entries())
      .map(([date, views]) => ({ date, views }))
      .reverse();

    return { totalViews, uniqueVisitors, uniqueSessions, googleAdsViews, pages, sources, devices, dailyTrend };
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <Line type="monotone" dataKey="views" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 4 }} />
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
                        <TableCell colSpan={4} className="text-center py-8 text-gray-400">
                          {searchQuery ? 'No pages match your search' : 'No page view data yet. Views will appear as visitors browse your site.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default PageAnalyticsTab;
