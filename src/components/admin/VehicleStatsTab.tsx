import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Car, TrendingUp, TrendingDown, Filter, Fuel, Calendar, Hash } from 'lucide-react';
import { normaliseMake, normaliseModelFamily } from './claims/vehicleNormalisation';

interface CustomerVehicle {
  id: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_fuel_type: string | null;
  vehicle_transmission: string | null;
  vehicle_year: string | null;
  plan_type: string;
  payment_type: string | null;
  final_amount: number | null;
  status: string;
  signup_date: string;
}

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#ef4444', '#eab308', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#f43f5e'];

export const VehicleStatsTab: React.FC = () => {
  const [data, setData] = useState<CustomerVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const fetch = async () => {
      const { data: rows } = await supabase
        .from('customers')
        .select('id, vehicle_make, vehicle_model, vehicle_fuel_type, vehicle_transmission, vehicle_year, plan_type, payment_type, final_amount, status, signup_date')
        .eq('is_deleted', false);
      setData(rows ?? []);
      setLoading(false);
    };
    fetch();
    const timeout = setTimeout(() => setLoading(false), 12000);
    return () => clearTimeout(timeout);
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return data;
    return data.filter(d => d.status?.toLowerCase() === statusFilter.toLowerCase());
  }, [data, statusFilter]);

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
      .map(([make, d]) => ({ make, count: d.count, revenue: Math.round(d.revenue * 100) / 100 }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  // Stats by model
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

  // Pie data for top makes
  const pieData = useMemo(() => {
    const top = makeStats.slice(0, 7);
    const others = makeStats.slice(7);
    const result = top.map(d => ({ name: d.make, value: d.count }));
    if (others.length > 0) {
      result.push({ name: 'Others', value: others.reduce((s, d) => s + d.count, 0) });
    }
    return result;
  }, [makeStats]);

  const totalWarranties = filtered.length;
  const totalRevenue = filtered.reduce((s, c) => s + (c.final_amount || 0), 0);
  const topMake = makeStats[0];
  const bottomMakes = [...makeStats].sort((a, b) => a.count - b.count).slice(0, 3);

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
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Warranties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWarranties}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          </CardContent>
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

      {/* Top makes table + pie chart */}
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

      {/* Fuel type + Year distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Fuel className="h-4 w-4" /> Fuel Type Breakdown
            </CardTitle>
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
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Vehicle Year Distribution
            </CardTitle>
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

      {/* Full make table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="h-4 w-4" /> Full Make Breakdown
          </CardTitle>
          <CardDescription>All vehicle makes ranked by warranty sales</CardDescription>
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
                </tr>
              </thead>
              <tbody>
                {makeStats.map((m, i) => (
                  <tr key={m.make} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 px-3 font-medium">{m.make}</td>
                    <td className="py-2 px-3 text-right">{m.count}</td>
                    <td className="py-2 px-3 text-right">£{m.revenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td className="py-2 px-3 text-right">£{m.count > 0 ? Math.round(m.revenue / m.count).toLocaleString() : 0}</td>
                    <td className="py-2 px-3 text-right">{totalWarranties > 0 ? ((m.count / totalWarranties) * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VehicleStatsTab;
