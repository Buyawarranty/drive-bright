import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { GitCompare, TrendingDown, TrendingUp, Minus, Info } from 'lucide-react';
import {
  usePricingVersions,
  buildCodeAdminMatrix,
  PERIODS,
  EXCESSES,
  
} from '@/hooks/usePricingVersions';
import {
  buildCodeBaseClaimTiers,
  CODE_BASE_PUBLISHED_TIERS,
  CODE_BASE_TIER_COLUMN,
  codeBasePremiumStep,
} from '@/lib/pricing/codeBaseClaimTiers';

import {
  applyCustomerJourneyUplift,
  deriveCustomerPriceFromAdmin,
  BASE_PRICING_MATRIX,
  LABOUR_RATE_FACTOR,
  DEFAULT_LABOUR_RATE_OPTIONS,
  getLabourRateOptions,
  getLiveLabourRateFactors,
} from '@/lib/pricingMatrix';
import PriceTestStep2 from './PriceTestStep2';
import PriceDiffBanner from './PriceDiffBanner';
import type { PriceTestQuoteSnapshot } from './PriceTestStep2';
import SectionPushLiveBar from './SectionPushLiveBar';
import RegLookupBar, { type ResolvedTestVehicle } from './RegLookupBar';
import { useSavedPricingModel } from './useSavedPricingModel';


/**
 * Read-only comparison: the pricing baked into the code base (July 2026 matrix)
 * versus whatever grid is currently live/published.
 * Pure presentation — never writes, publishes or changes any pricing.
 */

const money = (n: number) => `£${Math.round(n).toLocaleString()}`;

const TERM_LABEL: Record<string, string> = {
  '12months': '1 year',
  '24months': '2 years',
  '36months': '3 years',
};

const DiffBadge: React.FC<{ code: number; current: number }> = ({ code, current }) => {
  const diff = current - code;
  const pct = code ? (diff / code) * 100 : 0;
  if (Math.abs(diff) < 0.5) {
    return (
      <Badge variant="outline" className="gap-1 font-mono text-[11px]">
        <Minus className="h-3 w-3" /> same
      </Badge>
    );
  }
  const up = diff > 0;
  return (
    <Badge
      variant="outline"
      className={`gap-1 font-mono text-[11px] ${
        up
          ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30'
          : 'border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30'
      }`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : '−'}
      {money(Math.abs(diff))} ({up ? '+' : '−'}
      {Math.abs(pct).toFixed(1)}%)
    </Badge>
  );
};

/**
 * Turn the hard-coded July 2026 matrix into the shape PriceTestStep2 expects, so
 * the Step 2 replica on the left prices exactly like the original code base:
 * one flat grid, no age / mileage / powertrain / model-risk differentiation.
 */
function buildCodeBaseModel(saved: ReturnType<typeof useSavedPricingModel>) {
  const m: any = BASE_PRICING_MATRIX;
  const ref = Number(m['12months'][150][2000]); // reference cell: 1 yr, £150 excess, £2,000 limit
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

export default function CodebaseVsCurrentPanel({
  liveLabel,
  busy,
  onPushModel,
}: {
  liveLabel?: string | null;
  busy?: boolean;
  onPushModel?: (model: any, label: string, websiteDiscountPct?: number) => void | Promise<void>;
} = {}) {
  const { versions, loading } = usePricingVersions();
  const [claimLimit, setClaimLimit] = useState<number>(2000);
  const [labourRate, setLabourRate] = useState<number>(70);
  const saved = useSavedPricingModel();
  const [step2Vehicle, setStep2Vehicle] = useState<ResolvedTestVehicle | null>(null);
  const [leftQuote, setLeftQuote] = useState<PriceTestQuoteSnapshot | null>(null);
  const [rightQuote, setRightQuote] = useState<PriceTestQuoteSnapshot | null>(null);
  const codeBaseModel = useMemo(() => buildCodeBaseModel(saved), [saved]);


  const liveVersion = useMemo(() => versions.find(v => v.status === 'live') ?? null, [versions]);

  const codeMatrix = useMemo(() => buildCodeAdminMatrix(), []);
  const currentMatrix = useMemo(
    () => (liveVersion?.admin_matrix as any) ?? codeMatrix,
    [liveVersion, codeMatrix]
  );
  const currentDiscountPct = liveVersion?.step3_discount_pct ?? 10;

  /** Labour-rate factors baked into the code base. */
  const codeFactors = useMemo(() => {
    const map: Record<number, number> = {};
    DEFAULT_LABOUR_RATE_OPTIONS.forEach(o => {
      map[o.rate] = o.factor;
    });
    return map;
  }, []);

  /** Labour-rate factors from the live published version (falls back to code). */
  const liveFactors = useMemo(() => {
    const published = (liveVersion as any)?.labour_rate_factors as
      | { rate: number; factor: number; label?: string | null }[]
      | null
      | undefined;
    if (Array.isArray(published) && published.length) {
      const map: Record<number, number> = {};
      published.forEach(f => {
        if (Number.isFinite(Number(f.rate)) && Number(f.factor) > 0) map[Number(f.rate)] = Number(f.factor);
      });
      return map;
    }
    const runtime = getLiveLabourRateFactors();
    if (runtime && Object.keys(runtime).length) return runtime;
    return codeFactors;
  }, [liveVersion, codeFactors]);

  const labourLabels = useMemo(() => {
    const map: Record<number, string> = {};
    [...DEFAULT_LABOUR_RATE_OPTIONS, ...getLabourRateOptions()].forEach(o => {
      if (o.label) map[o.rate] = o.label;
    });
    return map;
  }, [liveVersion]);

  const labourRates = useMemo(() => {
    const all = new Set<number>([
      ...Object.keys(codeFactors).map(Number),
      ...Object.keys(liveFactors).map(Number),
    ]);
    return Array.from(all).sort((a, b) => a - b);
  }, [codeFactors, liveFactors]);

  const codeFactor = codeFactors[labourRate] ?? LABOUR_RATE_FACTOR[labourRate] ?? 1;
  const liveFactor = liveFactors[labourRate] ?? codeFactor;

  const rows = useMemo(() => {
    const column = CODE_BASE_TIER_COLUMN[claimLimit] ?? claimLimit;
    return PERIODS.flatMap(period =>
      EXCESSES.map(excess => {
        // £5,000 sits on top of the £3,000 column (£5/mo boost), so add its step.
        const step = claimLimit === 5000 ? codeBasePremiumStep(period) : 0;
        const codeGrid = Number(codeMatrix[period]?.[String(excess)]?.[String(column)] ?? 0) + step;
        const currentGrid =
          Number(currentMatrix?.[period]?.[String(excess)]?.[String(column)] ?? codeGrid - step) + step;
        const codeBase = Number((BASE_PRICING_MATRIX as any)[period]?.[excess]?.[column] ?? 0) + step;

        const code = Math.round(codeGrid * codeFactor);
        const current = Math.round(currentGrid * liveFactor);
        return {
          period,
          excess,
          codeGrid,
          currentGrid,
          code,
          current,
          codeWeb: Math.round(applyCustomerJourneyUplift(codeBase, 'customer') * codeFactor),
          currentWeb: Math.round(
            deriveCustomerPriceFromAdmin(currentGrid, currentDiscountPct) * liveFactor
          ),
        };
      })
    );
  }, [codeMatrix, currentMatrix, claimLimit, currentDiscountPct, codeFactor, liveFactor]);

  const summary = useMemo(() => {
    return PERIODS.map(period => {
      const set = rows.filter(r => r.period === period);
      const code = set.reduce((s, r) => s + r.code, 0) / (set.length || 1);
      const current = set.reduce((s, r) => s + r.current, 0) / (set.length || 1);
      return { period, code, current, pct: code ? ((current - code) / code) * 100 : 0 };
    });
  }, [rows]);

  return (
    <div className="space-y-4">
      <SectionPushLiveBar
        sectionLabel="Original codebase pricing vs Live"
        liveLabel={liveLabel}
        busy={busy}
        onPush={onPushModel}
        candidates={[
          {
            key: 'codebase',
            label: 'Original code base pricing 7/2026 (left)',
            description: 'Publishes the flat July 2026 code-base grid as live pricing.',
            getModel: () => codeBaseModel,
          },
        ]}
      />
      <Alert className="border-indigo-300 bg-indigo-50 dark:bg-indigo-950/30">
        <GitCompare className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Comparison only — nothing is changed or published here.</strong> Every figure below
          is for one exact cover combination: the <strong>term</strong> (rows), the{' '}
          <strong>voluntary excess</strong> (rows), the <strong>claim limit</strong> and the{' '}
          <strong>labour rate</strong> you pick in the selectors. Change a selector and the whole
          table re-prices. Left = pricing hard-coded in the code base (July 2026 matrix). Right =
          the grid currently live
          {liveVersion ? (
            <> — <strong>{liveVersion.label}</strong></>
          ) : (
            ' (no published version yet, so it still matches the code base)'
          )}
          .
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cover options being compared</CardTitle>
          <CardDescription>
            Pick the claim limit and labour rate. Terms and excess tiers are shown as rows, so all
            three variables are visible at once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground w-24">Claim limit</span>
            {CODE_BASE_PUBLISHED_TIERS.map(limit => (
              <Button
                key={limit}
                type="button"
                size="sm"
                variant={claimLimit === limit ? 'default' : 'outline'}
                onClick={() => setClaimLimit(limit)}
              >
                {money(limit)}
              </Button>
            ))}

          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground w-24">Labour rate</span>
            {labourRates.map(rate => (
              <Button
                key={rate}
                type="button"
                size="sm"
                variant={labourRate === rate ? 'default' : 'outline'}
                onClick={() => setLabourRate(rate)}
              >
                £{rate}/hr
                {labourLabels[rate] ? (
                  <span className="ml-1 hidden sm:inline opacity-70">· {labourLabels[rate]}</span>
                ) : null}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
            <span>
              Code-base factor for £{labourRate}/hr:{' '}
              <span className="font-mono text-foreground">×{codeFactor.toFixed(2)}</span>
            </span>
            <span>
              Live factor for £{labourRate}/hr:{' '}
              <span className="font-mono text-foreground">×{liveFactor.toFixed(2)}</span>
            </span>
            {Math.abs(codeFactor - liveFactor) > 0.001 && (
              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                labour factor differs
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {summary.map(s => (
          <Card key={s.period}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{TERM_LABEL[s.period]}</CardTitle>
              <CardDescription>
                Average across all excess tiers · {money(claimLimit)} limit · £{labourRate}/hr
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Code base 7/2026</span>
                <span className="font-mono">{money(s.code)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current live</span>
                <span className="font-mono font-semibold">{money(s.current)}</span>
              </div>
              <div className="pt-1">
                <DiffBadge code={s.code} current={s.current} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Grid-by-grid comparison</CardTitle>
          <CardDescription>
            Quotes &amp; Orders price at {money(claimLimit)} claim limit and £{labourRate}/hr labour,
            plus the website (Step 3/4) price each one produces. Website discount currently set to{' '}
            {currentDiscountPct || 10}%.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading current live prices…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Term</th>
                    <th className="text-left py-2 px-3 font-medium">Excess</th>
                    <th className="text-right py-2 px-3 font-medium">Grid: code → live</th>
                    <th className="text-right py-2 px-3 font-medium">
                      Code base 7/2026<div className="text-[11px] font-normal text-muted-foreground">at £{labourRate}/hr</div>
                    </th>
                    <th className="text-right py-2 px-3 font-medium">
                      Current live<div className="text-[11px] font-normal text-muted-foreground">at £{labourRate}/hr</div>
                    </th>
                    <th className="text-right py-2 px-3 font-medium">Difference</th>
                    <th className="text-right py-2 px-3 font-medium">Website: code → current</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={`${r.period}-${r.excess}`} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">{TERM_LABEL[r.period]}</td>
                      <td className="py-2 px-3">{money(r.excess)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">
                        {money(r.codeGrid)} → {money(r.currentGrid)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{money(r.code)}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        {money(r.current)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <DiffBadge code={r.code} current={r.current} />
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">
                        {money(r.codeWeb)} → {money(r.currentWeb)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitCompare className="h-4 w-4" />
            Step 2 comparison — Quotes &amp; Orders
          </CardTitle>
          <CardDescription>
            The same agent Step 2 quote screen twice: left priced with the original code-base grid
            (July 2026, flat — no age, mileage, powertrain or model-risk differentiation), right
            priced with the pricing model that is live today. Look up a reg to drive both columns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Read-only sandbox — nothing here saves a quote or changes live pricing. Any figure the
              code base does not vary by vehicle (age band, mileage, powertrain, model risk) is held
              at ×1.00 on the left, so a difference between the columns is exactly what the live
              model adds or removes.
            </AlertDescription>
          </Alert>
          <RegLookupBar onResolved={setStep2Vehicle} />
        </CardContent>
      </Card>

      <PriceDiffBanner
        baseline={leftQuote}
        baselineLabel="Original code base 7/2026"
        candidate={rightQuote}
        candidateLabel="Current live pricing"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <PriceTestStep2
          onQuoteChange={setLeftQuote}
          liveModel={codeBaseModel}
          vehicle={step2Vehicle}
          showRegLookup={false}
          title="Original code base 7/2026 — Step 2"
          subtitle="Flat grid straight from the code base, no vehicle-specific factors."
          badgeText="Code base"
        />
        <PriceTestStep2
            onQuoteChange={setRightQuote}
          vehicle={step2Vehicle}
          showRegLookup={false}
          title={`${liveVersion?.label ?? 'Current live'} — Step 2`}
          subtitle="Priced with the pricing model currently live."
          badgeText="Live"
        />
      </div>



      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Which one works better?</CardTitle>
          <CardDescription>How to read the numbers above.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            <strong className="text-foreground">Grid: code → live</strong> is the raw grid cell before
            labour rate is applied, so you can see whether a difference comes from the grid itself or
            from the labour-rate factor.
          </p>
          <p>
            <strong className="text-foreground">Green (+)</strong> means the live grid charges more
            than the code base — higher margin per sale, but a harder close, especially on 2 and 3
            year terms where we already sit above the market.
          </p>
          <p>
            <strong className="text-foreground">Red (−)</strong> means the live grid is cheaper than
            the code base — easier conversion, so watch average order value and claim cost per
            policy over the same period.
          </p>
          <p>
            Compare each change against conversion in Analytics for the weeks either side of the
            publish date: the version with the higher revenue per quote wins, not the higher price.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

