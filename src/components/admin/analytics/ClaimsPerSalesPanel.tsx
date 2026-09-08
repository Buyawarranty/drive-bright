import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, subMonths } from 'date-fns';

interface MonthRow {
  key: string;
  month: string;
  sales: number;
  claims: number;
  rate: number;
}

const normReg = (v?: string | null) => (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const normEmail = (v?: string | null) => (v || '').trim().toLowerCase();

export const ClaimsPerSalesPanel: React.FC = () => {
  const [salesByMonth, setSalesByMonth] = useState<Map<string, number>>(new Map());
  const [claims, setClaims] = useState<{ created_at: string; reg: string; email: string }[]>([]);
  const [customerKeys, setCustomerKeys] = useState<{ regs: Set<string>; emails: Set<string> }>({ regs: new Set(), emails: new Set() });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const since = startOfMonth(subMonths(new Date(), 11)).toISOString();
      const [{ data: customers }, { data: claimRows }] = await Promise.all([
        supabase
          .from('customers')
          .select('signup_date, status, registration_plate, email')
          .gte('signup_date', since)
          .limit(10000),
        supabase
          .from('claims_submissions')
          .select('created_at, vehicle_registration, email')
          .limit(10000),
      ]);
      if (!active) return;

      const sales = new Map<string, number>();
      const regs = new Set<string>();
      const emails = new Set<string>();
      (customers || []).forEach((c: any) => {
        const s = (c.status || '').toLowerCase();
        if (s.includes('cancelled') || s.includes('refunded')) return;
        if (!c.signup_date) return;
        const key = format(new Date(c.signup_date), 'yyyy-MM');
        sales.set(key, (sales.get(key) || 0) + 1);
        const r = normReg(c.registration_plate);
        const e = normEmail(c.email);
        if (r) regs.add(r);
        if (e) emails.add(e);
      });

      setSalesByMonth(sales);
      setCustomerKeys({ regs, emails });
      setClaims(
        (claimRows || []).map((c: any) => ({
          created_at: c.created_at,
          reg: normReg(c.vehicle_registration),
          email: normEmail(c.email),
        }))
      );
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const { data, totalSales, totalClaims, overallRate } = useMemo(() => {
    const months: MonthRow[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      const key = format(d, 'yyyy-MM');
      months.push({ key, month: format(d, 'MMM yyyy'), sales: salesByMonth.get(key) || 0, claims: 0, rate: 0 });
    }
    const monthKeys = new Set(months.map(m => m.key));
    const map = new Map(months.map(m => [m.key, m]));

    // Claims matched to a customer (by reg or email) whose purchase month we know
    const { regs, emails } = customerKeys;
    let matched = 0;
    claims.forEach(c => {
      if (!c.created_at) return;
      if (!(regs.has(c.reg) || emails.has(c.email))) return;
      matched += 1;
      const key = format(new Date(c.created_at), 'yyyy-MM');
      if (monthKeys.has(key)) {
        const row = map.get(key);
        if (row) row.claims += 1;
      }
    });

    months.forEach(m => {
      m.rate = m.sales > 0 ? Math.round((m.claims / m.sales) * 1000) / 10 : 0;
    });

    const tSales = months.reduce((s, m) => s + m.sales, 0);
    const tClaims = months.reduce((s, m) => s + m.claims, 0);
    return {
      data: months,
      totalSales: tSales,
      totalClaims: tClaims,
      overallRate: tSales > 0 ? Math.round((tClaims / tSales) * 1000) / 10 : 0,
    };
  }, [salesByMonth, claims, customerKeys]);

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader>
        <CardTitle>Claims per number of sales</CardTitle>
        <CardDescription className="mt-1">
          Warranties sold each month versus claims submitted that month (claims matched to a known customer by
          registration or email). The line shows claims as a percentage of that month's sales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{totalSales.toLocaleString('en-GB')} sales (12 months)</Badge>
          <Badge variant="secondary">{totalClaims.toLocaleString('en-GB')} claims</Badge>
          <Badge variant="outline" className="border-amber-300 text-amber-700">
            {overallRate}% claims per sale
          </Badge>
        </div>

        {loading ? (
          <div className="h-[320px] flex items-center justify-center text-muted-foreground">Loading…</div>
        ) : totalSales === 0 ? (
          <div className="h-[320px] flex items-center justify-center text-muted-foreground">No sales found</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis yAxisId="left" allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'rate') return [`${value}%`, 'Claims per sale'];
                  return [Number(value).toLocaleString('en-GB'), name === 'sales' ? 'Warranties Sold' : 'Claims Submitted'];
                }}
                labelStyle={{ fontWeight: 'bold' }}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend
                formatter={(value) =>
                  value === 'sales' ? 'Warranties Sold' : value === 'claims' ? 'Claims Submitted' : 'Claims per sale'
                }
              />
              <Bar yAxisId="left" dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="claims" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="rate" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        <p className="text-xs text-muted-foreground">
          Note: claims are counted in the month they were submitted, sales in the month they were purchased — so a
          claim can relate to a policy bought in an earlier month.
        </p>
      </CardContent>
    </Card>
  );
};
