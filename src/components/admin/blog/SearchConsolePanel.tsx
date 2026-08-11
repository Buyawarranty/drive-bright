import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ExternalLink, Info, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';

const SITE_ORIGIN = 'https://buyawarranty.co.uk';
const EV_MOT_SLUG = 'do-electric-cars-need-mot-uk-rules-explained-2026';

interface InspectResult {
  url: string;
  ok: boolean;
  status?: number;
  details?: string;
  verdict?: string | null;
  coverageState?: string | null;
  robotsTxtState?: string | null;
  indexingState?: string | null;
  pageFetchState?: string | null;
  lastCrawlTime?: string | null;
  googleCanonical?: string | null;
  userCanonical?: string | null;
  mobileUsability?: string | null;
  richResultsVerdict?: string | null;
  richResults?: { type: string; count: number }[];
  inspectionLink?: string | null;
}

interface HubUrl {
  slug: string;
  title: string;
  url: string;
}

const verdictTone = (verdict?: string | null) => {
  switch (verdict) {
    case 'PASS':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'FAIL':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'PARTIAL':
    case 'NEUTRAL':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

/** Deep link into Search Console's URL Inspection tool, where indexing can be requested. */
const inspectToolLink = (siteUrl: string, pageUrl: string) =>
  `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(siteUrl)}&id=${encodeURIComponent(pageUrl)}`;

/** Flags meta/robots/canonical problems worth a quick fix. */
const issuesFor = (r: InspectResult) => {
  const issues: string[] = [];
  if (r.robotsTxtState && r.robotsTxtState !== 'ALLOWED') issues.push(`robots.txt: ${r.robotsTxtState}`);
  if (r.indexingState && !['INDEXING_ALLOWED', 'INDEXING_STATE_UNSPECIFIED'].includes(r.indexingState)) {
    issues.push(`meta robots: ${r.indexingState}`);
  }
  if (r.pageFetchState && r.pageFetchState !== 'SUCCESSFUL') issues.push(`fetch: ${r.pageFetchState}`);
  if (r.googleCanonical && r.userCanonical && r.googleCanonical !== r.userCanonical) {
    issues.push('canonical mismatch (Google picked a different URL)');
  }
  if (r.mobileUsability && r.mobileUsability === 'FAIL') issues.push('mobile usability failing');
  if (!r.richResults?.length) issues.push('no rich results detected yet');
  return issues;
};

export const SearchConsolePanel = () => {
  const [hubUrls, setHubUrls] = useState<HubUrl[]>([]);
  const [selected, setSelected] = useState<string[]>([`${SITE_ORIGIN}/thewarrantyhub/${EV_MOT_SLUG}/`]);
  const [property, setProperty] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [loadingProperty, setLoadingProperty] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<InspectResult[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  // Load every published Warranty Hub URL
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('slug, title, published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      setHubUrls(
        (data || []).map((p) => ({
          slug: p.slug,
          title: p.title,
          url: `${SITE_ORIGIN}/thewarrantyhub/${p.slug}/`,
        })),
      );
    })();
  }, []);

  const callFunction = useCallback(async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('gsc-url-inspect', { body: payload });
    if (error) {
      const details = 'context' in error && error.context ? await (error.context as Response).text() : error.message;
      throw new Error(details || error.message);
    }
    return data as Record<string, any>;
  }, []);

  // Resolve the verified property once
  useEffect(() => {
    (async () => {
      try {
        const data = await callFunction({ action: 'properties', target_url: `${SITE_ORIGIN}/` });
        setCandidates(data.candidates || []);
        setProperty(data.site_url || null);
        if (data.status === 'no_property') {
          setConnectionError(data.message || 'No verified Search Console property covers this site.');
        }
      } catch (err) {
        setConnectionError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingProperty(false);
      }
    })();
  }, [callFunction]);

  const toggle = (url: string) =>
    setSelected((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));

  const runCheck = async () => {
    if (!property) {
      toast.error('Choose a Search Console property first');
      return;
    }
    if (selected.length === 0) {
      toast.error('Select at least one URL');
      return;
    }
    setRunning(true);
    try {
      const data = await callFunction({
        action: 'inspect',
        target_url: `${SITE_ORIGIN}/`,
        site_url: property,
        urls: selected,
      });
      setResults(data.results || []);
      setCheckedAt(data.checked_at || null);
      toast.success(`Checked ${data.results?.length ?? 0} URL(s) in Search Console`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search Console check failed');
    } finally {
      setRunning(false);
    }
  };

  const evMotUrl = `${SITE_ORIGIN}/thewarrantyhub/${EV_MOT_SLUG}/`;
  const orderedUrls = useMemo(() => {
    const ev = hubUrls.find((u) => u.slug === EV_MOT_SLUG);
    const rest = hubUrls.filter((u) => u.slug !== EV_MOT_SLUG);
    return ev ? [ev, ...rest] : [{ slug: EV_MOT_SLUG, title: 'EV MOT rules explained 2026', url: evMotUrl }, ...rest];
  }, [hubUrls, evMotUrl]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Search Console — indexing, canonical &amp; robots</h2>
        <p className="text-sm text-slate-600 mt-1">
          Reads the live state of each Warranty Hub URL in Google's index, and flags meta, robots and canonical issues
          for quick fixes.
        </p>
      </div>

      {connectionError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Search Console unavailable</AlertTitle>
          <AlertDescription>{connectionError}</AlertDescription>
        </Alert>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>About "submit for indexing"</AlertTitle>
        <AlertDescription>
          Google's API can read a URL's index state but cannot request indexing or a re-crawl. Use the
          "Request indexing in GSC" link on each result to do that in Search Console in one click. Keeping sitemap.xml
          and canonicals correct (checked here) is what drives automatic re-crawls.
        </AlertDescription>
      </Alert>

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px]">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Property</label>
            {loadingProperty ? (
              <Skeleton className="h-10 w-full mt-1" />
            ) : candidates.length > 1 ? (
              <Select value={property ?? undefined} onValueChange={setProperty}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a verified property" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="mt-2 text-sm font-medium text-slate-900">{property || '—'}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelected([evMotUrl])}>EV MOT only</Button>
            <Button variant="outline" onClick={() => setSelected(orderedUrls.slice(0, 25).map((u) => u.url))}>
              Select all (max 25)
            </Button>
            <Button onClick={runCheck} disabled={running || !property}>
              {running ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Check {selected.length} URL{selected.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
          {orderedUrls.map((u) => (
            <label key={u.slug} className="flex items-start gap-3 p-3 hover:bg-slate-50 cursor-pointer">
              <Checkbox checked={selected.includes(u.url)} onCheckedChange={() => toggle(u.url)} />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-900 truncate">{u.title}</span>
                <span className="block text-xs text-slate-500 truncate">/thewarrantyhub/{u.slug}/</span>
              </span>
            </label>
          ))}
        </div>
      </Card>

      {checkedAt && (
        <p className="text-xs text-slate-500">
          Last checked {new Date(checkedAt).toLocaleString('en-GB')}
        </p>
      )}

      <div className="space-y-4">
        {results.map((r) => {
          const issues = r.ok ? issuesFor(r) : [];
          return (
            <Card key={r.url} className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-slate-900 hover:underline break-all"
                >
                  {r.url.replace(SITE_ORIGIN, '')}
                </a>
                {r.ok ? (
                  <Badge variant="outline" className={verdictTone(r.verdict)}>{r.verdict || 'UNKNOWN'}</Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                    Error {r.status}
                  </Badge>
                )}
              </div>

              {!r.ok ? (
                <p className="text-sm text-red-700 break-all">{r.details}</p>
              ) : (
                <>
                  <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500 uppercase">Coverage</dt>
                      <dd className="font-medium text-slate-900">{r.coverageState || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 uppercase">robots.txt</dt>
                      <dd className="font-medium text-slate-900">{r.robotsTxtState || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 uppercase">Meta robots</dt>
                      <dd className="font-medium text-slate-900">{r.indexingState || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 uppercase">Last crawl</dt>
                      <dd className="font-medium text-slate-900">
                        {r.lastCrawlTime ? new Date(r.lastCrawlTime).toLocaleDateString('en-GB') : 'Not crawled'}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-500 uppercase">Canonical (ours → Google's)</dt>
                      <dd className="font-medium text-slate-900 break-all text-xs">
                        {(r.userCanonical || '—')} → {(r.googleCanonical || '—')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 uppercase">Mobile</dt>
                      <dd className="font-medium text-slate-900">{r.mobileUsability || '—'}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-500 uppercase">Structured data detected</dt>
                      <dd className="font-medium text-slate-900">
                        {r.richResults?.length
                          ? r.richResults.map((rr) => `${rr.type} (${rr.count})`).join(', ')
                          : 'None'}
                      </dd>
                    </div>
                  </dl>

                  {issues.length > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-1">Quick fixes</p>
                      <ul className="list-disc pl-5 text-sm text-amber-900 space-y-0.5">
                        {issues.map((i) => <li key={i}>{i}</li>)}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {property && (
                      <Button asChild size="sm" variant="outline">
                        <a href={inspectToolLink(property, r.url)} target="_blank" rel="noreferrer">
                          Request indexing in GSC <ExternalLink className="h-3.5 w-3.5 ml-1" />
                        </a>
                      </Button>
                    )}
                    {r.inspectionLink && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={r.inspectionLink} target="_blank" rel="noreferrer">
                          Full inspection report <ExternalLink className="h-3.5 w-3.5 ml-1" />
                        </a>
                      </Button>
                    )}
                  </div>
                </>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
