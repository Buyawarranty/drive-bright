import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Calendar, Gauge, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SalesCustomer {
  id: string;
  name: string;
  email: string;
  plan_type: string;
  signup_date: string;
  status: string;
  final_amount: number | null;
  vehicle_year: string | null;
  mileage: string | null;
}

interface SalesAgeMileageAnalyticsProps {
  customers: SalesCustomer[];
}

const currentYear = new Date().getFullYear();

const AGE_BANDS = [
  { label: '0–2 yrs', min: 0, max: 2 },
  { label: '3–5 yrs', min: 3, max: 5 },
  { label: '6–8 yrs', min: 6, max: 8 },
  { label: '9–11 yrs', min: 9, max: 11 },
  { label: '12–15 yrs', min: 12, max: 15 },
  { label: '16+ yrs', min: 16, max: 999 },
];

const MILEAGE_BANDS = [
  { label: '0–20k', min: 0, max: 20000 },
  { label: '20–40k', min: 20001, max: 40000 },
  { label: '40–60k', min: 40001, max: 60000 },
  { label: '60–80k', min: 60001, max: 80000 },
  { label: '80–100k', min: 80001, max: 100000 },
  { label: '100–120k', min: 100001, max: 120000 },
  { label: '120–150k', min: 120001, max: 150000 },
  { label: '150k+', min: 150001, max: 9999999 },
];

const isRevenueLost = (status: string): boolean => {
  const s = status?.toLowerCase() || '';
  return s === 'cancelled' || s === 'refunded' || s === 'test purchase';
};

const COLORS_AGE = ['#10b981', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#dc2626'];
const COLORS_MILEAGE = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#f97316', '#ef4444', '#dc2626', '#991b1b'];

export const SalesAgeMileageAnalytics: React.FC<SalesAgeMileageAnalyticsProps> = ({ customers }) => {
  // --- Sales by Vehicle Age ---
  const ageData = useMemo(() => {
    const bands = AGE_BANDS.map(b => ({ ...b, sales: 0, revenue: 0, cancelled: 0, active: 0 }));

    customers.forEach(c => {
      const yearStr = c.vehicle_year;
      if (!yearStr) return;
      const year = parseInt(yearStr, 10);
      if (isNaN(year) || year < 1950) return;
      const age = currentYear - year;

      const band = bands.find(b => age >= b.min && age <= b.max);
      if (band) {
        band.sales++;
        if (!isRevenueLost(c.status)) {
          band.revenue += Number(c.final_amount) || 0;
          band.active++;
        } else {
          band.cancelled++;
        }
      }
    });

    return bands.map(b => ({
      band: b.label,
      sales: b.sales,
      active: b.active,
      cancelled: b.cancelled,
      revenue: Math.round(b.revenue),
      aov: b.active > 0 ? Math.round(b.revenue / b.active) : 0,
      cancelRate: b.sales > 0 ? Math.round((b.cancelled / b.sales) * 100) : 0,
    }));
  }, [customers]);

  // --- Sales by Mileage ---
  const mileageData = useMemo(() => {
    const bands = MILEAGE_BANDS.map(b => ({ ...b, sales: 0, revenue: 0, cancelled: 0, active: 0 }));

    customers.forEach(c => {
      const mileageStr = c.mileage;
      if (!mileageStr) return;
      const miles = parseInt(mileageStr.replace(/\D/g, ''), 10);
      if (isNaN(miles)) return;

      const band = bands.find(b => miles >= b.min && miles <= b.max);
      if (band) {
        band.sales++;
        if (!isRevenueLost(c.status)) {
          band.revenue += Number(c.final_amount) || 0;
          band.active++;
        } else {
          band.cancelled++;
        }
      }
    });

    return bands.map(b => ({
      band: b.label,
      sales: b.sales,
      active: b.active,
      cancelled: b.cancelled,
      revenue: Math.round(b.revenue),
      aov: b.active > 0 ? Math.round(b.revenue / b.active) : 0,
      cancelRate: b.sales > 0 ? Math.round((b.cancelled / b.sales) * 100) : 0,
    }));
  }, [customers]);

  const hasAgeData = ageData.some(d => d.sales > 0);
  const hasMileageData = mileageData.some(d => d.sales > 0);

  if (!hasAgeData && !hasMileageData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No vehicle age or mileage data available yet.
        </CardContent>
      </Card>
    );
  }

  // Find insights
  const bestSellingAge = [...ageData].sort((a, b) => b.sales - a.sales)[0];
  const worstSellingAge = [...ageData].filter(d => d.sales > 0).sort((a, b) => a.sales - b.sales)[0];
  const highestRevenueAge = [...ageData].sort((a, b) => b.revenue - a.revenue)[0];
  const bestSellingMileage = [...mileageData].sort((a, b) => b.sales - a.sales)[0];
  const worstSellingMileage = [...mileageData].filter(d => d.sales > 0).sort((a, b) => a.sales - b.sales)[0];
  const highestRevenueMileage = [...mileageData].sort((a, b) => b.revenue - a.revenue)[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-orange-500" />
        <h3 className="text-lg font-semibold">Sales by Vehicle Age & Mileage</h3>
        <Badge variant="secondary" className="text-xs">Marketing Insights</Badge>
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bestSellingAge && bestSellingAge.sales > 0 && (
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Best Selling Age Band
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{bestSellingAge.band}</p>
              <p className="text-xs text-muted-foreground">{bestSellingAge.sales} sales · £{bestSellingAge.revenue.toLocaleString()} revenue</p>
            </CardContent>
          </Card>
        )}

        {worstSellingAge && worstSellingAge.sales > 0 && worstSellingAge.band !== bestSellingAge?.band && (
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Lowest Selling Age Band
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{worstSellingAge.band}</p>
              <p className="text-xs text-muted-foreground">{worstSellingAge.sales} sales · opportunity to market more</p>
            </CardContent>
          </Card>
        )}

        {bestSellingMileage && bestSellingMileage.sales > 0 && (
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Best Selling Mileage Band
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{bestSellingMileage.band}</p>
              <p className="text-xs text-muted-foreground">{bestSellingMileage.sales} sales · £{bestSellingMileage.revenue.toLocaleString()} revenue</p>
            </CardContent>
          </Card>
        )}

        {highestRevenueAge && highestRevenueAge.revenue > 0 && highestRevenueAge.band !== bestSellingAge?.band && (
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Highest Revenue Age
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{highestRevenueAge.band}</p>
              <p className="text-xs text-muted-foreground">£{highestRevenueAge.revenue.toLocaleString()} · AOV £{highestRevenueAge.aov}</p>
            </CardContent>
          </Card>
        )}

        {worstSellingMileage && worstSellingMileage.sales > 0 && worstSellingMileage.band !== bestSellingMileage?.band && (
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-amber-500" />
                Lowest Selling Mileage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{worstSellingMileage.band}</p>
              <p className="text-xs text-muted-foreground">{worstSellingMileage.sales} sales · marketing opportunity</p>
            </CardContent>
          </Card>
        )}

        {highestRevenueMileage && highestRevenueMileage.revenue > 0 && highestRevenueMileage.band !== bestSellingMileage?.band && (
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                Highest Revenue Mileage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{highestRevenueMileage.band}</p>
              <p className="text-xs text-muted-foreground">£{highestRevenueMileage.revenue.toLocaleString()} · AOV £{highestRevenueMileage.aov}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Age Chart */}
      {hasAgeData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              Sales by Vehicle Age
            </CardTitle>
            <CardDescription>
              Which age bands sell the most warranties — use this to target your marketing by vehicle age
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name.includes('£') || name.includes('Revenue') ? `£${value.toLocaleString()}` : value
                  }
                />
                <Legend />
                <Bar yAxisId="left" dataKey="sales" name="Total Sales" radius={[4, 4, 0, 0]}>
                  {ageData.map((_, i) => (
                    <Cell key={i} fill={COLORS_AGE[i % COLORS_AGE.length]} />
                  ))}
                </Bar>
                <Bar yAxisId="right" dataKey="revenue" fill="#3b82f6" name="Revenue (£)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Mileage Chart */}
      {hasMileageData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="h-4 w-4 text-blue-500" />
              Sales by Mileage Band
            </CardTitle>
            <CardDescription>
              Which mileage ranges buy the most warranties — identify under-served segments to target
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={mileageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name.includes('£') || name.includes('Revenue') ? `£${value.toLocaleString()}` : value
                  }
                />
                <Legend />
                <Bar yAxisId="left" dataKey="sales" name="Total Sales" radius={[4, 4, 0, 0]}>
                  {mileageData.map((_, i) => (
                    <Cell key={i} fill={COLORS_MILEAGE[i % COLORS_MILEAGE.length]} />
                  ))}
                </Bar>
                <Bar yAxisId="right" dataKey="revenue" fill="#f97316" name="Revenue (£)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Breakdown Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {hasAgeData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Age Band Breakdown</CardTitle>
              <CardDescription className="text-xs">Sales, revenue, AOV, and cancellation rate per age band</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <div className="grid grid-cols-5 text-xs font-medium text-muted-foreground border-b pb-1">
                  <span>Age</span><span className="text-right">Sales</span><span className="text-right">Revenue</span><span className="text-right">AOV</span><span className="text-right">Cancel %</span>
                </div>
                {ageData.filter(d => d.sales > 0).map(d => (
                  <div key={d.band} className="grid grid-cols-5 text-sm">
                    <span className="font-medium">{d.band}</span>
                    <span className="text-right">{d.sales}</span>
                    <span className="text-right">£{d.revenue.toLocaleString()}</span>
                    <span className="text-right">£{d.aov}</span>
                    <span className={`text-right ${d.cancelRate > 20 ? 'text-red-600 font-medium' : ''}`}>{d.cancelRate}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {hasMileageData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Mileage Band Breakdown</CardTitle>
              <CardDescription className="text-xs">Sales, revenue, AOV, and cancellation rate per mileage band</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <div className="grid grid-cols-5 text-xs font-medium text-muted-foreground border-b pb-1">
                  <span>Mileage</span><span className="text-right">Sales</span><span className="text-right">Revenue</span><span className="text-right">AOV</span><span className="text-right">Cancel %</span>
                </div>
                {mileageData.filter(d => d.sales > 0).map(d => (
                  <div key={d.band} className="grid grid-cols-5 text-sm">
                    <span className="font-medium">{d.band}</span>
                    <span className="text-right">{d.sales}</span>
                    <span className="text-right">£{d.revenue.toLocaleString()}</span>
                    <span className="text-right">£{d.aov}</span>
                    <span className={`text-right ${d.cancelRate > 20 ? 'text-red-600 font-medium' : ''}`}>{d.cancelRate}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
