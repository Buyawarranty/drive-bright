import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Rocket, ArrowRight, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { CODE_WEB_DISCOUNT_PCT, MAX_WEB_DISCOUNT_PCT } from '@/lib/pricing/pricingVersionConfig';
import { runPreflightCheck, type PreflightItem } from '@/lib/pricing/preflightCheck';


/** One model in this section that a manager is allowed to publish. */
export interface PushCandidate {
  key: string;
  /** Exactly what the manager sees, e.g. "Aug hybrid test (right side)". */
  label: string;
  /** Short line explaining what publishing this changes. */
  description?: string;
  /** Age-band style model to publish. Return null if it isn't ready. */
  getModel: () => any | null;
  /** Optional grid / labour rates published with this model, for the checks. */
  getPreflightExtras?: () => {
    adminMatrix?: unknown;
    labourRateFactors?: { rate: number; factor: number | null }[] | null;
  } | null;
  /** Website (Step 3/4) discount to publish with this model. */
  websiteDiscountPct?: number;
}


export interface SectionPushLiveBarProps {
  /** The section this bar belongs to, e.g. "Code base vs Test Hybrid Aug". */
  sectionLabel: string;
  /** Label of whatever is live right now. */
  liveLabel?: string | null;
  candidates: PushCandidate[];
  /** For sections that own their own publish flow (e.g. the price grid). */
  directPush?: { label: string; run: () => void | Promise<void> };
  onPush?: (model: any, label: string, websiteDiscountPct?: number) => void | Promise<void>;
  /** Website (Step 3/4) gap that is live right now, used as the starting value. */
  liveWebDiscountPct?: number | null;
  busy?: boolean;
}

/**
 * Always-visible go-live bar for a single pricing section. Sticks to the top of
 * the section so the manager can see which model is live and publish the exact
 * side of a comparison they mean — the confirm dialog names it explicitly.
 */
const SectionPushLiveBar: React.FC<SectionPushLiveBarProps> = ({
  sectionLabel,
  liveLabel,
  candidates,
  directPush,
  onPush,
  liveWebDiscountPct,
  busy,
}) => {
  const [pending, setPending] = useState<PushCandidate | null>(null);
  const [webGap, setWebGap] = useState(
    String(liveWebDiscountPct ?? CODE_WEB_DISCOUNT_PCT)
  );

  const closePending = () => {
    setPending(null);
  };

  const gapValue = Math.min(
    Math.max(Number(webGap) || 0, 0),
    MAX_WEB_DISCOUNT_PCT
  );

  /** Completeness check for whatever is about to be published. */
  const preflight = useMemo(() => {
    if (!pending) return null;
    let model: any = null;
    let extras: { adminMatrix?: unknown; labourRateFactors?: any } | null = null;
    try {
      model = pending.getModel();
      extras = pending.getPreflightExtras?.() ?? null;
    } catch {
      model = null;
    }
    // Anything in the version that names a vehicle and gives it a price is
    // checked against the excluded vehicle matrix before this can go live.
    const pricedVehicles = [
      ...(Array.isArray(model?.modelFloors) ? model.modelFloors : []),
      ...(Array.isArray(model?.modelRisks) ? model.modelRisks : []),
    ]
      .filter((r: any) => r?.covered !== false)
      .map((r: any) => {
        const text = String(r?.vehicle ?? r?.label ?? r?.key ?? '').trim();
        return { make: text, model: text, label: text };
      })
      .filter(v => v.label.length > 0);

    return runPreflightCheck({
      adminMatrix: extras?.adminMatrix,
      labourRateFactors: extras?.labourRateFactors ?? null,
      vehicleFactorModel: model,
      webDiscountPct: pending.websiteDiscountPct ?? gapValue,
      pricedVehicles,
    });
  }, [pending, gapValue]);

  const openPending = (c: PushCandidate) => {
    setPending(c);
  };

  const confirmPush = async () => {
    if (!pending || !onPush) return;
    if (preflight?.blocked) return;
    const model = pending.getModel();
    closePending();
    if (!model) return;
    await onPush(model, `${sectionLabel} — ${pending.label}`, pending.websiteDiscountPct ?? gapValue);
  };

  return (
    <>
      <div className="sticky top-0 z-20 rounded-lg border-2 border-primary/30 bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{sectionLabel}</span>
              {liveLabel ? (
                <Badge className="bg-emerald-600">Live now: {liveLabel}</Badge>
              ) : (
                <Badge variant="secondary">Live now: built-in code pricing</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {onPush || directPush
                ? 'Pick the exact model you want customers and agents to use — the button names which side goes live.'
                : 'Read-only comparison — publish from the section that owns the model.'}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {(onPush || directPush) && (
              <div className="space-y-1">
                <Label className="text-xs whitespace-nowrap">
                  Step 3/4 vs Quotes &amp; Orders
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    className="h-8 w-20"
                    type="number"
                    min={0}
                    max={MAX_WEB_DISCOUNT_PCT}
                    step={0.5}
                    value={webGap}
                    onChange={e => setWebGap(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">% cheaper</span>
                </div>
              </div>
            )}
            {directPush && (
              <Button size="sm" disabled={busy} onClick={() => directPush.run()}>
                <Rocket className="mr-1 h-4 w-4" />
                Push live: {directPush.label}
              </Button>
            )}
            {candidates.map(c => (
              <Button
                key={c.key}
                size="sm"
                variant="default"
                disabled={busy || !onPush}
                onClick={() => openPending(c)}
              >
                <Rocket className="mr-1 h-4 w-4" />
                Push live: {c.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={!!pending} onOpenChange={open => !open && closePending()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Push this model live?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{liveLabel || 'Built-in code pricing'}</Badge>
                  <ArrowRight className="h-4 w-4" />
                  <Badge className="bg-emerald-600">{pending?.label}</Badge>
                </div>
                <p>
                  <strong>{sectionLabel}</strong> — publishing <strong>{pending?.label}</strong>. Quotes
                  &amp; Orders will price with this model immediately, and the customer journey (Step
                  3/4) will be <strong>{pending?.websiteDiscountPct ?? gapValue}% cheaper</strong>{' '}
                  than the Quotes &amp; Orders price, rounded to the nearest pound.
                </p>
                {pending?.description && <p>{pending.description}</p>}
              </div>
            </DialogDescription>
          </DialogHeader>

          {preflight && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Before it goes live</span>
                {preflight.blocked ? (
                  <Badge variant="destructive">Not ready</Badge>
                ) : preflight.hasWarnings ? (
                  <Badge className="bg-amber-500 text-amber-950">Check these</Badge>
                ) : (
                  <Badge className="bg-emerald-600">All checks passed</Badge>
                )}
              </div>
              <ul className="space-y-2">
                {preflight.items.map(item => (
                  <PreflightRow key={item.key} item={item} />
                ))}
              </ul>
              {preflight.blocked && (
                <p className="text-xs text-muted-foreground">
                  Fill in the gaps above, then push live. This stops a customer being quoted a price
                  you never approved.
                </p>
              )}
              {!preflight.blocked && preflight.hasWarnings && (
                <p className="text-xs text-muted-foreground">
                  These are advisory checks only. Review them above, then use the push button below.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closePending}>
              Cancel
            </Button>
            <Button
              onClick={confirmPush}
              disabled={
                busy ||
                !!preflight?.blocked
              }
            >
              <Rocket className="mr-1 h-4 w-4" /> Yes, push {pending?.label} live
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </>
  );
};

/** One line of the completeness checklist. */
const PreflightRow: React.FC<{ item: PreflightItem }> = ({ item }) => {
  const Icon =
    item.severity === 'ok' ? CheckCircle2 : item.severity === 'warn' ? AlertTriangle : XCircle;
  const tone =
    item.severity === 'ok'
      ? 'text-emerald-600'
      : item.severity === 'warn'
        ? 'text-amber-600'
        : 'text-destructive';
  return (
    <li className="flex gap-2 text-sm">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
      <div className="min-w-0">
        <span className="font-medium">{item.label}</span>{' '}
        <span className="text-muted-foreground">— {item.detail}</span>
        {item.gaps?.length ? (
          <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
            {item.gaps.map(g => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
};


export default SectionPushLiveBar;
