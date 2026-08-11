import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, RotateCcw } from 'lucide-react';

/**
 * Quick percentage uplift for a pricing variant.
 * One control, shown on every variant panel: tap 5 / 10 / 15 / 20 / 25% and the
 * whole Quotes & Orders curve for that variant moves by that amount. The website
 * Step 3 price stays "grid minus the web gap", so it follows in proportion.
 * Nothing is saved until the variant is pushed live.
 */

const PRESETS = [0, 5, 10, 15, 20, 25, 30];

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
}> = ({ variantLabel, value, onChange }) => (
  <div className="rounded-lg border-2 bg-muted/30 p-3">
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <Label className="text-sm font-semibold">Quick price uplift — {variantLabel}</Label>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map(p => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant={value === p ? 'default' : 'outline'}
            onClick={() => onChange(p)}
          >
            {p === 0 ? 'None' : `+${p}%`}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor={`uplift-${variantLabel}`} className="text-xs text-muted-foreground">
          Custom %
        </Label>
        <Input
          id={`uplift-${variantLabel}`}
          type="number"
          min={-50}
          max={200}
          step={1}
          className="h-8 w-24"
          value={value}
          onChange={e => onChange(Number(e.target.value) || 0)}
        />
        {value !== 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(0)}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>
      {value !== 0 && (
        <Badge variant="secondary" className="text-xs">
          Quotes &amp; Orders prices {value > 0 ? 'up' : 'down'} {Math.abs(value)}% — website Step 3 follows in proportion
        </Badge>
      )}
    </div>
    <p className="mt-2 text-xs text-muted-foreground">
      Applies to every claim limit, labour rate, excess and term in this variant, rounded to whole pounds.
      Minimum price floors still apply. Takes effect for customers only when you push this variant live.
    </p>
  </div>
);

export default QuickUpliftBar;
