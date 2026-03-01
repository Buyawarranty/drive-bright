import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Car, TrendingUp, TrendingDown, Filter, Fuel, Calendar, Hash, AlertTriangle, ChevronDown, ChevronUp, Truck } from 'lucide-react';
import { normaliseMake, normaliseModelFamily } from './claims/vehicleNormalisation';
import { classifyVehicleType, VehicleBodyType } from './claims/vehicleTypeClassification';
import { DateRangeFilter } from './DateRangeFilter';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';

interface CustomerVehicle {
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_fuel_type: string | null;
  vehicle_year: string | null;
  final_amount: number | null;
  status: string;
  signup_date: string;
}

interface ClaimRow {
  id: string;
  vehicle_registration: string | null;
  status: string;
  payment_amount: number | null;
}

interface VehicleLookup {
  registration_plate: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
}

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#ef4444', '#eab308', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#f43f5e'];

export const VehicleStatsTab: React.FC = () => {
  const [data, setData] = useState<CustomerVehicle[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Map<string, VehicleLookup>>(new Map());
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [showOthers, setShowOthers] = useState(false);
  const [expandedMakes, setExpandedMakes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAll = async () => {
      const [custRes, claimsRes] = await Promise.all([
        supabase
          .from('customers')
          .select('vehicle_make, vehicle_model, vehicle_fuel_type, vehicle_year, final_amount, status, signup_date')
          .eq('is_deleted', false)
          .ilike('status', 'active'),
        supabase
          .from('claims_submissions')
          .select('id, vehicle_registration, status, payment_amount'),
      ]);
      setData(custRes.data ?? []);
      setClaims(claimsRes.data ?? []);

      // Fetch vehicle info for claims registrations
      const regs = Array.from(new Set(
        (claimsRes.data ?? []).map(c => c.vehicle_registration?.toUpperCase()).filter(Boolean)
      )) as string[];
      if (regs.length > 0) {
        const batchSize = 300;
        const map = new Map<string, VehicleLookup>();
        for (let i = 0; i < regs.length; i += batchSize) {
          const batch = regs.slice(i, i + batchSize);
          const { data: vData } = await supabase
            .from('customers')
            .select('registration_plate, vehicle_make, vehicle_model')
            .in('registration_plate', batch);
          vData?.forEach(v => {
            if (v.registration_plate) map.set(v.registration_plate.toUpperCase(), v as VehicleLookup);
          });
        }
        setVehicleMap(map);
      }
      setLoading(false);
    };
    fetchAll();
    const timeout = setTimeout(() => setLoading(false), 12000);
    return () => clearTimeout(timeout);
  }, []);

  // Filter by status + date range + vehicle type
  const filtered = useMemo(() => {
    let result = data;
    if (statusFilter !== 'all') {
      result = result.filter(d => d.status?.toLowerCase() === statusFilter.toLowerCase());
    }
    if (vehicleTypeFilter !== 'all') {
      result = result.filter(d => {
        const vType = classifyVehicleType(d.vehicle_make, d.vehicle_model, d.vehicle_fuel_type);
        return vType === vehicleTypeFilter;
      });
    }
    if (dateRange?.from) {
      const from = startOfDay(dateRange.from);
      const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      result = result.filter(d => {
        const date = new Date(d.signup_date);
        return isWithinInterval(date, { start: from, end: to });
      });
    }
    return result;
  }, [data, statusFilter, vehicleTypeFilter, dateRange]);

  // Claims by make for reliability cross-reference
  // Only count claims that have been actioned (not raw/unprocessed submissions)
  const ACTIONABLE_CLAIM_STATUSES = new Set(['approved', 'in_progress', 'awaiting_info', 'paid', 'settled', 'under_review']);

  const claimsByMake = useMemo(() => {
    const map = new Map<string, { count: number; totalCost: number }>();
    claims.forEach(c => {
      if (!ACTIONABLE_CLAIM_STATUSES.has(c.status?.toLowerCase())) return;
      const reg = c.vehicle_registration?.toUpperCase();
      const info = reg ? vehicleMap.get(reg) : null;
      const make = normaliseMake(info?.vehicle_make || '');
      if (make === 'Unknown') return;
      if (!map.has(make)) map.set(make, { count: 0, totalCost: 0 });
      const e = map.get(make)!;
      e.count++;
      if (c.payment_amount && c.payment_amount > 0) e.totalCost += c.payment_amount;
    });
    return map;
  }, [claims, vehicleMap]);

  // Stats by normalised make
  const makeStats = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    filtered.forEach(c => {
      const make = normaliseMake(c.vehicle_make || '');
      if (make === 'Unknown') return;
      if (!map.has(make)) map.set(make, { count: 0, revenue: 0 });
      const e = map.get(make)!;
      e.count++;
      if (c.final_amount) e.revenue += c.final_amount;
    });
    return Array.from(map.entries())
      .map(([make, d]) => ({
        make,
        count: d.count,
        revenue: Math.round(d.revenue * 100) / 100,
        claims: claimsByMake.get(make)?.count || 0,
        claimCost: Math.round((claimsByMake.get(make)?.totalCost || 0) * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filtered, claimsByMake]);

  // Stats by model — grouped by make for drill-down
  const modelsByMake = useMemo(() => {
    const map = new Map<string, Map<string, { count: number; revenue: number }>>();
    filtered.forEach(c => {
      if (!c.vehicle_make) return;
      const make = normaliseMake(c.vehicle_make);
      const family = normaliseModelFamily(make, c.vehicle_model || '');
      if (make === 'Unknown') return;
      if (!map.has(make)) map.set(make, new Map());
      const models = map.get(make)!;
      if (!models.has(family)) models.set(family, { count: 0, revenue: 0 });
      const e = models.get(family)!;
      e.count++;
      if (c.final_amount) e.revenue += c.final_amount;
    });
    return map;
  }, [filtered]);

  // Stats by model (flat, for chart)
  const modelStats = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    filtered.forEach(c => {
      if (!c.vehicle_make) return;
      const make = normaliseMake(c.vehicle_make);
      const family = normaliseModelFamily(make, c.vehicle_model || '');
      if (make === 'Unknown') return;
      const key = `${make} ${family}`;
      if (!map.has(key)) map.set(key, { count: 0, revenue: 0 });
      const e = map.get(key)!;
      e.count++;
      if (c.final_amount) e.revenue += c.final_amount;
    });
    return Array.from(map.entries())
      .map(([model, d]) => ({ model, count: d.count, revenue: Math.round(d.revenue * 100) / 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [filtered]);

  const toggleMakeExpand = (make: string) => {
    setExpandedMakes(prev => {
      const next = new Set(prev);
      if (next.has(make)) next.delete(make);
      else next.add(make);
      return next;
    });
  };

  // Fuel type stats
  const fuelStats = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(c => {
      const fuel = c.vehicle_fuel_type?.trim() || 'Unknown';
      map.set(fuel, (map.get(fuel) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([fuel, count]) => ({ name: fuel, value: count }))
      .filter(d => d.name !== 'Unknown')
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // Year stats
  const yearStats = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(c => {
      const year = c.vehicle_year?.trim();
      if (!year || year.length < 4) return;
      const y = year.substring(0, 4);
      map.set(y, (map.get(y) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [filtered]);

  // Vehicle type stats
  const vehicleTypeStats = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    filtered.forEach(c => {
      const vType = classifyVehicleType(c.vehicle_make, c.vehicle_model, c.vehicle_fuel_type);
      if (!map.has(vType)) map.set(vType, { count: 0, revenue: 0 });
      const e = map.get(vType)!;
      e.count++;
      if (c.final_amount) e.revenue += c.final_amount;
    });
    return Array.from(map.entries())
      .map(([type, d]) => ({ name: type, value: d.count, revenue: Math.round(d.revenue * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // All unique vehicle types for filter dropdown
  const allVehicleTypes = useMemo(() => {
    const types = new Set<string>();
    data.forEach(c => {
      types.add(classifyVehicleType(c.vehicle_make, c.vehicle_model, c.vehicle_fuel_type));
    });
    return Array.from(types).sort();
  }, [data]);


  const topMakes = makeStats.slice(0, 7);
  const otherMakes = makeStats.slice(7);
  const pieData = useMemo(() => {
    const result = topMakes.map(d => ({ name: d.make, value: d.count }));
    if (otherMakes.length > 0) {
      result.push({ name: 'Others', value: otherMakes.reduce((s, d) => s + d.count, 0) });
    }
    return result;
  }, [makeStats]);

  const totalWarranties = filtered.length;
  const totalRevenue = filtered.reduce((s, c) => s + (c.final_amount || 0), 0);
  const topMake = makeStats[0];
  const bottomMakes = [...makeStats].sort((a, b) => a.count - b.count).slice(0, 3);

  // Most unreliable makes (most claims)
  const unreliableMakes = useMemo(() =>
    [...makeStats].filter(m => m.claims > 0).sort((a, b) => b.claims - a.claims).slice(0, 5),
  [makeStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Car className="h-6 w-6 text-orange-500" />
          <h2 className="text-xl font-bold">Vehicle Stats</h2>
          <Badge variant="secondary" className="text-xs">{totalWarranties} warranties</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <Select value={vehicleTypeFilter} onValueChange={setVehicleTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Vehicle type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {allVehicleTypes.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Warranties</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalWarranties}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Revenue</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">£{totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-green-500" /> Top Selling Make
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topMake?.make || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">{topMake?.count || 0} warranties sold</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <TrendingDown className="h-4 w-4 text-red-500" /> Least Popular
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              {bottomMakes.map(m => (
                <div key={m.make} className="flex justify-between">
                  <span>{m.make}</span>
                  <Badge variant="outline" className="text-xs">{m.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Claims reliability card */}
      {unreliableMakes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Claims Reliability Cross-Reference
            </CardTitle>
            <CardDescription>Data from Vehicle Intelligence — makes with the most claims vs warranty sales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Make</th>
                    <th className="text-right py-2 px-3 font-medium">Warranties Sold</th>
                    <th className="text-right py-2 px-3 font-medium">Claims Filed</th>
                    <th className="text-right py-2 px-3 font-medium">Claims Cost</th>
                    <th className="text-right py-2 px-3 font-medium">Claim Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {unreliableMakes.map(m => (
                    <tr key={m.make} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">{m.make}</td>
                      <td className="py-2 px-3 text-right">{m.count}</td>
                      <td className="py-2 px-3 text-right">
                        <Badge variant="destructive" className="text-xs">{m.claims}</Badge>
                      </td>
                      <td className="py-2 px-3 text-right">£{m.claimCost.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                      <td className="py-2 px-3 text-right">
                        {m.count > 0 ? ((m.claims / m.count) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top makes chart + pie chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Warranties by Vehicle Make</CardTitle>
            <CardDescription>Which makes sell the most warranties</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(300, Math.min(makeStats.length, 15) * 28)}>
              <BarChart data={makeStats.slice(0, 15)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="make" type="category" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#f97316" name="Warranties Sold" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Market Share by Make</CardTitle>
            <CardDescription>Proportion of warranties per manufacturer</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            {/* Expand "Others" breakdown */}
            {otherMakes.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowOthers(!showOthers)}>
                  {showOthers ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                  {showOthers ? 'Hide' : 'Show'} "Others" breakdown ({otherMakes.length} makes)
                </Button>
                {showOthers && (
                  <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
                    {otherMakes.map((m, i) => (
                      <div key={m.make} className="flex justify-between items-center text-xs px-2 py-1 hover:bg-muted/50 rounded">
                        <span className="font-medium">{i + 8}. {m.make}</span>
                        <div className="flex items-center gap-2">
                          <span>{m.count} warranties</span>
                          <span className="text-muted-foreground">£{m.revenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by make */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by Make</CardTitle>
          <CardDescription>Total warranty revenue per vehicle manufacturer</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(300, Math.min(makeStats.length, 15) * 28)}>
            <BarChart data={[...makeStats].sort((a, b) => b.revenue - a.revenue).slice(0, 15)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v.toLocaleString()}`} />
              <YAxis dataKey="make" type="category" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
              <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (£)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top models */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 20 Models</CardTitle>
          <CardDescription>Best-selling vehicle models by warranty count</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(300, modelStats.length * 28)}>
            <BarChart data={modelStats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="model" type="category" width={130} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#22c55e" name="Warranties" radius={[0, 4, 4, 0]} />
              <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (£)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Vehicle Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" /> Vehicle Type Breakdown</CardTitle>
          <CardDescription>SUV, Van, Hatchback, Saloon, etc.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={vehicleTypeStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {vehicleTypeStats.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5">
              {vehicleTypeStats.map((t, i) => (
                <div key={t.name} className="flex justify-between items-center text-sm px-2 py-1 hover:bg-muted/50 rounded">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="font-medium">{t.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="text-xs">{t.value} warranties</Badge>
                    <span className="text-muted-foreground text-xs">£{t.revenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fuel type + Year distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Fuel className="h-4 w-4" /> Fuel Type Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={fuelStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {fuelStats.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Vehicle Year Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={yearStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" name="Warranties" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Full make table with claims data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Hash className="h-4 w-4" /> Full Make Breakdown</CardTitle>
          <CardDescription>All vehicle makes ranked by warranty sales — with claims data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">#</th>
                  <th className="text-left py-2 px-3 font-medium">Make</th>
                  <th className="text-right py-2 px-3 font-medium">Warranties</th>
                  <th className="text-right py-2 px-3 font-medium">Revenue</th>
                  <th className="text-right py-2 px-3 font-medium">Avg Value</th>
                  <th className="text-right py-2 px-3 font-medium">Share</th>
                  <th className="text-right py-2 px-3 font-medium">Claims</th>
                  <th className="text-right py-2 px-3 font-medium">Claim Rate</th>
                </tr>
              </thead>
              <tbody>
                {makeStats.map((m, i) => {
                  const isExpanded = expandedMakes.has(m.make);
                  const models = modelsByMake.get(m.make);
                  const modelList = models
                    ? Array.from(models.entries())
                        .map(([model, d]) => ({ model, count: d.count, revenue: Math.round(d.revenue * 100) / 100 }))
                        .sort((a, b) => b.count - a.count)
                    : [];
                  return (
                    <React.Fragment key={m.make}>
                      <tr 
                        className="border-b hover:bg-muted/50 cursor-pointer" 
                        onClick={() => toggleMakeExpand(m.make)}
                      >
                        <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 px-3 font-medium flex items-center gap-1">
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {m.make}
                          {modelList.length > 0 && (
                            <Badge variant="outline" className="text-[10px] ml-1">{modelList.length} models</Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">{m.count}</td>
                        <td className="py-2 px-3 text-right">£{m.revenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                        <td className="py-2 px-3 text-right">£{m.count > 0 ? Math.round(m.revenue / m.count).toLocaleString() : 0}</td>
                        <td className="py-2 px-3 text-right">{totalWarranties > 0 ? ((m.count / totalWarranties) * 100).toFixed(1) : 0}%</td>
                        <td className="py-2 px-3 text-right">{m.claims > 0 ? <Badge variant="destructive" className="text-xs">{m.claims}</Badge> : <span className="text-muted-foreground">0</span>}</td>
                        <td className="py-2 px-3 text-right">{m.count > 0 ? ((m.claims / m.count) * 100).toFixed(1) : 0}%</td>
                      </tr>
                      {isExpanded && modelList.map((model) => (
                        <tr key={`${m.make}-${model.model}`} className="border-b bg-muted/30">
                          <td className="py-1.5 px-3"></td>
                          <td className="py-1.5 px-3 pl-8 text-sm text-muted-foreground">↳ {model.model}</td>
                          <td className="py-1.5 px-3 text-right text-sm">{model.count}</td>
                          <td className="py-1.5 px-3 text-right text-sm">£{model.revenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                          <td className="py-1.5 px-3 text-right text-sm">£{model.count > 0 ? Math.round(model.revenue / model.count).toLocaleString() : 0}</td>
                          <td className="py-1.5 px-3 text-right text-sm">{m.count > 0 ? ((model.count / m.count) * 100).toFixed(1) : 0}%</td>
                          <td className="py-1.5 px-3" colSpan={2}></td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VehicleStatsTab;
