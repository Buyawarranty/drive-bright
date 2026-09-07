import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedDateFilter, periodToRange, type DateScope, type PeriodKey } from '../UnifiedDateFilter';
import { QuickMonthFilter } from '../QuickMonthFilter';
import { DateRange } from 'react-day-picker';
import {
  format, startOfMonth, endOfMonth, eachMonthOfInterval,
  differenceInCalendarDays, isWithinInterval, min as minDate, max as maxDate,
} from 'date-fns';

interface ClaimRow {
  id: string;
  status: string;
  created_at: string;
  vehicle_registration?: string | null;
  email?: string | null;
}

interface PurchaseRow {
  id: string;
  signup_date: string | null;
  registration_plate: string | null;
  email: string | null;
  status: string | null;
}

interface Props {
  claims: ClaimRow[];
}

const REJECTED_STATUSES = new Set(['declined', 'rejected', 'not_a_customer']);

const normReg = (v?: string | null) => (v || '').toUpperCase().replace(/\s+/g, '');

function pct(part: number, whole: number) {
  if (!whole) return '0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

const Stat: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <Card className="p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-2xl font-bold">{value}</p>
    {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
  </Card>
);

export const ClaimsIntelligencePanel: React.FC<Props> = ({ claims }) => {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [scope, setScope] = useState<DateScope>('claim_opened');
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);

  const range: DateRange | undefined = period === 'all'
    ? undefined
    : period === 'custom' ? customRange : periodToRange(period);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all: PurchaseRow[] = [];
      const pageSize = 1000;
      for (let page = 0; page < 20; page++) {
        const { data, error } = await supabase
          .from('customers')
          .select('id, signup_date, registration_plate, email, status')
          .order('signup_date', { ascending: false })
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (error || !data?.length) break;
        all.push(...(data as PurchaseRow[]));
        if (data.length < pageSize) break;
      }
      if (!cancelled) {
        setPurchases(all);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const inRange = (iso?: string | null) => {
    if (!range?.from) return true;
    if (!iso) return false;
    const d = new Date(iso);
    const from = new Date(range.from); from.setHours(0, 0, 0, 0);
    const to = new Date(range.to || range.from); to.setHours(23, 59, 59, 999);
    return isWithinInterval(d, { start: from, end: to });
  };

  const data = useMemo(() => {
    const cleanClaims = (claims || []).filter(c => c.status !== 'fake_test');

    // Purchase cohort: filtered by signup date when the scope is signup.
    const cohort = purchases.filter(p => (scope === 'signup' ? inRange(p.signup_date) : true));
    const cohortByReg = new Map<string, PurchaseRow>();
    cohort.forEach(p => {
      const reg = normReg(p.registration_plate);
      if (reg && !cohortByReg.has(reg)) cohortByReg.set(reg, p);
    });

    // Claims scoped: by claim opened date when scope is claim_opened, else all claims for the cohort.
    const scopedClaims = cleanClaims.filter(c => {
      const reg = normReg(c.vehicle_registration);
      if (scope === 'signup') return cohortByReg.has(reg);
      return inRange(c.created_at);
    });

    // Claims grouped per purchase (lifetime, cohort-limited) for rate/frequency stats.
    const claimsByPurchase = new Map<string, ClaimRow[]>();
    cleanClaims.forEach(c => {
      const reg = normReg(c.vehicle_registration);
      if (!reg || !cohortByReg.has(reg)) return;
      const list = claimsByPurchase.get(reg) || [];
      list.push(c);
      claimsByPurchase.set(reg, list);
    });

    const totalPurchases = cohortByReg.size;
    const claimants = claimsByPurchase.size;
    const rejectionPurchases = [...claimsByPurchase.values()]
      .filter(list => list.some(c => REJECTED_STATUSES.has(c.status))).length;
    const repeatClaimants = [...claimsByPurchase.values()].filter(list => list.length > 1).length;
    const totalClaimsForCohort = [...claimsByPurchase.values()].reduce((s, l) => s + l.length, 0);

    // Days from purchase to first claim.
    const firstClaimDays: number[] = [];
    const policyMonthCounts = new Map<number, number>();
    let earliest: { days: number; reg: string; date: string } | null = null;
    let slowest: { days: number; reg: string; date: string } | null = null;

    claimsByPurchase.forEach((list, reg) => {
      const purchase = cohortByReg.get(reg);
      if (!purchase?.signup_date) return;
      const start = new Date(purchase.signup_date);
      const sorted = [...list].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      const days = Math.max(0, differenceInCalendarDays(new Date(sorted[0].created_at), start));
      firstClaimDays.push(days);
      if (!earliest || days < earliest.days) earliest = { days, reg, date: sorted[0].created_at };
      if (!slowest || days > slowest.days) slowest = { days, reg, date: sorted[0].created_at };
      list.forEach(c => {
        const d = Math.max(0, differenceInCalendarDays(new Date(c.created_at), start));
        const monthNo = Math.min(13, Math.floor(d / 30) + 1);
        policyMonthCounts.set(monthNo, (policyMonthCounts.get(monthNo) || 0) + 1);
      });
    });

    // Never-claimed customers and how long they have been with us.
    const neverClaimedDays: number[] = [];
    cohortByReg.forEach((p, reg) => {
      if (claimsByPurchase.has(reg)) return;
      if (!p.signup_date) return;
      neverClaimedDays.push(Math.max(0, differenceInCalendarDays(new Date(), new Date(p.signup_date))));
    });

    // Claims per calendar month.
    const claimDates = scopedClaims.map(c => new Date(c.created_at)).filter(d => !isNaN(+d));
    let monthly: { month: string; claims: number; rejected: number; approved: number }[] = [];
    if (claimDates.length) {
      const start = startOfMonth(range?.from ? new Date(range.from) : minDate(claimDates));
      const end = endOfMonth(range?.to ? new Date(range.to) : maxDate(claimDates));
      monthly = eachMonthOfInterval({ start, end }).map(m => {
        const s = startOfMonth(m), e = endOfMonth(m);
        const inMonth = scopedClaims.filter(c => {
          const d = new Date(c.created_at);
          return d >= s && d <= e;
        });
        return {
          month: format(m, 'MMM yy'),
          claims: inMonth.length,
          rejected: inMonth.filter(c => REJECTED_STATUSES.has(c.status)).length,
          approved: inMonth.filter(c => ['approved', 'paid', 'partially_approved'].includes(c.status)).length,
        };
      });
    }

    const monthsSpan = monthly.length || 1;
    const policyMonthChart = Array.from({ length: 13 }, (_, i) => ({
      month: i === 12 ? '13+' : `${i + 1}`,
      claims: policyMonthCounts.get(i + 1) || 0,
    }));

    return {
      totalPurchases,
      claimants,
      scopedClaimCount: scopedClaims.length,
      avgPerMonth: scopedClaims.length / monthsSpan,
      rejectionPurchases,
      repeatClaimants,
      avgClaimsPerClaimant: claimants ? totalClaimsForCohort / claimants : 0,
      avgFirstClaimDays: firstClaimDays.length ? Math.round(firstClaimDays.reduce((a, b) => a + b, 0) / firstClaimDays.length) : 0,
      medianFirstClaimDays: median(firstClaimDays),
      neverClaimed: neverClaimedDays.length,
      avgNeverClaimedDays: neverClaimedDays.length ? Math.round(neverClaimedDays.reduce((a, b) => a + b, 0) / neverClaimedDays.length) : 0,
      earliest: earliest as { days: number; reg: string; date: string } | null,
      slowest: slowest as { days: number; reg: string; date: string } | null,
      monthly,
      policyMonthChart,
    };
  }, [claims, purchases, scope, period, customRange]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border flex items-center gap-3 px-4 py-2.5 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</span>
        <UnifiedDateFilter
          scope={scope}
          period={period}
          customRange={customRange}
          availableScopes={['claim_opened', 'signup']}
          onChange={(next) => {
            setScope(next.scope);
            setPeriod(next.period);
            setCustomRange(next.customRange);
          }}
        />
        <QuickMonthFilter
          dateRange={period === 'custom' ? customRange : (period === 'this_month' ? periodToRange('this_month') : undefined)}
          onDateRangeChange={(r) => {
            setPeriod('custom');
            setCustomRange(r);
          }}
        />
        <span className="text-[11px] text-muted-foreground">
          {scope === 'claim_opened'
            ? 'Counting claims opened in this period, measured against every purchase.'
            : 'Counting customers who bought in this period, and every claim they have ever made.'}
        </span>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Stat label="Claims opened" value={String(data.scopedClaimCount)} hint={`${data.avgPerMonth.toFixed(1)} a month on average`} />
        <Stat label="Purchases that claim" value={pct(data.claimants, data.totalPurchases)} hint={`${data.claimants} of ${data.totalPurchases} purchases`} />
        <Stat label="Purchases with a rejected claim" value={pct(data.rejectionPurchases, data.totalPurchases)} hint={`${data.rejectionPurchases} purchases`} />
        <Stat label="Claim more than once" value={pct(data.repeatClaimants, data.claimants)} hint={`${data.avgClaimsPerClaimant.toFixed(2)} claims per claiming customer`} />
        <Stat label="Average time to first claim" value={`${data.avgFirstClaimDays} days`} hint={`Middle figure ${data.medianFirstClaimDays} days`} />
        <Stat label="Never made a claim" value={pct(data.neverClaimed, data.totalPurchases)} hint={`${data.neverClaimed} customers, ${data.avgNeverClaimedDays} days with us on average`} />
        <Stat
          label="Quickest first claim"
          value={data.earliest ? `${data.earliest.days} days` : '—'}
          hint={data.earliest ? `${data.earliest.reg} · ${format(new Date(data.earliest.date), 'd MMM yyyy')}` : undefined}
        />
        <Stat
          label="Slowest first claim"
          value={data.slowest ? `${data.slowest.days} days` : '—'}
          hint={data.slowest ? `${data.slowest.reg} · ${format(new Date(data.slowest.date), 'd MMM yyyy')}` : undefined}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Claims each month</CardTitle>
          <CardDescription>How many claims were opened, and how many were approved or rejected.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="claims" name="Claims opened" fill="hsl(var(--primary))" />
              <Bar dataKey="approved" name="Approved" fill="hsl(142 71% 45%)" />
              <Bar dataKey="rejected" name="Rejected" fill="hsl(0 72% 51%)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">When in the warranty a claim is made</CardTitle>
          <CardDescription>Month of cover the claim falls in, counted from the purchase date.</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.policyMonthChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} label={{ value: 'Month of cover', position: 'insideBottom', offset: -4, fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="claims" name="Claims" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {loading && <p className="text-xs text-muted-foreground">Loading purchase history…</p>}
    </div>
  );
};
