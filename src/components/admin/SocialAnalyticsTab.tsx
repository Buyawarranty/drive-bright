import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Instagram, Facebook, Music2, RefreshCw, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { UnifiedDateFilter, periodToRange, type PeriodKey } from '@/components/admin/UnifiedDateFilter';
import type { DateRange } from 'react-day-picker';

type Row = {
  platform: string;
  visits: number;
  visitors: number;
  quotes_started: number;
  leads: number;
  sales: number;
  revenue: number;
};

const PLATFORM_META: Record<string, { label: string; icon: React.ElementType; profile: string; tagged: string }> = {
  instagram: {
    label: 'Instagram',
    icon: Instagram,
    profile: 'https://www.instagram.com/buya.warranty',
    tagged: 'https://buyawarranty.co.uk/?utm_source=instagram&utm_medium=social&utm_campaign=bio_link',
  },
  tiktok: {
    label: 'TikTok',
    icon: Music2,
    profile: 'https://www.tiktok.com/@uk.buyawarranty',
    tagged: 'https://buyawarranty.co.uk/?utm_source=tiktok&utm_medium=social&utm_campaign=bio_link',
  },
  facebook: {
    label: 'Facebook',
    icon: Facebook,
    profile: 'https://www.facebook.com/buyawarranty.co.uk/',
    tagged: 'https://buyawarranty.co.uk/?utm_source=facebook&utm_medium=social&utm_campaign=bio_link',
  },
};

const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');
const gbp = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n || 0);

export const SocialAnalyticsTab: React.FC = () => {
  const [datePeriod, setDatePeriod] = useState<PeriodKey>('30days');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const activeRange = useMemo<DateRange | undefined>(
    () => (datePeriod === 'custom' ? customRange : periodToRange(datePeriod)),
    [datePeriod, customRange]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const to = activeRange?.to ? new Date(activeRange.to) : now;
      to.setHours(23, 59, 59, 999);
      const from = activeRange?.from
        ? new Date(new Date(activeRange.from).setHours(0, 0, 0, 0))
        : new Date('2020-01-01T00:00:00.000Z');
      const { data, error } = await (supabase as any).rpc('get_social_analytics', {
        p_from: from.toISOString(),
        p_to: new Date(to.getTime() + 60 * 1000).toISOString(),
      });
      if (error) throw error;
      setRows(
        (data || []).map((r: any) => ({
          platform: r.platform,
          visits: Number(r.visits || 0),
          visitors: Number(r.visitors || 0),
          quotes_started: Number(r.quotes_started || 0),
          leads: Number(r.leads || 0),
          sales: Number(r.sales || 0),
          revenue: Number(r.revenue || 0),
        }))
      );
    } catch (e: any) {
      console.error('[SocialAnalytics]', e);
      toast.error('Could not load social analytics right now');
    } finally {
      setLoading(false);
    }
  }, [activeRange]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          visits: acc.visits + r.visits,
          visitors: acc.visitors + r.visitors,
          quotes_started: acc.quotes_started + r.quotes_started,
          leads: acc.leads + r.leads,
          sales: acc.sales + r.sales,
          revenue: acc.revenue + r.revenue,
        }),
        { visits: 0, visitors: 0, quotes_started: 0, leads: 0, sales: 0, revenue: 0 }
      ),
    [rows]
  );

  const copy = async (platform: string, link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(platform);
      toast.success('Link copied — paste it into the profile bio');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Social analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visitors, quotes, leads and sales coming from our Instagram, TikTok and Facebook pages.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <UnifiedDateFilter
            scope="signup"
            period={datePeriod}
            customRange={customRange}
            availableScopes={['signup']}
            showLabel={false}
            onChange={({ period, customRange: cr }) => {
              setDatePeriod(period);
              setCustomRange(cr);
            }}
          />
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Visits', value: totals.visits.toLocaleString() },
          { label: 'People', value: totals.visitors.toLocaleString() },
          { label: 'Quotes started', value: totals.quotes_started.toLocaleString() },
          { label: 'Leads', value: totals.leads.toLocaleString() },
          { label: 'Sales', value: `${totals.sales.toLocaleString()} · ${gbp(totals.revenue)}` },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="text-xl font-semibold mt-1">{loading ? '—' : k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">By platform</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2 font-medium">Platform</th>
                  <th className="px-4 py-2 font-medium text-right">Visits</th>
                  <th className="px-4 py-2 font-medium text-right">People</th>
                  <th className="px-4 py-2 font-medium text-right">Quotes started</th>
                  <th className="px-4 py-2 font-medium text-right">Leads</th>
                  <th className="px-4 py-2 font-medium text-right">Sales</th>
                  <th className="px-4 py-2 font-medium text-right">Revenue</th>
                  <th className="px-4 py-2 font-medium text-right">Visit → lead</th>
                  <th className="px-4 py-2 font-medium text-right">Lead → sale</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : (
                  rows.map(r => {
                    const meta = PLATFORM_META[r.platform];
                    const Icon = meta?.icon ?? Instagram;
                    return (
                      <tr key={r.platform} className="border-t">
                        <td className="px-4 py-3">
                          <a
                            href={meta?.profile}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 font-medium hover:underline"
                          >
                            <Icon className="h-4 w-4" />
                            {meta?.label ?? r.platform}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-right">{r.visits.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{r.visitors.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{r.quotes_started.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{r.leads.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{r.sales.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{gbp(r.revenue)}</td>
                        <td className="px-4 py-3 text-right">{pct(r.leads, r.visits)}</td>
                        <td className="px-4 py-3 text-right">{pct(r.sales, r.leads)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Links to use in each profile bio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Instagram and TikTok hide where a visitor came from, so only these tagged links can be counted. Paste the
            matching link into each profile bio — everything else keeps working as normal.
          </p>
          {Object.entries(PLATFORM_META).map(([key, meta]) => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border p-3">
              <Badge variant="secondary" className="w-fit">
                {meta.label}
              </Badge>
              <code className="text-xs break-all flex-1">{meta.tagged}</code>
              <Button size="sm" variant="outline" onClick={() => copy(key, meta.tagged)}>
                {copied === key ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                Copy
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Facebook passes its own referral information, so those visits are counted even without a tagged link. Sales are
        counted from tagged visits only and exclude cancelled or refunded policies.
      </p>
    </div>
  );
};

export default SocialAnalyticsTab;
