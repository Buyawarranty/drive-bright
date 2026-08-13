import React, { useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Car, AlertTriangle, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { normaliseMake, normaliseModelFamily } from './vehicleNormalisation';
import { settledCost } from './claimCost';

interface ClaimData {
  id: string;
  status: string;
  payment_amount?: number;
  claimed_amount?: number | null;
  paid_amount?: number | null;
  created_at: string;
  vehicle_registration?: string;
}

interface ClaimsVehicleAnalyticsProps {
  claims: ClaimData[];
}

interface VehicleInfo {
  registration_plate: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
}

const COLORS = ['#f97316', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

export const ClaimsVehicleAnalytics: React.FC<ClaimsVehicleAnalyticsProps> = ({ claims }) => {
  const [vehicleMap, setVehicleMap] = useState<Map<string, VehicleInfo>>(new Map());

  useEffect(() => {
    const regs = Array.from(new Set(claims.map(c => c.vehicle_registration?.toUpperCase()).filter(Boolean))) as string[];
    if (regs.length === 0) return;

    const fetchVehicles = async () => {
      const { data } = await supabase
        .from('customers')
        .select('registration_plate, vehicle_make, vehicle_model')
        .in('registration_plate', regs);

      if (data) {
        const map = new Map<string, VehicleInfo>();
        data.forEach(v => {
          if (v.registration_plate) map.set(v.registration_plate.toUpperCase(), v as VehicleInfo);
        });
        setVehicleMap(map);
      }
    };
    fetchVehicles();
  }, [claims]);

  // Claims by normalised make
  const makeStats = useMemo(() => {
    const byMake = new Map<string, { count: number; totalCost: number; paidCount: number }>();

    claims.forEach(c => {
      const reg = c.vehicle_registration?.toUpperCase();
      const info = reg ? vehicleMap.get(reg) : null;
      const make = normaliseMake(info?.vehicle_make || '');

      if (!byMake.has(make)) byMake.set(make, { count: 0, totalCost: 0, paidCount: 0 });
      const entry = byMake.get(make)!;
      entry.count++;
      const paid = settledCost(c);
      if (paid > 0) {
        entry.totalCost += paid;
        entry.paidCount++;
      }
    });

    return Array.from(byMake.entries())
      .map(([make, data]) => ({
        make,
        claims: data.count,
        totalCost: Math.round(data.totalCost * 100) / 100,
        avgCost: data.paidCount > 0 ? Math.round((data.totalCost / data.paidCount) * 100) / 100 : 0,
      }))
      .filter(d => d.make !== 'Unknown')
      .sort((a, b) => b.claims - a.claims);
  }, [claims, vehicleMap]);

  const costliestMakes = useMemo(
    () => [...makeStats].sort((a, b) => b.totalCost - a.totalCost).slice(0, 10),
    [makeStats]
  );

  const leastReliable = useMemo(
    () => [...makeStats].sort((a, b) => b.claims - a.claims).slice(0, 10),
    [makeStats]
  );

  // Claims by normalised make/model family (top 15)
  const modelStats = useMemo(() => {
    const byModel = new Map<string, { count: number; totalCost: number; paidCount: number }>();

    claims.forEach(c => {
      const reg = c.vehicle_registration?.toUpperCase();
      const info = reg ? vehicleMap.get(reg) : null;
      if (!info?.vehicle_make) return;
      const make = normaliseMake(info.vehicle_make);
      const family = normaliseModelFamily(make, info.vehicle_model || '');
      const key = `${make} ${family}`;

      if (!byModel.has(key)) byModel.set(key, { count: 0, totalCost: 0, paidCount: 0 });
      const entry = byModel.get(key)!;
      entry.count++;
      const paid = settledCost(c);
      if (paid > 0) {
        entry.totalCost += paid;
        entry.paidCount++;
      }
    });

    return Array.from(byModel.entries())
      .map(([model, data]) => ({
        model,
        claims: data.count,
        totalCost: Math.round(data.totalCost * 100) / 100,
        avgCost: data.paidCount > 0 ? Math.round((data.totalCost / data.paidCount) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 15);
  }, [claims, vehicleMap]);

  // Pie data for claims distribution by make
  const pieData = useMemo(() => {
    const top = makeStats.slice(0, 7);
    const others = makeStats.slice(7);
    const result = top.map(d => ({ name: d.make, value: d.claims }));
    if (others.length > 0) {
      result.push({ name: 'Others', value: others.reduce((s, d) => s + d.claims, 0) });
    }
    return result;
  }, [makeStats]);

  if (makeStats.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          <Car className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No vehicle data available yet. Vehicle analytics will appear once claims are linked to customer vehicles.
        </CardContent>
      </Card>
    );
  }

  const totalClaimsAll = makeStats.reduce((s, d) => s + d.claims, 0);
  const totalPaidAll = makeStats.reduce((s, d) => s + d.totalCost, 0);
  const paidMakes = costliestMakes.filter(m => m.totalCost > 0);
  const modelsByVolume = useMemo(
    () => [...modelStats].sort((a, b) => b.claims - a.claims),
    [modelStats]
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Car className="h-5 w-5 text-orange-500" />
        <h3 className="text-lg font-semibold">Vehicle Reliability & Cost Intelligence</h3>
      </div>

      <p className="text-xs text-muted-foreground -mt-6">
        <strong>Claims made</strong> and <strong>claims paid out</strong> are reported as two separate sections.
        Volume counts every claim whatever the outcome; payout counts only money actually settled on approved and
        paid claims, so declined, appealed and open garage quotes are excluded.
      </p>

      {/* ============ SECTION 1: CLAIMS MADE ============ */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-l-4 border-l-slate-400 pl-3">
          <h4 className="text-base font-semibold">1. Claims made by vehicle (volume)</h4>
          <Badge variant="outline" className="text-xs">{totalClaimsAll} claims with a known make</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Most claims made (least reliable)
              </CardTitle>
              <CardDescription className="text-xs">Claim count only — outcome ignored</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {leastReliable.slice(0, 5).map((m, i) => (
                <div key={m.make} className="flex justify-between items-center text-sm">
                  <span className="font-medium">{i + 1}. {m.make}</span>
                  <Badge variant="secondary" className="text-xs">{m.claims} claims</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Claims made by make</CardTitle>
              <CardDescription>Which makes generate the most claims</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={leastReliable} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="make" type="category" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="claims" fill="#f97316" name="Claims made" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Share of claims made</CardTitle>
              <CardDescription>Share of total claims per manufacturer</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claims made by make & model</CardTitle>
            <CardDescription>Model families ranked by number of claims submitted</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(300, modelsByVolume.length * 26)}>
              <BarChart data={modelsByVolume} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="model" type="category" width={120} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="claims" fill="#8b5cf6" name="Claims made" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* ============ SECTION 2: CLAIMS PAID OUT ============ */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-l-4 border-l-amber-500 pl-3">
          <h4 className="text-base font-semibold">2. Claims paid out by vehicle (settled money)</h4>
          <Badge variant="outline" className="text-xs">
            £{Math.round(totalPaidAll).toLocaleString()} settled
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground pl-3">
          Approved and paid claims only — a make can top the volume list above and still appear low here if most of
          its claims were declined.
        </p>

        {paidMakes.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No settled payouts recorded for this period yet.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-orange-500" />
                    Most paid out by make
                  </CardTitle>
                  <CardDescription className="text-xs">Total settled spend</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {paidMakes.slice(0, 5).map((m, i) => (
                    <div key={m.make} className="flex justify-between items-center text-sm">
                      <span className="font-medium">{i + 1}. {m.make}</span>
                      <Badge variant="secondary" className="text-xs">
                        £{m.totalCost.toLocaleString('en-GB', { maximumFractionDigits: 0 })} paid
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Car className="h-4 w-4 text-blue-500" />
                    Highest average payout by make
                  </CardTitle>
                  <CardDescription className="text-xs">Total paid ÷ settled claims</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {[...makeStats]
                    .filter(m => m.avgCost > 0)
                    .sort((a, b) => b.avgCost - a.avgCost)
                    .slice(0, 5)
                    .map((m, i) => (
                      <div key={m.make} className="flex justify-between items-center text-sm">
                        <span className="font-medium">{i + 1}. {m.make}</span>
                        <Badge variant="secondary" className="text-xs">
                          £{m.avgCost.toLocaleString('en-GB', { maximumFractionDigits: 0 })} avg
                        </Badge>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Paid out by make & model</CardTitle>
                <CardDescription>Top 15 model families by amount actually paid out</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(300, modelStats.length * 28)}>
                  <BarChart data={modelStats.filter(m => m.totalCost > 0)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v.toLocaleString()}`} />
                    <YAxis dataKey="model" type="category" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value: number) => `£${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`} />
                    <Legend />
                    <Bar dataKey="totalCost" fill="#ef4444" name="Total paid (£)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="avgCost" fill="#3b82f6" name="Avg payout (£)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </div>
  );
};

