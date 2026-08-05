import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Download, Search, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import { AreaDistrictDrilldown } from './AreaDistrictDrilldown';
import { format, startOfMonth, subMonths, parseISO } from 'date-fns';
import { POSTCODE_AREA_MAP, NATIONS } from '@/lib/ukPostcodeAreas';

interface AreaMonthRow { area: string; month: string; sales: number; revenue: number; organic_sales?: number; organic_revenue?: number }
interface AreaClaimRow { area: string; month: string; claims: number; claim_cost: number }

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

type SortKey = 'sales' | 'revenue' | 'per100k' | 'town' | 'aov' | 'change' | 'claims' | 'claimCost' | 'claimRate' | 'organicSales';

export const BillboardDemographicsPanel: React.FC = () => {
  const [monthsBack, setMonthsBack] = useState(12);
  const [nation, setNation] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('sales');
  const [expandedArea, setExpandedArea] = useState<string | null>(null);

  const from = format(startOfMonth(subMonths(new Date(), monthsBack - 1)), 'yyyy-MM-dd');
  const to = format(new Date(), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['postcode-area-monthly-sales', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('postcode_area_monthly_sales', { _from: from, _to: to });
      if (error) throw error;
      return (data || []) as AreaMonthRow[];
    },
  });

  const { data: claimsData } = useQuery({
    queryKey: ['postcode-area-monthly-claims', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('postcode_area_monthly_claims', { _from: from, _to: to });
      if (error) throw error;
      return (data || []) as AreaClaimRow[];
    },
  });

  const claimsByArea = useMemo(() => {
    const map = new Map<string, { claims: number; claimCost: number }>();
    (claimsData || []).forEach((r) => {
      if (!r.area) return;
      const e = map.get(r.area) || { claims: 0, claimCost: 0 };
      e.claims += Number(r.claims || 0);
      e.claimCost += Number(r.claim_cost || 0);
      map.set(r.area, e);
    });
    return map;
  }, [claimsData]);

  const months = useMemo(() => {
    const list: string[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      list.push(format(startOfMonth(subMonths(new Date(), i)), 'yyyy-MM-dd'));
    }
    return list;
  }, [monthsBack]);

  const rows = useMemo(() => {
    const byArea = new Map<string, { monthly: Record<string, number>; organicMonthly: Record<string, number>; revenue: number; sales: number; organicSales: number; organicRevenue: number }>();
    (data || []).forEach((r) => {
      const key = r.area;
      if (!byArea.has(key)) byArea.set(key, { monthly: {}, organicMonthly: {}, revenue: 0, sales: 0, organicSales: 0, organicRevenue: 0 });
      const entry = byArea.get(key)!;
      const m = String(r.month).slice(0, 10);
      entry.monthly[m] = (entry.monthly[m] || 0) + Number(r.sales || 0);
      entry.organicMonthly[m] = (entry.organicMonthly[m] || 0) + Number(r.organic_sales || 0);
      entry.sales += Number(r.sales || 0);
      entry.revenue += Number(r.revenue || 0);
      entry.organicSales += Number(r.organic_sales || 0);
      entry.organicRevenue += Number(r.organic_revenue || 0);
    });

    const half = Math.floor(months.length / 2) || 1;
    const firstHalf = months.slice(0, half);
    const secondHalf = months.slice(months.length - half);

    const all = Array.from(byArea.entries()).map(([area, v]) => {
      const meta = POSTCODE_AREA_MAP[area];
      const sum = (ms: string[]) => ms.reduce((s, m) => s + (v.monthly[m] || 0), 0);
      const prev = sum(firstHalf);
      const recent = sum(secondHalf);
      const change = prev > 0 ? ((recent - prev) / prev) * 100 : recent > 0 ? 100 : 0;
      const population = meta?.population ?? 0;
      const cl = claimsByArea.get(area) || { claims: 0, claimCost: 0 };
      return {
        claims: cl.claims,
        claimCost: cl.claimCost,
        claimRate: v.sales ? (cl.claims / v.sales) * 100 : 0,
        netRevenue: v.revenue - cl.claimCost,
        area,
        town: meta?.town ?? `${area} (unmapped)`,
        region: meta?.region ?? '—',
        nation: meta?.nation ?? 'England',
        population,
        sales: v.sales,
        revenue: v.revenue,
        organicSales: v.organicSales,
        organicRevenue: v.organicRevenue,
        organicShare: v.sales ? (v.organicSales / v.sales) * 100 : 0,
        organicMonthly: v.organicMonthly,
        aov: v.sales ? v.revenue / v.sales : 0,
        perMonth: v.sales / months.length,
        per100k: population ? (v.sales / population) * 100000 : 0,
        change,
        monthly: v.monthly,
      };
    });

    const totalSales = all.reduce((s, r) => s + r.sales, 0) || 1;

    return all
      .map((r) => ({ ...r, share: (r.sales / totalSales) * 100 }))
      .filter((r) => (nation === 'all' ? true : r.nation === nation))
      .filter((r) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          r.town.toLowerCase().includes(q) ||
          r.region.toLowerCase().includes(q) ||
          r.area.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortKey === 'town') return a.town.localeCompare(b.town);
        return Number(b[sortKey]) - Number(a[sortKey]);
      });
  }, [data, claimsByArea, months, nation, search, sortKey]);

  const nationTotals = useMemo(() => {
    const totals: Record<string, { sales: number; revenue: number; population: number; claims: number; claimCost: number; organicSales: number; organicRevenue: number }> = {};
    NATIONS.forEach((n) => (totals[n] = { sales: 0, revenue: 0, population: 0, claims: 0, claimCost: 0, organicSales: 0, organicRevenue: 0 }));
    const seenAreas = new Set<string>();
    (data || []).forEach((r) => {
      const meta = POSTCODE_AREA_MAP[r.area];
      const n = meta?.nation ?? 'England';
      totals[n].sales += Number(r.sales || 0);
      totals[n].revenue += Number(r.revenue || 0);
      totals[n].organicSales += Number(r.organic_sales || 0);
      totals[n].organicRevenue += Number(r.organic_revenue || 0);
      if (meta && !seenAreas.has(r.area)) {
        seenAreas.add(r.area);
      }
    });
    (claimsData || []).forEach((r) => {
      const meta = POSTCODE_AREA_MAP[r.area];
      const n = meta?.nation ?? 'England';
      totals[n].claims += Number(r.claims || 0);
      totals[n].claimCost += Number(r.claim_cost || 0);
    });
    Object.values(POSTCODE_AREA_MAP).forEach((a) => {
      totals[a.nation].population += a.population;
    });
    return totals;
  }, [data, claimsData]);

  const grandSales = Object.values(nationTotals).reduce((s, t) => s + t.sales, 0);
  const maxMonthly = Math.max(1, ...rows.flatMap((r) => months.map((m) => r.monthly[m] || 0)));

  const exportCsv = () => {
    const header = [
      'Postcode area', 'Town / city', 'Region', 'Nation', 'Population',
      'Total sales', 'Organic sales', 'Organic %', 'Organic revenue',
      'Sales per month', 'Sales per 100k', 'Revenue', 'Avg order value',
      'Claims', 'Claim cost', 'Claim rate %', 'Net revenue', 'Share %', 'Trend %',
      ...months.map((m) => format(parseISO(m), 'MMM yy')),
      ...months.map((m) => `${format(parseISO(m), 'MMM yy')} organic`),
    ];
    const lines = rows.map((r) => [
      r.area, r.town, r.region, r.nation, r.population,
      r.sales, r.organicSales, r.organicShare.toFixed(0), Math.round(r.organicRevenue),
      r.perMonth.toFixed(2), r.per100k.toFixed(2), Math.round(r.revenue), Math.round(r.aov),
      r.claims, Math.round(r.claimCost), r.claimRate.toFixed(0), Math.round(r.netRevenue),
      r.share.toFixed(1), r.change.toFixed(0),
      ...months.map((m) => r.monthly[m] || 0),
      ...months.map((m) => r.organicMonthly[m] || 0),
    ]);
    const csv = [header, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `billboard-demographics-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Billboard Demographics
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Warranties sold each month by UK town / city catchment — England, Scotland, Wales and Northern Ireland.
              Use sales per 100k people to spot under-served areas worth a banner.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(monthsBack)} onValueChange={(v) => setMonthsBack(Number(v))}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
                <SelectItem value="24">Last 24 months</SelectItem>
              </SelectContent>
            </Select>
            <Select value={nation} onValueChange={setNation}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All UK nations</SelectItem>
                {NATIONS.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Most sales</SelectItem>
                <SelectItem value="per100k">Sales per 100k people</SelectItem>
                <SelectItem value="revenue">Highest revenue</SelectItem>
                <SelectItem value="aov">Highest avg order</SelectItem>
                <SelectItem value="change">Fastest growing</SelectItem>
                <SelectItem value="claims">Most claims</SelectItem>
                <SelectItem value="claimCost">Highest claim cost</SelectItem>
                <SelectItem value="claimRate">Highest claim rate</SelectItem>
                <SelectItem value="organicSales">Most organic sales</SelectItem>
                <SelectItem value="town">Town A–Z</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" />CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Nation summary */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {NATIONS.map((n) => {
            const t = nationTotals[n];
            const share = grandSales ? (t.sales / grandSales) * 100 : 0;
            const per100k = t.population ? (t.sales / t.population) * 100000 : 0;
            return (
              <div key={n} className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">{n}</p>
                <p className="text-xl font-bold">{t.sales} sales</p>
                <p className="text-xs text-muted-foreground">
                  {gbp(t.revenue)} · {share.toFixed(1)}% of UK · {per100k.toFixed(1)} per 100k
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.organicSales} organic sales ({t.sales ? ((t.organicSales / t.sales) * 100).toFixed(0) : '0'}%) · {gbp(t.organicRevenue)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.claims} claims · {gbp(t.claimCost)} paid out
                  {t.sales ? ` · ${((t.claims / t.sales) * 100).toFixed(0)}% claim rate` : ''}
                </p>
              </div>
            );
          })}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search town, region or postcode area…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading UK sales by town…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales with postcodes found in this period.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Town / city</TableHead>
                  <TableHead>Nation</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Organic</TableHead>
                  <TableHead className="text-right">Per month</TableHead>
                  <TableHead className="text-right">Per 100k</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Avg order</TableHead>
                  <TableHead className="text-right">Claims</TableHead>
                  <TableHead className="text-right">Claim cost</TableHead>
                  <TableHead className="text-right">Claim rate</TableHead>
                  <TableHead className="text-right">Net revenue</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead className="text-right">Trend</TableHead>
                  <TableHead className="min-w-[160px]">Monthly</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const TrendIcon = r.change > 5 ? TrendingUp : r.change < -5 ? TrendingDown : Minus;
                  const trendClass =
                    r.change > 5 ? 'text-emerald-600' : r.change < -5 ? 'text-red-600' : 'text-muted-foreground';
                  const isOpen = expandedArea === r.area;
                  const ExpandIcon = isOpen ? ChevronDown : ChevronRight;
                  return (
                    <React.Fragment key={r.area}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedArea(isOpen ? null : r.area)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-medium">
                          <ExpandIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {r.town}
                        </div>
                        <div className="pl-5 text-xs text-muted-foreground">
                          {r.area} · {r.region}
                          {r.population ? ` · ${(r.population / 1000).toFixed(0)}k people` : ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">{r.nation}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{r.sales}</TableCell>
                      <TableCell className="text-right text-emerald-700">
                        {r.organicSales}
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          {r.sales ? `${r.organicShare.toFixed(0)}%` : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{r.perMonth.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{r.per100k.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{gbp(r.revenue)}</TableCell>
                      <TableCell className="text-right">{gbp(r.aov)}</TableCell>
                      <TableCell className="text-right font-medium">{r.claims}</TableCell>
                      <TableCell className="text-right">{r.claimCost ? gbp(r.claimCost) : '—'}</TableCell>
                      <TableCell
                        className={`text-right ${r.claimRate > 50 ? 'text-red-600 font-semibold' : r.claimRate > 25 ? 'text-amber-600' : ''}`}
                      >
                        {r.sales ? `${r.claimRate.toFixed(0)}%` : '—'}
                      </TableCell>
                      <TableCell className={`text-right ${r.netRevenue < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {gbp(r.netRevenue)}
                      </TableCell>
                      <TableCell className="text-right">{r.share.toFixed(1)}%</TableCell>
                      <TableCell className={`text-right ${trendClass}`}>
                        <span className="inline-flex items-center gap-1">
                          <TrendIcon className="h-3.5 w-3.5" />
                          {r.change > 0 ? '+' : ''}{r.change.toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-end gap-[2px]">
                          {months.map((m) => {
                            const v = r.monthly[m] || 0;
                            return (
                              <div
                                key={m}
                                className="w-2 rounded-t bg-primary/70"
                                style={{ height: `${Math.max(2, (v / maxMonthly) * 28)}px` }}
                                title={`${format(parseISO(m), 'MMM yyyy')}: ${v} sales`}
                              />
                            );
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={15} className="p-3">
                          <AreaDistrictDrilldown area={r.area} town={r.town} from={from} to={to} />
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Populations are approximate postcode-area catchments used for relative comparison. Trend compares the most
          recent half of the period with the earlier half. Cancelled and refunded orders are excluded.
        </p>
      </CardContent>
    </Card>
  );
};

export default BillboardDemographicsPanel;
