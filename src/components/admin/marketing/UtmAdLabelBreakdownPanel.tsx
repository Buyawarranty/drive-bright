import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tag, Loader2 } from 'lucide-react';
import { useIsManagement } from '@/hooks/useIsManagement';

interface LabelRow {
  adId: string;
  leads: number;
  sales: number;
  sources: string;
}

interface SourceRow {
  source: string;
  leads: number;
}

/**
 * Management view of the ad tracking labels captured with each lead
 * (utm_source/medium/campaign/term/content + ad_id, 90-day window):
 *   - by ad label (ad_id): how many leads and sales carry each label
 *   - by UTM source: lead counts per labelled source
 * Website labels are only collected once the site is published; leads from
 * before that have no labels.
 */
export const UtmAdLabelBreakdownPanel: React.FC = () => {
  const { isManagement } = useIsManagement();
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [labelledLeads, setLabelledLeads] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isManagement) return;
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 3);
      since.setDate(1);
      since.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('sales_leads')
        .select('id, created_at, ad_id, abandoned_cart:abandoned_carts(cart_metadata)')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);

      if (cancelled) return;
      if (error || !data) { setLoading(false); return; }

      const byLabel = new Map<string, { leads: number; sources: Set<string> }>();
      const bySource = new Map<string, number>();
      let labelled = 0;

      for (const row of data as any[]) {
        const meta = row.abandoned_cart?.cart_metadata as
          { utm_source?: string; utm_medium?: string; utm_campaign?: string } | null | undefined;
        const source = (meta?.utm_source || row.ad_id ? 'labelled' : '').trim();
        void source;
        const utmSource = (meta?.utm_source || '').trim();
        const label = String(row.ad_id || '').trim();
        if (utmSource) {
          bySource.set(utmSource, (bySource.get(utmSource) || 0) + 1);
        }
        if (label) {
          labelled += 1;
          if (!byLabel.has(label)) byLabel.set(label, { leads: 0, sources: new Set() });
          const bucket = byLabel.get(label)!;
          bucket.leads += 1;
          if (utmSource) bucket.sources.add(utmSource);
        }
      }

      const labelIds = Array.from(byLabel.keys());
      const salesByLabel = new Map<string, number>();
      if (labelIds.length) {
        const { data: sold } = await supabase
          .from('customers')
          .select('ad_id')
          .in('ad_id', labelIds)
          .limit(10000);
        for (const c of (sold || []) as any[]) {
          const id = String(c.ad_id || '').trim();
          if (id) salesByLabel.set(id, (salesByLabel.get(id) || 0) + 1);
        }
      }

      if (cancelled) return;
      setLabels(
        Array.from(byLabel.entries())
          .map(([adId, v]) => ({ adId, leads: v.leads, sales: salesByLabel.get(adId) || 0, sources: Array.from(v.sources).join(', ') }))
          .sort((a, z) => z.leads - a.leads)
          .slice(0, 15),
      );
      setSources(
        Array.from(bySource.entries())
          .map(([source, leads]) => ({ source, leads }))
          .sort((a, z) => z.leads - a.leads),
      );
      setLabelledLeads(labelled);
      setTotalLeads(data.length);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isManagement]);

  const caption = useMemo(() => 'Last three months of leads captured on the website.', []);

  if (!isManagement) return null;

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-lg inline-flex items-center gap-2">
          <Tag className="h-4 w-4" /> Ad labels — UTM &amp; ad_id on leads
        </CardTitle>
        <CardDescription>
          {caption} Each ad link can carry <strong>utm_source/medium/campaign/term/content</strong> and an{' '}
          <strong>ad_id</strong> label; these are saved with the lead and copied onto the customer when it becomes a
          sale. Leads created before the labelled site goes live have no labels.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading ad labels…
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              <strong>{labelledLeads}</strong> of <strong>{totalLeads}</strong> leads in the period carry an ad_id
              label.
            </p>
            <div>
              <h3 className="text-sm font-semibold mb-2">By ad label (ad_id)</h3>
              {labels.length === 0 ? (
                <p className="text-sm text-muted-foreground">No labelled leads yet — labels start once the site is published and ad links include ad_id.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ad_id</TableHead>
                      <TableHead>UTM source(s) seen with it</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Sales</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {labels.map((r) => (
                      <TableRow key={r.adId}>
                        <TableCell className="font-mono text-xs">{r.adId}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.sources || '—'}</TableCell>
                        <TableCell className="text-right">{r.leads}</TableCell>
                        <TableCell className="text-right">{r.sales}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            {sources.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">By UTM source</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>utm_source</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map((r) => (
                      <TableRow key={r.source}>
                        <TableCell className="font-mono text-xs">{r.source}</TableCell>
                        <TableCell className="text-right">{r.leads}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UtmAdLabelBreakdownPanel;
