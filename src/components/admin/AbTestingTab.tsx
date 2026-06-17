import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangeFilter } from '@/components/admin/DateRangeFilter';
import { format, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { FlaskConical, Loader2 } from 'lucide-react';

/**
 * A/B Testing dashboard — currently scoped to the
 *   step2_phone_optional  experiment:
 *     A = /?step=2   (phone required)
 *     B = /?step=2b  (phone optional)
 *
 * Data sources:
 *   - ab_variant_visits     → unique session landings on step 2 / 2b
 *   - abandoned_carts       → step-2 form submissions (cart_metadata.ab_variant)
 *   - customers             → paid conversions, matched to carts by email/reg
 */

const EXPERIMENT_KEY = 'step2_phone_optional';

type VariantStats = {
  visits: number;
  submissions: number;
  submissionsWithPhone: number;
  submissionsNoPhone: number;
  conversions: number;
};

const emptyStats = (): VariantStats => ({
  visits: 0,
  submissions: 0,
  submissionsWithPhone: 0,
  submissionsNoPhone: 0,
  conversions: 0,
});

const pct = (numer: number, denom: number): string =>
  denom > 0 ? `${((numer / denom) * 100).toFixed(2)}%` : '—';

const normalizeEmail = (e?: string | null) => (e || '').trim().toLowerCase();
const normalizeReg = (r?: string | null) =>
  (r || '').toUpperCase().replace(/\s+/g, '');

const AbTestingTab: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ a: VariantStats; b: VariantStats }>({
    a: emptyStats(),
    b: emptyStats(),
  });
  const [daily, setDaily] = useState<
    Array<{ date: string; aVisits: number; bVisits: number; aSubs: number; bSubs: number }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const from = dateRange?.from
          ? new Date(dateRange.from.setHours(0, 0, 0, 0)).toISOString()
          : new Date('2020-01-01').toISOString();
        const to = dateRange?.to
          ? new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString()
          : new Date().toISOString();

        // 1. Visits per variant
        const { data: visits } = await supabase
          .from('ab_variant_visits')
          .select('variant, landed_at')
          .eq('experiment_key', EXPERIMENT_KEY)
          .gte('landed_at', from)
          .lte('landed_at', to);

        // 2. Step-2 submissions per variant — ONLY carts tagged with this experiment's
        //    ab_variant in cart_metadata. Without this filter, every historical
        //    abandoned_cart gets counted as A (and Supabase caps the response,
        //    producing the bogus "1000 submissions" reading).
        const { data: carts } = await supabase
          .from('abandoned_carts')
          .select('id, email, phone, vehicle_reg, cart_metadata, created_at, is_converted')
          .gte('created_at', from)
          .lte('created_at', to)
          .in('cart_metadata->>ab_variant', ['a', 'b'])
          .limit(10000);

        // 3. Conversions: paid customers in window, matched back to carts to read variant
        const { data: customers } = await supabase
          .from('customers')
          .select('email, registration_plate, signup_date, status')
          .gte('signup_date', from)
          .lte('signup_date', to)
          .limit(10000);

        if (cancelled) return;

        const a = emptyStats();
        const b = emptyStats();

        // Visits
        const dailyMap = new Map<
          string,
          { aVisits: number; bVisits: number; aSubs: number; bSubs: number }
        >();
        const ensureDay = (d: string) => {
          if (!dailyMap.has(d))
            dailyMap.set(d, { aVisits: 0, bVisits: 0, aSubs: 0, bSubs: 0 });
          return dailyMap.get(d)!;
        };

        (visits || []).forEach((v: any) => {
          const day = format(new Date(v.landed_at), 'yyyy-MM-dd');
          const row = ensureDay(day);
          if (v.variant === 'b') {
            b.visits++;
            row.bVisits++;
          } else {
            a.visits++;
            row.aVisits++;
          }
        });

        // Carts (submissions). Only carts with an explicit experiment tag are counted.
        const cartsByEmailReg = new Map<string, 'a' | 'b'>();
        (carts || []).forEach((c: any) => {
          const tag = c.cart_metadata?.ab_variant;
          if (tag !== 'a' && tag !== 'b') return; // safety net for client-side
          const variant: 'a' | 'b' = tag;
          const target = variant === 'b' ? b : a;
          target.submissions++;
          if (c.phone && String(c.phone).trim()) target.submissionsWithPhone++;
          else target.submissionsNoPhone++;

          const day = format(new Date(c.created_at), 'yyyy-MM-dd');
          const row = ensureDay(day);
          if (variant === 'b') row.bSubs++;
          else row.aSubs++;

          const key = `${normalizeEmail(c.email)}|${normalizeReg(c.vehicle_reg)}`;
          cartsByEmailReg.set(key, variant);
          const emailKey = `${normalizeEmail(c.email)}|`;
          if (!cartsByEmailReg.has(emailKey)) cartsByEmailReg.set(emailKey, variant);
        });

        // Conversions
        (customers || []).forEach((cust: any) => {
          if (
            cust.status &&
            ['cancelled', 'refunded'].includes(String(cust.status).toLowerCase())
          )
            return;
          const email = normalizeEmail(cust.email);
          const reg = normalizeReg(cust.registration_plate);
          const variant =
            cartsByEmailReg.get(`${email}|${reg}`) ??
            cartsByEmailReg.get(`${email}|`);
          if (!variant) return;
          if (variant === 'b') b.conversions++;
          else a.conversions++;
        });

        setStats({ a, b });

        // Build daily series (sorted)
        const days = Array.from(dailyMap.entries())
          .sort(([d1], [d2]) => d1.localeCompare(d2))
          .map(([date, v]) => ({ date, ...v }));
        setDaily(days);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange?.from, dateRange?.to]);

  const summaryRows = useMemo(
    () => [
      {
        label: 'Visits (unique sessions)',
        a: stats.a.visits.toLocaleString(),
        b: stats.b.visits.toLocaleString(),
      },
      {
        label: 'Step-2 submissions',
        a: stats.a.submissions.toLocaleString(),
        b: stats.b.submissions.toLocaleString(),
      },
      {
        label: 'Submission rate (visit → submit)',
        a: pct(stats.a.submissions, stats.a.visits),
        b: pct(stats.b.submissions, stats.b.visits),
      },
      {
        label: 'Submissions with phone',
        a: stats.a.submissionsWithPhone.toLocaleString(),
        b: stats.b.submissionsWithPhone.toLocaleString(),
      },
      {
        label: 'Submissions without phone',
        a: stats.a.submissionsNoPhone.toLocaleString(),
        b: stats.b.submissionsNoPhone.toLocaleString(),
      },
      {
        label: '% submissions with phone',
        a: pct(stats.a.submissionsWithPhone, stats.a.submissions),
        b: pct(stats.b.submissionsWithPhone, stats.b.submissions),
      },
      {
        label: 'Conversions (paid)',
        a: stats.a.conversions.toLocaleString(),
        b: stats.b.conversions.toLocaleString(),
      },
      {
        label: 'Conversion rate (visit → paid)',
        a: pct(stats.a.conversions, stats.a.visits),
        b: pct(stats.b.conversions, stats.b.visits),
      },
      {
        label: 'Submission → paid',
        a: pct(stats.a.conversions, stats.a.submissions),
        b: pct(stats.b.conversions, stats.b.submissions),
      },
    ],
    [stats]
  );

  const summaryChart = useMemo(
    () => [
      { metric: 'Visits', A: stats.a.visits, B: stats.b.visits },
      { metric: 'Submissions', A: stats.a.submissions, B: stats.b.submissions },
      { metric: 'With phone', A: stats.a.submissionsWithPhone, B: stats.b.submissionsWithPhone },
      { metric: 'Conversions', A: stats.a.conversions, B: stats.b.conversions },
    ],
    [stats]
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-primary" />
            A/B Testing
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Current experiment:{' '}
            <span className="font-medium text-foreground">step2_phone_optional</span> —
            A (<code>/?step=2</code>, phone required) vs B (<code>/?step=2b</code>, phone optional).
            Visits are deduped per session.
          </p>
        </div>
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading experiment data…
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Variant A — phone required</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div>Visits: <b>{stats.a.visits}</b></div>
                <div>Submissions: <b>{stats.a.submissions}</b> ({pct(stats.a.submissions, stats.a.visits)})</div>
                <div>Conversions: <b>{stats.a.conversions}</b> ({pct(stats.a.conversions, stats.a.visits)})</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Variant B — phone optional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div>Visits: <b>{stats.b.visits}</b></div>
                <div>Submissions: <b>{stats.b.submissions}</b> ({pct(stats.b.submissions, stats.b.visits)})</div>
                <div>With phone: <b>{stats.b.submissionsWithPhone}</b> ({pct(stats.b.submissionsWithPhone, stats.b.submissions)})</div>
                <div>Without phone: <b>{stats.b.submissionsNoPhone}</b></div>
                <div>Conversions: <b>{stats.b.conversions}</b> ({pct(stats.b.conversions, stats.b.visits)})</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>A vs B — totals</CardTitle>
            </CardHeader>
            <CardContent style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summaryChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="A" fill="hsl(var(--primary))" />
                  <Bar dataKey="B" fill="#eb4b00" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily trend</CardTitle>
            </CardHeader>
            <CardContent style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="aVisits" name="A visits" stroke="hsl(var(--primary))" />
                  <Line type="monotone" dataKey="bVisits" name="B visits" stroke="#eb4b00" />
                  <Line type="monotone" dataKey="aSubs" name="A submits" stroke="hsl(var(--primary))" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="bSubs" name="B submits" stroke="#eb4b00" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Full breakdown</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Metric</th>
                    <th className="text-right py-2 px-4">A (phone required)</th>
                    <th className="text-right py-2 px-4">B (phone optional)</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => (
                    <tr key={row.label} className="border-b last:border-0">
                      <td className="py-2 pr-4">{row.label}</td>
                      <td className="py-2 px-4 text-right font-mono">{row.a}</td>
                      <td className="py-2 px-4 text-right font-mono">{row.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-3">
                Conversions are matched from the <code>customers</code> table back to{' '}
                <code>abandoned_carts</code> by normalized email + reg (cancelled/refunded
                customers excluded). Visits are deduped per browser session.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AbTestingTab;
