import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { ArrowLeftRight, GitCompare, Info } from 'lucide-react';
import PriceTestStep2, { type PriceTestQuoteSnapshot } from './PriceTestStep2';
import PriceDiffBanner from './PriceDiffBanner';
import SectionPushLiveBar from './SectionPushLiveBar';
import RegLookupBar, { type ResolvedTestVehicle } from './RegLookupBar';
import { useSavedPricingModel } from './useSavedPricingModel';
import { usePricingVersions } from '@/hooks/usePricingVersions';
import PriceSurfaceBadge from './PriceSurfaceBadge';
import { buildCodeBaseModel } from './CodebaseVsLivePanel';
import { versionToModel } from './LiveVsAug26Panel';
import {
  HYBRID_ABSOLUTE_MIN_TOTAL,
  HYBRID_BASE_MARKER,
  HYBRID_PRICE_UPLIFT_PCT,
  upliftTermMult,
} from './AugHybridVsLivePanel';
import { Button } from '@/components/ui/button';
import SaveModelAsVersionBar from './SaveModelAsVersionBar';

/**
 * COMPARE ANY TWO MODELS
 * One sandbox that can put any two of the pricing models on this page side by
 * side (live grid, code base, Aug hybrid test, saved Aug 2026 version, the
 * vehicle risk builder figures). Read-only: nothing saves a quote or changes
 * live prices unless Push live is used above.
 */

/** Hybrid defaults, mirroring the Live Vs Test Hybrid Aug tab's starting point. */
const HYBRID_DEFAULTS = {
  referenceBandKey: '6-7',
  baseReductionPct: 20,
  riskSpread: 0.75,
  mileageSpread: 0.75,
  twoYearDiscountPct: 25,
  threeYearDiscountPct: 30,
};

const spread = (factor: number | null, amount: number) => {
  if (factor === null || factor <= 1) return factor;
  return Math.round((1 + (factor - 1) * amount) * 100) / 100;
};

function liveBaseFrom(liveModel: any, saved: ReturnType<typeof useSavedPricingModel>) {
  const use = <T,>(v: T[] | undefined, fallback: T[]) => (Array.isArray(v) && v.length ? v : fallback);
  return {
    bands: use(liveModel?.bands, saved.ageBands),
    mileageBands: use(liveModel?.mileageBands, saved.mileageBands),
    powertrains: use(liveModel?.powertrains, saved.powertrains),
    vehicleTypes: use(liveModel?.vehicleTypes, saved.vehicleTypes),
    modelRisks: use(liveModel?.modelRisks, saved.modelRisks),
    modelFloors: use(liveModel?.modelFloors, saved.modelFloors),
    claimLimits: use(liveModel?.claimLimits, saved.claimLimits),
    labourRates: use(liveModel?.labourRates, saved.labourRateFactors),
    excessFactors: use(liveModel?.excessFactors, saved.excessFactors),
    twoYearMult: Number(liveModel?.twoYearMult ?? saved.twoYearMult),
    threeYearMult: Number(liveModel?.threeYearMult ?? saved.threeYearMult),
    payInFullFactor: Number(liveModel?.payInFullFactor ?? saved.payInFullFactor),
  };
}

/** Aug hybrid test curve derived from live, with the tab's default variables. */
function buildHybridModel(live: any) {
  const referenceBand =
    live.bands.find((b: any) => String(b.key) === HYBRID_DEFAULTS.referenceBandKey) ?? live.bands[0];
  const referenceLive = Number(referenceBand?.oneYear ?? 0);
  const reduced = Math.round(referenceLive * (1 - HYBRID_DEFAULTS.baseReductionPct / 100));
  const target = Math.round(reduced * (1 + HYBRID_PRICE_UPLIFT_PCT / 100));
  const scale = referenceLive > 0 ? target / referenceLive : 1;
  return {
    ...live,
    [HYBRID_BASE_MARKER]: true,
    absoluteMinTotal: HYBRID_ABSOLUTE_MIN_TOTAL,
    bands: live.bands.map((b: any) => ({
      ...b,
      oneYear: b.oneYear === null ? null : Math.round(b.oneYear * scale),
    })),
    mileageBands: live.mileageBands.map((b: any) => ({
      ...b,
      factor: spread(b.factor, HYBRID_DEFAULTS.mileageSpread),
    })),
    modelRisks: live.modelRisks.map((r: any) => ({
      ...r,
      factor: spread(r.factor, HYBRID_DEFAULTS.riskSpread),
    })),
    twoYearMult: upliftTermMult(
      Math.round(2 * (1 - HYBRID_DEFAULTS.twoYearDiscountPct / 100) * 100) / 100,
      24
    ),
    threeYearMult: upliftTermMult(
      Math.round(3 * (1 - HYBRID_DEFAULTS.threeYearDiscountPct / 100) * 100) / 100,
      36
    ),
  };
}

const AnyModelComparePanel: React.FC<{
  liveModel?: any;
  liveLabel?: string | null;
  busy?: boolean;
  onPushModel?: (model: any, label: string, websiteDiscountPct?: number) => void | Promise<void>;
}> = ({ liveModel, liveLabel, busy, onPushModel }) => {
  const saved = useSavedPricingModel();
  const { versions } = usePricingVersions();

  const live = useMemo(() => liveBaseFrom(liveModel, saved), [liveModel, saved]);
  const codeBase = useMemo(() => buildCodeBaseModel(saved), [saved]);
  const hybrid = useMemo(() => buildHybridModel(live), [live]);

  /** Every saved pricing version becomes its own selectable option. */
  const versionOptions = useMemo(
    () =>
      versions.map(v => ({
        key: `version:${v.id}`,
        label: `${v.label} (${v.status})`,
        getModel: () => versionToModel(v, saved),
      })),
    [versions, saved]
  );

  const options = useMemo(
    () => [
      {
        key: 'live',
        label: 'Price grid — live (this one goes live)',
        getModel: () => live,
      },
      {
        key: 'builder',
        label: 'Vehicle risk pricing model (builder figures)',
        getModel: () => liveModel ?? live,
      },
      { key: 'codebase', label: 'Code base pricing 7/2026', getModel: () => codeBase },
      { key: 'hybrid', label: 'Test Hybrid Aug', getModel: () => hybrid },
      ...versionOptions,
    ],
    [live, liveModel, codeBase, hybrid, versionOptions]
  );

  const [leftKey, setLeftKey] = useState('live');
  const [rightKey, setRightKey] = useState('hybrid');
  const [vehicle, setVehicle] = useState<ResolvedTestVehicle | null>(null);
  const [leftQuote, setLeftQuote] = useState<PriceTestQuoteSnapshot | null>(null);
  const [rightQuote, setRightQuote] = useState<PriceTestQuoteSnapshot | null>(null);

  const leftOpt = options.find(o => o.key === leftKey) ?? options[0];
  const rightOpt = options.find(o => o.key === rightKey) ?? options[1] ?? options[0];
  const leftModel = useMemo(() => leftOpt?.getModel() ?? null, [leftOpt]);
  const rightModel = useMemo(() => rightOpt?.getModel() ?? null, [rightOpt]);

  const swap = () => {
    setLeftKey(rightKey);
    setRightKey(leftKey);
  };

  return (
    <div className="space-y-4">
      <SectionPushLiveBar
        sectionLabel="Compare any two models"
        liveLabel={liveLabel}
        busy={busy}
        onPush={onPushModel}
        candidates={[
          {
            key: 'left',
            label: `${leftOpt?.label ?? 'Left'} (left)`,
            description: 'Publishes the model selected on the left, exactly as previewed.',
            getModel: () => leftModel,
          },
          {
            key: 'right',
            label: `${rightOpt?.label ?? 'Right'} (right)`,
            description: 'Publishes the model selected on the right, exactly as previewed.',
            getModel: () => rightModel,
          },
        ]}
      />

      <Card className="border-2">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <GitCompare className="h-5 w-5" />
                Compare any two models
              </CardTitle>
              <CardDescription>
                Pick any two pricing models and see the same Step 2 quote screen priced with each one.
                Sandbox only — nothing saves a quote or changes live prices.
              </CardDescription>
            </div>
            <PriceSurfaceBadge surface="mixed" />
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Test Hybrid Aug uses that tab's default variables. To flex its base reduction, spread or
              multi-year savings, open <strong>Live Vs Test Hybrid Aug</strong>.
            </AlertDescription>
          </Alert>

          <RegLookupBar onResolved={setVehicle} />

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Left model</Label>
              <select
                className="mt-1 h-9 min-w-[280px] rounded-md border bg-background px-2 text-sm"
                value={leftKey}
                onChange={e => setLeftKey(e.target.value)}
              >
                {options.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
            <Button variant="outline" size="sm" onClick={swap} className="mb-[2px]">
              <ArrowLeftRight className="mr-2 h-4 w-4" /> Swap
            </Button>
            <div>
              <Label className="text-xs">Right model</Label>
              <select
                className="mt-1 h-9 min-w-[280px] rounded-md border bg-background px-2 text-sm"
                value={rightKey}
                onChange={e => setRightKey(e.target.value)}
              >
                {options.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
            {leftKey === rightKey && (
              <Badge variant="outline">Same model on both sides</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <SaveModelAsVersionBar
        sources={[
          { key: 'left', label: `${leftOpt?.label ?? 'Left'} (left)`, getModel: () => leftModel },
          { key: 'right', label: `${rightOpt?.label ?? 'Right'} (right)`, getModel: () => rightModel },
        ]}
        onSaved={id => setRightKey(`version:${id}`)}
      />

      <PriceDiffBanner
        baseline={leftQuote}
        baselineLabel={leftOpt?.label ?? 'Left'}
        candidate={rightQuote}
        candidateLabel={rightOpt?.label ?? 'Right'}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <PriceTestStep2
          onQuoteChange={setLeftQuote}
          liveModel={leftModel}
          vehicle={vehicle}
          showRegLookup={false}
          title={`${leftOpt?.label ?? 'Left'} — Quotes & Orders price`}
          subtitle="The website Step 3 price is 10% below this figure."
          badgeText="Left"
        />
        <PriceTestStep2
          onQuoteChange={setRightQuote}
          liveModel={rightModel}
          vehicle={vehicle}
          showRegLookup={false}
          title={`${rightOpt?.label ?? 'Right'} — Quotes & Orders price`}
          subtitle="The website Step 3 price is 10% below this figure."
          badgeText="Right"
        />
      </div>
    </div>
  );
};

export default AnyModelComparePanel;
