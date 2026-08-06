import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, MapPin, Info, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { DateRangeFilter } from '@/components/admin/DateRangeFilter';
import { POSTCODE_AREA_MAP, NATIONS } from '@/lib/ukPostcodeAreas';
import { POSTCODE_AREA_COORDS } from '@/lib/ukPostcodeAreaCoords';
import { UK_MAP_PATHS, UK_MAP_WIDTH, UK_MAP_HEIGHT, projectLatLng } from '@/lib/ukMapPaths';

interface Props {
  dateRange?: DateRange;
}

interface CustomerRow {
  customer_dob: string | null;
  postcode: string | null;
  final_amount: number | null;
  status: string | null;
  name: string | null;
  email: string | null;
  signup_date: string | null;
}

const TEST_NAMES = ['kamran qureshi', 'prajwal chauhan', 'accepttest'];
const isTestOrder = (name?: string | null, email?: string | null) => {
  const n = (name || '').toLowerCase();
  const e = (email || '').toLowerCase();
  if (e.includes('@test.com') || e.includes('testuser') || e.includes('guest@')) return true;
  if (n === 'test customer' || n === 'guest customer') return true;
  return TEST_NAMES.some((t) => n.includes(t));
};
const EXCLUDED = ['cancelled', 'refunded'];

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

const AGE_BANDS = [
  { key: '18-24', min: 18, max: 24 },
  { key: '25-34', min: 25, max: 34 },
  { key: '35-44', min: 35, max: 44 },
  { key: '45-54', min: 45, max: 54 },
  { key: '55-64', min: 55, max: 64 },
  { key: '65-74', min: 65, max: 74 },
  { key: '75+', min: 75, max: 200 },
];

const ageFromDob = (dob: string) => {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  if (age < 16 || age > 105) return null;
  return age;
};

/** First 1–2 letters of a UK postcode = postcode area. */
const areaFromPostcode = (pc?: string | null) => {
  const clean = (pc || '').toUpperCase().replace(/\s+/g, '');
  const m = clean.match(/^([A-Z]{1,2})\d/);
  return m ? m[1] : null;
};

const DEMOGRAPHICS_LINKS = [
  { id: 'demographics-filters', label: 'Date filter', className: 'bg-slate-300/50 text-slate-900 border-slate-200/50 hover:bg-slate-400/50' },
  { id: 'demographics-age', label: 'Age profile', className: 'bg-fuchsia-300/50 text-fuchsia-900 border-fuchsia-200/50 hover:bg-fuchsia-400/50' },
  { id: 'demographics-map', label: 'UK map', className: 'bg-emerald-300/50 text-emerald-900 border-emerald-200/50 hover:bg-emerald-400/50' },
  { id: 'demographics-areas', label: 'Postcode areas', className: 'bg-sky-300/50 text-sky-900 border-sky-200/50 hover:bg-sky-400/50' },
];

const SubHeading: React.FC<{ id: string; title: string; description?: string; accent?: string }> = ({
  id,
  title,
  description,
  accent = 'border-primary/60',
}) => (
  <div id={id} className={cn('scroll-mt-32 border-l-4 pl-3', accent)}>
    <h3 className="text-lg font-semibold text-foreground">{title}</h3>
    {description && <p className="text-xs text-muted-foreground">{description}</p>}
  </div>
);

export const CustomerDemographicsPanel: React.FC<Props> = ({ dateRange }) => {
  const [nation, setNation] = useState<string>('all');
  const [metric, setMetric] = useState<'customers' | 'revenue'>('customers');
  // Local date filter for this section: follows the page filter until overridden.
  const [useOwnRange, setUseOwnRange] = useState(false);
  const [localRange, setLocalRange] = useState<DateRange | undefined>(dateRange);

  const effectiveRange = useOwnRange ? localRange : dateRange;

  const from = effectiveRange?.from ? format(effectiveRange.from, 'yyyy-MM-dd') : null;
  const to = effectiveRange?.to ? format(effectiveRange.to, 'yyyy-MM-dd') : null;

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['customer-demographics', from, to],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('customer_dob, postcode, final_amount, status, name, email, signup_date')
        .limit(5000);
      if (from) query = query.gte('signup_date', from);
      if (to) query = query.lte('signup_date', `${to}T23:59:59`);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CustomerRow[];
    },
  });

  const rows = useMemo(
    () =>
      (data || []).filter(
        (r) => !isTestOrder(r.name, r.email) && !EXCLUDED.includes((r.status || '').toLowerCase())
      ),
    [data]
  );

  // ---------- Age ----------
  const ageStats = useMemo(() => {
    const ages = rows.map((r) => (r.customer_dob ? ageFromDob(r.customer_dob) : null)).filter((a): a is number => a !== null);
    const bands = AGE_BANDS.map((b) => ({
      ...b,
      count: ages.filter((a) => a >= b.min && a <= b.max).length,
    }));
    const total = ages.length;
    const sorted = [...ages].sort((a, b) => a - b);
    return {
      total,
      coverage: rows.length ? (total / rows.length) * 100 : 0,
      avg: total ? ages.reduce((s, a) => s + a, 0) / total : 0,
      median: total ? sorted[Math.floor(total / 2)] : 0,
      youngest: total ? sorted[0] : 0,
      oldest: total ? sorted[total - 1] : 0,
      bands: bands.map((b) => ({ ...b, pct: total ? (b.count / total) * 100 : 0 })),
    };
  }, [rows]);

  // ---------- Geography ----------
  const areaStats = useMemo(() => {
    const map = new Map<string, { area: string; customers: number; revenue: number }>();
    rows.forEach((r) => {
      const area = areaFromPostcode(r.postcode);
      if (!area || !POSTCODE_AREA_MAP[area]) return;
      const e = map.get(area) || { area, customers: 0, revenue: 0 };
      e.customers += 1;
      e.revenue += Number(r.final_amount || 0);
      map.set(area, e);
    });
    let list = [...map.values()];
    if (nation !== 'all') list = list.filter((a) => POSTCODE_AREA_MAP[a.area]?.nation === nation);
    return list.sort((a, b) => (metric === 'revenue' ? b.revenue - a.revenue : b.customers - a.customers));
  }, [rows, nation, metric]);

  const maxMetric = Math.max(1, ...areaStats.map((a) => (metric === 'revenue' ? a.revenue : a.customers)));
  const withPostcode = rows.filter((r) => areaFromPostcode(r.postcode)).length;

  const nationTotals = useMemo(() => {
    const totals = new Map<string, { customers: number; revenue: number }>();
    rows.forEach((r) => {
      const area = areaFromPostcode(r.postcode);
      const nat = area ? POSTCODE_AREA_MAP[area]?.nation : null;
      if (!nat) return;
      const e = totals.get(nat) || { customers: 0, revenue: 0 };
      e.customers += 1;
      e.revenue += Number(r.final_amount || 0);
      totals.set(nat, e);
    });
    return NATIONS.map((n) => ({ nation: n, ...(totals.get(n) || { customers: 0, revenue: 0 }) }));
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Quick links */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
        <span className="text-xs font-semibold text-foreground">Jump to:</span>
        {DEMOGRAPHICS_LINKS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => jumpTo(l.id)}
            className={cn(
              'inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:shadow-md',
              l.className
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Date filter */}
      <SubHeading
        id="demographics-filters"
        title="Demographics date filter"
        description="Filter this section on its own, or leave it following the page-level period above."
        accent="border-slate-500/60"
      />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-4">
          <DateRangeFilter
            dateRange={effectiveRange}
            onDateRangeChange={(r) => {
              setUseOwnRange(true);
              setLocalRange(r);
            }}
          />
          <Badge variant={useOwnRange ? 'default' : 'outline'}>
            {useOwnRange ? 'Using this section’s own dates' : 'Following the page filter'}
          </Badge>
          {useOwnRange && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUseOwnRange(false);
                setLocalRange(dateRange);
              }}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Follow page filter
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {isLoading
              ? 'Loading…'
              : `${rows.length} customers${
                  effectiveRange?.from
                    ? ` from ${format(effectiveRange.from, 'd MMM yyyy')}${
                        effectiveRange.to ? ` to ${format(effectiveRange.to, 'd MMM yyyy')}` : ''
                      }`
                    : ' (all time)'
                }`}
          </span>
        </CardContent>
      </Card>

      {/* Age */}
      <SubHeading
        id="demographics-age"
        title="Customer age profile"
        description="Average, median and age-band split of buyers in the selected period."
        accent="border-fuchsia-500/60"
      />
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                Customer age profile
              </CardTitle>
              <CardDescription>Age bands of buyers in the selected period, from the date of birth on file.</CardDescription>
            </div>
            <Badge variant="outline">
              Age on file for {ageStats.total} of {rows.length} ({ageStats.coverage.toFixed(1)}%)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {ageStats.coverage < 25 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Date of birth is optional at checkout, so age coverage is currently very low
                ({ageStats.coverage.toFixed(1)}% of orders). Treat these bands as indicative only — to get a
                reliable age profile we would need to capture date of birth on the checkout form.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Average age', value: ageStats.avg ? `${ageStats.avg.toFixed(1)} yrs` : '—' },
              { label: 'Median age', value: ageStats.median ? `${ageStats.median} yrs` : '—' },
              { label: 'Youngest', value: ageStats.youngest ? `${ageStats.youngest} yrs` : '—' },
              { label: 'Oldest', value: ageStats.oldest ? `${ageStats.oldest} yrs` : '—' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {ageStats.bands.map((b) => (
              <div key={b.key} className="flex items-center gap-3">
                <span className="w-14 text-xs font-medium text-muted-foreground">{b.key}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${b.pct}%` }} />
                </div>
                <span className="w-24 text-right text-xs">
                  <span className="font-semibold">{b.count}</span>{' '}
                  <span className="text-muted-foreground">({b.pct.toFixed(0)}%)</span>
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Map */}
      <SubHeading
        id="demographics-map"
        title="Where our customers are — UK map"
        description="Bubble map of customers or revenue by postcode area, with nation filters."
        accent="border-emerald-500/60"
      />
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" />
                Where our customers are — UK map
              </CardTitle>
              <CardDescription>
                Bubble size shows {metric === 'revenue' ? 'revenue' : 'customer count'} by postcode area.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={metric} onValueChange={(v) => setMetric(v as 'customers' | 'revenue')}>
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customers">Customers</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={nation} onValueChange={setNation}>
                <SelectTrigger className="h-8 w-[170px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All nations</SelectItem>
                  {NATIONS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline">
                {withPostcode} of {rows.length} have a postcode
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading demographics…</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
              <div className="rounded-lg border bg-muted/20 p-2">
                <svg
                  viewBox={`0 0 ${UK_MAP_WIDTH} ${UK_MAP_HEIGHT}`}
                  className="h-auto w-full"
                  role="img"
                  aria-label="Map of the United Kingdom showing customer concentration by postcode area"
                >
                  <g>
                    {UK_MAP_PATHS.map((d, i) => (
                      <path key={i} d={d} className="fill-muted stroke-border" strokeWidth={0.7} />
                    ))}
                  </g>
                  <g>
                    {areaStats.map((a) => {
                      const c = POSTCODE_AREA_COORDS[a.area];
                      if (!c) return null;
                      const { x, y } = projectLatLng(c.lat, c.lng);
                      const value = metric === 'revenue' ? a.revenue : a.customers;
                      const r = 3 + Math.sqrt(value / maxMetric) * 17;
                      return (
                        <circle
                          key={a.area}
                          cx={x}
                          cy={y}
                          r={r}
                          className="fill-primary/45 stroke-primary"
                          strokeWidth={1}
                        >
                          <title>
                            {`${a.area} — ${POSTCODE_AREA_MAP[a.area]?.town}: ${a.customers} customers, ${gbp(a.revenue)}`}
                          </title>
                        </circle>
                      );
                    })}
                  </g>
                </svg>
                <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                  Hover a bubble for the area's customers and revenue.
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {nationTotals.map((n) => (
                    <div key={n.nation} className="rounded-lg border bg-muted/30 p-3">
                      <p className="truncate text-xs text-muted-foreground">{n.nation}</p>
                      <p className="text-lg font-bold">{n.customers}</p>
                      <p className="text-xs text-muted-foreground">{gbp(n.revenue)}</p>
                    </div>
                  ))}
                </div>

                <div id="demographics-areas" className="scroll-mt-32 overflow-x-auto">
                  <h4 className="mb-1 text-sm font-semibold text-foreground">Top postcode areas</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="py-1 pr-3 text-left font-medium">Area</th>
                        <th className="py-1 pr-3 text-left font-medium">Town</th>
                        <th className="py-1 pr-3 text-right font-medium">Customers</th>
                        <th className="py-1 pr-3 text-right font-medium">Share</th>
                        <th className="py-1 pr-3 text-right font-medium">Revenue</th>
                        <th className="py-1 text-right font-medium">Avg order</th>
                      </tr>
                    </thead>
                    <tbody>
                      {areaStats.slice(0, 15).map((a) => (
                        <tr key={a.area} className="border-t border-border/60">
                          <td className="py-1.5 pr-3 font-semibold">{a.area}</td>
                          <td className="py-1.5 pr-3">{POSTCODE_AREA_MAP[a.area]?.town}</td>
                          <td className="py-1.5 pr-3 text-right font-semibold">{a.customers}</td>
                          <td className="py-1.5 pr-3 text-right text-muted-foreground">
                            {withPostcode ? `${((a.customers / withPostcode) * 100).toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-1.5 pr-3 text-right">{gbp(a.revenue)}</td>
                          <td className="py-1.5 text-right">{a.customers ? gbp(a.revenue / a.customers) : '—'}</td>
                        </tr>
                      ))}
                      {areaStats.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-3 text-center text-sm text-muted-foreground">
                            No customers with a postcode in this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
