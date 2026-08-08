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
import { formatGBP } from '@/lib/pricingMatrix';
import PriceTestStep2 from './PriceTestStep2';
import PriceDiffBanner from './PriceDiffBanner';
import type { PriceTestQuoteSnapshot } from './PriceTestStep2';
import SectionPushLiveBar from './SectionPushLiveBar';
import RegLookupBar, { type ResolvedTestVehicle } from './RegLookupBar';
import { useSavedPricingModel } from './useSavedPricingModel';
import { buildAdminMatrixFromModel } from './AgeBandPricingPreview';

/**
 * AUG HYBRID TEST vs LIVE
 * The August test model, side by side with what is live today, in the same
 * Step 2 layout agents use. Every hybrid variable is adjustable here:
 *   - set a target one-year price for the reference vehicle
 *   - spread risk (mileage / model-risk deviation amplified or flattened)
 *   - flip the multi-year uplift into a visible discount vs buying single years
 *   - cap the auto-quote at a price we know converts, overflow goes to referral
 * Nothing on this screen saves a quote or changes live pricing.
 */

const HYBRID_DEFAULTS = {
  referenceBandKey: '6-7',
  /** Proposal starts below August pricing because the August level is not converting. */
  baseReductionPct: 20,
  /** Optional exact override; 0 uses the reduction above. */
  targetReference: 0,
  /** Compress, rather than amplify, the expensive end of the August risk curve. */
  riskSpread: 0.75,
  mileageSpread: 0.75,
  /** Both defaults are materially cheaper than the live ×1.65 / ×2.35 terms. */
  twoYearDiscountPct: 25,
  threeYearDiscountPct: 30,
  ceiling: 650,
  ceilingOn: true,
};

/** Normalise either the live builder model or the saved editor model into one shape. */
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

/** Compress costly uplifts without weakening an existing low-risk discount. */
const spread = (factor: number | null, amount: number) => {
  if (factor === null || factor <= 1) return factor;
  return Math.round((1 + (factor - 1) * amount) * 100) / 100;
};

const AugHybridVsLivePanel: React.FC<{
  liveModel?: any;
  liveLabel?: string | null;
  busy?: boolean;
  onPushModel?: (model: any, label: string, websiteDiscountPct?: number) => void | Promise<void>;
}> = ({ liveModel, liveLabel, busy, onPushModel }) => {
  const saved = useSavedPricingModel();
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
  /** Exact target wins; otherwise apply the deliberate reduction to the August base. */
  const reducedReference = Math.round(referenceLive * (1 - cfg.baseReductionPct / 100));
  const effectiveTarget = cfg.targetReference > 0 ? cfg.targetReference : reducedReference;
  /** One scale factor moves the whole age curve so the reference vehicle lands on target. */
  const targetScale = referenceLive > 0 ? effectiveTarget / referenceLive : 1;
  /** What live's flat multipliers imply as a discount off N × one year. */
  const liveTwoYearDiscountPct = Math.round((1 - base.twoYearMult / 2) * 1000) / 10;
  const liveThreeYearDiscountPct = Math.round((1 - base.threeYearMult / 3) * 1000) / 10;

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
        sectionLabel="Live Vs Test Hybrid Aug"
        liveLabel={liveLabel}
        busy={busy}
        onPush={onPushModel}
        candidates={[
          {
            key: 'live',
            label: 'Live pricing (left)',
            description: 'Republishes the current live builder figures unchanged.',
            getModel: () => liveModel,
            getPreflightExtras: () => liveModel
              ? {
                  adminMatrix: buildAdminMatrixFromModel({
                    ...liveModel,
                    refBandKey: liveModel.refBandKey ?? liveModel.bands?.[0]?.key ?? '',
                    websiteDiscountPct: liveModel.websiteDiscountPct ?? 10,
                  }),
                  labourRateFactors: liveModel.labourRates,
                }
              : null,
          },
          {
            key: 'hybrid',
            label: 'Aug hybrid test (right)',
            description:
              'Publishes the hybrid variables exactly as set above: reduced base, compressed risk/mileage spread and the multi-year discounts.',
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
            Live Vs Test Hybrid Aug
          </CardTitle>
          <CardDescription>
            The August test model against live pricing in the same Step 2 screen. Left is exactly what
            agents sell today; right applies the hybrid variables below. Sandbox only — nothing saves a
            quote or changes live prices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              This test model starts 20% below the August base and compresses its risk and mileage uplifts.
              Multi-year terms are also cheaper than live. Anything over the ceiling refers out instead
              of displaying a high price that is difficult to convert.
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
                  Live one-year base {referenceLive ? formatGBP(referenceLive) : '—'}
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
                  Target reference {effectiveTarget ? formatGBP(effectiveTarget) : '—'} vs August {formatGBP(referenceLive)}
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
                  Below 1 reduces high-risk uplifts while preserving low-risk discounts.
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">2-year discount % (off 2× one year)</Label>
                  <Input
                    type="number"
                    className="mt-1 h-9"
                    value={cfg.twoYearDiscountPct}
                    onChange={e => set('twoYearDiscountPct', Number(e.target.value) || 0)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    ×{hybridModel.twoYearMult.toFixed(2)} vs live ×{base.twoYearMult.toFixed(2)} (live ={' '}
                    {liveTwoYearDiscountPct}% off)
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
                    ×{hybridModel.threeYearMult.toFixed(2)} vs live ×{base.threeYearMult.toFixed(2)} (live ={' '}
                    {liveThreeYearDiscountPct}% off)
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
                Multi-year now a discount ({cfg.twoYearDiscountPct}% / {cfg.threeYearDiscountPct}%)
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <PriceDiffBanner
        baseline={leftQuote}
        baselineLabel="Live pricing"
        candidate={rightQuote}
        candidateLabel="Aug hybrid test"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <PriceTestStep2
          onQuoteChange={setLeftQuote}
          liveModel={liveModel}
          vehicle={vehicle}
          showRegLookup={false}
          title="Live pricing — Step 2"
          subtitle="Exactly what agents sell today, from the live age-based builder figures."
          badgeText="Live"
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

export default AugHybridVsLivePanel;
