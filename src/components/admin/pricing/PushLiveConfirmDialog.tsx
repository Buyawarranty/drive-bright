import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Rocket } from 'lucide-react';

interface PushLiveConfirmDialogProps {
  open: boolean;
  /** Name of the pricing plan about to go live. */
  planLabel: string;
  /**
   * Website gap in percent, or null when the gap is fixed
   * (code-base pricing keeps the built-in 10%).
   */
  gapPct: number | null;
  onGapPctChange?: (pct: number) => void;
  /** Blank grid cells that will be filled from the current live prices. */
  filledCount?: number;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The single "Are you sure?" gate for every push-live action in Price Updates.
 * Asks for confirmation and lets management choose how much cheaper the
 * website (Step 3/4) should be than Quotes & Orders before anything goes live.
 */
export default function PushLiveConfirmDialog({
  open,
  planLabel,
  gapPct,
  onGapPctChange,
  filledCount = 0,
  busy,
  onConfirm,
  onCancel,
}: PushLiveConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !busy) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Push this pricing live?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                <strong>Are you sure?</strong> “{planLabel}” will go live immediately.
                Quotes &amp; Orders will charge these prices straight away.
              </p>
              {gapPct !== null ? (
                <div className="space-y-1">
                  <label htmlFor="push-live-gap" className="font-semibold text-foreground">
                    How much cheaper should the website be than Quotes &amp; Orders?
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="push-live-gap"
                      type="number"
                      min={0}
                      max={50}
                      step={1}
                      value={gapPct}
                      onChange={e => onGapPctChange?.(Number(e.target.value))}
                      className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm"
                    />
                    <span className="text-muted-foreground">% cheaper on Step 3/4</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The customer journey price is the Quotes &amp; Orders price minus this
                    percentage, rounded to the nearest whole pound.
                  </p>
                </div>
              ) : (
                <p>The website (Step 3/4) will be the built-in 10% cheaper than Quotes &amp; Orders.</p>
              )}
              {filledCount > 0 && (
                <p className="text-xs">
                  {filledCount} blank price cell(s) will be filled from the current live prices so
                  no page loses a price.
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            <Rocket className="h-4 w-4 mr-1" /> {busy ? 'Pushing live…' : 'Yes, push live'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
