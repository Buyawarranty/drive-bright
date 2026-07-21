import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BarChart3 } from 'lucide-react';

interface PageRow {
  page_path: string;
  views: number;
  visitors: number;
  google_ads_views: number;
  facebook_ads_views: number;
  direct_views: number;
  organic_views: number;
  cta_sessions: number;
  top_referrer: string | null;
  top_utm_source: string | null;
}

// Brand + hub pages the user asked to track (canonical paths + trailing-slash variants)
const BRAND_PAGES: Array<{ label: string; paths: string[] }> = [
  { label: 'Volkswagen Warranty', paths: ['/car-extended-warranty/volkswagen/', '/car-extended-warranty/volkswagen', '/warranty-types/volkswagen-warranty/', '/warranty-types/volkswagen-warranty'] },
  { label: 'Mercedes-Benz Warranty', paths: ['/car-extended-warranty/mercedes-benz/', '/car-extended-warranty/mercedes-benz', '/warranty-types/mercedes-warranty/', '/warranty-types/mercedes-warranty'] },
  { label: 'BMW Warranty', paths: ['/car-extended-warranty/bmw/', '/car-extended-warranty/bmw', '/warranty-types/bmw-warranty/', '/warranty-types/bmw-warranty', '/warranty-types/bmw/'] },
  { label: 'Citroen Warranty', paths: ['/car-extended-warranty/citroen/', '/car-extended-warranty/citroen', '/warranty-types/citroen-warranty/', '/warranty-types/citroen-warranty'] },
  { label: 'Land Rover Warranty', paths: ['/car-extended-warranty/land-rover/', '/car-extended-warranty/land-rover'] },
  { label: 'Ford Warranty', paths: ['/car-extended-warranty/ford/', '/car-extended-warranty/ford', '/warranty-types/ford-warranty/', '/warranty-types/ford-warranty'] },
  { label: 'Audi Warranty', paths: ['/car-extended-warranty/audi/', '/car-extended-warranty/audi', '/warranty-types/audi-warranty/', '/warranty-types/audi-warranty'] },
  { label: 'Nissan Warranty', paths: ['/car-extended-warranty/nissan/', '/car-extended-warranty/nissan', '/warranty-types/nissan-warranty/', '/warranty-types/nissan-warranty'] },
  { label: 'Vauxhall Warranty', paths: ['/car-extended-warranty/vauxhall/', '/car-extended-warranty/vauxhall', '/warranty-types/vauxhall-warranty/', '/warranty-types/vauxhall-warranty'] },
  { label: 'Extended Warranty (hub)', paths: ['/car-extended-warranty/', '/car-extended-warranty'] },
  { label: 'Warranty Types (hub)', paths: ['/warranty-types/', '/warranty-types'] },
  { label: 'Warranty Hub (blog)', paths: ['/thewarrantyhub/', '/thewarrantyhub'] },
];

const RANGE_OPTIONS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 180 days', value: 180 },
  { label: 'All time (365d)', value: 365 },
];

const shortRef = (r: string | null) => {
  if (!r) return '—';
  try {
    const u = new URL(r);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return r.slice(0, 40);
  }
};

const num = (n: number) => (n || 0).toLocaleString();

export const BlogAnalyticsTab = () => {
  const [rangeDays, setRangeDays] = useState<number>(90);
  const [rows, setRows] = useState<Record<string, PageRow>>({});
  const [blogPosts, setBlogPosts] = useState<Array<{ slug: string; title: string; view_count: number | null }>>([]);
  const [loading, setLoading] = useState(true);

  const allPaths = useMemo(() => {
    const brand = BRAND_PAGES.flatMap((b) => b.paths);
    const blog = blogPosts.flatMap((p) => [`/thewarrantyhub/${p.slug}/`, `/thewarrantyhub/${p.slug}`]);
    return Array.from(new Set([...brand, ...blog]));
  }, [blogPosts]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('slug, title, view_count')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (error) {
        toast.error('Failed to load blog posts');
        return;
      }
      setBlogPosts(data || []);
    })();
  }, []);

  useEffect(() => {
    if (allPaths.length === 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_blog_page_analytics', {
        _paths: allPaths,
        _since_days: rangeDays,
      });
      if (cancelled) return;
      if (error) {
        console.error(error);
        toast.error('Failed to load analytics');
        setLoading(false);
        return;
      }
      const map: Record<string, PageRow> = {};
      (data as PageRow[] | null)?.forEach((r) => {
        map[r.page_path] = r;
      });
      setRows(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [allPaths, rangeDays]);

  // Combine rows across canonical + trailing-slash variants
  const combine = (paths: string[]): PageRow => {
    const base: PageRow = {
      page_path: paths[0],
      views: 0,
      visitors: 0,
      google_ads_views: 0,
      facebook_ads_views: 0,
      direct_views: 0,
      organic_views: 0,
      cta_sessions: 0,
      top_referrer: null,
      top_utm_source: null,
    };
    let bestRefCount = 0;
    let bestUtmCount = 0;
    for (const p of paths) {
      const r = rows[p];
      if (!r) continue;
      base.views += r.views;
      base.visitors += r.visitors;
      base.google_ads_views += r.google_ads_views;
      base.facebook_ads_views += r.facebook_ads_views;
      base.direct_views += r.direct_views;
      base.organic_views += r.organic_views;
      base.cta_sessions += r.cta_sessions;
      if (r.top_referrer && r.views > bestRefCount) {
        base.top_referrer = r.top_referrer;
        bestRefCount = r.views;
      }
      if (r.top_utm_source && r.views > bestUtmCount) {
        base.top_utm_source = r.top_utm_source;
        bestUtmCount = r.views;
      }
    }
    return base;
  };

  const brandRows = BRAND_PAGES.map((b) => ({ label: b.label, path: b.paths[0], stats: combine(b.paths) }));
  const blogRows = blogPosts.map((p) => ({
    label: p.title,
    slug: p.slug,
    path: `/thewarrantyhub/${p.slug}/`,
    stats: combine([`/thewarrantyhub/${p.slug}/`, `/thewarrantyhub/${p.slug}`]),
  }));

  const totalBlogViews = blogRows.reduce((s, r) => s + r.stats.views, 0);
  const totalBrandViews = brandRows.reduce((s, r) => s + r.stats.views, 0);
  const totalCta = [...blogRows, ...brandRows].reduce((s, r) => s + r.stats.cta_sessions, 0);

  const renderTable = (
    items: Array<{ label: string; path: string; slug?: string; stats: PageRow }>,
    labelHeader: string,
  ) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[240px]">{labelHeader}</TableHead>
            <TableHead className="text-right">Views</TableHead>
            <TableHead className="text-right">Unique visitors</TableHead>
            <TableHead className="text-right">CTA sessions</TableHead>
            <TableHead className="text-right">CTR</TableHead>
            <TableHead className="text-right">Google Ads</TableHead>
            <TableHead className="text-right">Facebook Ads</TableHead>
            <TableHead className="text-right">Organic search</TableHead>
            <TableHead className="text-right">Direct</TableHead>
            <TableHead>Top referrer</TableHead>
            <TableHead>Top UTM source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items
            .slice()
            .sort((a, b) => b.stats.views - a.stats.views)
            .map((r) => {
              const ctr = r.stats.visitors > 0 ? (r.stats.cta_sessions / r.stats.visitors) * 100 : 0;
              return (
                <TableRow key={r.path}>
                  <TableCell className="font-medium">
                    <a href={r.path} target="_blank" rel="noreferrer" className="hover:underline">
                      {r.label}
                    </a>
                    <div className="text-xs text-muted-foreground">{r.path}</div>
                  </TableCell>
                  <TableCell className="text-right">{num(r.stats.views)}</TableCell>
                  <TableCell className="text-right">{num(r.stats.visitors)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={r.stats.cta_sessions > 0 ? 'default' : 'secondary'}>{num(r.stats.cta_sessions)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{ctr.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{num(r.stats.google_ads_views)}</TableCell>
                  <TableCell className="text-right">{num(r.stats.facebook_ads_views)}</TableCell>
                  <TableCell className="text-right">{num(r.stats.organic_views)}</TableCell>
                  <TableCell className="text-right">{num(r.stats.direct_views)}</TableCell>
                  <TableCell className="text-xs">{shortRef(r.stats.top_referrer)}</TableCell>
                  <TableCell className="text-xs">{r.stats.top_utm_source || '—'}</TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" /> Blog & landing page analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Views, source of traffic and CTA sessions (visits that reached the quote / shopping / checkout page within 2 hours).
          </p>
        </div>
        <Select value={String(rangeDays)} onValueChange={(v) => setRangeDays(Number(v))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Blog article views</p>
            <p className="text-2xl font-bold">{num(totalBlogViews)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Brand / hub page views</p>
            <p className="text-2xl font-bold">{num(totalBrandViews)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total CTA sessions</p>
            <p className="text-2xl font-bold">{num(totalCta)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Brand & warranty landing pages (footer links)</CardTitle>
          <CardDescription>All the brand pages plus the Extended Warranty and Warranty Hub entry points.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : renderTable(brandRows, 'Page')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Blog articles</CardTitle>
          <CardDescription>Every published article under /thewarrantyhub/.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : blogRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published articles yet.</p>
          ) : (
            renderTable(blogRows, 'Article')
          )}
        </CardContent>
      </Card>
    </div>
  );
};
