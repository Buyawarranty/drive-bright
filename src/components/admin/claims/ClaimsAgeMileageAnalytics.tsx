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
  const pickMostPaid = (rows: typeof ageData) =>
    [...rows].filter(d => d.totalCost > 0).sort((a, b) => b.totalCost - a.totalCost)[0];

  const mostClaimsAge = [...ageData].sort((a, b) => b.claims - a.claims)[0];
  const leastClaimsAge = [...ageData].filter(d => d.claims > 0).sort((a, b) => a.claims - b.claims)[0];
  const costliestAge = pickCostliest(ageData);
  const mostPaidAge = pickMostPaid(ageData);
  const mostClaimsMileage = [...mileageData].sort((a, b) => b.claims - a.claims)[0];
  const leastClaimsMileage = [...mileageData].filter(d => d.claims > 0).sort((a, b) => a.claims - b.claims)[0];
  const costliestMileage = pickCostliest(mileageData);
  const mostPaidMileage = pickMostPaid(mileageData);

  const totalClaims = ageData.reduce((s, d) => s + d.claims, 0) + 0;
  const totalPaid = ageData.reduce((s, d) => s + d.totalCost, 0);
  const totalSettled = ageData.reduce((s, d) => s + d.paidCount, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-orange-500" />
        <h3 className="text-lg font-semibold">Claims by Vehicle Age & Mileage</h3>
        <Badge variant="secondary" className="text-xs">Marketing Insights</Badge>
      </div>

      <p className="text-xs text-muted-foreground -mt-6">
        These are two separate measures and they are reported separately below. <strong>Claims made</strong> counts
        every claim submitted, whatever the outcome. <strong>Claims paid out</strong> counts only money actually
        settled on approved and paid claims — garage quotes on declined, appealed or still-open claims are excluded.
        A band can be top for volume and near the bottom for payout, and vice versa.
      </p>

      {/* ============ SECTION 1: CLAIMS MADE (VOLUME) ============ */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-l-4 border-l-slate-400 pl-3">
          <h4 className="text-base font-semibold">1. Claims made (volume)</h4>
          <Badge variant="outline" className="text-xs">Every claim submitted · {totalClaims} with age data</Badge>
        </div>
        <p className="text-xs text-muted-foreground pl-3">
          Outcome is ignored here on purpose — declined and open claims still tell you where claims come from.
          No money figures appear in this section.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mostClaimsAge && mostClaimsAge.claims > 0 && (
            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-red-500" />
                  Most claims by age
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{mostClaimsAge.band}</p>
                <p className="text-xs text-muted-foreground">{mostClaimsAge.claims} claims submitted</p>
              </CardContent>
            </Card>
          )}

          {leastClaimsAge && leastClaimsAge.claims > 0 && leastClaimsAge.band !== mostClaimsAge?.band && (
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  Fewest claims by age
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{leastClaimsAge.band}</p>
                <p className="text-xs text-muted-foreground">{leastClaimsAge.claims} claims submitted</p>
              </CardContent>
            </Card>
          )}

          {mostClaimsMileage && mostClaimsMileage.claims > 0 && (
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                  Most claims by mileage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{mostClaimsMileage.band}</p>
                <p className="text-xs text-muted-foreground">{mostClaimsMileage.claims} claims submitted</p>
              </CardContent>
            </Card>
          )}

          {leastClaimsMileage && leastClaimsMileage.claims > 0 && leastClaimsMileage.band !== mostClaimsMileage?.band && (
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-blue-500" />
                  Fewest claims by mileage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{leastClaimsMileage.band}</p>
                <p className="text-xs text-muted-foreground">{leastClaimsMileage.claims} claims submitted</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {hasAgeData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  Claims made by vehicle age
                </CardTitle>
                <CardDescription>Claim count only — no cost in this chart</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="claims" name="Claims made" radius={[4, 4, 0, 0]}>
                      {ageData.map((_, i) => (
                        <Cell key={i} fill={COLORS_AGE[i % COLORS_AGE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {hasMileageData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-blue-500" />
                  Claims made by mileage band
                </CardTitle>
                <CardDescription>Claim count only — no cost in this chart</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mileageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="claims" name="Claims made" radius={[4, 4, 0, 0]}>
                      {mileageData.map((_, i) => (
                        <Cell key={i} fill={COLORS_MILEAGE[i % COLORS_MILEAGE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {hasAgeData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Claims made — age bands</CardTitle>
                <CardDescription className="text-xs">Share of all claims with a known vehicle year</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground border-b pb-1">
                    <span>Age</span><span className="text-right">Claims made</span><span className="text-right">Share</span>
                  </div>
                  {ageData.filter(d => d.claims > 0).map(d => (
                    <div key={d.band} className="grid grid-cols-3 text-sm">
                      <span className="font-medium">{d.band}</span>
                      <span className="text-right">{d.claims}</span>
                      <span className="text-right text-muted-foreground">
                        {totalClaims > 0 ? Math.round((d.claims / totalClaims) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {hasMileageData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Claims made — mileage bands</CardTitle>
                <CardDescription className="text-xs">Share of all claims with a known mileage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground border-b pb-1">
                    <span>Mileage</span><span className="text-right">Claims made</span><span className="text-right">Share</span>
                  </div>
                  {(() => {
                    const totalMileageClaims = mileageData.reduce((s, d) => s + d.claims, 0);
                    return mileageData.filter(d => d.claims > 0).map(d => (
                      <div key={d.band} className="grid grid-cols-3 text-sm">
                        <span className="font-medium">{d.band}</span>
                        <span className="text-right">{d.claims}</span>
                        <span className="text-right text-muted-foreground">
                          {totalMileageClaims > 0 ? Math.round((d.claims / totalMileageClaims) * 100) : 0}%
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* ============ SECTION 2: CLAIMS PAID OUT (MONEY) ============ */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-l-4 border-l-amber-500 pl-3">
          <h4 className="text-base font-semibold">2. Claims paid out (settled money)</h4>
          <Badge variant="outline" className="text-xs">
            £{Math.round(totalPaid).toLocaleString()} paid across {totalSettled} settled claims
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground pl-3">
          Approved and paid claims only. Declined, appealed and open claims are excluded entirely, so nothing here
          can be compared one-to-one with the volume figures above.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mostPaidAge && (
            <Card className="border-l-4 border-l-rose-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-rose-500" />
                  Most paid out by age
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{mostPaidAge.band}</p>
                <p className="text-xs text-muted-foreground">
                  £{mostPaidAge.totalCost.toLocaleString()} across {mostPaidAge.paidCount} settled claims
                </p>
              </CardContent>
            </Card>
          )}

          {costliestAge && costliestAge.avgCost > 0 && (
            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  Highest average payout by age
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

          {mostPaidMileage && (
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  Most paid out by mileage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{mostPaidMileage.band}</p>
                <p className="text-xs text-muted-foreground">
                  £{mostPaidMileage.totalCost.toLocaleString()} across {mostPaidMileage.paidCount} settled claims
                </p>
              </CardContent>
            </Card>
          )}

          {costliestMileage && costliestMileage.avgCost > 0 && (
            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-yellow-600" />
                  Highest average payout by mileage
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {hasAgeData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  Paid out by vehicle age
                </CardTitle>
                <CardDescription>Total settled spend and average payout per settled claim</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} />
                    <Tooltip formatter={(value: number) => `£${value.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="totalCost" fill="#ef4444" name="Total paid (£)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avgCost" fill="#3b82f6" name="Avg payout (£)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {hasMileageData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-amber-500" />
                  Paid out by mileage band
                </CardTitle>
                <CardDescription>Total settled spend and average payout per settled claim</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mileageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} />
                    <Tooltip formatter={(value: number) => `£${value.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="totalCost" fill="#f97316" name="Total paid (£)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avgCost" fill="#3b82f6" name="Avg payout (£)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {hasAgeData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Paid out — age bands</CardTitle>
                <CardDescription className="text-xs">Avg payout = total paid ÷ settled claims</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-4 text-xs font-medium text-muted-foreground border-b pb-1">
                    <span>Age</span><span className="text-right">Settled</span><span className="text-right">Total paid</span><span className="text-right">Avg payout</span>
                  </div>
                  {ageData.filter(d => d.paidCount > 0).map(d => (
                    <div key={d.band} className="grid grid-cols-4 text-sm">
                      <span className="font-medium">{d.band}</span>
                      <span className="text-right">{d.paidCount}</span>
                      <span className="text-right">£{d.totalCost.toLocaleString()}</span>
                      <span className={`text-right ${d.avgCost > 500 ? 'text-red-600 font-medium' : ''}`}>£{d.avgCost.toLocaleString()}</span>
                    </div>
                  ))}
                  {ageData.every(d => d.paidCount === 0) && (
                    <p className="text-xs text-muted-foreground pt-2">No settled claims in this view yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {hasMileageData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Paid out — mileage bands</CardTitle>
                <CardDescription className="text-xs">Avg payout = total paid ÷ settled claims</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-4 text-xs font-medium text-muted-foreground border-b pb-1">
                    <span>Mileage</span><span className="text-right">Settled</span><span className="text-right">Total paid</span><span className="text-right">Avg payout</span>
                  </div>
                  {mileageData.filter(d => d.paidCount > 0).map(d => (
                    <div key={d.band} className="grid grid-cols-4 text-sm">
                      <span className="font-medium">{d.band}</span>
                      <span className="text-right">{d.paidCount}</span>
                      <span className="text-right">£{d.totalCost.toLocaleString()}</span>
                      <span className={`text-right ${d.avgCost > 500 ? 'text-red-600 font-medium' : ''}`}>£{d.avgCost.toLocaleString()}</span>
                    </div>
                  ))}
                  {mileageData.every(d => d.paidCount === 0) && (
                    <p className="text-xs text-muted-foreground pt-2">No settled claims in this view yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
};

