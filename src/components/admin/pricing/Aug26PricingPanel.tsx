import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarClock, Copy, History, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  usePricingVersions,
  buildCodeAdminMatrix,
  PERIODS,
  EXCESSES,
  CLAIM_LIMITS,
  type PricingVersion,
} from '@/hooks/usePricingVersions';
import { resolvePriceFloors, CODE_PRICE_FLOORS } from '@/lib/pricing/pricingVersionConfig';
import { clampToNetFloor } from '@/lib/pricing/netFloor';
import PriceSurfaceBadge from './PriceSurfaceBadge';



const PERIOD_LABEL: Record<string, string> = {
  '12months': '12 months',
  '24months': '24 months',
  '36months': '36 months',
};

const money = (n: number | undefined) => (typeof n === 'number' ? `£${Math.round(n)}` : '—');

const statusVariant = (status: PricingVersion['status']) =>
  status === 'live' ? 'default' : status === 'draft' ? 'secondary' : 'outline';

/**
 * Aug26 pricing — the current pricing version front and centre, with every older
 * version kept alongside it so a previous grid can always be inspected or re-drafted.
 */
const Aug26PricingPanel: React.FC = () => {
  const { versions, loading, createVersion } = usePricingVersions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  const live = useMemo(() => versions.find((v) => v.status === 'live') ?? null, [versions]);
  const preferred = live ?? versions[0] ?? null;

  useEffect(() => {
    if (!selectedId && preferred) setSelectedId(preferred.id);
  }, [preferred, selectedId]);

  const selected = versions.find((v) => v.id === selectedId) ?? preferred;
  const matrix = selected?.admin_matrix ?? buildCodeAdminMatrix();
  const webDiscount = selected?.step3_discount_pct ?? 10;
  /**
   * Net sell floor for this version. `resolvePriceFloors` clamps to the agreed
   * £349 / £576 / £821 bottom (cheapest option combo), so an older version saved
   * with a lower figure is displayed — and priced — at the current floor.
   */
  const floors = useMemo(
    () => resolvePriceFloors({ price_floors: selected?.price_floors ?? null } as any),
    [selected?.price_floors],
  );
  const floorWasRaised = (PERIODS as readonly string[]).some(
    (p) => Number((selected?.price_floors as any)?.[p] ?? 0) > 0 &&
      Number((selected?.price_floors as any)?.[p]) < (CODE_PRICE_FLOORS as any)[p],
  );

  const duplicate = async () => {
    if (!selected) return;
    setDuplicating(true);
    try {
      const stamp = new Date().toLocaleDateString('en-GB');
      await createVersion(
        `Aug26 pricing — copy of ${selected.label} (${stamp})`,
        selected.admin_matrix,
        selected.step3_discount_pct,
        `Duplicated from "${selected.label}" for editing. Original kept untouched.`,
        selected.claim_limit_factors ?? null,
        selected.labour_rate_factors ?? null,
        selected.vehicle_factor_model ?? null,
        {
          reference_vehicle: selected.reference_vehicle ?? null,
          reference_factors: selected.reference_factors ?? null,
          price_floors: selected.price_floors ?? null,
          price_caps: selected.price_caps ?? null,
          rounding_rule: selected.rounding_rule ?? null,
          effective_date: selected.effective_date ?? null,
        } as any
      );
      toast.success('Copied to a new draft — nothing went live');
    } catch (e: any) {
      toast.error(e?.message || 'Could not duplicate this version');
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CalendarClock className="h-5 w-5" />
                Aug26 pricing
              </CardTitle>
              <CardDescription>
                The pricing grid in force now, with every earlier version kept below so older prices can
                still be checked or copied into a new draft.
              </CardDescription>
            </div>
            <PriceSurfaceBadge surface="quotes" />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Viewing only — nothing here changes live prices. Website (Step 3/4) prices are{' '}
              {webDiscount}% below the figures shown. No warranty may be sold under the net floor of{' '}
              £{floors['12months']} / £{floors['24months']} / £{floors['36months']} (12 / 24 / 36 months,
              halved for motorbikes, shaped up by claim limit, labour rate and excess).
              {floorWasRaised && (
                <span className="mt-1 block font-semibold text-amber-600">
                  This version was saved with older, lower floors — they are shown and applied at the
                  current net floor.
                </span>
              )}
            </AlertDescription>
          </Alert>

          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading pricing versions…
            </p>
          )}

          {selected && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{selected.label}</span>
              <Badge variant={statusVariant(selected.status)} className="capitalize">
                {selected.status}
              </Badge>
              {selected.effective_date && (
                <Badge variant="outline">Effective {selected.effective_date}</Badge>
              )}
              <Badge variant="outline">Web gap {webDiscount}%</Badge>
              <Button size="sm" variant="outline" onClick={duplicate} disabled={duplicating}>
                <Copy className="mr-2 h-4 w-4" />
                Copy to new draft
              </Button>
            </div>
          )}

          <div className="space-y-6">
            {PERIODS.map((period) => (
              <div key={period} className="space-y-2">
                <h4 className="text-sm font-semibold">{PERIOD_LABEL[period]}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/60">
                        <th className="border p-2 text-left">Voluntary excess</th>
                        {CLAIM_LIMITS.map((limit) => (
                          <th key={limit} className="border p-2 text-right">
                            £{limit.toLocaleString()} claim limit
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {EXCESSES.map((excess) => (
                        <tr key={excess}>
                          <td className="border p-2 font-medium">£{excess}</td>
                          {CLAIM_LIMITS.map((limit) => {
                            const cell = matrix?.[period]?.[String(excess)]?.[String(limit)];
                            // PERMANENT floor: shaped per claim limit / excess, so
                            // every cell of every version shows a sellable price.
                            const floor = clampToNetFloor(0, {
                              paymentPeriod: period as any,
                              voluntaryExcess: excess,
                              claimLimit: limit,
                            });
                            const underFloor = typeof cell === 'number' && cell < floor;
                            return (
                              <td
                                key={limit}
                                className={`border p-2 text-right tabular-nums ${
                                  underFloor ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30' : ''
                                }`}
                                title={
                                  underFloor
                                    ? `Grid cell £${Math.round(cell as number)} is below the £${floor} minimum sellable price — it can only ever be sold at £${floor}.`
                                    : undefined
                                }
                              >
                                {money(underFloor ? floor : cell)}
                                {underFloor && (
                                  <span className="ml-1 text-[10px] font-semibold">
                                    floor
                                  </span>
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
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Version history ({versions.length})
          </CardTitle>
          <CardDescription>Select any version to view its grid above. Nothing is deleted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {versions.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">
              No saved versions yet — the grid above is the code default.
            </p>
          )}
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedId(v.id)}
              className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${
                v.id === selected?.id ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{v.label}</span>
                <Badge variant={statusVariant(v.status)} className="capitalize">
                  {v.status}
                </Badge>
              </span>
              <span className="text-xs text-muted-foreground">
                {v.published_at
                  ? `Published ${new Date(v.published_at).toLocaleDateString('en-GB')}`
                  : `Created ${new Date(v.created_at).toLocaleDateString('en-GB')}`}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Aug26PricingPanel;
