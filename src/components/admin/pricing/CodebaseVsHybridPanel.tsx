import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { FlaskConical, Info, RotateCcw } from 'lucide-react';
import {
  formatGBP,
  BASE_PRICING_MATRIX,
  DEFAULT_LABOUR_RATE_OPTIONS,
} from '@/lib/pricingMatrix';
import { EXCESSES } from '@/hooks/usePricingVersions';
import { buildCodeBaseClaimTiers } from '@/lib/pricing/codeBaseClaimTiers';
import PriceTestStep2 from './PriceTestStep2';
import PriceDiffBanner from './PriceDiffBanner';
import type { PriceTestQuoteSnapshot } from './PriceTestStep2';
import SectionPushLiveBar from './SectionPushLiveBar';
import RegLookupBar, { type ResolvedTestVehicle } from './RegLookupBar';
import { useSavedPricingModel } from './useSavedPricingModel';
import { buildAdminMatrixFromModel } from './AgeBandPricingPreview';

/**
 * CODE BASE vs TEST HYBRID AUG
 * The original July 2026 flat matrix written into the code base, side by side
 * with the August test model, in the Step 2 layout agents use. Every hybrid
 * variable is adjustable here (target price, risk / mileage spread, multi-year
 * discounts, auto-quote ceiling). Sandbox only — nothing saves a quote or
 * changes live pricing.
 */

const HYBRID_DEFAULTS = {
  referenceBandKey: '6-7',
  /** Proposal starts below the August level, which is not converting. */
  baseReductionPct: 20,
  targetReference: 0,
  riskSpread: 0.75,
  mileageSpread: 0.75,
  twoYearDiscountPct: 25,
  threeYearDiscountPct: 30,
  ceiling: 650,
  ceilingOn: true,
};

/** Compress or amplify an uplift without weakening an existing low-risk discount. */
const spread = (factor: number | null, amount: number) => {
  if (factor === null || factor <= 1) return factor;
  return Math.round((1 + (factor - 1) * amount) * 100) / 100;
};

/** The hard-coded July 2026 matrix in the shape PriceTestStep2 expects: one flat grid. */
function buildCodeBaseModel(saved: ReturnType<typeof useSavedPricingModel>) {
  const m: any = BASE_PRICING_MATRIX;
  const ref = Number(m['12months'][150][2000]);
  return {
    bands: saved.ageBands.map((b: any) => ({ ...b, oneYear: ref })),
    mileageBands: saved.mileageBands.map((b: any) => ({ ...b, factor: 1 })),
    powertrains: saved.powertrains.map((p: any) => ({ ...p, factor: 1 })),
    vehicleTypes: saved.vehicleTypes.map((t: any) => ({
      ...t,
      factor: t.key === 'motorbike' ? 0.5 : 1,
    })),
    modelRisks: saved.modelRisks.map((r: any) => ({ ...r, factor: 1 })),
    modelFloors: saved.modelFloors,
    claimLimits: buildCodeBaseClaimTiers(m, ref),
    labourRates: DEFAULT_LABOUR_RATE_OPTIONS.map(o => ({
      key: `lr-${o.rate}`,
      rate: o.rate,
      factor: o.factor,
      uxPosition: o.label ?? '',
    })),
    excessFactors: EXCESSES.map(excess => ({
      key: `ex-${excess}`,
      excess,
      factor: Number(m['12months'][excess][2000]) / ref,
    })),
    twoYearMult: Number(m['24months'][150][2000]) / ref,
    threeYearMult: Number(m['36months'][150][2000]) / ref,
    payInFullFactor: saved.payInFullFactor,
  };
}

/** Normalise the live builder model (the hybrid's starting point). */
function baseFrom(liveModel: any, saved: ReturnType<typeof useSavedPricingModel>) {
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

const CodebaseVsHybridPanel: React.FC<{
  liveModel?: any;
  liveLabel?: string | null;
  busy?: boolean;
  onPushModel?: (model: any, label: string, websiteDiscountPct?: number) => void | Promise<void>;
}> = ({ liveModel, liveLabel, busy, onPushModel }) => {
  const saved = useSavedPricingModel();
  const codeBaseModel = useMemo(() => buildCodeBaseModel(saved), [saved]);
  const base = useMemo(() => baseFrom(liveModel, saved), [liveModel, saved]);

  const [vehicle, setVehicle] = useState<ResolvedTestVehicle | null>(null);
  const [leftQuote, setLeftQuote] = useState<PriceTestQuoteSnapshot | null>(null);
  const [rightQuote, setRightQuote] = useState<PriceTestQuoteSnapshot | null>(null);
  const [cfg, setCfg] = useState(HYBRID_DEFAULTS);
  const set = <K extends keyof typeof HYBRID_DEFAULTS>(key: K, value: (typeof HYBRID_DEFAULTS)[K]) =>
    setCfg(c => ({ ...c, [key]: value }));

  const referenceBand =
    base.bands.find((b: any) => String(b.key) === cfg.referenceBandKey) ?? base.bands[0];
  const referenceLive = Number(referenceBand?.oneYear ?? 0);
  const reducedReference = Math.round(referenceLive * (1 - cfg.baseReductionPct / 100));
  const effectiveTarget = cfg.targetReference > 0 ? cfg.targetReference : reducedReference;
  const targetScale = referenceLive > 0 ? effectiveTarget / referenceLive : 1;

  /** Code-base reference for context, and its implied multi-year discounts. */
  const codeReference = Number(codeBaseModel.bands[0]?.oneYear ?? 0);
  const codeTwoYearDiscountPct = Math.round((1 - codeBaseModel.twoYearMult / 2) * 1000) / 10;
  const codeThreeYearDiscountPct = Math.round((1 - codeBaseModel.threeYearMult / 3) * 1000) / 10;

  const hybridModel = useMemo(
    () => ({
      ...base,
      bands: base.bands.map((b: any) => ({
        ...b,
        oneYear: b.oneYear === null ? null : Math.round(b.oneYear * targetScale),
      })),
      mileageBands: base.mileageBands.map((b: any) => ({
        ...b,
        factor: spread(b.factor, cfg.mileageSpread),
      })),
      modelRisks: base.modelRisks.map((r: any) => ({
        ...r,
        factor: spread(r.factor, cfg.riskSpread),
      })),
      twoYearMult: Math.round(2 * (1 - cfg.twoYearDiscountPct / 100) * 100) / 100,
      threeYearMult: Math.round(3 * (1 - cfg.threeYearDiscountPct / 100) * 100) / 100,
    }),
    [base, targetScale, cfg.mileageSpread, cfg.riskSpread, cfg.twoYearDiscountPct, cfg.threeYearDiscountPct]
  );

  const ceiling = cfg.ceilingOn ? cfg.ceiling : null;

  return (
    <div className="space-y-4">
      <SectionPushLiveBar
        sectionLabel="Code base vs Test Hybrid Aug"
        liveLabel={liveLabel}
        busy={busy}
        onPush={onPushModel}
        candidates={[
          {
            key: 'codebase',
            label: 'Code base pricing 7/2026 (left)',
            description: 'Publishes the flat July 2026 code-base grid.',
            getModel: () => codeBaseModel,
            getPreflightExtras: () => ({
              adminMatrix: buildAdminMatrixFromModel({
                ...codeBaseModel,
                refBandKey: codeBaseModel.bands[0]?.key ?? '',
                websiteDiscountPct: 10,
              } as any),
              labourRateFactors: codeBaseModel.labourRates,
            }),
          },
          {
            key: 'hybrid',
            label: 'Aug hybrid test (right)',
            description: 'Publishes the hybrid variables exactly as set above.',
            getModel: () => hybridModel,
            getPreflightExtras: () => ({
              adminMatrix: buildAdminMatrixFromModel({
                ...hybridModel,
                refBandKey: hybridModel.bands[0]?.key ?? '',
                websiteDiscountPct: 10,
              }),
              labourRateFactors: hybridModel.labourRates,
            }),
          },
        ]}
      />
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FlaskConical className="h-5 w-5" />
            Code base vs Test Hybrid Aug
          </CardTitle>
          <CardDescription>
            The original July 2026 code-base pricing against the August test model in the same Step 2
            screen. Left is the flat code-base grid (no age, mileage, powertrain or model-risk
            differentiation); right applies the hybrid variables below. Sandbox only — nothing saves a
            quote or changes live prices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              This is the like-for-like test of the two candidates: the flat July grid that sold at a lower
              average order value, versus the hybrid that starts below the August base, compresses risk and
              mileage uplifts and makes multi-year terms genuinely cheaper. Anything above the ceiling refers
              out rather than showing a price that is difficult to convert.
            </AlertDescription>
          </Alert>

          <RegLookupBar onResolved={setVehicle} />

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Hybrid variables</div>
              <Button variant="outline" size="sm" onClick={() => setCfg(HYBRID_DEFAULTS)}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reset to default
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <Label className="text-xs">Reference age band</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={cfg.referenceBandKey}
                  onChange={e => set('referenceBandKey', e.target.value)}
                >
                  {base.bands.map((b: any) => (
                    <option key={b.key} value={b.key}>{b.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  August base {referenceLive ? formatGBP(referenceLive) : '—'} · code base{' '}
                  {codeReference ? formatGBP(codeReference) : '—'}
                </p>
              </div>

              <div>
                <Label className="text-xs">Reduction from August base (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  className="mt-1 h-9"
                  value={cfg.baseReductionPct}
                  onChange={e => set('baseReductionPct', Math.min(50, Math.max(0, Number(e.target.value) || 0)))}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Target reference {effectiveTarget ? formatGBP(effectiveTarget) : '—'}
                </p>
              </div>

              <div>
                <Label className="text-xs">Exact one-year target (optional)</Label>
                <Input
                  type="number"
                  className="mt-1 h-9"
                  placeholder={reducedReference ? String(reducedReference) : 'Reduced base'}
                  value={cfg.targetReference || ''}
                  onChange={e => set('targetReference', Number(e.target.value) || 0)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Whole age curve scaled by {targetScale.toFixed(3)} — blank uses the reduction
                </p>
              </div>

              <div>
                <Label className="text-xs">Auto-quote ceiling (one-year equivalent)</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    type="number"
                    className="h-9"
                    value={cfg.ceiling}
                    disabled={!cfg.ceilingOn}
                    onChange={e => set('ceiling', Number(e.target.value) || 0)}
                  />
                  <Switch
                    checked={cfg.ceilingOn}
                    onCheckedChange={v => set('ceilingOn', v)}
                    aria-label="Auto-quote ceiling on"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cfg.ceilingOn ? 'Above this the quote refers out' : 'Ceiling off — every price is quoted'}
                </p>
              </div>

              <div>
                <Label className="text-xs">Model-risk spread ×{cfg.riskSpread.toFixed(2)}</Label>
                <Slider
                  className="mt-3"
                  min={0}
                  max={2}
                  step={0.05}
                  value={[cfg.riskSpread]}
                  onValueChange={v => set('riskSpread', v[0])}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Below 1 compresses high-risk uplifts; 0 matches the flat code base.
                </p>
              </div>

              <div>
                <Label className="text-xs">Mileage spread ×{cfg.mileageSpread.toFixed(2)}</Label>
                <Slider
                  className="mt-3"
                  min={0}
                  max={2}
                  step={0.05}
                  value={[cfg.mileageSpread]}
                  onValueChange={v => set('mileageSpread', v[0])}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Below 1 reduces high-mileage uplifts while preserving lower-mileage discounts.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 xl:col-span-2">
                <div>
                  <Label className="text-xs">2-year discount % (off 2× one year)</Label>
                  <Input
                    type="number"
                    className="mt-1 h-9"
                    value={cfg.twoYearDiscountPct}
                    onChange={e => set('twoYearDiscountPct', Number(e.target.value) || 0)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    ×{hybridModel.twoYearMult.toFixed(2)} vs code base ×
                    {codeBaseModel.twoYearMult.toFixed(2)} ({codeTwoYearDiscountPct}% off)
                  </p>
                </div>
                <div>
                  <Label className="text-xs">3-year discount % (off 3× one year)</Label>
                  <Input
                    type="number"
                    className="mt-1 h-9"
                    value={cfg.threeYearDiscountPct}
                    onChange={e => set('threeYearDiscountPct', Number(e.target.value) || 0)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    ×{hybridModel.threeYearMult.toFixed(2)} vs code base ×
                    {codeBaseModel.threeYearMult.toFixed(2)} ({codeThreeYearDiscountPct}% off)
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline">
                Reference target {effectiveTarget ? formatGBP(effectiveTarget) : '—'}
                {cfg.targetReference > 0 ? ' (exact)' : ` (${cfg.baseReductionPct}% below August)`}
              </Badge>
              <Badge variant="outline">
                {cfg.ceilingOn ? `Ceiling ${formatGBP(cfg.ceiling)}` : 'No ceiling'}
              </Badge>
              <Badge variant="outline">
                Multi-year discount {cfg.twoYearDiscountPct}% / {cfg.threeYearDiscountPct}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <PriceDiffBanner
        baseline={leftQuote}
        baselineLabel="Code base pricing"
        candidate={rightQuote}
        candidateLabel="Aug hybrid test"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <PriceTestStep2
          onQuoteChange={setLeftQuote}
          liveModel={codeBaseModel}
          vehicle={vehicle}
          showRegLookup={false}
          title="Code base pricing — Step 2"
          subtitle="The July 2026 matrix written into the code base: one flat grid per term."
          badgeText="Code base"
        />
        <PriceTestStep2
            onQuoteChange={setRightQuote}
          liveModel={hybridModel}
          vehicle={vehicle}
          showRegLookup={false}
          autoQuoteCeiling={ceiling}
          title="Aug hybrid test — Step 2"
          subtitle="Lower base, compressed risk uplifts, cheaper multi-year terms and an auto-quote ceiling."
          badgeText="Hybrid draft"
        />
      </div>
    </div>
  );
};

export default CodebaseVsHybridPanel;
