import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { GitCompare, Info, RotateCcw } from 'lucide-react';
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

/**
 * CODE BASE vs LIVE
 * The original July 2026 flat matrix baked into the code base, side by side with
 * live pricing, in the same Step 2 layout agents use — with the same adjustable
 * variables as the hybrid tab so the code-base side can be flexed too:
 *   - set a target one-year price for the code-base reference
 *   - spread risk / mileage deviation (code base is flat, so this only bites
 *     once a spread above 0 reintroduces the live risk curve)
 *   - express multi-year terms as a discount off N × one year
 *   - cap the auto-quote, overflow refers out
 * Sandbox only — nothing here saves a quote or changes live pricing.
 */

const DEFAULTS = {
  referenceBandKey: '6-7',
  /** 0 = keep the code base exactly as written. */
  baseReductionPct: 0,
  targetReference: 0,
  /** 0 keeps the code base flat (no risk / mileage differentiation at all). */
  riskSpread: 0,
  mileageSpread: 0,
  twoYearDiscountPct: 0,
  threeYearDiscountPct: 0,
  ceiling: 650,
  ceilingOn: false,
};

/** Compress or amplify an uplift without weakening an existing low-risk discount. */
const spread = (factor: number | null, amount: number) => {
  if (factor === null || factor <= 1) return factor;
  return Math.round((1 + (factor - 1) * amount) * 100) / 100;
};

/**
 * The hard-coded July 2026 matrix in the shape PriceTestStep2 expects: one flat
 * grid, no age / mileage / powertrain / model-risk differentiation.
 */
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

/** Normalise the live builder model, falling back to the saved editor model. */
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

const CodebaseVsLivePanel: React.FC<{
  liveModel?: any;
  liveLabel?: string | null;
  busy?: boolean;
  onPushModel?: (model: any, label: string, websiteDiscountPct?: number) => void | Promise<void>;
}> = ({ liveModel, liveLabel, busy, onPushModel }) => {
  const saved = useSavedPricingModel();
  const codeBase = useMemo(() => buildCodeBaseModel(saved), [saved]);
  const live = useMemo(() => liveBaseFrom(liveModel, saved), [liveModel, saved]);

  const [vehicle, setVehicle] = useState<ResolvedTestVehicle | null>(null);
  const [leftQuote, setLeftQuote] = useState<PriceTestQuoteSnapshot | null>(null);
  const [rightQuote, setRightQuote] = useState<PriceTestQuoteSnapshot | null>(null);
  const [cfg, setCfg] = useState(DEFAULTS);
  const set = <K extends keyof typeof DEFAULTS>(key: K, value: (typeof DEFAULTS)[K]) =>
    setCfg(c => ({ ...c, [key]: value }));

  const referenceBand =
    codeBase.bands.find((b: any) => String(b.key) === cfg.referenceBandKey) ?? codeBase.bands[0];
  const referenceCode = Number(referenceBand?.oneYear ?? 0);
  const reducedReference = Math.round(referenceCode * (1 - cfg.baseReductionPct / 100));
  const effectiveTarget = cfg.targetReference > 0 ? cfg.targetReference : reducedReference;
  const targetScale = referenceCode > 0 ? effectiveTarget / referenceCode : 1;

  /** Code base multi-year terms implied as a discount off N × one year. */
  const codeTwoYearDiscountPct = Math.round((1 - codeBase.twoYearMult / 2) * 1000) / 10;
  const codeThreeYearDiscountPct = Math.round((1 - codeBase.threeYearMult / 3) * 1000) / 10;

  /** Risk / mileage spread reintroduces the live curve on top of the flat code base. */
  const testModel = useMemo(
    () => ({
      ...codeBase,
      bands: codeBase.bands.map((b: any) => ({
        ...b,
        oneYear: b.oneYear === null ? null : Math.round(b.oneYear * targetScale),
      })),
      mileageBands: live.mileageBands.map((b: any) => ({
        ...b,
        factor: spread(b.factor, cfg.mileageSpread),
      })),
      modelRisks: live.modelRisks.map((r: any) => ({
        ...r,
        factor: spread(r.factor, cfg.riskSpread),
      })),
      twoYearMult:
        cfg.twoYearDiscountPct > 0
          ? Math.round(2 * (1 - cfg.twoYearDiscountPct / 100) * 100) / 100
          : codeBase.twoYearMult,
      threeYearMult:
        cfg.threeYearDiscountPct > 0
          ? Math.round(3 * (1 - cfg.threeYearDiscountPct / 100) * 100) / 100
          : codeBase.threeYearMult,
    }),
    [codeBase, live, targetScale, cfg.mileageSpread, cfg.riskSpread, cfg.twoYearDiscountPct, cfg.threeYearDiscountPct]
  );

  const ceiling = cfg.ceilingOn ? cfg.ceiling : null;

  return (
    <div className="space-y-4">
      <SectionPushLiveBar
        sectionLabel="Code base vs Live"
        liveLabel={liveLabel}
        busy={busy}
        onPush={onPushModel}
        candidates={[
          {
            key: 'codebase',
            label: 'Code base pricing 7/2026 (left)',
            description: 'Publishes the flat July 2026 code-base grid with the variables set above.',
            getModel: () => testModel,
          },
          {
            key: 'live',
            label: 'Live pricing (right)',
            description: 'Republishes the current live builder figures unchanged.',
            getModel: () => liveModel,
          },
        ]}
      />
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <GitCompare className="h-5 w-5" />
            Code base vs Live
          </CardTitle>
          <CardDescription>
            The original July 2026 pricing written into the code base against live pricing, in the same
            Step 2 screen agents use. Right is exactly what agents sell today; left is the flat code-base
            grid with the variables below applied. Sandbox only — nothing saves a quote or changes live
            prices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              With every variable at its default the left side is the untouched code base: one flat price
              per term with no age, mileage, powertrain or model-risk differentiation. Raising the risk or
              mileage spread reintroduces the live curve gradually, so you can see where the two models
              part company.
            </AlertDescription>
          </Alert>

          <RegLookupBar onResolved={setVehicle} />

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Code-base variables</div>
              <Button variant="outline" size="sm" onClick={() => setCfg(DEFAULTS)}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reset to code base
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
                  {codeBase.bands.map((b: any) => (
                    <option key={b.key} value={b.key}>{b.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Code-base one-year price {referenceCode ? formatGBP(referenceCode) : '—'} (flat across all ages)
                </p>
              </div>

              <div>
                <Label className="text-xs">Reduction from code base (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  className="mt-1 h-9"
                  value={cfg.baseReductionPct}
                  onChange={e => set('baseReductionPct', Math.min(50, Math.max(0, Number(e.target.value) || 0)))}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Test reference {effectiveTarget ? formatGBP(effectiveTarget) : '—'} vs code base{' '}
                  {formatGBP(referenceCode)}
                </p>
              </div>

              <div>
                <Label className="text-xs">Exact one-year target (optional)</Label>
                <Input
                  type="number"
                  className="mt-1 h-9"
                  placeholder={reducedReference ? String(reducedReference) : 'Code base'}
                  value={cfg.targetReference || ''}
                  onChange={e => set('targetReference', Number(e.target.value) || 0)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Whole curve scaled by {targetScale.toFixed(3)} — blank uses the reduction
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
                  0 = flat code base. 1 = the full live model-risk uplifts.
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
                  0 = flat code base. 1 = the full live high-mileage uplifts.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 xl:col-span-2">
                <div>
                  <Label className="text-xs">2-year discount % (off 2× one year)</Label>
                  <Input
                    type="number"
                    className="mt-1 h-9"
                    placeholder={String(codeTwoYearDiscountPct)}
                    value={cfg.twoYearDiscountPct || ''}
                    onChange={e => set('twoYearDiscountPct', Number(e.target.value) || 0)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    ×{testModel.twoYearMult.toFixed(2)} vs live ×{live.twoYearMult.toFixed(2)} (code base ={' '}
                    {codeTwoYearDiscountPct}% off)
                  </p>
                </div>
                <div>
                  <Label className="text-xs">3-year discount % (off 3× one year)</Label>
                  <Input
                    type="number"
                    className="mt-1 h-9"
                    placeholder={String(codeThreeYearDiscountPct)}
                    value={cfg.threeYearDiscountPct || ''}
                    onChange={e => set('threeYearDiscountPct', Number(e.target.value) || 0)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    ×{testModel.threeYearMult.toFixed(2)} vs live ×{live.threeYearMult.toFixed(2)} (code base ={' '}
                    {codeThreeYearDiscountPct}% off)
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline">
                Reference {effectiveTarget ? formatGBP(effectiveTarget) : '—'}
                {cfg.targetReference > 0
                  ? ' (exact)'
                  : cfg.baseReductionPct > 0
                    ? ` (${cfg.baseReductionPct}% below code base)`
                    : ' (code base)'}
              </Badge>
              <Badge variant="outline">
                {cfg.ceilingOn ? `Ceiling ${formatGBP(cfg.ceiling)}` : 'No ceiling'}
              </Badge>
              <Badge variant="outline">
                Risk ×{cfg.riskSpread.toFixed(2)} · Mileage ×{cfg.mileageSpread.toFixed(2)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <PriceDiffBanner
        baseline={leftQuote}
        baselineLabel="Code base pricing"
        candidate={rightQuote}
        candidateLabel="Live pricing"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <PriceTestStep2
          onQuoteChange={setLeftQuote}
          liveModel={testModel}
          vehicle={vehicle}
          showRegLookup={false}
          autoQuoteCeiling={ceiling}
          title="Code base pricing — Step 2"
          subtitle="The July 2026 matrix written into the code base, with the variables above applied."
          badgeText="Code base"
        />
        <PriceTestStep2
            onQuoteChange={setRightQuote}
          liveModel={liveModel}
          vehicle={vehicle}
          showRegLookup={false}
          title="Live pricing — Step 2"
          subtitle="Exactly what agents sell today, from the live age-based builder figures."
          badgeText="Live"
        />
      </div>
    </div>
  );
};

export default CodebaseVsLivePanel;
