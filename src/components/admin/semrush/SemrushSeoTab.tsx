import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { invokeWithFreshSession } from '@/lib/invokeWithFreshSession';
import { AlertTriangle, BarChart3, KeyRound, Link2, RefreshCw, Search, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_DOMAIN = 'buyawarranty.co.uk';
const DATABASES = [
  { value: 'uk', label: 'United Kingdom' },
  { value: 'us', label: 'United States' },
  { value: 'ie', label: 'Ireland' },
];

type SemrushRows = { columnNames: string[]; rows: Array<Record<string, string>> };

interface SemrushResult {
  data?: SemrushRows;
  status?: number;
}

function normaliseRows(payload: unknown): SemrushRows {
  const data = (payload as SemrushResult | undefined)?.data;
  if (data && Array.isArray(data.rows)) {
    return { columnNames: data.columnNames ?? [], rows: data.rows };
  }
  return { columnNames: [], rows: [] };
}

async function callSemrush(
  group: string,
  method: string,
  params: Record<string, string | number>,
): Promise<{ rows: SemrushRows; error: string | null }> {
  const { data, error } = await invokeWithFreshSession<unknown>('semrush-seo', { group, method, params });
  if (error) return { rows: { columnNames: [], rows: [] }, error: error.message };
  const payload = data as { error?: string } | undefined;
  if (payload?.error) return { rows: { columnNames: [], rows: [] }, error: payload.error };
  return { rows: normaliseRows(data), error: null };
}

const SectionHeading: React.FC<{ icon: React.ElementType; title: string; description: string }> = ({
  icon: Icon,
  title,
  description,
}) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div>
      <CardTitle className="text-base">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </div>
  </div>
);

const ResultTable: React.FC<{
  rows: SemrushRows;
  loading: boolean;
  empty: string;
  labels?: Record<string, string>;
}> = ({ rows, loading, empty, labels }) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (!rows.rows.length) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  const columns = rows.columnNames.length ? rows.columnNames : Object.keys(rows.rows[0]);

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c} className="whitespace-nowrap text-xs uppercase tracking-wide">
                {labels?.[c] ?? c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.rows.map((row, idx) => (
            <TableRow key={idx}>
              {columns.map((c) => (
                <TableCell key={c} className="whitespace-nowrap text-sm">
                  {row[c] ?? '—'}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const SemrushSeoTab: React.FC = () => {
  const { toast } = useToast();
  const [database, setDatabase] = useState('uk');
  const [domain, setDomain] = useState(DEFAULT_DOMAIN);

  const [overview, setOverview] = useState<SemrushRows>({ columnNames: [], rows: [] });
  const [organic, setOrganic] = useState<SemrushRows>({ columnNames: [], rows: [] });
  const [backlinks, setBacklinks] = useState<SemrushRows>({ columnNames: [], rows: [] });
  const [refDomains, setRefDomains] = useState<SemrushRows>({ columnNames: [], rows: [] });
  const [keywordRows, setKeywordRows] = useState<SemrushRows>({ columnNames: [], rows: [] });
  const [questionRows, setQuestionRows] = useState<SemrushRows>({ columnNames: [], rows: [] });

  const [loading, setLoading] = useState(false);
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('car warranty uk');

  const cleanDomain = useMemo(
    () => domain.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, ''),
    [domain],
  );

  const loadDomain = useCallback(async () => {
    if (!cleanDomain) return;
    setLoading(true);
    setError(null);

    const [ranks, organicKeywords, blOverview, blRefDomains] = await Promise.all([
      callSemrush('domains', 'domain_ranks', {
        domain: cleanDomain,
        database,
        export_columns: 'Db,Dn,Rk,Or,Ot,Oc,Ad,At,Ac',
      }),
      callSemrush('domains', 'domain_organic', {
        domain: cleanDomain,
        database,
        display_limit: 25,
        display_sort: 'tr_desc',
        export_columns: 'Ph,Po,Nq,Cp,Kd,Tr,Ur',
      }),
      callSemrush('backlinks', 'backlinks_overview', {
        target: cleanDomain,
        target_type: 'root_domain',
        export_columns: 'ascore,total,domains_num,urls_num,follows_num,nofollows_num',
      }),
      callSemrush('backlinks', 'backlinks_refdomains', {
        target: cleanDomain,
        target_type: 'root_domain',
        display_limit: 15,
        export_columns: 'domain_ascore,domain,backlinks_num',
      }),
    ]);

    const firstError = ranks.error || organicKeywords.error || blOverview.error || blRefDomains.error;
    if (firstError) setError(firstError);

    setOverview(ranks.rows);
    setOrganic(organicKeywords.rows);
    setBacklinks(blOverview.rows);
    setRefDomains(blRefDomains.rows);
    setLoading(false);
  }, [cleanDomain, database]);

  const loadKeyword = useCallback(async () => {
    const phrase = keyword.trim();
    if (!phrase) return;
    setKeywordLoading(true);

    const [overviewRes, questionsRes] = await Promise.all([
      callSemrush('keywords', 'phrase_related', {
        phrase,
        database,
        display_limit: 25,
        export_columns: 'Ph,Nq,Cp,Kd,Co,Nr',
      }),
      callSemrush('keywords', 'phrase_questions', {
        phrase,
        database,
        display_limit: 20,
        export_columns: 'Ph,Nq,Cp,Kd',
      }),
    ]);

    if (overviewRes.error || questionsRes.error) {
      const message = overviewRes.error || questionsRes.error || 'Semrush request failed';
      setError(message);
      toast({ title: 'Semrush', description: message, variant: 'destructive' });
    }

    setKeywordRows(overviewRes.rows);
    setQuestionRows(questionsRes.rows);
    setKeywordLoading(false);
  }, [keyword, database, toast]);

  useEffect(() => {
    void loadDomain();
  }, [loadDomain]);

  const summary = overview.rows[0] ?? {};

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Semrush SEO</h1>
          <p className="text-sm text-muted-foreground">
            Live organic visibility, keyword and backlink data for our sites, straight from Semrush.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full sm:w-56">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Domain</label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="buyawarranty.co.uk" />
          </div>
          <div className="w-full sm:w-44">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Market</label>
            <Select value={database} onValueChange={setDatabase}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATABASES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => void loadDomain()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Semrush could not return that report</AlertTitle>
          <AlertDescription className="break-words text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Authority score', value: summary.Rk ?? backlinks.rows[0]?.ascore, hint: 'Semrush rank / authority' },
          { label: 'Organic keywords', value: summary.Or, hint: 'Keywords in Google top 100' },
          { label: 'Est. organic traffic', value: summary.Ot, hint: 'Monthly visits (estimate)' },
          { label: 'Referring domains', value: backlinks.rows[0]?.domains_num, hint: 'Unique linking domains' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wide">{kpi.label}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <div className="text-2xl font-semibold">
                  {kpi.value ? Number(kpi.value).toLocaleString('en-GB') : '—'}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="visibility" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="visibility">
            <TrendingUp className="mr-2 h-4 w-4" /> Visibility
          </TabsTrigger>
          <TabsTrigger value="keywords">
            <KeyRound className="mr-2 h-4 w-4" /> Keyword research
          </TabsTrigger>
          <TabsTrigger value="backlinks">
            <Link2 className="mr-2 h-4 w-4" /> Backlinks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visibility" className="space-y-4">
          <Card>
            <CardHeader>
              <SectionHeading
                icon={BarChart3}
                title="Top ranking keywords"
                description={`Highest traffic-driving organic keywords for ${cleanDomain}.`}
              />
            </CardHeader>
            <CardContent>
              <ResultTable
                rows={organic}
                loading={loading}
                empty="No organic keyword data returned for this domain and market."
                labels={{
                  Ph: 'Keyword',
                  Po: 'Position',
                  Nq: 'Monthly searches',
                  Cp: 'CPC (£)',
                  Kd: 'Difficulty',
                  Tr: 'Traffic share',
                  Ur: 'Ranking URL',
                }}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Source: Semrush ({DATABASES.find((d) => d.value === database)?.label} database). Volumes and traffic
                are estimates for Google organic results only.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keywords" className="space-y-4">
          <Card>
            <CardHeader>
              <SectionHeading
                icon={Search}
                title="Research a keyword"
                description="Related terms and real question searches to guide new pages and rewrites."
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void loadKeyword();
                  }}
                  placeholder="e.g. extended car warranty"
                  className="max-w-sm"
                />
                <Button onClick={() => void loadKeyword()} disabled={keywordLoading}>
                  <Search className={`mr-2 h-4 w-4 ${keywordLoading ? 'animate-pulse' : ''}`} />
                  Research
                </Button>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Related keywords</h3>
                <ResultTable
                  rows={keywordRows}
                  loading={keywordLoading}
                  empty="Run a search to see related keywords."
                  labels={{
                    Ph: 'Keyword',
                    Nq: 'Monthly searches',
                    Cp: 'CPC (£)',
                    Kd: 'Difficulty',
                    Co: 'Ad competition',
                    Nr: 'Results',
                  }}
                />
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Questions people search</h3>
                <ResultTable
                  rows={questionRows}
                  loading={keywordLoading}
                  empty="Run a search to see question variations."
                  labels={{ Ph: 'Question', Nq: 'Monthly searches', Cp: 'CPC (£)', Kd: 'Difficulty' }}
                />
              </div>

              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                Difficulty guide — under 30 is realistic for us to win, 30–50 needs strong content plus time, 50–70 is
                ambitious, 70+ is big-site territory (target a longer, more specific phrase instead).
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backlinks" className="space-y-4">
          <Card>
            <CardHeader>
              <SectionHeading
                icon={Link2}
                title="Backlink profile"
                description="Authority and the domains sending us the most links."
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {backlinks.rows[0] &&
                  Object.entries(backlinks.rows[0]).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="text-xs">
                      {k.replace(/_/g, ' ')}: {Number(v) ? Number(v).toLocaleString('en-GB') : v}
                    </Badge>
                  ))}
              </div>
              <ResultTable
                rows={refDomains}
                loading={loading}
                empty="No referring domain data returned."
                labels={{ domain: 'Referring domain', domain_ascore: 'Authority', backlinks_num: 'Backlinks' }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SemrushSeoTab;
