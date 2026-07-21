import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Eye, TrendingUp, Users, Globe, Megaphone, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface PostRow {
  id: string;
  title: string;
  slug: string | null;
  view_count: number | null;
  status: string | null;
  published_at: string | null;
}

interface ViewRow {
  page_path: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  session_id: string | null;
  visitor_id: string | null;
  created_at: string;
}

const WINDOW_DAYS = 30;

const classifyReferrer = (ref: string | null): string => {
  if (!ref) return 'Direct';
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    if (!host) return 'Direct';
    if (host.includes('buyawarranty')) return 'Internal';
    if (host.includes('google')) return 'Google';
    if (host.includes('bing')) return 'Bing';
    if (host.includes('duckduckgo')) return 'DuckDuckGo';
    if (host.includes('facebook') || host.includes('fb.com') || host.includes('instagram')) return 'Meta';
    if (host.includes('t.co') || host.includes('twitter') || host.includes('x.com')) return 'X / Twitter';
    if (host.includes('linkedin')) return 'LinkedIn';
    if (host.includes('reddit')) return 'Reddit';
    if (host.includes('youtube')) return 'YouTube';
    return host;
  } catch {
    return 'Direct';
  }
};

export const PerformanceInsights = () => {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [views, setViews] = useState<ViewRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const sinceIso = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const [postsRes, viewsRes] = await Promise.all([
          supabase
            .from('blog_posts')
            .select('id, title, slug, view_count, status, published_at')
            .order('view_count', { ascending: false, nullsFirst: false })
            .limit(200),
          supabase
            .from('page_views')
            .select('page_path, referrer, utm_source, utm_medium, session_id, visitor_id, created_at')
            .like('page_path', '/thewarrantyhub/%')
            .gte('created_at', sinceIso)
            .order('created_at', { ascending: false })
            .limit(5000),
        ]);
        if (postsRes.error) throw postsRes.error;
        if (viewsRes.error) throw viewsRes.error;
        setPosts((postsRes.data as PostRow[]) || []);
        setViews((viewsRes.data as ViewRow[]) || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalStoredViews = posts.reduce((s, p) => s + (p.view_count || 0), 0);
  const publishedCount = posts.filter(p => p.status === 'published').length;

  const trackedViews = views.length;
  const uniqueVisitors = new Set(views.map(v => v.visitor_id).filter(Boolean)).size;
  const uniqueSessions = new Set(views.map(v => v.session_id).filter(Boolean)).size;

  const referrerBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    views.forEach(v => {
      const k = classifyReferrer(v.referrer);
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [views]);

  const utmBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    views.forEach(v => {
      if (!v.utm_source) return;
      const k = v.utm_medium ? `${v.utm_source} / ${v.utm_medium}` : v.utm_source;
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [views]);

  const timeline = useMemo(() => {
    const days: { date: string; views: number }[] = [];
    const buckets = new Map<string, number>();
    views.forEach(v => {
      const d = new Date(v.created_at).toISOString().slice(0, 10);
      buckets.set(d, (buckets.get(d) || 0) + 1);
    });
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      days.push({ date: d.slice(5), views: buckets.get(d) || 0 });
    }
    return days;
  }, [views]);

  const topByTracked = useMemo(() => {
    const map = new Map<string, number>();
    views.forEach(v => {
      const key = v.page_path.replace(/^\/thewarrantyhub\//, '').replace(/\/$/, '');
      if (!key) return; // hub landing itself
      if (/^page\/\d+$/i.test(key)) return; // pagination
      map.set(key, (map.get(key) || 0) + 1);
    });
    const bySlug = new Map(posts.map(p => [p.slug || '', p]));
    const byId = new Map(posts.map(p => [p.id, p]));
    return Array.from(map.entries())
      .map(([key, count]) => {
        const post = bySlug.get(key) || byId.get(key);
        return { key, slug: post?.slug || key, count, post };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [views, posts]);

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="pt-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-emerald-700 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <p className="font-semibold">Real traffic tracking is live</p>
            <p>
              Every public blog pageview is logged server-side to <code>page_views</code> with referrer,
              UTM tags and visitor/session IDs. Numbers below are actual visitor data from the last {WINDOW_DAYS} days.
              Time-on-page and bounce rate still require GA4.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pageviews (30d)</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Eye className="w-6 h-6 text-blue-600" />
              {loading ? '—' : trackedViews.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500">From page_views</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unique Visitors</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              {loading ? '—' : uniqueVisitors.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500">Distinct visitor_id</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sessions</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-purple-600" />
              {loading ? '—' : uniqueSessions.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500">Distinct session_id</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>All-time Views</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-slate-600" />
              {loading ? '—' : totalStoredViews.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500">blog_posts.view_count</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Published</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-green-600" />
              {loading ? '—' : publishedCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500">Live articles</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pageviews — last {WINDOW_DAYS} days</CardTitle>
          <CardDescription>Daily blog pageviews from real traffic</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          {loading ? (
            <p className="text-gray-500 text-sm py-6 text-center">Loading…</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="views" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-4 h-4" /> Traffic Sources
            </CardTitle>
            <CardDescription>Where visitors came from (referrer domain)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-sm py-4 text-center">Loading…</p>
            ) : referrerBreakdown.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No traffic yet.</p>
            ) : (
              <div className="space-y-2">
                {referrerBreakdown.slice(0, 8).map(([k, count]) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="truncate">{k}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-4 h-4" /> Campaigns (UTM)
            </CardTitle>
            <CardDescription>utm_source / utm_medium breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-sm py-4 text-center">Loading…</p>
            ) : utmBreakdown.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No UTM-tagged visits in this window.</p>
            ) : (
              <div className="space-y-2">
                {utmBreakdown.slice(0, 8).map(([k, count]) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="truncate">{k}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Articles (last {WINDOW_DAYS} days)</CardTitle>
          <CardDescription>Ranked by real pageviews in the window</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500 text-sm py-6 text-center">Loading…</p>
          ) : error ? (
            <p className="text-red-600 text-sm py-6 text-center">{error}</p>
          ) : topByTracked.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">No tracked pageviews yet.</p>
          ) : (
            <div className="space-y-2">
              {topByTracked.map((row, i) => (
                <div key={row.key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-gray-400 text-sm w-6">#{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {row.post?.title || <span className="text-gray-500 italic">Unknown / deleted post</span>}
                      </p>
                      <p className="text-xs text-gray-500 truncate">/thewarrantyhub/{row.slug}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-3 shrink-0">
                    {row.count.toLocaleString()} views
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
