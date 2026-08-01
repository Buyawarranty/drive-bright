import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Car, TrendingUp, TrendingDown, Filter, Fuel, Calendar, Hash, AlertTriangle, ChevronDown, ChevronUp, Truck, ShieldCheck, Gauge, Target } from 'lucide-react';
import { normaliseMake, normaliseModelFamily } from './claims/vehicleNormalisation';
import { classifyVehicleType, VehicleBodyType } from './claims/vehicleTypeClassification';
import { DateRangeFilter } from './DateRangeFilter';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { SalesAgeMileageAnalytics } from './SalesAgeMileageAnalytics';
import { CompetitorPricingPanel } from './vehicle/CompetitorPricingPanel';


interface CustomerVehicle {
  id: string;
  name: string | null;
  email: string | null;
  plan_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_fuel_type: string | null;
  vehicle_year: string | null;
  mileage: string | null;
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
  mileage: string | null;
  vehicle_year: string | null;
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
          .select('id, name, email, plan_type, vehicle_make, vehicle_model, vehicle_fuel_type, vehicle_year, mileage, final_amount, status, signup_date')
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
            .select('registration_plate, vehicle_make, vehicle_model, mileage, vehicle_year')
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
          <h2 className="text-xl font-bold">Vehicle Intelligence</h2>
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

      {/* Most Reliable Vehicles — zero claims */}
      <ReliableVehiclesSection makeStats={makeStats} modelsByMake={modelsByMake} claimsByMake={claimsByMake} vehicleMap={vehicleMap} claims={claims} />

      {/* Claims by Mileage Band — reliability by mileage */}
      <ClaimsByMileageSection filtered={filtered} claims={claims} vehicleMap={vehicleMap} />

      {/* Claims by Age Band — reliability by vehicle age */}
      <ClaimsByAgeSection filtered={filtered} claims={claims} vehicleMap={vehicleMap} />

      {/* Age × Mileage matrix — pricing recommendation heatmap */}
      <ClaimsByAgeMileageMatrix filtered={filtered} claims={claims} vehicleMap={vehicleMap} />

      {/* Competitor pricing from price match records */}
      <CompetitorPricingPanel />





      {/* Sales by Vehicle Age & Mileage */}
      <SalesAgeMileageAnalytics
        customers={filtered.map(c => ({
          id: c.id,
          name: c.name ?? '',
          email: c.email ?? '',
          plan_type: c.plan_type ?? '',
          signup_date: c.signup_date,
          status: c.status,
          final_amount: c.final_amount,
          vehicle_year: c.vehicle_year,
          mileage: c.mileage,
        }))}
      />
    </div>
  );
};

// ---------- Reliability sub-components ----------

const parseMileageNum = (m: string | null | undefined): number | null => {
  if (!m) return null;
  const n = parseInt(String(m).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

const MILEAGE_BUCKETS = [
  { label: '0–20k', min: 0, max: 20000 },
  { label: '20–40k', min: 20001, max: 40000 },
  { label: '40–60k', min: 40001, max: 60000 },
  { label: '60–80k', min: 60001, max: 80000 },
  { label: '80–100k', min: 80001, max: 100000 },
  { label: '100–120k', min: 100001, max: 120000 },
  { label: '120–150k', min: 120001, max: 150000 },
  { label: '150k+', min: 150001, max: 9_999_999 },
];

interface ReliableProps {
  makeStats: { make: string; count: number; revenue: number; claims: number; claimCost: number }[];
  modelsByMake: Map<string, Map<string, { count: number; revenue: number }>>;
  claimsByMake: Map<string, { count: number; totalCost: number }>;
  vehicleMap: Map<string, { registration_plate: string; vehicle_make: string | null; vehicle_model: string | null; mileage: string | null }>;
  claims: { id: string; vehicle_registration: string | null; status: string; payment_amount: number | null }[];
}

const ReliableVehiclesSection: React.FC<ReliableProps> = ({ makeStats, modelsByMake, claimsByMake, vehicleMap, claims }) => {
  const ACTIONABLE = new Set(['approved', 'in_progress', 'awaiting_info', 'paid', 'settled', 'under_review']);

  // Claimed model set (make|model) among actionable claims
  const claimedModelSet = useMemo(() => {
    const set = new Set<string>();
    claims.forEach(c => {
      if (!ACTIONABLE.has((c.status || '').toLowerCase())) return;
      const reg = c.vehicle_registration?.toUpperCase();
      const info = reg ? vehicleMap.get(reg) : null;
      if (!info?.vehicle_make) return;
      const make = normaliseMake(info.vehicle_make);
      const family = normaliseModelFamily(make, info.vehicle_model || '');
      set.add(`${make}|${family}`);
    });
    return set;
  }, [claims, vehicleMap]);

  // Makes with zero actionable claims, sorted by warranties sold
  const reliableMakes = useMemo(
    () => makeStats.filter(m => (claimsByMake.get(m.make)?.count || 0) === 0 && m.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    [makeStats, claimsByMake],
  );

  // Models with zero claims (need at least 2 sold to be meaningful)
  const reliableModels = useMemo(() => {
    const rows: { make: string; model: string; count: number; revenue: number }[] = [];
    modelsByMake.forEach((models, make) => {
      models.forEach((d, model) => {
        if (d.count >= 2 && !claimedModelSet.has(`${make}|${model}`)) {
          rows.push({ make, model, count: d.count, revenue: Math.round(d.revenue * 100) / 100 });
        }
      });
    });
    return rows.sort((a, b) => b.count - a.count).slice(0, 15);
  }, [modelsByMake, claimedModelSet]);

  if (reliableMakes.length === 0 && reliableModels.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-green-600" /> Most Reliable Vehicles
        </CardTitle>
        <CardDescription>Makes and models with warranties sold and zero claims filed to date</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold mb-2">By Make</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium">Make</th>
                <th className="text-right py-2 px-3 font-medium">Warranties</th>
                <th className="text-right py-2 px-3 font-medium">Claims</th>
              </tr>
            </thead>
            <tbody>
              {reliableMakes.map(m => (
                <tr key={m.make} className="border-b hover:bg-muted/50">
                  <td className="py-2 px-3 font-medium">{m.make}</td>
                  <td className="py-2 px-3 text-right">{m.count}</td>
                  <td className="py-2 px-3 text-right">
                    <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">0</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-2">By Model</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium">Model</th>
                <th className="text-right py-2 px-3 font-medium">Warranties</th>
                <th className="text-right py-2 px-3 font-medium">Claims</th>
              </tr>
            </thead>
            <tbody>
              {reliableModels.map(m => (
                <tr key={`${m.make}-${m.model}`} className="border-b hover:bg-muted/50">
                  <td className="py-2 px-3 font-medium">{m.make} {m.model}</td>
                  <td className="py-2 px-3 text-right">{m.count}</td>
                  <td className="py-2 px-3 text-right">
                    <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">0</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

interface MileageSectionProps {
  filtered: CustomerVehicle[];
  claims: { id: string; vehicle_registration: string | null; status: string; payment_amount: number | null }[];
  vehicleMap: Map<string, { registration_plate: string; vehicle_make: string | null; vehicle_model: string | null; mileage: string | null }>;
}

const ClaimsByMileageSection: React.FC<MileageSectionProps> = ({ filtered, claims, vehicleMap }) => {
  const ACTIONABLE = new Set(['approved', 'in_progress', 'awaiting_info', 'paid', 'settled', 'under_review']);
  const [bucketFilter, setBucketFilter] = useState<string>('all');

  const rows = useMemo(() => {
    // Sales per bucket
    const sales = new Map<string, number>();
    MILEAGE_BUCKETS.forEach(b => sales.set(b.label, 0));
    filtered.forEach(c => {
      const m = parseMileageNum(c.mileage);
      if (m == null) return;
      const b = MILEAGE_BUCKETS.find(bk => m >= bk.min && m <= bk.max);
      if (b) sales.set(b.label, (sales.get(b.label) || 0) + 1);
    });

    // Claims per bucket (using vehicleMap mileage)
    const claimCounts = new Map<string, number>();
    const claimCosts = new Map<string, number>();
    MILEAGE_BUCKETS.forEach(b => { claimCounts.set(b.label, 0); claimCosts.set(b.label, 0); });
    claims.forEach(c => {
      if (!ACTIONABLE.has((c.status || '').toLowerCase())) return;
      const reg = c.vehicle_registration?.toUpperCase();
      const info = reg ? vehicleMap.get(reg) : null;
      const m = parseMileageNum(info?.mileage ?? null);
      if (m == null) return;
      const b = MILEAGE_BUCKETS.find(bk => m >= bk.min && m <= bk.max);
      if (!b) return;
      claimCounts.set(b.label, (claimCounts.get(b.label) || 0) + 1);
      if (c.payment_amount) claimCosts.set(b.label, (claimCosts.get(b.label) || 0) + c.payment_amount);
    });

    return MILEAGE_BUCKETS.map(b => {
      const s = sales.get(b.label) || 0;
      const cl = claimCounts.get(b.label) || 0;
      const cost = claimCosts.get(b.label) || 0;
      return {
        band: b.label,
        sales: s,
        claims: cl,
        claimRate: s > 0 ? (cl / s) * 100 : 0,
        cost: Math.round(cost),
      };
    });
  }, [filtered, claims, vehicleMap]);

  const displayRows = bucketFilter === 'all' ? rows : rows.filter(r => r.band === bucketFilter);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="h-4 w-4 text-blue-600" /> Reliability by Mileage Band
            </CardTitle>
            <CardDescription>
              Lower-mileage vehicles typically claim less — filter by mileage to compare claim rates
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={bucketFilter} onValueChange={setBucketFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Mileage band" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All bands</SelectItem>
                {MILEAGE_BUCKETS.map(b => (
                  <SelectItem key={b.label} value={b.label}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium">Mileage Band</th>
                <th className="text-right py-2 px-3 font-medium">Warranties Sold</th>
                <th className="text-right py-2 px-3 font-medium">Claims Filed</th>
                <th className="text-right py-2 px-3 font-medium">Claim Rate</th>
                <th className="text-right py-2 px-3 font-medium">Claim Cost</th>
                <th className="text-right py-2 px-3 font-medium">Reliability</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map(r => {
                const reliable = r.sales > 0 && r.claimRate < 5;
                return (
                  <tr key={r.band} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">{r.band}</td>
                    <td className="py-2 px-3 text-right">{r.sales}</td>
                    <td className="py-2 px-3 text-right">
                      {r.claims > 0
                        ? <Badge variant="destructive" className="text-xs">{r.claims}</Badge>
                        : <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">0</Badge>}
                    </td>
                    <td className="py-2 px-3 text-right">{r.claimRate.toFixed(1)}%</td>
                    <td className="py-2 px-3 text-right">
                      £{r.cost.toLocaleString('en-GB')}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {r.sales === 0
                        ? <span className="text-muted-foreground text-xs">n/a</span>
                        : reliable
                          ? <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">High</Badge>
                          : r.claimRate < 15
                            ? <Badge className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-100">Medium</Badge>
                            : <Badge variant="destructive" className="text-xs">Low</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

// ---------- Claims by Age Band ----------

const AGE_BUCKETS = [
  { label: '0–2 yrs', min: 0, max: 2 },
  { label: '3–5 yrs', min: 3, max: 5 },
  { label: '6–8 yrs', min: 6, max: 8 },
  { label: '9–11 yrs', min: 9, max: 11 },
  { label: '12–15 yrs', min: 12, max: 15 },
  { label: '16+ yrs', min: 16, max: 999 },
];

const parseYearNum = (y: string | null | undefined): number | null => {
  if (!y) return null;
  const m = String(y).match(/\d{4}/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
};
const currentYearForAge = new Date().getFullYear();
const ageFromYear = (y: string | null | undefined): number | null => {
  const yr = parseYearNum(y);
  if (yr == null) return null;
  const age = currentYearForAge - yr;
  return age >= 0 && age < 60 ? age : null;
};

interface AgeSectionProps {
  filtered: CustomerVehicle[];
  claims: { id: string; vehicle_registration: string | null; status: string; payment_amount: number | null }[];
  vehicleMap: Map<string, VehicleLookup>;
}

const ClaimsByAgeSection: React.FC<AgeSectionProps> = ({ filtered, claims, vehicleMap }) => {
  const ACTIONABLE = new Set(['approved', 'in_progress', 'awaiting_info', 'paid', 'settled', 'under_review']);
  const [bucketFilter, setBucketFilter] = useState<string>('all');

  const rows = useMemo(() => {
    const sales = new Map<string, { policies: number; revenue: number }>();
    AGE_BUCKETS.forEach(b => sales.set(b.label, { policies: 0, revenue: 0 }));
    filtered.forEach(c => {
      const age = ageFromYear(c.vehicle_year);
      if (age == null) return;
      const b = AGE_BUCKETS.find(bk => age >= bk.min && age <= bk.max);
      if (!b) return;
      const cur = sales.get(b.label)!;
      cur.policies++;
      if (c.final_amount) cur.revenue += c.final_amount;
    });

    const claimCounts = new Map<string, number>();
    const claimCosts = new Map<string, number>();
    AGE_BUCKETS.forEach(b => { claimCounts.set(b.label, 0); claimCosts.set(b.label, 0); });
    claims.forEach(c => {
      if (!ACTIONABLE.has((c.status || '').toLowerCase())) return;
      const reg = c.vehicle_registration?.toUpperCase();
      const info = reg ? vehicleMap.get(reg) : null;
      const age = ageFromYear(info?.vehicle_year ?? null);
      if (age == null) return;
      const b = AGE_BUCKETS.find(bk => age >= bk.min && age <= bk.max);
      if (!b) return;
      claimCounts.set(b.label, (claimCounts.get(b.label) || 0) + 1);
      if (c.payment_amount) claimCosts.set(b.label, (claimCosts.get(b.label) || 0) + c.payment_amount);
    });

    return AGE_BUCKETS.map(b => {
      const s = sales.get(b.label)!;
      const cl = claimCounts.get(b.label) || 0;
      const cost = claimCosts.get(b.label) || 0;
      const loss = s.revenue > 0 ? (cost / s.revenue) * 100 : 0;
      return {
        band: b.label,
        sales: s.policies,
        revenue: Math.round(s.revenue),
        claims: cl,
        claimRate: s.policies > 0 ? (cl / s.policies) * 100 : 0,
        cost: Math.round(cost),
        avgClaim: cl > 0 ? Math.round(cost / cl) : 0,
        lossRatio: Math.round(loss * 10) / 10,
      };
    });
  }, [filtered, claims, vehicleMap]);

  const displayRows = bucketFilter === 'all' ? rows : rows.filter(r => r.band === bucketFilter);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" /> Reliability by Vehicle Age
            </CardTitle>
            <CardDescription>
              Younger vehicles typically claim less — compare claim rate and loss ratio (claim cost ÷ premium) by age band to find pricing headroom
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={bucketFilter} onValueChange={setBucketFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Age band" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All bands</SelectItem>
                {AGE_BUCKETS.map(b => (
                  <SelectItem key={b.label} value={b.label}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium">Age Band</th>
                <th className="text-right py-2 px-3 font-medium">Warranties Sold</th>
                <th className="text-right py-2 px-3 font-medium">Premium £</th>
                <th className="text-right py-2 px-3 font-medium">Claims</th>
                <th className="text-right py-2 px-3 font-medium">Claim Rate</th>
                <th className="text-right py-2 px-3 font-medium">Claim Cost</th>
                <th className="text-right py-2 px-3 font-medium">Avg Claim</th>
                <th className="text-right py-2 px-3 font-medium">Loss Ratio</th>
                <th className="text-right py-2 px-3 font-medium">Reliability</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map(r => {
                const reliable = r.sales > 0 && r.claimRate < 2 && r.lossRatio < 20;
                return (
                  <tr key={r.band} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">{r.band}</td>
                    <td className="py-2 px-3 text-right">{r.sales}</td>
                    <td className="py-2 px-3 text-right">£{r.revenue.toLocaleString('en-GB')}</td>
                    <td className="py-2 px-3 text-right">
                      {r.claims > 0
                        ? <Badge variant="destructive" className="text-xs">{r.claims}</Badge>
                        : <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">0</Badge>}
                    </td>
                    <td className="py-2 px-3 text-right">{r.claimRate.toFixed(1)}%</td>
                    <td className="py-2 px-3 text-right">£{r.cost.toLocaleString('en-GB')}</td>
                    <td className="py-2 px-3 text-right">{r.avgClaim > 0 ? `£${r.avgClaim.toLocaleString('en-GB')}` : '—'}</td>
                    <td className="py-2 px-3 text-right">{r.sales > 0 ? `${r.lossRatio.toFixed(1)}%` : '—'}</td>
                    <td className="py-2 px-3 text-right">
                      {r.sales === 0
                        ? <span className="text-muted-foreground text-xs">n/a</span>
                        : reliable
                          ? <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">High</Badge>
                          : r.claimRate < 5
                            ? <Badge className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-100">Medium</Badge>
                            : <Badge variant="destructive" className="text-xs">Low</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          <strong>Loss ratio</strong> = total claim cost ÷ total premium collected in that band. A band with a loss ratio under ~40% is a candidate for a targeted price reduction; over ~70% needs a price increase.
        </p>
      </CardContent>
    </Card>
  );
};

// ---------- Age × Mileage Pricing Matrix ----------

const MATRIX_AGE = [
  { label: '0–5', min: 0, max: 5 },
  { label: '6–10', min: 6, max: 10 },
  { label: '11+', min: 11, max: 999 },
];
const MATRIX_MI = [
  { label: '0–40k', min: 0, max: 40000 },
  { label: '40–80k', min: 40001, max: 80000 },
  { label: '80–120k', min: 80001, max: 120000 },
  { label: '120k+', min: 120001, max: 9_999_999 },
];

const MIN_POLICIES_FOR_RECOMMENDATION = 20;

const cellColor = (claimRate: number, sales: number): string => {
  if (sales < 5) return 'bg-muted text-muted-foreground';
  if (claimRate === 0) return 'bg-green-200 text-green-900';
  if (claimRate < 2) return 'bg-green-100 text-green-800';
  if (claimRate < 5) return 'bg-amber-100 text-amber-800';
  if (claimRate < 10) return 'bg-orange-200 text-orange-900';
  return 'bg-red-200 text-red-900';
};

const ClaimsByAgeMileageMatrix: React.FC<AgeSectionProps> = ({ filtered, claims, vehicleMap }) => {
  const ACTIONABLE = new Set(['approved', 'in_progress', 'awaiting_info', 'paid', 'settled', 'under_review']);

  const { cells, overallRate, overallLoss, recommendations } = useMemo(() => {
    const key = (a: string, m: string) => `${a}||${m}`;
    const salesMap = new Map<string, { policies: number; revenue: number }>();
    const claimsMap = new Map<string, { count: number; cost: number }>();

    MATRIX_AGE.forEach(a => MATRIX_MI.forEach(m => {
      salesMap.set(key(a.label, m.label), { policies: 0, revenue: 0 });
      claimsMap.set(key(a.label, m.label), { count: 0, cost: 0 });
    }));

    filtered.forEach(c => {
      const age = ageFromYear(c.vehicle_year);
      const mi = parseMileageNum(c.mileage);
      if (age == null || mi == null) return;
      const a = MATRIX_AGE.find(x => age >= x.min && age <= x.max);
      const m = MATRIX_MI.find(x => mi >= x.min && mi <= x.max);
      if (!a || !m) return;
      const s = salesMap.get(key(a.label, m.label))!;
      s.policies++;
      if (c.final_amount) s.revenue += c.final_amount;
    });

    claims.forEach(c => {
      if (!ACTIONABLE.has((c.status || '').toLowerCase())) return;
      const reg = c.vehicle_registration?.toUpperCase();
      const info = reg ? vehicleMap.get(reg) : null;
      if (!info) return;
      const age = ageFromYear(info.vehicle_year);
      const mi = parseMileageNum(info.mileage);
      if (age == null || mi == null) return;
      const a = MATRIX_AGE.find(x => age >= x.min && age <= x.max);
      const m = MATRIX_MI.find(x => mi >= x.min && mi <= x.max);
      if (!a || !m) return;
      const cur = claimsMap.get(key(a.label, m.label))!;
      cur.count++;
      if (c.payment_amount) cur.cost += c.payment_amount;
    });

    let totalPolicies = 0, totalRevenue = 0, totalClaims = 0, totalCost = 0;
    const cells = MATRIX_AGE.map(a => ({
      age: a.label,
      cols: MATRIX_MI.map(m => {
        const s = salesMap.get(key(a.label, m.label))!;
        const cl = claimsMap.get(key(a.label, m.label))!;
        totalPolicies += s.policies;
        totalRevenue += s.revenue;
        totalClaims += cl.count;
        totalCost += cl.cost;
        return {
          mileage: m.label,
          policies: s.policies,
          revenue: s.revenue,
          claims: cl.count,
          cost: cl.cost,
          claimRate: s.policies > 0 ? (cl.count / s.policies) * 100 : 0,
          lossRatio: s.revenue > 0 ? (cl.cost / s.revenue) * 100 : 0,
        };
      }),
    }));

    const overallRate = totalPolicies > 0 ? (totalClaims / totalPolicies) * 100 : 0;
    const overallLoss = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;

    // Recommendations: bands with enough volume, low claim rate/loss ratio vs overall
    const flat = cells.flatMap(row => row.cols.map(c => ({ age: row.age, ...c })));
    const recommendations = flat
      .filter(c => c.policies >= MIN_POLICIES_FOR_RECOMMENDATION)
      .map(c => {
        const rateDelta = c.claimRate - overallRate;
        const lossDelta = c.lossRatio - overallLoss;
        let action: 'discount' | 'increase' | 'hold' = 'hold';
        let pct = 0;
        if (c.claimRate <= overallRate * 0.5 && c.lossRatio < 30) {
          action = 'discount';
          pct = c.claimRate === 0 && c.lossRatio === 0 ? 15 : 10;
        } else if (c.claimRate >= overallRate * 1.5 || c.lossRatio > 60) {
          action = 'increase';
          pct = c.lossRatio > 80 ? 15 : 10;
        }
        return { ...c, rateDelta, lossDelta, action, pct };
      })
      .sort((a, b) => a.claimRate - b.claimRate);

    return { cells, overallRate, overallLoss, recommendations };
  }, [filtered, claims, vehicleMap]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-indigo-600" /> Age × Mileage Pricing Matrix
        </CardTitle>
        <CardDescription>
          Claim rate by vehicle age and mileage combined. Overall claim rate: <strong>{overallRate.toFixed(2)}%</strong> · overall loss ratio: <strong>{overallLoss.toFixed(1)}%</strong>. Green cells with enough volume are pricing-discount candidates; red cells need a price increase.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 font-medium border-b bg-muted/40">Age \ Mileage</th>
                {MATRIX_MI.map(m => (
                  <th key={m.label} className="text-center py-2 px-3 font-medium border-b bg-muted/40">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cells.map(row => (
                <tr key={row.age}>
                  <td className="py-2 px-3 font-semibold border-b bg-muted/20">{row.age} yrs</td>
                  {row.cols.map(c => (
                    <td key={c.mileage} className={`py-2 px-3 border-b text-center ${cellColor(c.claimRate, c.policies)}`}>
                      <div className="text-base font-bold">{c.policies > 0 ? `${c.claimRate.toFixed(1)}%` : '—'}</div>
                      <div className="text-[11px] opacity-80">
                        {c.claims}/{c.policies} claims
                      </div>
                      <div className="text-[11px] opacity-80">
                        loss {c.policies > 0 ? `${c.lossRatio.toFixed(0)}%` : '—'}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-green-600" /> Pricing recommendations
            <span className="text-xs font-normal text-muted-foreground">(bands with ≥ {MIN_POLICIES_FOR_RECOMMENDATION} policies only)</span>
          </h4>
          {recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough policy volume per band yet — recommendations appear once each cell reaches {MIN_POLICIES_FOR_RECOMMENDATION}+ policies.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Segment</th>
                    <th className="text-right py-2 px-3 font-medium">Policies</th>
                    <th className="text-right py-2 px-3 font-medium">Claim Rate</th>
                    <th className="text-right py-2 px-3 font-medium">vs Overall</th>
                    <th className="text-right py-2 px-3 font-medium">Loss Ratio</th>
                    <th className="text-right py-2 px-3 font-medium">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map(r => (
                    <tr key={`${r.age}-${r.mileage}`} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">{r.age} yrs · {r.mileage}</td>
                      <td className="py-2 px-3 text-right">{r.policies}</td>
                      <td className="py-2 px-3 text-right">{r.claimRate.toFixed(2)}%</td>
                      <td className={`py-2 px-3 text-right ${r.rateDelta < 0 ? 'text-green-700' : r.rateDelta > 0 ? 'text-red-700' : ''}`}>
                        {r.rateDelta > 0 ? '+' : ''}{r.rateDelta.toFixed(2)}pp
                      </td>
                      <td className="py-2 px-3 text-right">{r.lossRatio.toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right">
                        {r.action === 'discount' && (
                          <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">
                            Reduce price ~{r.pct}%
                          </Badge>
                        )}
                        {r.action === 'increase' && (
                          <Badge variant="destructive" className="text-xs">
                            Raise price ~{r.pct}%
                          </Badge>
                        )}
                        {r.action === 'hold' && (
                          <Badge variant="outline" className="text-xs">Hold current price</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            <strong>Method:</strong> a segment is flagged for discount when its claim rate is under half the overall rate <em>and</em> loss ratio is below 30% — meaning we're being paid disproportionately more than we pay out. It is flagged for a price increase when claim rate is 1.5× overall or loss ratio exceeds 60%. Small samples (&lt;{MIN_POLICIES_FOR_RECOMMENDATION} policies) are hidden to avoid noise.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default VehicleStatsTab;


