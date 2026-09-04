import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BatteryCharging, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_POWERTRAIN_RULES,
  POWERTRAIN_KEYS,
  POWERTRAIN_LABEL,
  clampBandFactor,
  normalizePowertrainRules,
  type PowertrainKey,
  type PowertrainRule,
  type RiskBandConfig,
} from '@/lib/pricing/vehicleRiskBands';

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * CATEGORY PRICE PER POWERTRAIN
 * One uplift and one 1-year minimum for every electric car, every plug-in
 * hybrid and every full hybrid — so all of a group can be re-priced in one go.
 * Named makes / models can be excluded and then price on their model-risk band
 * alone, exactly as a petrol car would.
 */
const PowertrainCategoryPanel: React.FC<{
  config: RiskBandConfig;
  update: (next: RiskBandConfig) => void;
}> = ({ config, update }) => {
  const rules = normalizePowertrainRules(config.powertrains);
  const [draft, setDraft] = useState<Record<PowertrainKey, { make: string; model: string }>>({
    ev: { make: '', model: '' },
    phev: { make: '', model: '' },
    hev: { make: '', model: '' },
  });

  const patch = (key: PowertrainKey, next: Partial<PowertrainRule>) => {
    update({ ...config, powertrains: { ...rules, [key]: { ...rules[key], ...next } } });
  };

  const addExclusion = (key: PowertrainKey) => {
    const make = draft[key].make.trim();
    const model = draft[key].model.trim();
    if (!make && !model) {
      toast.error('Enter a make, a model, or both.');
      return;
    }
    patch(key, {
      excludes: [{ id: newId(`${key}-ex`), make, model }, ...rules[key].excludes],
    });
    setDraft(d => ({ ...d, [key]: { make: '', model: '' } }));
    toast.success(
      `${[make, model].filter(Boolean).join(' ')} is out of the ${POWERTRAIN_LABEL[key]} category price.`
    );
  };

  const removeExclusion = (key: PowertrainKey, id: string) => {
    patch(key, { excludes: rules[key].excludes.filter(x => x.id !== id) });
  };

  const resetCategory = (key: PowertrainKey) => {
    const d = DEFAULT_POWERTRAIN_RULES[key];
    patch(key, { ...d, excludes: [...d.excludes] });
    toast.info(`${POWERTRAIN_LABEL[key]} reset to the starter figures.`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <BatteryCharging className="h-5 w-5" /> Category price — electric &amp; hybrid
        </CardTitle>
        <CardDescription>
          Set one uplift and one minimum 12-month price for a whole powertrain, so every electric car
          (or plug-in hybrid, or full hybrid) can be re-priced at once. Hybrids are kept separate from
          electric so they can move independently. Anything on a category&apos;s exclusion list is
          priced like a normal car on its model-risk band. Push live from the button above to apply.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription className="text-sm">
            Order of pricing: age base × mileage × <strong>category uplift</strong> × vehicle type ×
            model-risk band, then the highest of the band minimum, the category minimum and the global
            minimum. Fuel type comes from the DVLA lookup, so a vehicle with no fuel data never picks
            up a category price.
          </AlertDescription>
        </Alert>

        {POWERTRAIN_KEYS.map(key => {
          const rule = rules[key];
          return (
            <div key={key} className="rounded-lg border p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-sm">
                    {POWERTRAIN_LABEL[key]}
                  </Badge>
                  {rule.enabled ? (
                    <span className="text-xs text-muted-foreground">
                      {Math.round((clampBandFactor(rule.factor) - 1) * 100)}% on the standard price
                      {rule.minOneYear ? ` · minimum £${rule.minOneYear} for 12 months` : ' · no category minimum'}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Off — priced as a normal car</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={v => patch(key, { enabled: v })}
                      aria-label={`${POWERTRAIN_LABEL[key]} category price on`}
                    />
                    <span className="text-xs">{rule.enabled ? 'On' : 'Off'}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => resetCategory(key)}>
                    Reset
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Uplift factor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={rule.factor}
                    onChange={e => patch(key, { factor: clampBandFactor(Number(e.target.value)) })}
                    disabled={!rule.enabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Minimum 12-month price (£, blank for none)</Label>
                  <Input
                    type="number"
                    value={rule.minOneYear ?? ''}
                    onChange={e => {
                      const n = Number(e.target.value);
                      patch(key, { minOneYear: Number.isFinite(n) && n > 0 ? Math.round(n) : null });
                    }}
                    disabled={!rule.enabled}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">
                  Excluded from this category ({rule.excludes.length})
                </Label>
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    className="w-40"
                    placeholder="Make e.g. Tesla"
                    value={draft[key].make}
                    onChange={e => setDraft(d => ({ ...d, [key]: { ...d[key], make: e.target.value } }))}
                  />
                  <Input
                    className="w-48"
                    placeholder="Model (blank = whole make)"
                    value={draft[key].model}
                    onChange={e => setDraft(d => ({ ...d, [key]: { ...d[key], model: e.target.value } }))}
                  />
                  <Button variant="outline" size="sm" onClick={() => addExclusion(key)}>
                    <Plus className="h-4 w-4 mr-2" /> Exclude
                  </Button>
                </div>
                {rule.excludes.length ? (
                  <div className="flex flex-wrap gap-2">
                    {rule.excludes.map(x => (
                      <span
                        key={x.id}
                        className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs"
                      >
                        {[x.make, x.model].filter(Boolean).join(' ') || '(any)'}
                        <button
                          type="button"
                          onClick={() => removeExclusion(key, x.id)}
                          aria-label={`Remove ${x.make} ${x.model} from the exclusions`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nothing excluded — every {POWERTRAIN_LABEL[key].toLowerCase()} gets the category price.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default PowertrainCategoryPanel;
