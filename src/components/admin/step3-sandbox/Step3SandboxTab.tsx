import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Lock, Search, Rocket, SlidersHorizontal, RotateCcw, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { usePricingVersions } from '@/hooks/usePricingVersions';
import DraftPricingScope from '@/components/admin/pricing/DraftPricingScope';
import { readAppliedPromos, setPromoSuppressed } from '@/lib/promoStorage';
import { CODE_WEB_DISCOUNT_PCT } from '@/lib/pricing/pricingVersionConfig';
import {
  DEFAULT_SANDBOX_TWEAKS,
  tweaksAreLive,
  type SandboxOptions,
  type SandboxTweaks,
} from '@/lib/pricing/sandboxStep3Pricing';
import {
  DEFAULT_PAYMENT_SETTINGS,
  paymentSettingsAreLive,
  type SandboxPaymentSettings,
} from '@/lib/pricing/sandboxPaymentMethods';
import type { WebsiteQuoteVehicle } from '@/lib/pricing/websiteQuotePrice';
import SandboxStep3Pricing, { type SandboxSelection } from './SandboxStep3Pricing';
import SandboxStep4Preview from './SandboxStep4Preview';
import QuotesOrdersReviewPanel from './QuotesOrdersReviewPanel';

/**
 * STEP 3 SANDBOX — super admin only (server-verified).
 *
 * A safe copy of the website step 3 → step 4 journey for trying the new
 * PayLater-based tile design against any pricing plan draft. Pushing live goes
 * through the SAME pricing-version machinery as Price Updates, so both pages
 * always agree; the "Also update Quotes & Orders" tick decides whether the
 * Q&O grid is re-based on the sandbox plan.
 */
export default function Step3SandboxTab() {
  const { isSuperAdmin, loading: gateLoading } = useIsSuperAdmin();
  const { versions, loading: versionsLoading, createVersion, publishVersion } = usePricingVersions();

  const [reg, setReg] = useState('');
  const [mileage, setMileage] = useState('60000');
  const [looking, setLooking] = useState(false);
  const [vehicle, setVehicle] = useState<WebsiteQuoteVehicle | null>(null);
  const [options, setOptions] = useState<SandboxOptions>({
    claimLimit: 2000,
    voluntaryExcess: 100,
    labourRate: 50,
  });
  const [tweaks, setTweaks] = useState<SandboxTweaks>({ ...DEFAULT_SANDBOX_TWEAKS });
  const [paymentSettings, setPaymentSettings] = useState<SandboxPaymentSettings>({
    ...DEFAULT_PAYMENT_SETTINGS,
    payLater: { ...DEFAULT_PAYMENT_SETTINGS.payLater },
    klarna: { ...DEFAULT_PAYMENT_SETTINGS.klarna },
    zopa: { ...DEFAULT_PAYMENT_SETTINGS.zopa },
  });
  const [gapTweak, setGapTweak] = useState<number | null>(null);
  const [selection, setSelection] = useState<SandboxSelection | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [alsoUpdateQuotesOrders, setAlsoUpdateQuotesOrders] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [storedPromos] = useState(() => readAppliedPromos().map(c => c.code));

  // Ignore any promo codes saved in this browser so the sandbox shows true prices.
  useEffect(() => {
    setPromoSuppressed(true);
    return () => setPromoSuppressed(false);
  }, []);

  const liveVersion = useMemo(
    () => versions.find(v => v.status === 'live') || null,
    [versions],
  );
  const selectedVersion = useMemo(
    () => versions.find(v => v.id === selectedVersionId) || liveVersion,
    [versions, selectedVersionId, liveVersion],
  );
  const gapPct = liveVersion?.step3_discount_pct ?? CODE_WEB_DISCOUNT_PCT;
  const effectiveGapPct = gapTweak ?? gapPct;
  // The PayLater uplift lives in the payment-options card; merge it into the
  // tweaks so the pricing helpers see one consistent set of figures.
  const effectiveTweaks: SandboxTweaks = useMemo(
    () => ({ ...tweaks, payLaterUpliftPct: paymentSettings.payLater.upliftPct }),
    [tweaks, paymentSettings.payLater.upliftPct],
  );
  const tweaked =
    !tweaksAreLive(effectiveTweaks) || gapTweak != null || !paymentSettingsAreLive(paymentSettings);

  const resetTweaks = () => {
    setTweaks({ ...DEFAULT_SANDBOX_TWEAKS });
    setPaymentSettings({
      ...DEFAULT_PAYMENT_SETTINGS,
      payLater: { ...DEFAULT_PAYMENT_SETTINGS.payLater },
      klarna: { ...DEFAULT_PAYMENT_SETTINGS.klarna },
      zopa: { ...DEFAULT_PAYMENT_SETTINGS.zopa },
    });
    setGapTweak(null);
  };

  async function loadVehicle() {
    if (!reg.trim()) {
      toast.error('Enter a registration to preview the sandbox');
      return;
    }
    setLooking(true);
    setSelection(null);
    try {
      const { data } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registration: reg.trim() },
      });
      setVehicle({
        regNumber: reg.trim().toUpperCase(),
        mileage: String(Math.max(0, Number(mileage) || 0)),
        make: data?.make,
        model: data?.model,
        fuelType: data?.fuelType,
        transmission: data?.transmission,
        year: data?.yearOfManufacture || data?.year,
        vehicleType: data?.vehicleType,
      });
      if (!data?.make) toast.warning('No DVLA match — previewing with registration and mileage only');
    } catch {
      setVehicle({ regNumber: reg.trim().toUpperCase(), mileage: String(Number(mileage) || 0) });
      toast.warning('Lookup failed — previewing with registration and mileage only');
    } finally {
      setLooking(false);
    }
  }

  async function handlePushLive() {
    if (!selectedVersion) return;
    const planLabel = selectedVersion.label;
    const target = alsoUpdateQuotesOrders
      ? 'the website AND Quotes & Orders (which stays 10% above the website price)'
      : 'the website ONLY — Quotes & Orders keeps its current grid, so any grid edits in this plan will NOT be applied';
    const ok = window.confirm(
      `Push pricing plan "${planLabel}" live?\n\nThis updates ${target}.\n\nThe new step 3 design itself goes live the next time the website is published — this button pushes the PRICES.`,
    );
    if (!ok) return;

    setPushing(true);
    try {
      if (alsoUpdateQuotesOrders || !liveVersion) {
        // Publish the selected plan as-is: Q&O grid = plan grid, web = grid − gap.
        await publishVersion(selectedVersion.id);
      } else {
        // Website only: publish a copy that keeps the CURRENT live Q&O grid but
        // carries the plan's vehicle factors, floors and web discount. The
        // original draft is left untouched.
        const copy = await createVersion(
          `${planLabel} — website only`,
          liveVersion.admin_matrix,
          selectedVersion.step3_discount_pct,
          `Website-only push of "${planLabel}" from the step 3 sandbox; Quotes & Orders grid preserved from "${liveVersion.label}".`,
          selectedVersion.claim_limit_factors ?? null,
          selectedVersion.labour_rate_factors ?? null,
          selectedVersion.vehicle_factor_model ?? null,
          {
            reference_vehicle: selectedVersion.reference_vehicle ?? null,
            reference_factors: selectedVersion.reference_factors ?? null,
            price_floors: selectedVersion.price_floors ?? null,
            price_caps: selectedVersion.price_caps ?? null,
            rounding_rule: selectedVersion.rounding_rule ?? null,
          },
        );
        await publishVersion(copy.id);
      }
      toast.success(`"${planLabel}" is now live — reload any open quote pages`);
    } catch (e: any) {
      toast.error(e?.message || 'Push live failed');
    } finally {
      setPushing(false);
    }
  }

  if (gateLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">Super admins only</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            The step 3 sandbox is a pricing test area. Only super admins can open it.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Step 3 sandbox</CardTitle>
          <CardDescription>
            Try the new step 3 design — 12 instalments and BAW PayLater side by side — against any
            pricing plan, then follow through to a payment-safe step 4. Nothing here reaches
            customers until you push live.
            {storedPromos.length > 0 && (
              <span className="block mt-2 font-semibold text-foreground">
                Promo code{storedPromos.length > 1 ? 's' : ''} {storedPromos.join(', ')} saved in this
                browser {storedPromos.length > 1 ? 'are' : 'is'} ignored here, so you see true grid prices.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Pricing plan to test</Label>
            <Select
              value={selectedVersion?.id || ''}
              onValueChange={setSelectedVersionId}
              disabled={versionsLoading}
            >
              <SelectTrigger className="w-64"><SelectValue placeholder="Loading plans…" /></SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.label} {v.status === 'live' ? '(live)' : v.status === 'draft' ? '(draft)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Registration</Label>
            <Input
              value={reg}
              onChange={e => setReg(e.target.value.toUpperCase())}
              placeholder="AB12 CDE"
              className="w-40 uppercase font-semibold"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mileage</Label>
            <Input
              value={mileage}
              onChange={e => setMileage(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-32"
            />
          </div>
          <Button onClick={loadVehicle} disabled={looking}>
            {looking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Load sandbox
          </Button>
          {vehicle && (
            <Button variant="outline" onClick={() => { setVehicle(null); setSelection(null); }}>
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Price tweak settings — sandbox only, never saved or pushed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Tweak prices
            {tweaked && (
              <span className="text-xs font-bold uppercase tracking-wide text-primary">
                tweaks on
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Experiment with the figures below and watch every price on this page update. These
            settings are sandbox-only — they are never saved, never pushed live, and the Push live
            button below always pushes the plan's real prices.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Adjust all prices (%)</Label>
            <Input
              type="number"
              min={-50}
              max={50}
              step={1}
              value={tweaks.priceAdjustPct}
              onChange={e => setTweaks(t => ({ ...t, priceAdjustPct: Number(e.target.value) || 0 }))}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">e.g. 5 = 5% dearer, −10 = 10% cheaper</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quotes & Orders gap (%)</Label>
            <Input
              type="number"
              min={0}
              max={50}
              step={1}
              value={effectiveGapPct}
              onChange={e => {
                const v = Number(e.target.value);
                setGapTweak(Number.isFinite(v) ? v : null);
              }}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">Live gap: {gapPct}%</p>
          </div>
          <Button variant="outline" onClick={resetTweaks} disabled={!tweaked}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Back to live prices
          </Button>
        </CardContent>
      </Card>

      {/* Payment options — which ways to pay appear, and their variables */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Payment options
            {!paymentSettingsAreLive(paymentSettings) && (
              <span className="text-xs font-bold uppercase tracking-wide text-primary">
                experimenting
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Choose which ways to pay appear on the sandbox tiles and set their variables. Klarna
            and Zopa are design experiments only — there is no integration, no credit check and no
            payment behind them, and nothing here is ever pushed live.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* BAW PayLater */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <Checkbox
                checked={paymentSettings.payLater.enabled}
                onCheckedChange={v =>
                  setPaymentSettings(s => ({
                    ...s,
                    payLater: { ...s.payLater, enabled: v === true },
                  }))
                }
              />
              BAW PayLater (yearly collection)
            </label>
            {paymentSettings.payLater.enabled && (
              <div className="flex flex-wrap items-end gap-4 pl-6">
                <div className="space-y-1">
                  <Label className="text-xs">Yearly uplift (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    value={paymentSettings.payLater.upliftPct}
                    onChange={e =>
                      setPaymentSettings(s => ({
                        ...s,
                        payLater: { ...s.payLater, upliftPct: Number(e.target.value) || 0 },
                      }))
                    }
                    className="w-28"
                  />
                  <p className="text-xs text-muted-foreground">Live rule: 10%</p>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer pb-1">
                  <Checkbox
                    checked={paymentSettings.payLater.offerOn24}
                    onCheckedChange={v =>
                      setPaymentSettings(s => ({
                        ...s,
                        payLater: { ...s.payLater, offerOn24: v === true },
                      }))
                    }
                  />
                  Offer on 2-year cover
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer pb-1">
                  <Checkbox
                    checked={paymentSettings.payLater.offerOn36}
                    onCheckedChange={v =>
                      setPaymentSettings(s => ({
                        ...s,
                        payLater: { ...s.payLater, offerOn36: v === true },
                      }))
                    }
                  />
                  Offer on 3-year cover
                </label>
              </div>
            )}
          </div>

          {/* Klarna */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <Checkbox
                checked={paymentSettings.klarna.enabled}
                onCheckedChange={v =>
                  setPaymentSettings(s => ({
                    ...s,
                    klarna: { ...s.klarna, enabled: v === true },
                  }))
                }
              />
              Klarna — pay in instalments
              <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                experiment
              </span>
            </label>
            {paymentSettings.klarna.enabled && (
              <div className="flex flex-wrap items-end gap-4 pl-6">
                <div className="space-y-1">
                  <Label className="text-xs">Number of payments</Label>
                  <Select
                    value={String(paymentSettings.klarna.instalments)}
                    onValueChange={v =>
                      setPaymentSettings(s => ({
                        ...s,
                        klarna: { ...s.klarna, instalments: Number(v) },
                      }))
                    }
                  >
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4].map(n => (
                        <SelectItem key={n} value={String(n)}>Pay in {n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Interest-free, one every 30 days</p>
                </div>
              </div>
            )}
          </div>

          {/* Zopa */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <Checkbox
                checked={paymentSettings.zopa.enabled}
                onCheckedChange={v =>
                  setPaymentSettings(s => ({
                    ...s,
                    zopa: { ...s.zopa, enabled: v === true },
                  }))
                }
              />
              Zopa — monthly loan
              <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                experiment
              </span>
            </label>
            {paymentSettings.zopa.enabled && (
              <div className="flex flex-wrap items-end gap-4 pl-6">
                <div className="space-y-1">
                  <Label className="text-xs">Representative APR (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    step={0.1}
                    value={paymentSettings.zopa.aprPct}
                    onChange={e =>
                      setPaymentSettings(s => ({
                        ...s,
                        zopa: { ...s.zopa, aprPct: Number(e.target.value) || 0 },
                      }))
                    }
                    className="w-28"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Loan length</Label>
                  <Select
                    value={String(paymentSettings.zopa.termMonths)}
                    onValueChange={v =>
                      setPaymentSettings(s => ({
                        ...s,
                        zopa: { ...s.zopa, termMonths: Number(v) },
                      }))
                    }
                  >
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[12, 18, 24, 36, 48].map(m => (
                        <SelectItem key={m} value={String(m)}>{m} months</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {vehicle && selectedVersion && (
        <DraftPricingScope
          matrix={selectedVersion.admin_matrix}
          discountPct={selectedVersion.step3_discount_pct}
          active={selectedVersion.status !== 'live'}
        >
          {selection ? (
            <SandboxStep4Preview
              vehicle={vehicle}
              selection={selection}
              onBack={() => setSelection(null)}
            />
          ) : (
            <>
              <SandboxStep3Pricing
                vehicle={vehicle}
                options={options}
                onOptionsChange={setOptions}
                onSelect={setSelection}
                tweaks={effectiveTweaks}
                paymentSettings={paymentSettings}
              />
              <QuotesOrdersReviewPanel
                vehicle={vehicle}
                options={options}
                gapPct={effectiveGapPct}
                tweaks={effectiveTweaks}
              />
            </>
          )}
        </DraftPricingScope>
      )}

      {/* Push live */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Push live
          </CardTitle>
          <CardDescription>
            Pushes the PRICES of the selected plan through the same machinery as Price Updates.
            The new step 3 design goes live separately, the next time the website is published.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Plan to push: <span className="font-semibold">{selectedVersion?.label ?? '—'}</span>
            {selectedVersion?.status === 'live' && (
              <span className="text-muted-foreground"> (already live — pushing again changes nothing)</span>
            )}
          </p>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={alsoUpdateQuotesOrders}
              onCheckedChange={v => setAlsoUpdateQuotesOrders(v === true)}
            />
            <span>
              Also update Quotes & Orders
              <span className="block text-xs text-muted-foreground">
                Re-bases the Quotes & Orders grid on this plan (always {gapPct}% above the website
                price). Unticked, only the website prices move and the Q&O grid stays as it is.
              </span>
            </span>
          </label>
          <Button
            onClick={handlePushLive}
            disabled={pushing || !selectedVersion || selectedVersion.status === 'live'}
          >
            {pushing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Push “{selectedVersion?.label ?? '—'}” live
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
