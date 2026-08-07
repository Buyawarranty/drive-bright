import React, { useState } from 'react';
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
import { Rocket, ArrowRight } from 'lucide-react';

/** One model in this section that a manager is allowed to publish. */
export interface PushCandidate {
  key: string;
  /** Exactly what the manager sees, e.g. "Aug hybrid test (right side)". */
  label: string;
  /** Short line explaining what publishing this changes. */
  description?: string;
  /** Age-band style model to publish. Return null if it isn't ready. */
  getModel: () => any | null;
  /** Website (Step 3/4) discount to publish with this model. */
  websiteDiscountPct?: number;
}

export interface SectionPushLiveBarProps {
  /** The section this bar belongs to, e.g. "Code base vs Test Hybrid Aug". */
  sectionLabel: string;
  /** Label of whatever is live right now. */
  liveLabel?: string | null;
  candidates: PushCandidate[];
  onPush?: (model: any, label: string, websiteDiscountPct?: number) => void | Promise<void>;
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
  onPush,
  busy,
}) => {
  const [pending, setPending] = useState<PushCandidate | null>(null);

  const confirmPush = async () => {
    if (!pending || !onPush) return;
    const model = pending.getModel();
    setPending(null);
    if (!model) return;
    await onPush(model, `${sectionLabel} — ${pending.label}`, pending.websiteDiscountPct);
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
              {onPush
                ? 'Pick the exact model you want customers and agents to use — the button names which side goes live.'
                : 'Read-only comparison — publish from the section that owns the model.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {candidates.map(c => (
              <Button
                key={c.key}
                size="sm"
                variant="default"
                disabled={busy || !onPush}
                onClick={() => setPending(c)}
              >
                <Rocket className="mr-1 h-4 w-4" />
                Push live: {c.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={!!pending} onOpenChange={open => !open && setPending(null)}>
        <DialogContent>
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
                  3/4) will use it minus the website discount, rounded to the nearest pound.
                </p>
                {pending?.description && <p>{pending.description}</p>}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={confirmPush} disabled={busy}>
              <Rocket className="mr-1 h-4 w-4" /> Yes, push {pending?.label} live
            </Button>
          </DialogFooter>
        </DialogFooter>
      </Dialog>
    </>
  );
};

export default SectionPushLiveBar;
