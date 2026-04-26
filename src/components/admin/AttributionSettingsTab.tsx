import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

type OptionId = 'strict' | 'lookback_7d' | 'tighten_matching' | 'backfill';

interface OptionDef {
  id: OptionId;
  title: string;
  description: string;
  recommended?: boolean;
}

const OPTIONS: OptionDef[] = [
  {
    id: 'strict',
    title: 'Strict per-visit attribution',
    description:
      "Remove cross-cart email lookup. lead_source comes only from the current cart's fbclid/gclid/utm_source.",
    recommended: true,
  },
  {
    id: 'lookback_7d',
    title: 'Keep lookback but limit to 7 days',
    description: 'Inherit attribution from past carts only if created within 7 days.',
  },
  {
    id: 'tighten_matching',
    title: 'Keep lookback but tighten matching',
    description: "Use proper JSON keys instead of LIKE '%gclid%' on JSON text.",
  },
  {
    id: 'backfill',
    title: 'Also backfill historical mis-tagged leads',
    description:
      "Run a one-time UPDATE to relabel leads from Apr 14 onward with no attribution signals back to 'website'.",
  },
];

export const AttributionSettingsTab: React.FC = () => {
  const [selected, setSelected] = useState<Set<OptionId>>(
    new Set<OptionId>(['strict', 'backfill'])
  );

  const toggle = (id: OptionId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showBackfillWarning = selected.has('backfill');

  const handleConfirm = () => {
    alert('Attribution settings saved');
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attribution Settings</h1>
          <p className="text-sm text-muted-foreground">
            Control how new leads are tagged as Organic, Google Ads or Facebook Ads.
          </p>
        </div>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base">Attribution rules</CardTitle>
          <CardDescription>Choose one or more behaviours to apply.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {OPTIONS.map((opt) => {
            const isChecked = selected.has(opt.id);
            return (
              <label
                key={opt.id}
                htmlFor={`attr-opt-${opt.id}`}
                className={cn(
                  'flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors',
                  isChecked
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40 hover:bg-muted/40'
                )}
              >
                <Checkbox
                  id={`attr-opt-${opt.id}`}
                  checked={isChecked}
                  onCheckedChange={() => toggle(opt.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{opt.title}</span>
                    {opt.recommended && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
              </label>
            );
          })}
        </CardContent>
      </Card>

      {showBackfillWarning && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-4"
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Backfill will relabel historical leads</p>
            <p className="mt-0.5 text-amber-800">This cannot be undone.</p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleConfirm}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          Confirm
        </Button>
      </div>
    </div>
  );
};

export default AttributionSettingsTab;
