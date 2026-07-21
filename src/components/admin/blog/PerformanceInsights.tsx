import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Eye, TrendingUp, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PostRow {
  id: string;
  title: string;
  slug: string | null;
  view_count: number | null;
  status: string | null;
  published_at: string | null;
}

export const PerformanceInsights = () => {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('blog_posts')
          .select('id, title, slug, view_count, status, published_at')
          .order('view_count', { ascending: false, nullsFirst: false })
          .limit(50);
        if (error) throw error;
        setPosts((data as PostRow[]) || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalViews = posts.reduce((s, p) => s + (p.view_count || 0), 0);
  const publishedCount = posts.filter(p => p.status === 'published').length;
  const topArticles = posts.slice(0, 10);

  return (
    <div className="space-y-6">
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Real data only</p>
            <p>
              Views come from the <code>blog_posts.view_count</code> column, which increments on the public
              blog article page. Traffic sources, keyword rankings and time-on-page are not tracked yet — add
              GA4 or a page-analytics integration to populate those.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Views</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Eye className="w-6 h-6 text-blue-600" />
              {loading ? '—' : totalViews.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500">Sum of view_count across all posts</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Published Articles</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-green-600" />
              {loading ? '—' : publishedCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500">Live on the public blog</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Articles With Views</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-purple-600" />
              {loading ? '—' : posts.filter(p => (p.view_count || 0) > 0).length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500">Posts with at least 1 recorded view</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Articles by Views</CardTitle>
          <CardDescription>Ordered by real view_count in the database</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500 text-sm py-6 text-center">Loading…</p>
          ) : error ? (
            <p className="text-red-600 text-sm py-6 text-center">{error}</p>
          ) : topArticles.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">No posts yet.</p>
          ) : (
            <div className="space-y-2">
              {topArticles.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-gray-400 text-sm w-6">#{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.title}</p>
                      <p className="text-xs text-gray-500">
                        {p.status} · {p.published_at ? new Date(p.published_at).toLocaleDateString() : 'unpublished'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-3 shrink-0">
                    {(p.view_count || 0).toLocaleString()} views
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
