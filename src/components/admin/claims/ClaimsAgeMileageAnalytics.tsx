import React, { useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Gauge, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { settledCost, claimedCost } from './claimCost';


interface ClaimData {
  id: string;
  status: string;
  payment_amount?: number;
  claimed_amount?: number | null;
  paid_amount?: number | null;
  created_at: string;
  vehicle_registration?: string;
  mileage_at_claim?: number;
}


interface ClaimsAgeMileageAnalyticsProps {
  claims: ClaimData[];
}

interface CustomerVehicle {
  registration_plate: string;
  vehicle_year: string | null;
  mileage: string | null;
}

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

const currentYear = new Date().getFullYear();

const COLORS_AGE = ['#10b981', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#dc2626'];
const COLORS_MILEAGE = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#f97316', '#ef4444', '#dc2626', '#991b1b'];

export const ClaimsAgeMileageAnalytics: React.FC<ClaimsAgeMileageAnalyticsProps> = ({ claims }) => {
  const [vehicleMap, setVehicleMap] = useState<Map<string, CustomerVehicle>>(new Map());

  useEffect(() => {
    const regs = Array.from(new Set(
      claims.map(c => c.vehicle_registration?.toUpperCase()).filter(Boolean)
    )) as string[];
    if (regs.length === 0) return;

    const fetchVehicles = async () => {
      const { data } = await supabase
        .from('customers')
        .select('registration_plate, vehicle_year, mileage')
        .in('registration_plate', regs);

      if (data) {
        const map = new Map<string, CustomerVehicle>();
        data.forEach(v => {
          if (v.registration_plate) map.set(v.registration_plate.toUpperCase(), v as CustomerVehicle);
        });
        setVehicleMap(map);
      }
    };
    fetchVehicles();
  }, [claims]);

  // --- Vehicle Age analytics ---
  const ageData = useMemo(() => {
    const bands = AGE_BANDS.map(b => ({ ...b, claims: 0, totalCost: 0, paidCount: 0, totalClaimed: 0 }));

    claims.forEach(c => {
      const reg = c.vehicle_registration?.toUpperCase();
      const info = reg ? vehicleMap.get(reg) : null;
      const yearStr = info?.vehicle_year;
      if (!yearStr) return;
      const year = parseInt(yearStr, 10);
      if (isNaN(year) || year < 1950) return;
      const age = currentYear - year;

      const band = bands.find(b => age >= b.min && age <= b.max);
      if (band) {
        band.claims++;
        band.totalClaimed += claimedCost(c);
        const paid = settledCost(c);
        if (paid > 0) {
          band.totalCost += paid;
          band.paidCount++;
        }
      }
    });

    return bands.map(b => ({
      band: b.label,
      claims: b.claims,
      totalCost: Math.round(b.totalCost),
      totalClaimed: Math.round(b.totalClaimed),
      avgCost: b.paidCount > 0 ? Math.round(b.totalCost / b.paidCount) : 0,
      costPerClaim: b.claims > 0 ? Math.round(b.totalCost / b.claims) : 0,
      paidCount: b.paidCount,
    }));
  }, [claims, vehicleMap]);



  // --- Mileage analytics ---
  const mileageData = useMemo(() => {
    const bands = MILEAGE_BANDS.map(b => ({ ...b, claims: 0, totalCost: 0, paidCount: 0, totalClaimed: 0 }));

    claims.forEach(c => {
      const reg = c.vehicle_registration?.toUpperCase();
      const info = reg ? vehicleMap.get(reg) : null;
      const miles = c.mileage_at_claim || (info?.mileage ? parseInt(info.mileage.replace(/\D/g, ''), 10) : null);
      if (!miles || isNaN(miles)) return;

      const band = bands.find(b => miles >= b.min && miles <= b.max);
      if (band) {
        band.claims++;
        band.totalClaimed += claimedCost(c);
        const paid = settledCost(c);
        if (paid > 0) {
          band.totalCost += paid;
          band.paidCount++;
        }
      }
    });

    return bands.map(b => ({
      band: b.label,
      claims: b.claims,
      totalCost: Math.round(b.totalCost),
      totalClaimed: Math.round(b.totalClaimed),
      avgCost: b.paidCount > 0 ? Math.round(b.totalCost / b.paidCount) : 0,

      costPerClaim: b.claims > 0 ? Math.round(b.totalCost / b.claims) : 0,
      paidCount: b.paidCount,
    }));
  }, [claims, vehicleMap]);


  const hasAgeData = ageData.some(d => d.claims > 0);
  const hasMileageData = mileageData.some(d => d.claims > 0);

  if (!hasAgeData && !hasMileageData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No vehicle age or mileage data available yet. Data will appear once claims are linked to customer vehicles with year/mileage information.
        </CardContent>
      </Card>
    );
  }

  // Find insights.
  // Cost comparisons only use bands with enough settled claims to be meaningful,
  // so a band with 1–2 payouts can never be crowned "costliest".
  const MIN_SETTLED = 5;
  const pickCostliest = (rows: typeof ageData) => {
    const reliable = rows.filter(d => d.paidCount >= MIN_SETTLED);
    const pool = reliable.length > 0 ? reliable : rows.filter(d => d.paidCount > 0);
    const winner = [...pool].sort((a, b) => b.avgCost - a.avgCost)[0];
    return winner ? { ...winner, lowSample: winner.paidCount < MIN_SETTLED } : undefined;
  };

  const mostClaimsAge = [...ageData].sort((a, b) => b.claims - a.claims)[0];
  const leastClaimsAge = [...ageData].filter(d => d.claims > 0).sort((a, b) => a.claims - b.claims)[0];
  const costliestAge = pickCostliest(ageData);
  const mostClaimsMileage = [...mileageData].sort((a, b) => b.claims - a.claims)[0];
  const leastClaimsMileage = [...mileageData].filter(d => d.claims > 0).sort((a, b) => a.claims - b.claims)[0];
  const costliestMileage = pickCostliest(mileageData);


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-orange-500" />
        <h3 className="text-lg font-semibold">Claims by Vehicle Age & Mileage</h3>
        <Badge variant="secondary" className="text-xs">Marketing Insights</Badge>
      </div>

      <p className="text-xs text-muted-foreground -mt-4">
        Claim counts include every claim. Cost figures use only the amount actually settled on approved and paid
        claims — garage quotes on declined, appealed or still-open claims are excluded, because those were never
        paid. That is why total paid divided by claim count will not equal the average per settled claim, and why
        volume and cost are separate measures: a band can have very few claims while another has the highest
        average payout.
      </p>

      {/* Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mostClaimsAge && mostClaimsAge.claims > 0 && (
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-500" />
                Most Claims by Age
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{mostClaimsAge.band}</p>
              <p className="text-xs text-muted-foreground">
                {mostClaimsAge.claims} claims · £{mostClaimsAge.totalCost.toLocaleString()} paid across {mostClaimsAge.paidCount} settled
              </p>
              <p className="text-xs text-muted-foreground">£{mostClaimsAge.costPerClaim.toLocaleString()} per claim overall</p>
            </CardContent>
          </Card>
        )}

        {leastClaimsAge && leastClaimsAge.claims > 0 && leastClaimsAge.band !== mostClaimsAge?.band && (
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-500" />
                Fewest Claims by Age
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{leastClaimsAge.band}</p>
              <p className="text-xs text-muted-foreground">
                {leastClaimsAge.claims} claims · lowest volume, not necessarily lowest cost
              </p>
            </CardContent>
          </Card>
        )}

        {costliestAge && costliestAge.avgCost > 0 && (
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                Highest Average Payout by Age
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{costliestAge.band}</p>
              <p className="text-xs text-muted-foreground">
                £{costliestAge.avgCost.toLocaleString()} average across {costliestAge.paidCount} settled claims
              </p>
              {costliestAge.lowSample && (
                <p className="text-xs text-amber-600">Small sample — treat as indicative only</p>
              )}
            </CardContent>
          </Card>
        )}

        {mostClaimsMileage && mostClaimsMileage.claims > 0 && (
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                Most Claims by Mileage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{mostClaimsMileage.band}</p>
              <p className="text-xs text-muted-foreground">
                {mostClaimsMileage.claims} claims · £{mostClaimsMileage.totalCost.toLocaleString()} paid across {mostClaimsMileage.paidCount} settled
              </p>
              <p className="text-xs text-muted-foreground">£{mostClaimsMileage.costPerClaim.toLocaleString()} per claim overall</p>
            </CardContent>
          </Card>
        )}

        {leastClaimsMileage && leastClaimsMileage.claims > 0 && leastClaimsMileage.band !== mostClaimsMileage?.band && (
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-500" />
                Fewest Claims by Mileage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{leastClaimsMileage.band}</p>
              <p className="text-xs text-muted-foreground">
                {leastClaimsMileage.claims} claims · lowest volume, not necessarily lowest cost
              </p>
            </CardContent>
          </Card>
        )}

        {costliestMileage && costliestMileage.avgCost > 0 && (
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                Highest Average Payout by Mileage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{costliestMileage.band}</p>
              <p className="text-xs text-muted-foreground">
                £{costliestMileage.avgCost.toLocaleString()} average across {costliestMileage.paidCount} settled claims
              </p>
              {costliestMileage.lowSample && (
                <p className="text-xs text-amber-600">Small sample — treat as indicative only</p>
              )}
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
              Claims by Vehicle Age
            </CardTitle>
            <CardDescription>
              Which age bands generate the most claims and cost — older vehicles typically have more and costlier repairs
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
                    name.includes('£') || name.includes('Cost') ? `£${value.toLocaleString()}` : value
                  }
                />
                <Legend />
                <Bar yAxisId="left" dataKey="claims" name="Total Claims" radius={[4, 4, 0, 0]}>
                  {ageData.map((_, i) => (
                    <Cell key={i} fill={COLORS_AGE[i % COLORS_AGE.length]} />
                  ))}
                </Bar>
                <Bar yAxisId="right" dataKey="totalCost" fill="#3b82f6" name="Total Cost (£)" radius={[4, 4, 0, 0]} />
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
              Claims by Mileage Band
            </CardTitle>
            <CardDescription>
              How mileage correlates with claim frequency and repair cost — identify high-risk mileage segments
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
                    name.includes('£') || name.includes('Cost') ? `£${value.toLocaleString()}` : value
                  }
                />
                <Legend />
                <Bar yAxisId="left" dataKey="claims" name="Total Claims" radius={[4, 4, 0, 0]}>
                  {mileageData.map((_, i) => (
                    <Cell key={i} fill={COLORS_MILEAGE[i % COLORS_MILEAGE.length]} />
                  ))}
                </Bar>
                <Bar yAxisId="right" dataKey="totalCost" fill="#f97316" name="Total Cost (£)" radius={[4, 4, 0, 0]} />
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
              <CardDescription className="text-xs">Avg payout = total paid ÷ settled claims. Per claim = total paid ÷ all claims.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <div className="grid grid-cols-5 text-xs font-medium text-muted-foreground border-b pb-1">
                  <span>Age</span><span className="text-right">Claims</span><span className="text-right">Settled</span><span className="text-right">Total Paid</span><span className="text-right">Avg Payout</span>
                </div>
                {ageData.filter(d => d.claims > 0).map(d => (
                  <div key={d.band} className="grid grid-cols-5 text-sm">
                    <span className="font-medium">{d.band}</span>
                    <span className="text-right">{d.claims}</span>
                    <span className="text-right">{d.paidCount}</span>
                    <span className="text-right">£{d.totalCost.toLocaleString()}</span>
                    <span className={`text-right ${d.avgCost > 500 ? 'text-red-600 font-medium' : ''}`}>£{d.avgCost.toLocaleString()}</span>
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
              <CardDescription className="text-xs">Avg payout = total paid ÷ settled claims. Per claim = total paid ÷ all claims.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <div className="grid grid-cols-5 text-xs font-medium text-muted-foreground border-b pb-1">
                  <span>Mileage</span><span className="text-right">Claims</span><span className="text-right">Settled</span><span className="text-right">Total Paid</span><span className="text-right">Avg Payout</span>
                </div>
                {mileageData.filter(d => d.claims > 0).map(d => (
                  <div key={d.band} className="grid grid-cols-5 text-sm">
                    <span className="font-medium">{d.band}</span>
                    <span className="text-right">{d.claims}</span>
                    <span className="text-right">{d.paidCount}</span>
                    <span className="text-right">£{d.totalCost.toLocaleString()}</span>
                    <span className={`text-right ${d.avgCost > 500 ? 'text-red-600 font-medium' : ''}`}>£{d.avgCost.toLocaleString()}</span>
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
