import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/admin/DateRangeFilter';
import { Wrench, ShieldCheck, Coins } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { DateRange } from 'react-day-picker';
import { PRICING_UPDATED_EVENT } from '@/lib/pricingMatrix';
import { useLabourRateTiers } from '@/hooks/useLabourRateTiers';

interface Row {
  labour_rate: number | null;
  claim_limit: number | null;
  voluntary_excess: number | null;
  signup_date: string | null;
  status: string | null;
  name: string | null;
  email: string | null;
}

const TEST_NAMES = ['kamran qureshi', 'prajwal chauhan', 'accepttest'];

const isTestOrder = (name?: string | null, email?: string | null) => {
  const n = (name || '').toLowerCase();
  const e = (email || '').toLowerCase();
  if (e.includes('@test.com')) return true;
  return TEST_NAMES.some((t) => n.includes(t));
};

type Dist = { key: string; label: string; count: number; pct: number };

function buildDist(values: (number | null)[], fmt: (v: number) => string): Dist[] {
  const map = new Map<string, { label: string; count: number; sort: number }>();
  values.forEach((v) => {
    const key = v === null || v === undefined ? 'not-set' : String(v);
    const label = v === null || v === undefined ? 'Not set' : fmt(Number(v));
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { label, count: 1, sort: v === null || v === undefined ? -1 : Number(v) });
  });
  const total = values.length || 1;
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, label: v.label, count: v.count, pct: (v.count / total) * 100, sort: v.sort }))
    .sort((a, b) => b.count - a.count)
    .map(({ sort, ...rest }) => rest);
}

const DistBlock: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  colour: string;
  data: Dist[];
  total: number;
}> = ({ title, description, icon, colour, data, total }) => {
  const top = data[0];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription className="mt-1">
          {description}
          {top && (
            <span className="block mt-1">
              Most common:{' '}
              <Badge variant="secondary" className="font-semibold">
                {top.label}
              </Badge>{' '}
              — {top.count.toLocaleString('en-GB')} of {total.toLocaleString('en-GB')} sales ({top.pct.toFixed(1)}%)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales in this period.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(180, data.length * 42)}>
              <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, _n, item: any) => [
                    `${value.toLocaleString('en-GB')} sales (${item?.payload?.pct?.toFixed(1)}%)`,
                    'Sales',
                  ]}
                />
                <Bar dataKey="count" fill={colour} radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="pct"
                    position="right"
                    formatter={(v: number) => `${v.toFixed(1)}%`}
                    style={{ fontSize: 11 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Option</th>
                    <th className="py-2 px-3 text-right">Sales</th>
                    <th className="py-2 pl-3 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, i) => (
                    <tr key={d.key} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">
                        {d.label}
                        {i === 0 && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Most popular
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">{d.count.toLocaleString('en-GB')}</td>
                      <td className="py-2 pl-3 text-right font-semibold">{d.pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const CoverOptionsMixPanel: React.FC<{ dateRange?: DateRange }> = ({ dateRange: inheritedRange }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [useOwnRange, setUseOwnRange] = useState(false);
  const [ownRange, setOwnRange] = useState<DateRange | undefined>(undefined);
  const dateRange = useOwnRange ? ownRange : inheritedRange;

  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const onPricingUpdated = () => setReloadKey((k) => k + 1);
    window.addEventListener(PRICING_UPDATED_EVENT, onPricingUpdated);
    return () => window.removeEventListener(PRICING_UPDATED_EVENT, onPricingUpdated);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await fetchAllRows<Row>(() => {
        let q = supabase
          .from('customers')
          .select('labour_rate, claim_limit, voluntary_excess, signup_date, status, name, email')
          .order('signup_date', { ascending: false });
        if (dateRange?.from) q = q.gte('signup_date', dateRange.from.toISOString());
        if (dateRange?.to) {
          const to = new Date(dateRange.to);
          to.setHours(23, 59, 59, 999);
          q = q.lte('signup_date', to.toISOString());
        }
        return q;
      });
      if (cancelled) return;
      if (error) {
        console.error('[CoverOptionsMixPanel] load failed', error);
        setRows([]);
      } else {
        setRows(
          (data || []).filter(
            (r) =>
              !isTestOrder(r.name, r.email) &&
              !['cancelled', 'refunded'].includes((r.status || '').toLowerCase())
          )
        );
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), reloadKey]);

  // Labels follow the currently published labour-rate tiers (Admin → Price updates)
  // and auto-refresh when a new pricing version is published. Rates that existed in
  // an earlier version but are no longer live are shown as "(retired)".
  const { format: labourFmt } = useLabourRateTiers();
  const labour = useMemo(
    () => buildDist(rows.map((r) => r.labour_rate), labourFmt),
    [rows, labourFmt]
  );
  const claim = useMemo(
    () => buildDist(rows.map((r) => r.claim_limit), (v) => `£${v.toLocaleString('en-GB')}`),
    [rows]
  );
  const excess = useMemo(
    () => buildDist(rows.map((r) => (r.voluntary_excess === null ? null : Number(r.voluntary_excess))), (v) => `£${v}`),
    [rows]
  );

  return (
    <div className="space-y-4" id="cover-options-mix">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Cover Options Bought — What customers actually choose</h3>
          <p className="text-sm text-muted-foreground">
            Distribution and percentage split of labour rate, claim limit and voluntary excess across
            {dateRange?.from ? ' the selected period' : ' all sales'} (cancelled and refunded excluded).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {useOwnRange ? 'Custom period' : 'Following page date filter'}
          </span>
          <DateRangeFilter
            dateRange={dateRange}
            onDateRangeChange={(range) => {
              setUseOwnRange(true);
              setOwnRange(range);
            }}
          />
          {useOwnRange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setUseOwnRange(false);
                setOwnRange(undefined);
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>


      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading cover options mix…</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <DistBlock
            title="Labour Rate"
            description="Hourly labour rate purchased"
            icon={<Wrench className="h-5 w-5 text-primary" />}
            colour="#3b82f6"
            data={labour}
            total={rows.length}
          />
          <DistBlock
            title="Claim Limit"
            description="Claim limit purchased per claim"
            icon={<ShieldCheck className="h-5 w-5 text-primary" />}
            colour="#10b981"
            data={claim}
            total={rows.length}
          />
          <DistBlock
            title="Voluntary Excess"
            description="Excess amount purchased"
            icon={<Coins className="h-5 w-5 text-primary" />}
            colour="#f59e0b"
            data={excess}
            total={rows.length}
          />
        </div>
      )}
    </div>
  );
};
