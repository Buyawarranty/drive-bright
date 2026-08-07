import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { type VehicleFactorModel } from '@/lib/pricing/vehicleFactorModel';
import { applyLivePricingVersion } from '@/lib/pricing/applyLivePricingVersion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

import { AlertTriangle, FlaskConical, RotateCcw, Save, Rocket, Trash2, Globe, GitCompare, CalendarClock, ShieldCheck, Ban, Info } from 'lucide-react';
import Aug26PricingPanel from '@/components/admin/pricing/Aug26PricingPanel';
import LiveVsAug26Panel from '@/components/admin/pricing/LiveVsAug26Panel';
import PricingEngineDraftPanel from '@/components/admin/pricing/PricingEngineDraftPanel';

import { usePriceUpdatesAccess } from '@/hooks/usePriceUpdatesAccess';
import AgeBandPricingPreview, {
  AGE_BAND_PRICING_STORAGE_KEY,
  buildAdminMatrixFromModel,
  type AgeBandModel,
} from '@/components/admin/pricing/AgeBandPricingPreview';

import DraftPricingScope from '@/components/admin/pricing/DraftPricingScope';
import Step3PreviewPanel from '@/components/admin/pricing/Step3PreviewPanel';
import CodebaseVsCurrentPanel from '@/components/admin/pricing/CodebaseVsCurrentPanel';
import ClaimLimit5kAuthToggle from '@/components/admin/pricing/ClaimLimit5kAuthToggle';
import ExcludedVehiclesPanel from '@/components/admin/pricing/ExcludedVehiclesPanel';


/** The real Quotes & Orders page, rendered read-only for beta testing before pushing prices live. */
const GetQuoteTab = lazy(() =>
  import('@/components/admin/GetQuoteTab').then(m => ({ default: m.GetQuoteTab }))
);
import {
  usePricingVersions,
  buildCodeAdminMatrix,
  PERIODS,
  EXCESSES,
  CLAIM_LIMITS,
  type PricingVersion,
} from '@/hooks/usePricingVersions';
import {
  deriveCustomerPriceFromAdmin,
  formatGBP,
  type PricingMatrixShape,
} from '@/lib/pricingMatrix';
import {
  PREMIUM_STEP_SURCHARGE,
  PREMIUM_STEP_MONTHLY,
} from '@/lib/claimLimitTiers';


const PERIOD_LABELS: Record<string, string> = {
  '12months': '1 year',
  '24months': '2 years',
  '36months': '3 years',
};

/** Internal matrix columns → the customer-facing AutoCare tiers they price. */
const CLAIM_COLUMN_LABELS: Record<number, { title: string; sub: string }> = {
  750: { title: 'AutoCare Basic — £1,000', sub: 'Internal column 750' },
  1250: { title: 'Legacy / promo fallback', sub: 'Internal column 1250 — not shown to customers' },
  2000: { title: 'AutoCare Essential — £2,000', sub: 'Internal column 2000' },
};

/**
 * Quotes & Orders floor: the sales team discounts from this grid, so an agent
 * price is never allowed under £399 for one year (2/3 year floors follow the
 * ×1.65 / ×2.35 term multipliers).
 * Website prices carry no acquisition cost and are NOT floored — a website
 * price of, say, £250 is fine and shown as-is.
 */
const MIN_SELLABLE_BY_PERIOD: Record<string, number> = {
  '12months': 399,
  '24months': 659,
  '36months': 938,
};




function cloneMatrix(m: PricingMatrixShape): PricingMatrixShape {
  return JSON.parse(JSON.stringify(m));
}

/**
 * Pre-publish safety net. A live grid must contain EVERY period × excess ×
 * claim-limit cell that Quotes & Orders and website Step 3 ask for — a missing
 * or zero cell is what breaks those pages after a push. Missing cells are
 * backfilled from the current live grid (or the built-in code grid), and any
 * cell that is still not a positive whole number blocks the push.
 */
function normalizeMatrixForPublish(
  draft: PricingMatrixShape,
  fallback: PricingMatrixShape
): { matrix: PricingMatrixShape; filled: string[]; invalid: string[] } {
  const out = cloneMatrix(draft);
  const filled: string[] = [];
  const invalid: string[] = [];

  for (const period of PERIODS) {
    out[period] = out[period] || {};
    for (const excess of EXCESSES) {
      const e = String(excess);
      out[period][e] = out[period][e] || {};
      for (const limit of CLAIM_LIMITS) {
        const l = String(limit);
        const cell = out[period][e][l];
        const cellOk = typeof cell === 'number' && Number.isFinite(cell) && cell > 0;
        if (!cellOk) {
          const fb = fallback?.[period]?.[e]?.[l];
          if (typeof fb === 'number' && Number.isFinite(fb) && fb > 0) {
            out[period][e][l] = Math.round(fb);
            filled.push(`${PERIOD_LABELS[period] ?? period} · £${e} excess · ${l}`);
          } else {
            invalid.push(`${PERIOD_LABELS[period] ?? period} · £${e} excess · ${l}`);
          }
        } else {
          out[period][e][l] = Math.round(cell);
        }
      }
    }
  }

  return { matrix: out, filled, invalid };
}

export default function PriceUpdatesTab() {
  const { allowed: hasAccess, loading: accessLoading } = usePriceUpdatesAccess();
  const {
    versions,
    loading,
    createVersion,
    saveVersion,
    publishVersion,
    revertToCode,
    deleteVersion,
  } = usePricingVersions();

  const liveVersion = versions.find(v => v.status === 'live') || null;
  const drafts = versions.filter(v => v.status === 'draft');

  // Figures currently typed in the Price updates editor, so the Step 2 replica follows them live.
  const [liveEditorModel, setLiveEditorModel] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [discountPct, setDiscountPct] = useState(10);
  const [bulkPct, setBulkPct] = useState('15');

  const [matrix, setMatrix] = useState<PricingMatrixShape>(() => buildCodeAdminMatrix());
  const [busy, setBusy] = useState(false);
  /** Preview tab: price the real Quotes & Orders page with the draft grid. */
  const [usePreviewDraftPrices, setUsePreviewDraftPrices] = useState(true);


  // Pick the first draft once loaded.
  useEffect(() => {
    if (selectedId || drafts.length === 0) return;
    loadIntoEditor(drafts[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts.length]);

  function loadIntoEditor(v: PricingVersion) {
    setSelectedId(v.id);
    setLabel(v.label);
    setNotes(v.notes ?? '');
    setDiscountPct(
      Number(v.step3_discount_pct) > 0 ? Number(v.step3_discount_pct) : 10
    );
    setMatrix(cloneMatrix(v.admin_matrix));
  }

  /** History: version opened in the quick-summary dialog. */
  const [previewVersion, setPreviewVersion] = useState<PricingVersion | null>(null);

  /** History: make a saved/archived version the live pricing again. */
  async function handleRestoreVersion(v: PricingVersion) {
    const { matrix: safeMatrix, invalid } = normalizeMatrixForPublish(
      cloneMatrix(v.admin_matrix),
      liveVersion?.admin_matrix || codeMatrix
    );
    if (invalid.length) {
      toast.error(
        `Cannot restore — ${invalid.length} price cell(s) are missing or zero: ${invalid
          .slice(0, 3)
          .join('; ')}${invalid.length > 3 ? '…' : ''}`
      );
      return;
    }
    const pct = effectiveDiscountPct(Number(v.step3_discount_pct));
    if (
      !window.confirm(
        `Restore "${v.label}" as the live pricing?\n\nQuotes & Orders will use these prices, and the customer journey (Step 3/4) will use them minus ${pct}%.`
      )
    )
      return;
    setBusy(true);
    try {
      await publishVersion(v.id);
      applyLivePricingVersion({
        status: 'live',
        admin_matrix: safeMatrix,
        step3_discount_pct: pct,
        claim_limit_factors: (v as any).claim_limit_factors ?? null,
        labour_rate_factors: (v as any).labour_rate_factors ?? null,
        vehicle_factor_model: (v as any).vehicle_factor_model ?? null,
      });
      loadIntoEditor({ ...v, admin_matrix: safeMatrix, step3_discount_pct: pct } as PricingVersion);
      setPreviewVersion(null);
      toast.success(`"${v.label}" restored live — reload any open quote pages`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not restore this version');
    } finally {
      setBusy(false);
    }
  }

  /**
   * The website (Step 3/4) price is always the Quotes & Orders price minus this
   * percentage. If nobody has set one, default to 10% so the customer journey is
   * never accidentally published at the same price as Quotes & Orders.
   */
  const DEFAULT_WEBSITE_DISCOUNT_PCT = 10;
  const effectiveDiscountPct = (pct: number) =>
    Number.isFinite(pct) && pct > 0 ? pct : DEFAULT_WEBSITE_DISCOUNT_PCT;

  const codeMatrix = useMemo(() => buildCodeAdminMatrix(), []);

  function setCell(period: string, excess: number, limit: number, value: string) {
    const n = Math.max(0, Math.round(Number(value.replace(/[^0-9]/g, '')) || 0));
    setMatrix(prev => {
      const next = cloneMatrix(prev);
      next[period] = next[period] || {};
      next[period][String(excess)] = next[period][String(excess)] || {};
      next[period][String(excess)][String(limit)] = n;
      return next;
    });
  }

  function bulkApplyPct(pct: number) {
    setMatrix(prev => {
      const next = cloneMatrix(prev);
      for (const p of Object.keys(next)) {
        for (const e of Object.keys(next[p])) {
          for (const l of Object.keys(next[p][e])) {
            next[p][e][l] = Math.round(next[p][e][l] * (1 + pct / 100));
          }
        }
      }
      return next;
    });
    toast.success(`Applied ${pct > 0 ? '+' : ''}${pct}% to every price in the draft`);
  }

  async function handleCreateDraft() {
    setBusy(true);
    try {
      const v = await createVersion(
        `Test pricing ${new Date().toLocaleDateString('en-GB')}`,
        liveVersion ? cloneMatrix(liveVersion.admin_matrix) : buildCodeAdminMatrix(),
        liveVersion ? Number(liveVersion.step3_discount_pct) : 10,
        ''
      );
      loadIntoEditor(v);
      toast.success('Test draft created — edit freely, nothing is live yet');
    } catch (e: any) {
      toast.error(e?.message || 'Could not create draft');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Claim limit factors currently being edited (live editor figures first, then
   * the last saved age-band model). These MUST travel with every save/publish or
   * the £3,000 / £5,000 tiers keep pricing off the old built-in steps.
   */
  function currentClaimLimitFactors(): { limit: number; factor: number }[] | null {
    const fromEditor = liveEditorModel?.claimLimits;
    let list: any[] | null = Array.isArray(fromEditor) && fromEditor.length ? fromEditor : null;
    if (!list) {
      try {
        const saved = JSON.parse(localStorage.getItem(AGE_BAND_PRICING_STORAGE_KEY) || '{}');
        if (Array.isArray(saved?.claimLimits) && saved.claimLimits.length) list = saved.claimLimits;
      } catch {
        list = null;
      }
    }
    if (!list) return null;
    const clean = list
      .map((c: any) => ({ limit: Number(c.limit), factor: Number(c.factor) }))
      .filter(c => Number.isFinite(c.limit) && Number.isFinite(c.factor) && c.factor > 0);
    return clean.length ? clean : null;
  }

  /**
   * Labour-rate factors currently being edited in the age-band model. These MUST
   * travel with every save/publish or the customer journey (Step 3/4) keeps using
   * the built-in code factors.
   */
  function currentLabourRateFactors(): { rate: number; factor: number; label?: string | null }[] | null {
    const fromEditor = liveEditorModel?.labourRates;
    let list: any[] | null = Array.isArray(fromEditor) && fromEditor.length ? fromEditor : null;
    if (!list) {
      try {
        const saved = JSON.parse(localStorage.getItem(AGE_BAND_PRICING_STORAGE_KEY) || '{}');
        if (Array.isArray(saved?.labourRates) && saved.labourRates.length) list = saved.labourRates;
      } catch {
        list = null;
      }
    }
    if (!list) return null;
    const clean = list
      .map((l: any) => ({ rate: Number(l.rate), factor: Number(l.factor), label: l.uxPosition ?? l.label ?? null }))
      .filter(l => Number.isFinite(l.rate) && Number.isFinite(l.factor) && l.factor > 0);
    return clean.length ? clean : null;
  }

  /**
   * Age / mileage / powertrain / vehicle-type risk figures from the Age-based
   * builder. Without these the published grid has no vehicle dimension and every
   * car quotes exactly the same price, so they MUST travel with every publish.
   */
  function currentVehicleFactorModel(): VehicleFactorModel | null {
    let m: any = liveEditorModel;
    if (!m || !Array.isArray(m.bands) || !m.bands.length) {
      try {
        m = JSON.parse(localStorage.getItem(AGE_BAND_PRICING_STORAGE_KEY) || '{}');
      } catch {
        m = null;
      }
    }
    if (!m || !Array.isArray(m.bands) || !m.bands.length) return null;
    return {
      bands: m.bands.map((b: any) => ({ key: String(b.key), oneYear: b.oneYear ?? null })),
      refBandKey: String(m.refBandKey ?? m.bands[0]?.key ?? ''),
      mileageBands: (m.mileageBands || []).map((b: any) => ({
        min: Number(b.min) || 0,
        max: b.max === null || b.max === undefined ? null : Number(b.max),
        factor: b.factor === null || b.factor === undefined ? null : Number(b.factor),
      })),
      powertrains: (m.powertrains || []).map((p: any) => ({ key: String(p.key), factor: Number(p.factor) })),
      vehicleTypes: (m.vehicleTypes || []).map((t: any) => ({
        key: String(t.key),
        factor: t.factor === null || t.factor === undefined ? null : Number(t.factor),
      })),
    };
  }

  async function handleSave() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await saveVersion(selectedId, {
        label,
        notes,
        admin_matrix: matrix,
        step3_discount_pct: discountPct,
        claim_limit_factors: currentClaimLimitFactors(),
        labour_rate_factors: currentLabourRateFactors(),
        vehicle_factor_model: currentVehicleFactorModel(),
      });
      toast.success('Draft saved (test only — not live)');
    } catch (e: any) {
      toast.error(e?.message || 'Could not save draft');
    } finally {
      setBusy(false);
    }
  }



  /** Turn the age-band model figures into a saved test draft ready for Push live. */
  async function handleBuildDraftFromModel(
    modelMatrix: PricingMatrixShape,
    websiteDiscountPct: number,
    publish = false,
    claimLimitFactors?: { limit: number; factor: number }[] | null,
    labourRateFactors?: { rate: number; factor: number; label?: string | null }[] | null
  ) {
    websiteDiscountPct = effectiveDiscountPct(Number(websiteDiscountPct));
    if (
      publish &&
      !window.confirm(
        'Push this age-based model live?\n\nQuotes & Orders will use these prices, and the customer journey (Step 3/4) will use them minus ' +
          websiteDiscountPct +
          '%, rounded to the nearest pound.'
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const draftLabel = `Age-based model ${new Date().toLocaleString('en-GB')}`;
      const v = await createVersion(
        draftLabel,
        modelMatrix,
        websiteDiscountPct,
        'Generated from the proposed age-based pricing model.',
        claimLimitFactors ?? null,
        labourRateFactors ?? null,
        currentVehicleFactorModel()
      );
      loadIntoEditor(v);

      if (publish) {
        const { matrix: safeMatrix, invalid } = normalizeMatrixForPublish(
          modelMatrix,
          liveVersion?.admin_matrix || codeMatrix
        );
        if (invalid.length) {
          toast.error(
            `Draft created but not published — ${invalid.length} price cell(s) are missing or zero: ${invalid
              .slice(0, 3)
              .join('; ')}${invalid.length > 3 ? '…' : ''}`
          );
          return;
        }
        await saveVersion(v.id, {
          label: draftLabel,
          notes: 'Generated from the proposed age-based pricing model.',
          admin_matrix: safeMatrix,
          step3_discount_pct: websiteDiscountPct,
          claim_limit_factors: claimLimitFactors ?? null,
          labour_rate_factors: labourRateFactors ?? null,
          vehicle_factor_model: currentVehicleFactorModel(),
        });
        await publishVersion(v.id);
        applyLivePricingVersion({
          status: 'live',
          admin_matrix: safeMatrix,
          step3_discount_pct: websiteDiscountPct,
          claim_limit_factors: claimLimitFactors ?? null,
          labour_rate_factors: labourRateFactors ?? null,
          vehicle_factor_model: currentVehicleFactorModel(),
        });
        setMatrix(safeMatrix);
        toast.success('Age-based pricing published live — reload any open quote pages');
        return;
      }

      toast.success('Test draft built from your figures — review it, then press Push live');
    } catch (e: any) {
      toast.error(e?.message || 'Could not build a draft from this model');
    } finally {
      setBusy(false);
    }
  }




  async function handlePublish() {
    if (!selectedId) {
      try {
        const savedModel = localStorage.getItem(AGE_BAND_PRICING_STORAGE_KEY);
        if (!savedModel) {
          toast.error('Save your age-based figures first, or create a test draft');
          return;
        }
        const model = JSON.parse(savedModel) as AgeBandModel;
        if (!Array.isArray(model.bands) || !model.bands.length) {
          toast.error('The saved age-based figures are incomplete — save them again before publishing');
          return;
        }
        await handleBuildDraftFromModel(
          buildAdminMatrixFromModel(model),
          Number(model.websiteDiscountPct ?? 10),
          true,
          (model.claimLimits || []).map(c => ({ limit: Number(c.limit), factor: Number(c.factor) })),
          (model.labourRates || []).map(l => ({ rate: Number(l.rate), factor: Number(l.factor), label: (l as any).uxPosition ?? null }))
        );
      } catch {
        toast.error('Could not read the saved age-based figures — save them again before publishing');
      }
      return;
    }

    // Safety net: never publish a grid with holes — that is what breaks
    // Quotes & Orders / Step 3 after a push.
    const { matrix: safeMatrix, filled, invalid } = normalizeMatrixForPublish(
      matrix,
      liveVersion?.admin_matrix || codeMatrix
    );

    if (invalid.length) {
      toast.error(
        `Cannot push live — ${invalid.length} price cell(s) are missing or zero: ${invalid
          .slice(0, 3)
          .join('; ')}${invalid.length > 3 ? '…' : ''}`
      );
      return;
    }

    if (
      !window.confirm(
        'Push this pricing live?\n\nQuotes & Orders will use these prices, and the customer journey (Step 3/4) will use them minus ' +
          effectiveDiscountPct(discountPct) +
          '%, rounded to the nearest pound.' +
          (filled.length
            ? `\n\n${filled.length} blank cell(s) will be filled from the current live prices so no page loses a price.`
            : '')
      )
    )
      return;
    setBusy(true);
    try {
      const factors = currentClaimLimitFactors();
      const labourFactors = currentLabourRateFactors();
      const publishDiscountPct = effectiveDiscountPct(discountPct);
      setDiscountPct(publishDiscountPct);
      setMatrix(safeMatrix);
      await saveVersion(selectedId, {
        label,
        notes,
        admin_matrix: safeMatrix,
        step3_discount_pct: publishDiscountPct,
        claim_limit_factors: factors,
        labour_rate_factors: labourFactors,
        vehicle_factor_model: currentVehicleFactorModel(),
      });
      await publishVersion(selectedId);
      applyLivePricingVersion({
        status: 'live',
        admin_matrix: safeMatrix,
        step3_discount_pct: publishDiscountPct,
        claim_limit_factors: factors,
        labour_rate_factors: labourFactors,
        vehicle_factor_model: currentVehicleFactorModel(),
      });
      toast.success('Pricing published live — reload any open quote pages');

    } catch (e: any) {
      toast.error(e?.message || 'Could not publish');
    } finally {
      setBusy(false);
    }
  }



  async function handleRevert() {
    if (!window.confirm('Revert all pricing back to the built-in code prices?')) return;
    setBusy(true);
    try {
      await revertToCode();
      toast.success('Reverted to the built-in code pricing');
    } catch (e: any) {
      toast.error(e?.message || 'Could not revert');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this draft?')) return;
    try {
      await deleteVersion(id);
      if (selectedId === id) setSelectedId(null);
      toast.success('Draft deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete');
    }
  }

  if (accessLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Checking access…</div>;
  }

  if (!hasAccess) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Price updates are restricted to management (admin, super admin, sales manager) and Accounts.
        </AlertDescription>
      </Alert>
    );
  }


  return (
    <div className="space-y-6 p-1">
      {/* Always-visible go-live controls so Push live / Revert are never buried in a tab */}
      <div className="rounded-lg border-2 border-primary/30 bg-muted/40 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              <span className="text-base font-semibold">Price updates</span>
              {liveVersion ? (
                <Badge className="bg-emerald-600">Live: {liveVersion.label}</Badge>
              ) : (
                <Badge variant="secondary">Live: built-in code pricing</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-3xl">
              Build and test a new Quotes &amp; Orders price structure without touching live pricing.
              The customer journey price (Step 3/4) is always this structure minus {discountPct}%,
              rounded to the nearest whole pound. Nothing changes for customers or agents until you
              press <strong>Push live</strong>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleCreateDraft} disabled={busy} variant="outline" size="sm">
              New test draft
            </Button>
            <Button variant="outline" size="sm" onClick={handleRevert} disabled={busy || !liveVersion}>
              <RotateCcw className="h-4 w-4 mr-1" /> Revert to code base pricing 7/2026
            </Button>
            <Button size="sm" onClick={handlePublish} disabled={busy}>
              <Rocket className="h-4 w-4 mr-1" /> Push live
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {selectedId ? (
            <span>
              Editing draft: <strong>{label || 'Untitled draft'}</strong> — “Push live” publishes this
              draft to customers and agents.
            </span>
          ) : (
            <span>
              “Push live” will publish your saved age-based figures, or select a test draft below
              to publish that draft instead.
            </span>
          )}
        </div>
      </div>

      {/* Clears up the "why are there two places to enter prices?" confusion */}
      <Alert className="border-sky-300 bg-sky-50 dark:bg-sky-950/30">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm space-y-2">
          <p className="font-semibold text-base">Why there are two places to enter prices</p>
          <p>
            <strong>1. Age-based builder</strong> (tab “Age-based builder (calculator)”) — a
            calculator. You set base prices per age band, term multipliers, mileage, labour and
            claim-limit factors, then press <strong>Build test draft from this model</strong>. It
            does not go live on its own; it only writes those numbers into the price grid.
          </p>
          <p>
            <strong>2. Price grid</strong> (tab “Price grid (this one goes live)”) — the actual
            table of Quotes &amp; Orders prices. <strong>This is the one that works</strong>: only
            what is in this grid when you press <strong>Push live</strong> is used by agents and
            customers. You can type straight into it and skip the builder entirely.
          </p>
          <p>
            Every publish sets the customer journey (Step 3 / Step 4) to the grid price
            <strong> minus {effectiveDiscountPct(discountPct)}%</strong>, rounded to the nearest
            pound — 10% is the default and is applied automatically if no other figure is set.
          </p>
        </AlertDescription>
      </Alert>

      <div id="claim-limit-auth" className="scroll-mt-4">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-amber-700" />
          Claim limit authorisation
        </h2>
        <ClaimLimit5kAuthToggle />
      </div>



      <Tabs defaultValue={tabOrder[0] || 'compare'} className="w-full">

        <div className="flex items-center justify-end gap-2 mb-2">
          <Button
            type="button"
            size="sm"
            variant={reorderMode ? 'default' : 'outline'}
            onClick={() => setReorderMode(v => !v)}
          >
            <ArrowLeftRight className="h-4 w-4 mr-1" />
            {reorderMode ? 'Done reordering' : 'Reorder tabs'}
          </Button>
          {reorderMode && (
            <Button type="button" size="sm" variant="ghost" onClick={resetTabOrder}>
              Reset order
            </Button>
          )}
        </div>

        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto gap-2 bg-muted/60 p-2">
          {tabOrder.map((value, i) => {
            const tab = TOP_TABS.find(t => t.value === value);
            if (!tab) return null;
            const Icon = tab.icon;
            return (
              <div key={value} className="flex items-center gap-1">
                {reorderMode && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    disabled={i === 0}
                    onClick={() => moveTab(i, -1)}
                    aria-label={`Move ${tab.label} left`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <TabsTrigger value={value} className="flex-1 py-3 text-base font-semibold">
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </TabsTrigger>
                {reorderMode && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    disabled={i === tabOrder.length - 1}
                    onClick={() => moveTab(i, 1)}
                    aria-label={`Move ${tab.label} right`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </TabsList>


        <TabsContent value="compare" className="space-y-6 mt-4">
          <LiveVsAug26Panel liveModel={liveEditorModel} />
          <AgeBandPricingPreview
            onBuildDraft={handleBuildDraftFromModel}
            onModelChange={setLiveEditorModel}
          />
        </TabsContent>

        <TabsContent value="builder" className="space-y-6 mt-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>The original age-based builder on its own.</strong> Same figures as the builder
              under the comparison tab — edit the bands and factors here, then press{' '}
              <strong>“Save &amp; push this model live”</strong> to send it to customers.
            </AlertDescription>
          </Alert>
          <AgeBandPricingPreview
            onBuildDraft={handleBuildDraftFromModel}
            onModelChange={setLiveEditorModel}
          />
        </TabsContent>


        <TabsContent value="tools" className="space-y-4 mt-4">
          <Tabs defaultValue="excluded" className="w-full">
            <TabsList className="flex flex-wrap gap-2 bg-muted/40 p-1">
              <TabsTrigger value="excluded">
                <Ban className="h-4 w-4 mr-2" /> Excluded vehicles
              </TabsTrigger>
              <TabsTrigger value="engine">
                <FlaskConical className="h-4 w-4 mr-2" /> Pricing engine (draft)
              </TabsTrigger>
              <TabsTrigger value="aug26">
                <CalendarClock className="h-4 w-4 mr-2" /> Aug26 grid &amp; version history
              </TabsTrigger>
              <TabsTrigger value="codevscurrent">
                <GitCompare className="h-4 w-4 mr-2" /> Base pricing 7/26 vs Current
              </TabsTrigger>
            </TabsList>
            <TabsContent value="excluded" className="mt-4">
              <ExcludedVehiclesPanel />
            </TabsContent>
            <TabsContent value="engine" className="mt-4">
              <PricingEngineDraftPanel />
            </TabsContent>
            <TabsContent value="aug26" className="mt-4">
              <Aug26PricingPanel />
            </TabsContent>
            <TabsContent value="codevscurrent" className="mt-4">
              <CodebaseVsCurrentPanel />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="previews" className="space-y-4 mt-4">
          <Tabs defaultValue="quotes-preview" className="w-full">
            <TabsList className="flex flex-wrap gap-2 bg-muted/40 p-1">
              <TabsTrigger value="quotes-preview">
                <Rocket className="h-4 w-4 mr-2" /> Quotes &amp; Orders Preview
              </TabsTrigger>
              <TabsTrigger value="step3-preview">
                <Globe className="h-4 w-4 mr-2" /> Website Step 3 Preview
              </TabsTrigger>
            </TabsList>
            <TabsContent value="step3-preview" className="mt-4">

          <Alert className="border-sky-300 bg-sky-50 dark:bg-sky-950/30">
            <Globe className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Customer view — the real Step 3 page.</strong> Exactly what the public sees at{' '}
              <code>?step=3</code>, priced with your draft grid (Quotes &amp; Orders minus the website
              discount). Selecting a plan is blocked — nothing goes to a cart or checkout.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={usePreviewDraftPrices ? 'default' : 'outline'}
              onClick={() => setUsePreviewDraftPrices(true)}
            >
              Draft prices{label ? ` — ${label}` : ''}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={usePreviewDraftPrices ? 'outline' : 'default'}
              onClick={() => setUsePreviewDraftPrices(false)}
            >
              Live prices
            </Button>
            <Badge variant="secondary">Website discount: {discountPct}% off Quotes &amp; Orders</Badge>
          </div>
          <DraftPricingScope
            matrix={matrix}
            discountPct={discountPct}
            active={usePreviewDraftPrices}
          >
            <Step3PreviewPanel />
          </DraftPricingScope>
            </TabsContent>

            <TabsContent value="quotes-preview" className="space-y-4 mt-4">
          <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <FlaskConical className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Beta test — real page, safe mode.</strong> This is the live Quotes &amp; Orders
              journey exactly as the sales team sees it, including the DVLA registration lookup and
              MOT mileage suggestions. Sending quotes, confirming orders and taking payments are all
              blocked here. Switch below to price it with your unsaved draft grid — nothing is
              published until you hit “Push live”.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={usePreviewDraftPrices ? 'default' : 'outline'}
              onClick={() => setUsePreviewDraftPrices(true)}
            >
              Draft prices{label ? ` — ${label}` : ''}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={usePreviewDraftPrices ? 'outline' : 'default'}
              onClick={() => setUsePreviewDraftPrices(false)}
            >
              Live prices
            </Button>
            <Badge variant={usePreviewDraftPrices ? 'default' : 'secondary'}>
              {usePreviewDraftPrices
                ? 'Pricing this page with your draft grid (not published)'
                : 'Pricing this page with the current live grid'}
            </Badge>
          </div>
          <div className="rounded-lg border bg-background p-2">
            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading the live quote page…</div>}>
              <DraftPricingScope
                matrix={matrix}
                discountPct={discountPct}
                active={usePreviewDraftPrices}
              >
                <GetQuoteTab previewMode />
              </DraftPricingScope>
            </Suspense>
          </div>
            </TabsContent>
          </Tabs>
        </TabsContent>


        <TabsContent value="editor" className="space-y-6 mt-4">




      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5" />
                Price updates
              </CardTitle>
              <CardDescription>
                <strong>This grid is the live source of truth.</strong> Whatever is in these cells
                when you press <strong>Push live</strong> is what Quotes &amp; Orders charges, and
                the customer journey (Step 3/4) is automatically this minus{' '}
                {effectiveDiscountPct(discountPct)}% (10% by default), rounded to the nearest whole
                pound. Nothing changes for customers or agents until you press{' '}
                <strong>Push live</strong>.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {liveVersion ? (
                <Badge className="bg-emerald-600">Live: {liveVersion.label}</Badge>
              ) : (
                <Badge variant="secondary">Live: built-in code pricing</Badge>
              )}
              <Button variant="outline" size="sm" onClick={handleRevert} disabled={busy || !liveVersion}>
                <RotateCcw className="h-4 w-4 mr-1" /> Revert to code base pricing 7/2026
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleCreateDraft} disabled={busy}>
              New test draft
            </Button>
            {drafts.map(d => (
              <div key={d.id} className="flex items-center gap-1">
                <Button
                  variant={selectedId === d.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => loadIntoEditor(d)}
                >
                  {d.label}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {loading && <span className="text-sm text-muted-foreground">Loading…</span>}
          </div>

          {!selectedId ? (
            <p className="text-sm text-muted-foreground">
              Create a test draft to start. It is pre-filled with the prices currently in use, so
              you only change what you need.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Draft name</Label>
                  <Input value={label} onChange={e => setLabel(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Website discount off Quotes &amp; Orders (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={discountPct}
                    onChange={e => setDiscountPct(Number(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Step 3 / Step 4 price = this grid minus this %. Leave blank or 0 and 10% is
                    applied automatically on publish.
                  </p>
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <div>
                  <Label>Quick change to every price</Label>
                  <p className="text-xs text-muted-foreground">
                    Applies to every cell in all three terms. All prices stay whole pounds — no
                    decimals.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15, 20, 25].map(p => (
                    <Button key={p} variant="outline" size="sm" onClick={() => bulkApplyPct(p)}>
                      +{p}%
                    </Button>
                  ))}
                  {[5, 10, 15, 20].map(p => (
                    <Button key={-p} variant="outline" size="sm" onClick={() => bulkApplyPct(-p)}>
                      -{p}%
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Your own amount (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={200}
                      step={1}
                      className="h-9 w-28"
                      value={bulkPct}
                      onChange={e => setBulkPct(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkApplyPct(Math.abs(Number(bulkPct) || 0))}
                    disabled={!Number(bulkPct)}
                  >
                    Increase all
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkApplyPct(-Math.abs(Number(bulkPct) || 0))}
                    disabled={!Number(bulkPct)}
                  >
                    Decrease all
                  </Button>
                  <Button size="sm" onClick={handlePublish} disabled={busy}>
                    <Rocket className="h-4 w-4 mr-1" /> Push live
                  </Button>
                </div>
              </div>


              <div className="space-y-1">
                <Label>Notes (why this change)</Label>
                <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              <Tabs defaultValue="12months">
                <TabsList>
                  {PERIODS.map(p => (
                    <TabsTrigger key={p} value={p}>
                      {PERIOD_LABELS[p]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {PERIODS.map(period => (
                  <TabsContent key={period} value={period} className="pt-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Excess</th>
                            {CLAIM_LIMITS.map(l => (
                              <th key={l} className="text-left p-2">
                                {CLAIM_COLUMN_LABELS[l].title}
                                <div className="text-xs font-normal text-muted-foreground">
                                  {CLAIM_COLUMN_LABELS[l].sub}
                                </div>
                              </th>
                            ))}
                            <th className="text-left p-2">
                              AutoCare Elite — £3,000
                              <div className="text-xs font-normal text-muted-foreground">
                                Derived: £2,000 col + (£2,000 − £1,000 step)
                              </div>
                            </th>
                            <th className="text-left p-2">
                              AutoCare Premium — £5,000
                              <div className="text-xs font-normal text-muted-foreground">
                                Derived: Elite + £{PREMIUM_STEP_MONTHLY[period]}/mo
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {EXCESSES.filter(
                            excess => !(period === '12months' && excess === 500)
                          ).map(excess => (
                            <tr key={excess} className="border-b align-top">
                              <td className="p-2 font-medium whitespace-nowrap">
                                £{excess}
                                {excess === 500 && (
                                  <div className="text-xs font-normal text-muted-foreground">
                                    £3,000 / £5,000 limits only
                                  </div>
                                )}
                              </td>
                              {CLAIM_LIMITS.map(limit => {
                                const value =
                                  matrix?.[period]?.[String(excess)]?.[String(limit)] ?? 0;
                                const codeValue =
                                  codeMatrix?.[period]?.[String(excess)]?.[String(limit)] ?? 0;
                                const raw = deriveCustomerPriceFromAdmin(value, discountPct);
                                const minPrice = MIN_SELLABLE_BY_PERIOD[period] ?? 399;
                                // Website prices carry no acquisition cost, so they may sit
                                // below the floor. The floor only guards the Quotes & Orders
                                // price the sales team discounts from.
                                const step3 = raw;
                                const belowFloor = value < minPrice;
                                const changed = value !== codeValue;
                                const blockedByGuardrail = excess === 500 && limit < 3000;
                                return (
                                  <td key={limit} className="p-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">£</span>
                                      <Input
                                        className="h-9 w-24"
                                        value={String(value)}
                                        onChange={e => setCell(period, excess, limit, e.target.value)}
                                      />
                                    </div>
                                    {blockedByGuardrail ? (
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        Not offered — excess above 25% of limit
                                      </div>
                                    ) : (
                                      <>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          Website: {formatGBP(step3)} ·{' '}
                                          {formatGBP(Math.ceil(step3 / 12))}/mo
                                        </div>
                                        {belowFloor && (
                                          <div className="text-xs text-destructive">
                                            Below {formatGBP(minPrice)} Quotes &amp; Orders floor —
                                            raise this cell
                                          </div>
                                        )}
                                      </>
                                    )}

                                    {changed && (
                                      <div className="text-xs text-amber-600">
                                        now live: {formatGBP(codeValue)}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                              {(() => {
                                const basic = matrix?.[period]?.[String(excess)]?.['750'] ?? 0;
                                const essential = matrix?.[period]?.[String(excess)]?.['2000'] ?? 0;
                                const elite = essential + (essential - basic);
                                const premium =
                                  elite + (PREMIUM_STEP_SURCHARGE[period] || 0);
                                const minPrice = MIN_SELLABLE_BY_PERIOD[period] ?? 399;
                                return (
                                  <>
                                    {[elite, premium].map((total, i) => {
                                      const raw = deriveCustomerPriceFromAdmin(total, discountPct);
                                      const step3 = raw;
                                      return (
                                        <td key={i} className="p-2 text-muted-foreground">
                                          <div className="font-medium text-foreground">
                                            {formatGBP(total)}
                                          </div>
                                          <div className="mt-1 text-xs">
                                            Website: {formatGBP(step3)} ·{' '}
                                            {formatGBP(Math.ceil(step3 / 12))}/mo
                                          </div>
                                          {total < minPrice && (
                                            <div className="text-xs text-destructive">
                                              Below {formatGBP(minPrice)} Quotes &amp; Orders floor
                                            </div>
                                          )}

                                        </td>
                                      );
                                    })}
                                  </>
                                );
                              })()}
                            </tr>
                          ))}
                        </tbody>

                      </table>

                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleSave} disabled={busy}>
                  <Save className="h-4 w-4 mr-1" /> Save draft (test only)
                </Button>
                <Button onClick={handlePublish} disabled={busy}>
                  <Rocket className="h-4 w-4 mr-1" /> Push live
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
          <CardDescription>
            Every saved and published pricing structure. Open one for a quick summary, then load it
            into the editor or restore it live.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {versions.length === 0 && (
            <p className="text-sm text-muted-foreground">No pricing versions yet.</p>
          )}
          {versions.map(v => (
            <div
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
            >
              <div>
                <div className="font-medium">{v.label}</div>
                <div className="text-xs text-muted-foreground">
                  Website is {Number(v.step3_discount_pct)}% below these prices ·{' '}
                  {v.published_at
                    ? `published ${new Date(v.published_at).toLocaleString('en-GB')}`
                    : `saved ${new Date(v.updated_at).toLocaleString('en-GB')}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    v.status === 'live'
                      ? 'bg-emerald-600'
                      : v.status === 'draft'
                        ? 'bg-amber-500'
                        : undefined
                  }
                  variant={v.status === 'archived' ? 'secondary' : 'default'}
                >
                  {v.status === 'live' ? 'Live' : v.status === 'draft' ? 'Test draft' : 'Archived'}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => setPreviewVersion(v)}>
                  Open
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick summary of a saved/published version — no full grid dump. */}
      <Dialog open={!!previewVersion} onOpenChange={open => !open && setPreviewVersion(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{previewVersion?.label}</DialogTitle>
            <DialogDescription>
              {previewVersion
                ? `${
                    previewVersion.status === 'live'
                      ? 'Currently live'
                      : previewVersion.status === 'draft'
                        ? 'Test draft'
                        : 'Archived'
                  } · website is ${Number(previewVersion.step3_discount_pct)}% below these prices`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {previewVersion && (
            <div className="space-y-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1">Term</th>
                    <th className="py-1">£0 excess</th>
                    <th className="py-1">£150 excess</th>
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map(p => {
                    const cell = (ex: number) =>
                      previewVersion.admin_matrix?.[p]?.[String(ex)]?.['2000'];
                    return (
                      <tr key={p} className="border-t">
                        <td className="py-1.5 font-medium">{PERIOD_LABELS[p] || p}</td>
                        <td className="py-1.5">{cell(0) ? formatGBP(cell(0)!) : '—'}</td>
                        <td className="py-1.5">{cell(150) ? formatGBP(cell(150)!) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground">
                Showing the £2,000 claim limit as a reference. Load it into the editor to see every
                cell.
              </p>
              {previewVersion.notes && (
                <p className="text-xs text-muted-foreground">{previewVersion.notes}</p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (previewVersion) loadIntoEditor(previewVersion);
                setPreviewVersion(null);
                toast.success('Loaded into the editor — nothing is live until you push it');
              }}
            >
              Load into editor
            </Button>
            {previewVersion?.status !== 'live' && (
              <Button size="sm" disabled={busy} onClick={() => handleRestoreVersion(previewVersion!)}>
                <RotateCcw className="h-4 w-4 mr-1" /> Restore this pricing live
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

        </TabsContent>
      </Tabs>
    </div>

  );
}
