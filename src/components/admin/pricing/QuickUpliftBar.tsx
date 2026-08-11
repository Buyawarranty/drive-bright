import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, RotateCcw, Save, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * QUICK PRICE CHANGE FOR ONE PRICING VARIANT.
 *
 * Sits at the very top of every comparison panel so a manager never has to open
 * the age-band builder to move prices: tap a decrease / increase preset, or type
 * an exact percentage, and the whole Quotes & Orders curve for that variant
 * moves by that amount. The website Step 3 price stays "grid minus the web gap",
 * so it follows in proportion.
 *
 * Two separate actions, deliberately:
 *   - "Save draft" keeps the percentage on this machine so it is still set when
 *     the tab is reopened, and the test figures below reflect it immediately.
 *     Customers are NOT affected.
 *   - "Push live" (the bar directly beneath this one) is what publishes it.
 */

/** Decrease presets on the left, increase presets on the right. */
const DECREASE_PRESETS = [-20, -15, -10, -5];
const INCREASE_PRESETS = [5, 10, 15, 20, 25, 30];

const storageKey = (variantLabel: string) =>
  `pricing_quick_uplift_${variantLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

/** Saved draft percentage for a variant, 0 when nothing has been saved. */
export function readSavedUplift(variantLabel: string): number {
  try {
    const raw = localStorage.getItem(storageKey(variantLabel));
    const pct = raw === null ? 0 : Number(raw);
    return Number.isFinite(pct) ? pct : 0;
  } catch {
    return 0;
  }
}

/** Scale the one-year age curve of a builder model by a percentage uplift. */
export function applyModelUplift<T extends { bands?: any[] }>(model: T, pct: number): T {
  if (!model || !pct) return model;
  const scale = 1 + pct / 100;
  const bands = Array.isArray((model as any).bands)
    ? (model as any).bands.map((b: any) => ({
        ...b,
        oneYear: b.oneYear === null || b.oneYear === undefined ? b.oneYear : Math.round(Number(b.oneYear) * scale),
      }))
    : (model as any).bands;
  return { ...(model as any), bands };
}

const QuickUpliftBar: React.FC<{
  /** Which variant this control belongs to, e.g. "Aug hybrid test". */
  variantLabel: string;
  value: number;
  onChange: (pct: number) => void;
}> = ({ variantLabel, value, onChange }) => {
  const [savedPct, setSavedPct] = useState(() => readSavedUplift(variantLabel));
  useEffect(() => setSavedPct(readSavedUplift(variantLabel)), [variantLabel]);

  const dirty = value !== savedPct;

  const save = () => {
    try {
      localStorage.setItem(storageKey(variantLabel), String(value));
      setSavedPct(value);
      toast.success(
        value === 0
          ? `${variantLabel}: price change cleared and saved as a draft`
          : `${variantLabel}: ${value > 0 ? '+' : ''}${value}% saved as a draft — push live when you are happy`
      );
    } catch {
      toast.error('Could not save the draft on this browser');
    }
  };

  return (
    <div className="sticky top-0 z-30 rounded-lg border-2 border-primary/30 bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {value < 0 ? (
            <TrendingDown className="h-4 w-4 text-primary" />
          ) : (
            <TrendingUp className="h-4 w-4 text-primary" />
          )}
          <Label className="text-sm font-semibold">Change price — {variantLabel}</Label>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {DECREASE_PRESETS.map(p => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={value === p ? 'default' : 'outline'}
              onClick={() => onChange(p)}
            >
              {p}%
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={value === 0 ? 'default' : 'outline'}
            onClick={() => onChange(0)}
          >
            No change
          </Button>
          {INCREASE_PRESETS.map(p => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={value === p ? 'default' : 'outline'}
              onClick={() => onChange(p)}
            >
              +{p}%
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor={`uplift-${variantLabel}`} className="text-xs text-muted-foreground">
            Exact %
          </Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              aria-label="Decrease by 1%"
              onClick={() => onChange(Math.max(-50, value - 1))}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Input
              id={`uplift-${variantLabel}`}
              type="number"
              min={-50}
              max={200}
              step={1}
              className="h-8 w-20 text-center"
              value={value}
              onChange={e => onChange(Number(e.target.value) || 0)}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              aria-label="Increase by 1%"
              onClick={() => onChange(Math.min(200, value + 1))}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {value !== 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(0)}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {dirty ? (
            <Badge variant="secondary" className="text-xs">Unsaved</Badge>
          ) : (
            savedPct !== 0 && (
              <Badge variant="secondary" className="text-xs">
                <Check className="mr-1 h-3 w-3" />
                Draft saved {savedPct > 0 ? '+' : ''}{savedPct}%
              </Badge>
            )
          )}
          <Button type="button" size="sm" onClick={save} disabled={!dirty}>
            <Save className="mr-2 h-4 w-4" />
            Save draft
          </Button>
        </div>
      </div>

      {value !== 0 && (
        <p className="mt-2 text-xs font-medium">
          Quotes &amp; Orders prices {value > 0 ? 'up' : 'down'} {Math.abs(value)}% — website Step 3 follows in
          proportion.
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        Applies to every claim limit, labour rate, excess and term in this variant, rounded to whole pounds.
        Minimum price floors still apply. Test the figures below first — saving keeps it as a draft, and customers
        only see it once you use “Push live” underneath.
      </p>
    </div>
  );
};

export default QuickUpliftBar;
