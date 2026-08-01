import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { PoundSterling, TrendingDown, TrendingUp } from 'lucide-react';
import { normaliseMake, normaliseModelFamily } from '../claims/vehicleNormalisation';

interface PriceMatchRow {
  id: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  price_match_competitor: string | null;
  price_match_competitor_price: number | null;
  price_match_our_price: number | null;
  signup_date: string | null;
}

type GroupBy = 'vehicle' | 'competitor';

const money = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? '—' : `£${Math.round(n).toLocaleString()}`;

export const CompetitorPricingPanel: React.FC = () => {
  const [rows, setRows] = useState<PriceMatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('vehicle');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, vehicle_make, vehicle_model, vehicle_year, price_match_competitor, price_match_competitor_price, price_match_our_price, signup_date')
        .eq('price_match_applied', true)
        .not('price_match_competitor_price', 'is', null)
        .order('signup_date', { ascending: false })
        .limit(2000);
      setRows((data as PriceMatchRow[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const { groups, totals } = useMemo(() => {
    const map = new Map<string, { label: string; count: number; theirs: number; ours: number }>();
    let theirsTotal = 0;
    let oursTotal = 0;
    let n = 0;

    rows.forEach(r => {
      const theirs = Number(r.price_match_competitor_price);
      const ours = Number(r.price_match_our_price);
      if (!Number.isFinite(theirs) || theirs <= 0 || !Number.isFinite(ours) || ours <= 0) return;

      const make = normaliseMake(r.vehicle_make || '') || 'Unknown';
      const family = normaliseModelFamily(make, r.vehicle_model || '') || '';
      const label =
        groupBy === 'vehicle'
          ? [make, family].filter(Boolean).join(' ')
          : (r.price_match_competitor || 'Unknown competitor');

      const existing = map.get(label) || { label, count: 0, theirs: 0, ours: 0 };
      existing.count += 1;
      existing.theirs += theirs;
      existing.ours += ours;
      map.set(label, existing);

      theirsTotal += theirs;
      oursTotal += ours;
      n += 1;
    });

    const groups = Array.from(map.values())
      .map(g => {
        const avgTheirs = g.theirs / g.count;
        const avgOurs = g.ours / g.count;
        return {
          ...g,
          avgTheirs,
          avgOurs,
          diff: avgOurs - avgTheirs,
          diffPct: avgTheirs > 0 ? ((avgOurs - avgTheirs) / avgTheirs) * 100 : 0,
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      groups,
      totals: {
        n,
        avgTheirs: n ? theirsTotal / n : 0,
        avgOurs: n ? oursTotal / n : 0,
        diffPct: theirsTotal > 0 ? ((oursTotal - theirsTotal) / theirsTotal) * 100 : 0,
      },
    };
  }, [rows, groupBy]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <PoundSterling className="h-4 w-4 text-sky-600" /> Competitor pricing (price match data)
            </CardTitle>
            <CardDescription>
              Built from price match records saved on Quotes &amp; Orders — how competitor quotes compare to the price we charged, by vehicle.
            </CardDescription>
          </div>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="w-[190px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vehicle">Group by vehicle</SelectItem>
              <SelectItem value="competitor">Group by competitor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading price match data…</p>
        ) : totals.n === 0 ? (
          <p className="text-sm text-muted-foreground">
            No price match records yet. Agents create these using the <strong>Price match</strong> override on Quotes &amp; Orders — competitor, their price and evidence.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Price matches</div>
                <div className="text-xl font-bold">{totals.n}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Avg competitor price</div>
                <div className="text-xl font-bold">{money(totals.avgTheirs)}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Avg our price</div>
                <div className="text-xl font-bold">{money(totals.avgOurs)}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Our price vs theirs</div>
                <div className={`text-xl font-bold ${totals.diffPct <= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {totals.diffPct > 0 ? '+' : ''}{totals.diffPct.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">{groupBy === 'vehicle' ? 'Vehicle' : 'Competitor'}</th>
                    <th className="text-right py-2 px-3 font-medium">Matches</th>
                    <th className="text-right py-2 px-3 font-medium">Avg competitor</th>
                    <th className="text-right py-2 px-3 font-medium">Avg ours</th>
                    <th className="text-right py-2 px-3 font-medium">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g.label} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">{g.label}</td>
                      <td className="py-2 px-3 text-right">{g.count}</td>
                      <td className="py-2 px-3 text-right">{money(g.avgTheirs)}</td>
                      <td className="py-2 px-3 text-right">{money(g.avgOurs)}</td>
                      <td className="py-2 px-3 text-right">
                        <Badge
                          variant="outline"
                          className={`text-xs gap-1 ${g.diff <= 0 ? 'text-green-700 border-green-300' : 'text-red-700 border-red-300'}`}
                        >
                          {g.diff <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                          {g.diff > 0 ? '+' : ''}{money(Math.abs(g.diff)).replace('£', g.diff < 0 ? '-£' : '£')} ({g.diffPct > 0 ? '+' : ''}{g.diffPct.toFixed(1)}%)
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompetitorPricingPanel;
