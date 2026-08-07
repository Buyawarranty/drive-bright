import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, FlaskConical, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_MODEL_RISK_RULES,
  MAX_RISK_FACTOR,
  MIN_RISK_FACTOR,
  applyModelRisk,
  clampRiskFactor,
  isTooBroad,
  loadDraftModelRiskRules,
  resolveModelRisk,
  saveDraftModelRiskRules,
  type ModelRiskRule,
} from '@/lib/pricing/modelRiskRules';
import { calculateQuotePrice } from '@/lib/pricing/quotePricingService';
import { isVehicleExcluded } from '@/lib/vehicleExclusions';
import type { PaymentPeriod } from '@/lib/pricingMatrix';

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

const PERIODS: { value: PaymentPeriod; label: string }[] = [
  { value: '12months', label: '1 year' },
  { value: '24months', label: '2 years' },
  { value: '36months', label: '3 years' },
];

/** Vehicles used to show that the same make can now price very differently. */
const SAMPLES: { make: string; model: string; fuelType: string; year: string; mileage: string }[] = [
  { make: 'BMW', model: '118d SE', fuelType: 'Diesel', year: '2018', mileage: '62000' },
  { make: 'BMW', model: '520d SE', fuelType: 'Diesel', year: '2018', mileage: '78000' },
  { make: 'BMW', model: 'X5 xDrive30d', fuelType: 'Diesel', year: '2016', mileage: '92000' },
  { make: 'Mercedes', model: 'A180 SE', fuelType: 'Petrol', year: '2019', mileage: '40000' },
  { make: 'Mercedes', model: 'C220d Sport', fuelType: 'Diesel', year: '2017', mileage: '68000' },
  { make: 'Volkswagen', model: 'Golf Match TSI', fuelType: 'Petrol', year: '2019', mileage: '38000' },
  { make: 'Land Rover', model: 'Range Rover Sport HSE', fuelType: 'Diesel', year: '2016', mileage: '88000' },
  { make: 'Ford', model: 'Fiesta Zetec', fuelType: 'Petrol', year: '2017', mileage: '54000' },
];

export default function ModelRiskDraftPanel() {
  const [rules, setRules] = useState<ModelRiskRule[]>(DEFAULT_MODEL_RISK_RULES);
  const [period, setPeriod] = useState<PaymentPeriod>('12months');
  const [testMake, setTestMake] = useState('BMW');
  const [testModel, setTestModel] = useState('520d SE');

  useEffect(() => {
    setRules(loadDraftModelRiskRules());
  }, []);

  const update = useCallback((id: string, patch: Partial<ModelRiskRule>) => {
    setRules(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addRule = useCallback(() => {
    setRules(prev => [
      { id: `rule-${Date.now()}`, make: '', model: '', riskFactor: 1, minOneYear: null, enabled: true },
      ...prev,
    ]);
  }, []);

  const save = useCallback(() => {
    const clean = rules
      .filter(r => String(r.make || '').trim())
      .map(r => ({ ...r, riskFactor: clampRiskFactor(Number(r.riskFactor)) }));
    setRules(clean);
    saveDraftModelRiskRules(clean);
    toast.success('Draft model risk rules saved (nothing live changed)');
  }, [rules]);

  const reset = useCallback(() => {
    setRules(DEFAULT_MODEL_RISK_RULES);
    saveDraftModelRiskRules(DEFAULT_MODEL_RISK_RULES);
    toast.info('Reset to the starter rule set');
  }, []);

  /** Base price for a sample vehicle, before and after model risk. */
  const rows = useMemo(() => {
    return SAMPLES.map(v => {
      const quote = calculateQuotePrice({
        vehicle: {
          make: v.make,
          model: v.model,
          fuelType: v.fuelType,
          vehicleType: 'Car',
          yearOfManufacture: v.year,
          mileage: v.mileage,
        },
        paymentPeriod: period,
        surface: 'admin',
        skipEligibility: true,
      });
      const outcome = resolveModelRisk(v.make, v.model, period, rules);
      const { price, floorApplied } = applyModelRisk(quote.total, outcome);
      return {
        ...v,
        current: quote.total,
        draft: price,
        delta: price - quote.total,
        outcome,
        floorApplied,
      };
    });
  }, [period, rules]);

  const testOutcome = useMemo(
    () => resolveModelRisk(testMake, testModel, period, rules),
    [testMake, testModel, period, rules]
  );

  const broadCount = rules.filter(r => r.enabled && isTooBroad(r)).length;
  const excludedRules = rules.filter(
    r => r.enabled && !isTooBroad(r) && isVehicleExcluded(r.make, r.model)
  );

  return (
    <Card className="border-2 border-amber-300">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FlaskConical className="h-5 w-5" />
              Model risk rules (draft)
            </CardTitle>
            <CardDescription>
              Risk priced by <strong>make + model</strong>, not by make alone — so a 118d and a
              520d no longer price the same. Vehicles we do not cover (M, AMG, RS, supercars) are
              declined by the excluded vehicle matrix and are never priced here. Draft only: these rules are stored on this device and are
              not used by Quotes &amp; Orders or the customer journey.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-amber-400 text-amber-700">
            Not live
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <Alert>
          <AlertDescription className="text-sm">
            £5,000 cover is <strong>no longer blocked</strong> for any vehicle. Model risk is priced
            here as a multiplier and an optional minimum price only — never as a cover restriction.
          </AlertDescription>
        </Alert>

        {broadCount > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {broadCount} rule{broadCount > 1 ? 's' : ''} name only a make, which prices every
              model of that make the same. Add a model or trim to keep risk granular.
            </AlertDescription>
          </Alert>
        )}

        {excludedRules.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {excludedRules.length} rule{excludedRules.length > 1 ? 's' : ''} target vehicles we do
              not cover at all ({excludedRules.map(r => `${r.make} ${r.model}`).join(', ')}). These
              are declined by the excluded vehicle matrix, so a risk factor would never be used —
              remove them or switch them off.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map(p => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? 'default' : 'outline'}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={addRule}>
              <Plus className="h-4 w-4 mr-1" /> Add rule
            </Button>
            <Button size="sm" variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-1" /> Reset
            </Button>
            <Button size="sm" onClick={save}>
              <Save className="h-4 w-4 mr-1" /> Save draft
            </Button>
          </div>
        </div>

        {/* Rule editor */}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="p-2 font-medium">Make</th>
                <th className="p-2 font-medium">Model / trim</th>
                <th className="p-2 font-medium">Risk ×</th>
                <th className="p-2 font-medium">Min 1-year £</th>
                <th className="p-2 font-medium">Note</th>
                <th className="p-2 font-medium">On</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} className="border-t align-middle">
                  <td className="p-2">
                    <Input
                      value={r.make}
                      onChange={e => update(r.id, { make: e.target.value })}
                      className="h-8 w-32"
                      placeholder="BMW"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={r.model}
                      onChange={e => update(r.id, { model: e.target.value })}
                      className={`h-8 w-40 ${isTooBroad(r) ? 'border-destructive' : ''}`}
                      placeholder="520d"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      step="0.05"
                      min={MIN_RISK_FACTOR}
                      max={MAX_RISK_FACTOR}
                      value={r.riskFactor}
                      onChange={e => update(r.id, { riskFactor: Number(e.target.value) })}
                      className="h-8 w-24"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min={0}
                      value={r.minOneYear ?? ''}
                      onChange={e =>
                        update(r.id, {
                          minOneYear: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className="h-8 w-24"
                      placeholder="—"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={r.note ?? ''}
                      onChange={e => update(r.id, { note: e.target.value })}
                      className="h-8 min-w-48"
                      placeholder="Why this rule exists"
                    />
                  </td>
                  <td className="p-2">
                    <Switch
                      checked={r.enabled}
                      onCheckedChange={v => update(r.id, { enabled: v })}
                    />
                  </td>
                  <td className="p-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setRules(prev => prev.filter(x => x.id !== r.id))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rule tester */}
        <div className="rounded-md border p-3 space-y-3">
          <div className="font-medium">Test a vehicle name</div>
          <div className="flex flex-wrap gap-3">
            <div>
              <Label className="text-xs">Make</Label>
              <Input value={testMake} onChange={e => setTestMake(e.target.value)} className="h-9 w-40" />
            </div>
            <div>
              <Label className="text-xs">Model</Label>
              <Input value={testModel} onChange={e => setTestModel(e.target.value)} className="h-9 w-56" />
            </div>
          </div>
          {isVehicleExcluded(testMake, testModel) && (
            <div className="text-sm font-medium text-destructive">
              Not covered — this vehicle is declined by the excluded vehicle matrix, so no price is
              ever quoted for it.
            </div>
          )}
          <div className="text-sm">
            {testOutcome.matched ? (
              <span>
                Matched <strong>{testOutcome.matched.make} {testOutcome.matched.model}</strong> — risk ×
                {testOutcome.riskFactor.toFixed(2)}
                {testOutcome.minPrice !== null && <> , minimum {money(testOutcome.minPrice)}</>}
              </span>
            ) : (
              <span className="text-muted-foreground">
                No rule matches — this vehicle keeps the standard grid price.
              </span>
            )}
          </div>
        </div>

        {/* Effect table */}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="p-2 font-medium">Vehicle</th>
                <th className="p-2 font-medium">Rule</th>
                <th className="p-2 font-medium text-right">Risk ×</th>
                <th className="p-2 font-medium text-right">Live now</th>
                <th className="p-2 font-medium text-right">Draft with model risk</th>
                <th className="p-2 font-medium text-right">Delta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={`${row.make}-${row.model}`} className="border-t">
                  <td className="p-2">
                    {row.make} {row.model}
                    <span className="block text-xs text-muted-foreground">
                      {row.year} · {Number(row.mileage).toLocaleString('en-GB')} mi · {row.fuelType}
                    </span>
                  </td>
                  <td className="p-2 text-xs">
                    {row.outcome.matched
                      ? `${row.outcome.matched.make} ${row.outcome.matched.model}`
                      : '—'}
                    {row.floorApplied && (
                      <Badge variant="outline" className="ml-1">
                        floor
                      </Badge>
                    )}
                  </td>
                  <td className="p-2 text-right">×{row.outcome.riskFactor.toFixed(2)}</td>
                  <td className="p-2 text-right">{money(row.current)}</td>
                  <td className="p-2 text-right font-semibold">{money(row.draft)}</td>
                  <td
                    className={`p-2 text-right ${
                      row.delta > 0
                        ? 'text-rose-600'
                        : row.delta < 0
                          ? 'text-emerald-600'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {row.delta === 0 ? '—' : `${row.delta > 0 ? '+' : '−'}${money(row.delta)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
