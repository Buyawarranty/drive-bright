import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Globe, MapPin, HelpCircle, Loader2 } from 'lucide-react';
import { classifyOrganicOrigin, type OrganicKind } from '@/lib/organicOrigin';
import { useIsManagement } from '@/hooks/useIsManagement';

interface MonthRow {
  key: string;
  label: string;
  web: number;
  offline: number;
  unknown: number;
  total: number;
}

/**
 * Management view of the organic split:
 *   ORGANIC W — arrived from the web (organic search, our blog/guide pages,
 *               organic social, any referring site)
 *   ORGANIC O — arrived with no referrer, i.e. offline demand (billboard,
 *               van livery, radio, leaflet, word of mouth)
 * Paid channels are excluded — they keep their own Google/Meta/Bing/TikTok source.
 */
export const OrganicSourceBreakdownPanel: React.FC = () => {
  const { isManagement } = useIsManagement();
  const [rows, setRows] = useState<MonthRow[]>([]);
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
        .select('id, created_at, lead_source, abandoned_cart:abandoned_carts(cart_metadata)')
        .gte('created_at', since.toISOString())
        .in('lead_source', ['website', 'organic', 'other'])
        .order('created_at', { ascending: false })
        .limit(5000);

      if (cancelled) return;
      if (error || !data) { setLoading(false); return; }

      const buckets = new Map<string, MonthRow>();
      for (const row of data as any[]) {
        const d = new Date(row.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!buckets.has(key)) {
          buckets.set(key, {
            key,
            label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
            web: 0, offline: 0, unknown: 0, total: 0,
          });
        }
        const b = buckets.get(key)!;
        const kind: OrganicKind = classifyOrganicOrigin(row.abandoned_cart?.cart_metadata).kind;
        b[kind] += 1;
        b.total += 1;
      }

      setRows(Array.from(buckets.values()).sort((a, z) => (a.key < z.key ? 1 : -1)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isManagement]);

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({ web: acc.web + r.web, offline: acc.offline + r.offline, unknown: acc.unknown + r.unknown, total: acc.total + r.total }),
    { web: 0, offline: 0, unknown: 0, total: 0 },
  ), [rows]);

  if (!isManagement) return null;

  const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '—');

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-lg">Organic leads — web vs offline</CardTitle>
        <CardDescription>
          Last three months of non-paid leads. <strong>Organic W</strong> arrived from the web (organic search,
          blog and guide pages, organic social, any referring site). <strong>Organic O</strong> arrived with no
          referrer at all — typed in or bookmarked, which is offline demand such as a billboard, van livery,
          radio or word of mouth.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading organic breakdown…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No organic leads in the last three months.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Organic W</span>
                </TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Organic O</span>
                </TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5" /> Not captured</span>
                </TableHead>
                <TableHead className="text-right">Total organic</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.web} <span className="text-xs text-muted-foreground">({pct(r.web, r.total)})</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.offline} <span className="text-xs text-muted-foreground">({pct(r.offline, r.total)})</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.unknown}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{r.total}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40">
                <TableCell className="font-semibold">Last 3 months</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{totals.web}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{totals.offline}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{totals.unknown}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{totals.total}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Referrer and landing page are captured from now on, so “Not captured” only covers leads created before
          this tracking was added.
        </p>
      </CardContent>
    </Card>
  );
};

export default OrganicSourceBreakdownPanel;
