import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DistrictRow {
  district: string;
  sales: number;
  revenue: number;
  claims: number;
  claim_cost: number;
}

interface Props {
  area: string;
  town: string;
  from: string;
  to: string;
}

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export const AreaDistrictDrilldown: React.FC<Props> = ({ area, town, from, to }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['postcode-district-stats', area, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('postcode_district_stats', {
        _from: from,
        _to: to,
        _area: area,
      });
      if (error) throw error;
      return (data || []) as DistrictRow[];
    },
  });

  const rows = data || [];
  const maxSales = Math.max(1, ...rows.map((r) => Number(r.sales || 0)));
  const totalSales = rows.reduce((s, r) => s + Number(r.sales || 0), 0) || 1;

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Top contributing postcodes — {town} ({area})
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading postcode breakdown…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No postcode-level sales or claims in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-1 pr-3 text-left font-medium">Postcode</th>
                <th className="py-1 pr-3 text-left font-medium">Share of area</th>
                <th className="py-1 pr-3 text-right font-medium">Sales</th>
                <th className="py-1 pr-3 text-right font-medium">Revenue</th>
                <th className="py-1 pr-3 text-right font-medium">Avg order</th>
                <th className="py-1 pr-3 text-right font-medium">Claims</th>
                <th className="py-1 pr-3 text-right font-medium">Claim cost</th>
                <th className="py-1 pr-3 text-right font-medium">Claim rate</th>
                <th className="py-1 text-right font-medium">Net revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sales = Number(r.sales || 0);
                const revenue = Number(r.revenue || 0);
                const claims = Number(r.claims || 0);
                const claimCost = Number(r.claim_cost || 0);
                const claimRate = sales ? (claims / sales) * 100 : 0;
                const net = revenue - claimCost;
                return (
                  <tr key={r.district} className="border-t border-border/60">
                    <td className="py-1.5 pr-3 font-medium">{r.district}</td>
                    <td className="py-1.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/70"
                            style={{ width: `${(sales / maxSales) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {((sales / totalSales) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 pr-3 text-right font-semibold">{sales}</td>
                    <td className="py-1.5 pr-3 text-right">{gbp(revenue)}</td>
                    <td className="py-1.5 pr-3 text-right">{sales ? gbp(revenue / sales) : '—'}</td>
                    <td className="py-1.5 pr-3 text-right">{claims}</td>
                    <td className="py-1.5 pr-3 text-right">{claimCost ? gbp(claimCost) : '—'}</td>
                    <td
                      className={`py-1.5 pr-3 text-right ${
                        claimRate > 50 ? 'font-semibold text-red-600' : claimRate > 25 ? 'text-amber-600' : ''
                      }`}
                    >
                      {sales ? `${claimRate.toFixed(0)}%` : '—'}
                    </td>
                    <td className={`py-1.5 text-right ${net < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {gbp(net)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
