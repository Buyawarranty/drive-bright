import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { calculateQuotePrice } from '@/lib/pricing/quotePricingService';
import type { PaymentPeriod, PricingSurface } from '@/lib/pricingMatrix';

type Vehicle = {
  make: string;
  model: string;
  fuelType: string;
  vehicleType: string;
  yearOfManufacture: string;
  registrationDate?: string | null;
  mileage: string;
};

type Props = {
  vehicle: Vehicle;
  labourRate: number;
  surface: PricingSurface;
  boostAddon: boolean;
  skipEligibility: boolean;
  excessOptions: number[];
  claimLimits: number[];
  /** Highlight the cell currently selected in the breakdown above. */
  activePeriod: PaymentPeriod;
  activeExcess: number;
  activeClaimLimit: number;
  onSelect?: (period: PaymentPeriod, excess: number, claimLimit: number) => void;
};

const PERIODS: { value: PaymentPeriod; label: string }[] = [
  { value: '12months', label: '1 year' },
  { value: '24months', label: '2 years' },
  { value: '36months', label: '3 years' },
];

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export default function PriceMatrixExplorer({
  vehicle,
  labourRate,
  surface,
  boostAddon,
  skipEligibility,
  excessOptions,
  claimLimits,
  activePeriod,
  activeExcess,
  activeClaimLimit,
  onSelect,
}: Props) {
  const grid = useMemo(() => {
    return PERIODS.map((period) => ({
      period,
      rows: claimLimits.map((claimLimit) => ({
        claimLimit,
        cells: excessOptions.map((excess) => {
          const r = calculateQuotePrice({
            vehicle,
            paymentPeriod: period.value,
            voluntaryExcess: excess,
            claimLimit,
            labourRate,
            boostAddon,
            surface,
            skipEligibility,
          });
          return { excess, result: r };
        }),
      })),
    }));
  }, [vehicle, labourRate, surface, boostAddon, skipEligibility, excessOptions, claimLimits]);

  const anyBlocked = grid[0]?.rows[0]?.cells[0]?.result.blocked;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">
          Full price matrix — {vehicle.make} {vehicle.model} ({vehicle.yearOfManufacture},{' '}
          {Number(vehicle.mileage || 0).toLocaleString('en-GB')} miles)
        </CardTitle>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline">{surface === 'admin' ? 'Quotes & Orders' : 'Step 3 / 4'}</Badge>
          <Badge variant="outline">£{labourRate}/hr</Badge>
          {boostAddon && <Badge variant="outline">boost on</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {anyBlocked && !skipEligibility ? (
          <p className="text-sm text-muted-foreground">
            This vehicle is not priceable with the current settings — turn on “Skip eligibility” to
            see what it would have cost.
          </p>
        ) : (
          grid.map(({ period, rows }) => (
            <div key={period.value} className="space-y-2">
              <div className="text-sm font-semibold">{period.label}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-2 border-b font-medium text-muted-foreground">
                        Claim limit
                      </th>
                      {excessOptions.map((e) => (
                        <th
                          key={e}
                          className="text-right p-2 border-b font-medium text-muted-foreground whitespace-nowrap"
                        >
                          £{e} excess
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ claimLimit, cells }) => (
                      <tr key={claimLimit}>
                        <td className="p-2 border-b whitespace-nowrap font-medium">
                          £{claimLimit.toLocaleString('en-GB')}
                        </td>
                        {cells.map(({ excess, result }) => {
                          const isActive =
                            period.value === activePeriod &&
                            excess === activeExcess &&
                            claimLimit === activeClaimLimit;
                          const unavailable = result.blocked && !skipEligibility;
                          return (
                            <td
                              key={excess}
                              onClick={() => onSelect?.(period.value, excess, claimLimit)}
                              className={`p-2 border-b text-right tabular-nums cursor-pointer transition-colors ${
                                isActive
                                  ? 'bg-primary/10 font-semibold ring-1 ring-primary/40'
                                  : 'hover:bg-muted/60'
                              }`}
                            >
                              {unavailable ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <>
                                  {money(result.total)}
                                  {result.floorApplied && (
                                    <span
                                      className="block text-[10px] text-amber-600"
                                      title="Minimum price floor applied"
                                    >
                                      floor
                                    </span>
                                  )}
                                </>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
        <p className="text-xs text-muted-foreground">
          Draft figures from the same pricing service the breakdown above uses — nothing here is
          live. Click any cell to load it into the breakdown. “floor” means the minimum price floor
          lifted that combination.
        </p>
      </CardContent>
    </Card>
  );
}
