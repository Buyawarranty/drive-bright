import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DateRangeFilter } from '../DateRangeFilter';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PoundSterling, FileText, CheckCircle, TrendingUp } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { ClaimsVehicleAnalytics } from './ClaimsVehicleAnalytics';
import {
  format,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  eachWeekOfInterval, eachMonthOfInterval,
  isWithinInterval,
  subMonths,
} from 'date-fns';

interface ClaimData {
  id: string;
  status: string;
  payment_amount?: number;
  created_at: string;
  paid_at?: string;
  approved_at?: string;
}

interface ClaimsAnalyticsPanelProps {
  claims: ClaimData[];
}

type Granularity = 'weekly' | 'monthly' | 'yearly';

export const ClaimsAnalyticsPanel: React.FC<ClaimsAnalyticsPanelProps> = ({ claims }) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [granularity, setGranularity] = useState<Granularity>('monthly');
  const [quickPeriod, setQuickPeriod] = useState<string>('');

  const handleQuickPeriod = (period: string) => {
    if (quickPeriod === period) {
      setQuickPeriod('');
      setDateRange(undefined);
      return;
    }
    setQuickPeriod(period);
    const now = new Date();
    switch (period) {
      case 'this_week':
        setDateRange({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) });
        setGranularity('weekly');
        break;
      case 'this_month':
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        setGranularity('weekly');
        break;
      case 'last_month': {
        const lm = subMonths(now, 1);
        setDateRange({ from: startOfMonth(lm), to: endOfMonth(lm) });
        setGranularity('weekly');
        break;
      }
      case 'this_year':
        setDateRange({ from: startOfYear(now), to: endOfYear(now) });
        setGranularity('monthly');
        break;
      case 'all_time':
        setDateRange(undefined);
        setGranularity('monthly');
        break;
    }
  };

  // Filter claims by date range
  const filteredClaims = useMemo(() => {
    if (!dateRange?.from) return claims;
    return claims.filter(c => {
      const d = new Date(c.created_at);
      const from = new Date(dateRange.from!);
      from.setHours(0, 0, 0, 0);
      if (d < from) return false;
      if (dateRange.to) {
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
      return true;
    });
  }, [claims, dateRange]);

  // Summary stats for filtered range
  const summary = useMemo(() => {
    const total = filteredClaims.length;
    const approved = filteredClaims.filter(c => c.status === 'approved' || c.status === 'paid').length;
    const paid = filteredClaims.filter(c => c.payment_amount && c.payment_amount > 0);
    const totalPaid = paid.reduce((s, c) => s + (c.payment_amount || 0), 0);
    const avgClaim = paid.length > 0 ? totalPaid / paid.length : 0;
    return { total, approved, totalPaid, avgClaim, paidCount: paid.length };
  }, [filteredClaims]);

  // Build chart data based on granularity
  const chartData = useMemo(() => {
    const now = new Date();
    const rangeFrom = dateRange?.from || (claims.length > 0 ? new Date(Math.min(...claims.map(c => new Date(c.created_at).getTime()))) : subMonths(now, 12));
    const rangeTo = dateRange?.to || now;

    if (granularity === 'weekly') {
      const weeks = eachWeekOfInterval({ start: rangeFrom, end: rangeTo }, { weekStartsOn: 1 });
      return weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const inWeek = filteredClaims.filter(c => {
          const d = new Date(c.created_at);
          return isWithinInterval(d, { start: weekStart, end: weekEnd });
        });
        const paid = inWeek.reduce((s, c) => s + (c.payment_amount || 0), 0);
        return {
          label: format(weekStart, 'dd MMM'),
          totalClaims: inWeek.length,
          approvedClaims: inWeek.filter(c => c.status === 'approved' || c.status === 'paid').length,
          totalPaid: Math.round(paid * 100) / 100,
        };
      });
    }

    if (granularity === 'yearly') {
      const years = new Map<number, { totalClaims: number; approvedClaims: number; totalPaid: number }>();
      filteredClaims.forEach(c => {
        const y = new Date(c.created_at).getFullYear();
        if (!years.has(y)) years.set(y, { totalClaims: 0, approvedClaims: 0, totalPaid: 0 });
        const entry = years.get(y)!;
        entry.totalClaims++;
        if (c.status === 'approved' || c.status === 'paid') entry.approvedClaims++;
        entry.totalPaid += c.payment_amount || 0;
      });
      return Array.from(years.entries())
        .sort(([a], [b]) => a - b)
        .map(([year, data]) => ({
          label: year.toString(),
          ...data,
          totalPaid: Math.round(data.totalPaid * 100) / 100,
        }));
    }

    // Monthly (default)
    const months = eachMonthOfInterval({ start: rangeFrom, end: rangeTo });
    return months.map(monthStart => {
      const monthEnd = endOfMonth(monthStart);
      const inMonth = filteredClaims.filter(c => {
        const d = new Date(c.created_at);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      });
      const paid = inMonth.reduce((s, c) => s + (c.payment_amount || 0), 0);
      return {
        label: format(monthStart, 'MMM yy'),
        totalClaims: inMonth.length,
        approvedClaims: inMonth.filter(c => c.status === 'approved' || c.status === 'paid').length,
        totalPaid: Math.round(paid * 100) / 100,
      };
    });
  }, [filteredClaims, granularity, dateRange, claims]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">📊 Analytics & Charts</h2>
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Quick Period</Label>
              <ToggleGroup
                type="single"
                value={quickPeriod}
                onValueChange={(val) => val && handleQuickPeriod(val)}
              >
                <ToggleGroupItem value="this_week" className="px-3 text-xs">This Week</ToggleGroupItem>
                <ToggleGroupItem value="this_month" className="px-3 text-xs">This Month</ToggleGroupItem>
                <ToggleGroupItem value="last_month" className="px-3 text-xs">Last Month</ToggleGroupItem>
                <ToggleGroupItem value="this_year" className="px-3 text-xs">This Year</ToggleGroupItem>
                <ToggleGroupItem value="all_time" className="px-3 text-xs">All Time</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <DateRangeFilter
              dateRange={dateRange}
              onDateRangeChange={(r) => { setDateRange(r); setQuickPeriod(''); }}
              className="min-w-[240px]"
            />
            <div className="space-y-1">
              <Label className="text-sm font-medium">View By</Label>
              <ToggleGroup
                type="single"
                value={granularity}
                onValueChange={(val) => val && setGranularity(val as Granularity)}
              >
                <ToggleGroupItem value="weekly" className="px-3 text-xs">Weekly</ToggleGroupItem>
                <ToggleGroupItem value="monthly" className="px-3 text-xs">Monthly</ToggleGroupItem>
                <ToggleGroupItem value="yearly" className="px-3 text-xs">Yearly</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.approved}</div>
            <p className="text-xs text-muted-foreground">
              {summary.total > 0 ? `${Math.round((summary.approved / summary.total) * 100)}% rate` : '0%'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid Out</CardTitle>
            <PoundSterling className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              £{summary.totalPaid.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">{summary.paidCount} paid claims</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Claim Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              £{summary.avgClaim.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Claims Submitted vs Approved</CardTitle>
            <CardDescription>{granularity.charAt(0).toUpperCase() + granularity.slice(1)} trend</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="totalClaims" stroke="#f97316" strokeWidth={2} name="Total Claims" />
                <Line type="monotone" dataKey="approvedClaims" stroke="#22c55e" strokeWidth={2} name="Approved" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Amount Paid Out</CardTitle>
            <CardDescription>{granularity.charAt(0).toUpperCase() + granularity.slice(1)} payout in £</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                <Legend />
                <Bar dataKey="totalPaid" fill="#f97316" name="Total Paid (£)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>


        {/* Vehicle Reliability & Cost Intelligence */}
        <ClaimsVehicleAnalytics claims={claims} />
      </div>
    </div>
  );
};
