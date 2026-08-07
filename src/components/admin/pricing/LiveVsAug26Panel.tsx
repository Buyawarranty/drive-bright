import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { GitCompare, Info, Loader2 } from 'lucide-react';
import PriceTestStep2 from './PriceTestStep2';
import PriceDiffBanner from './PriceDiffBanner';
import type { PriceTestQuoteSnapshot } from './PriceTestStep2';
import SectionPushLiveBar from './SectionPushLiveBar';
import RegLookupBar, { type ResolvedTestVehicle } from './RegLookupBar';
import { useSavedPricingModel } from './useSavedPricingModel';
import { usePricingVersions } from '@/hooks/usePricingVersions';


/**
 * LIVE AGE-BASED BUILDER vs AUG26 PRICING
 * Two Step 2 replicas side by side — the left one priced with the figures in the
 * Age-based builder (live), the right one with the factors stored on a saved
 * pricing version. Both are read-only sandboxes: nothing saves or goes live.
 */

/** Turn a saved pricing version into the shape PriceTestStep2 expects, keeping
 *  the live builder's band keys/labels so both columns offer the same profile. */
function versionToModel(version: any | null, saved: ReturnType<typeof useSavedPricingModel>) {
  if (!version) return null;
  const vfm = version.vehicle_factor_model;

  const bands = vfm?.bands?.length
    ? saved.ageBands.map((b: any) => {
        const match = vfm.bands.find((x: any) => String(x.key) === String(b.key));
        return match ? { ...b, oneYear: match.oneYear } : b;
      })
    : saved.ageBands;

  const mileageBands = vfm?.mileageBands?.length
    ? saved.mileageBands.map((b: any) => {
        const match = vfm.mileageBands.find(
          (x: any) => Number(x.min) === Number(b.min) && (x.max ?? null) === (b.max ?? null)
        );
        return match ? { ...b, factor: match.factor } : b;
      })
    : saved.mileageBands;

  const powertrains = vfm?.powertrains?.length
    ? saved.powertrains.map((p: any) => {
        const match = vfm.powertrains.find((x: any) => String(x.key) === String(p.key));
        return match ? { ...p, factor: match.factor } : p;
      })
    : saved.powertrains;

  const vehicleTypes = vfm?.vehicleTypes?.length
    ? saved.vehicleTypes.map((t: any) => {
        const match = vfm.vehicleTypes.find((x: any) => String(x.key) === String(t.key));
        return match ? { ...t, factor: match.factor } : t;
      })
    : saved.vehicleTypes;

  const claimLimits = version.claim_limit_factors?.length
    ? version.claim_limit_factors.map((c: any) => {
        const existing = saved.claimLimits.find((x: any) => x.limit === c.limit);
        return { key: existing?.key ?? `cl-${c.limit}`, limit: c.limit, factor: Number(c.factor) };
      })
    : saved.claimLimits;

  const labourRates = version.labour_rate_factors?.length
    ? version.labour_rate_factors.map((l: any) => {
        const existing = saved.labourRateFactors.find((x: any) => x.rate === l.rate);
        return {
          key: existing?.key ?? `lr-${l.rate}`,
          rate: l.rate,
          factor: Number(l.factor),
          uxPosition: l.label ?? existing?.uxPosition ?? '',
        };
      })
    : saved.labourRateFactors;

  return {
    bands,
    mileageBands,
    powertrains,
    vehicleTypes,
    modelRisks: saved.modelRisks,
    modelFloors: saved.modelFloors,
    claimLimits,
    labourRates,
    excessFactors: saved.excessFactors,
    twoYearMult: saved.twoYearMult,
    threeYearMult: saved.threeYearMult,
    payInFullFactor: saved.payInFullFactor,
  };
}

const LiveVsAug26Panel: React.FC<{
  liveModel?: any;
  liveLabel?: string | null;
  busy?: boolean;
  onPushModel?: (model: any, label: string, websiteDiscountPct?: number) => void | Promise<void>;
}> = ({ liveModel, liveLabel, busy, onPushModel }) => {
  const saved = useSavedPricingModel();
  const { versions, loading } = usePricingVersions();
  const [versionId, setVersionId] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<ResolvedTestVehicle | null>(null);
  const [leftQuote, setLeftQuote] = useState<PriceTestQuoteSnapshot | null>(null);
  const [rightQuote, setRightQuote] = useState<PriceTestQuoteSnapshot | null>(null);


  const preferred = useMemo(
    () => versions.find(v => v.status === 'live') ?? versions[0] ?? null,
    [versions]
  );

  useEffect(() => {
    if (!versionId && preferred) setVersionId(preferred.id);
  }, [preferred, versionId]);

  const selected = versions.find(v => v.id === versionId) ?? preferred;
  const aug26Model = useMemo(() => versionToModel(selected, saved), [selected, saved]);

  return (
    <div className="space-y-4">
      <SectionPushLiveBar
        sectionLabel="Live vs Aug 2026"
        liveLabel={liveLabel}
        busy={busy}
        onPush={onPushModel}
        candidates={[
          {
            key: 'live',
            label: 'Live builder figures (left)',
            description: 'Republishes the current live builder figures unchanged.',
            getModel: () => liveModel,
          },
          {
            key: 'aug26',
            label: 'Aug 2026 pricing (right)',
            description: 'Publishes the selected Aug 2026 saved version.',
            getModel: () => aug26Model,
          },
        ]}
      />
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <GitCompare className="h-5 w-5" />
            Live builder vs Aug26 pricing
          </CardTitle>
          <CardDescription>
            The same Step 2 quote screen twice — left priced with the live Age-based builder figures,
            right priced with a saved pricing version. Change any variable on either side to see the
            effect. Nothing here saves a quote or changes live prices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Left column = the live Age-based builder.</strong> Edit its figures in the
              builder below and the left column follows straight away; it only reaches customers once
              you press <strong>“Save &amp; push this model live”</strong> there.{' '}
              <strong>Right column = a saved pricing version (draft)</strong> — it is for comparison
              only and can never go live from this screen. To adopt it, open{' '}
              <strong>Aug26 pricing → Copy to new draft</strong>, then publish it from the{' '}
              <strong>Price grid</strong> tab.
            </AlertDescription>
          </Alert>

          <RegLookupBar onResolved={setVehicle} />

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Compare against</Label>
              <select
                className="mt-1 h-9 min-w-[260px] rounded-md border bg-background px-2 text-sm"
                value={versionId ?? ''}
                onChange={e => setVersionId(e.target.value)}
              >
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.label} ({v.status})
                  </option>
                ))}
              </select>
            </div>
            {loading && (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading pricing versions…
              </span>
            )}
            {selected?.effective_date && (
              <Badge variant="outline">Effective {selected.effective_date}</Badge>
            )}
            <Badge variant="outline">Web gap {selected?.step3_discount_pct ?? 10}%</Badge>
          </div>
        </CardContent>
      </Card>

      <PriceDiffBanner
        baseline={leftQuote}
        baselineLabel="Live age-based builder"
        candidate={rightQuote}
        candidateLabel="Saved Aug 2026 version"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <PriceTestStep2
          onQuoteChange={setLeftQuote}
          liveModel={liveModel}
          vehicle={vehicle}
          showRegLookup={false}
          title="Live age-based builder — Step 2"
          subtitle="Priced with the figures currently in the Age-based builder below."
          badgeText="Live builder"
        />
        {aug26Model ? (
          <PriceTestStep2
            onQuoteChange={setRightQuote}
            liveModel={aug26Model}
            vehicle={vehicle}
            showRegLookup={false}
            title={`${selected?.label ?? 'Aug26 pricing'} — Step 2`}
            subtitle="Priced with the age, mileage, claim-limit and labour factors stored on this saved version."
            badgeText="Saved version"
          />
        ) : (
          <Card className="border-2 border-dashed">
            <CardHeader>
              <CardTitle className="text-base">No saved pricing version yet</CardTitle>
              <CardDescription>
                Save or publish a version in the Price grid tab and it will appear here for comparison.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

    </div>
  );
};

export default LiveVsAug26Panel;
