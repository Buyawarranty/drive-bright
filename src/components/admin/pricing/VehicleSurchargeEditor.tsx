import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Car, Plus, RotateCcw, Save, Trash2, FlaskConical, Ban, Wrench } from 'lucide-react';
import { LABOUR_RATE_FACTOR } from '@/lib/pricingMatrix';

export const VEHICLE_SURCHARGE_STORAGE_KEY = 'bw_vehicle_surcharge_draft_v1';

/** Starting labour rate options. Management can add more in the editor below. */
export const LABOUR_RATES = [50, 70, 100, 150] as const;
export type LabourRate = (typeof LABOUR_RATES)[number];

/** Default UX wording shown next to each labour rate option. */
export const DEFAULT_LABOUR_RATE_LABELS: Record<number, string> = {
  50: 'Budget garage option',
  70: 'Most popular / reference',
  100: 'Broader garage choice',
  150: 'Premium / specialist repairers',
};


export interface BrandGroup {
  id: string;
  /** Group name shown to management, e.g. "Premium — Land Rover / Jaguar / Porsche / Tesla". */
  name: string;
  /** Vehicle makes this group matches (lowercase compare). */
  makes: string[];
  /** Model keywords that also match, e.g. "s-line", "m-sport". */
  modelKeywords: string[];
  /** Flat £ surcharge added on top of the grid price, per term. */
  surcharge: { 1: number; 2: number; 3: number };
  /**
   * Per-vehicle labour rate FACTOR override (multiplier on the base price,
   * £70/hr = 1.00). null = use the standard labour rate table below.
   */
  labourRateFactor?: Record<number, number> | null;
  /** Labour rate pre-selected for this vehicle group at quote time. null = £70/hr default. */
  defaultLabourRate?: number | null;
  /** Labour rates that cannot be sold for this vehicle group. */
  blockedLabourRates?: number[];
}

export interface VehicleSurchargeModel {
  brandGroups: BrandGroup[];
  mileage: { fromMiles: number; toMiles: number; surcharge: { 1: number; 2: number; 3: number } };
  age: { fromYears: number; toYears: number; surcharge: { 1: number; 2: number; 3: number } };
  /** Makes exempt from mileage + age surcharges (reliability exemption). */
  reliabilityExemptMakes: string[];
  /** Motorbike price as a % of the standard vehicle price. */
  motorbikePctOfStandard: number;
  /** Standard labour rate factor table (multiplier on the base price, £70/hr = 1.00). */
  labourRateFactor: Record<number, number>;
  /** The labour rate options we sell. Management can add or remove rates here. */
  labourRates: number[];
  /** UX wording shown beside each labour rate option (e.g. "Most popular / reference"). */
  labourRateLabels: Record<number, string>;
  /** Entire makes we will not cover at all (e.g. Ferrari, Lamborghini). */
  excludedMakes: string[];
  /** Per-make model variants we will not cover (e.g. Audi RS / R8, BMW M, Mercedes AMG). */
  excludedModelsByMake: Record<string, string[]>;
  updatedAt?: string;
}


/** Mirrors the current live code values in src/lib/vehicleValidation.ts. */
export const LIVE_CODE_SURCHARGE_MODEL: VehicleSurchargeModel = {
  brandGroups: [
    {
      id: 'premium',
      name: 'Premium — Land Rover / Jaguar / Porsche / Tesla',
      makes: ['land rover', 'jaguar', 'porsche', 'tesla'],
      modelKeywords: [],
      surcharge: { 1: 200, 2: 400, 3: 600 },
      labourRateFactor: null,
      defaultLabourRate: null,
      blockedLabourRates: [],
    },
    {
      id: 'special-variant',
      name: 'Sport variants — Audi S-Line / BMW M-Sport / Mercedes AMG-Line',
      makes: [],
      modelKeywords: ['s-line', 'm-sport', 'amg-line'],
      surcharge: { 1: 0, 2: 0, 3: 0 },
      labourRateFactor: null,
      defaultLabourRate: null,
      blockedLabourRates: [],
    },
  ],
  mileage: { fromMiles: 120001, toMiles: 150000, surcharge: { 1: 200, 2: 250, 3: 300 } },
  age: { fromYears: 12, toYears: 15, surcharge: { 1: 200, 2: 250, 3: 300 } },
  reliabilityExemptMakes: ['honda', 'toyota'],
  motorbikePctOfStandard: 50,
  // Mirrors LABOUR_RATE_FACTOR in src/lib/pricingMatrix.ts (£70/hr = 1.00 reference).
  labourRateFactor: { ...LABOUR_RATE_FACTOR },
  labourRates: [50, 70, 100, 150],
  labourRateLabels: { ...DEFAULT_LABOUR_RATE_LABELS },

  excludedMakes: [
    'aston martin', 'bentley', 'ferrari', 'lamborghini', 'lotus', 'maserati',
    'maybach', 'mclaren', 'morgan', 'rolls-royce', 'rolls royce', 'tvr',
  ],
  excludedModelsByMake: {
    audi: [
      'rs2', 'rs3', 'rs4', 'rs5', 'rs6', 'rs7', 'rs q3', 'rs q5', 'rs q8',
      'rs e-tron gt', 'tt rs', 'tts', 'r8', 'r8 v10', 'r8 spyder', 'r8 gt',
      's3', 's4', 's5', 's6', 's7', 's8', 'sq5', 'sq7', 'sq8', 's e-tron gt',
    ],
    bmw: [
      'm1', '1m coupe', 'm2', 'm3', 'm4', 'm5', 'm6', 'm8', 'x3 m', 'x4 m',
      'x5 m', 'x6 m', 'xm', 'z3 m roadster', 'z4 m roadster',
    ],
    mercedes: [
      'c 36 amg', 'c 43 amg', 'c 63 amg', 'e 55 amg', 'e 63 amg', 's 55 amg',
      's 63 amg', 's 65 amg', 'cl 63 amg', 'cl 65 amg', 'sl 55 amg', 'sl 63 amg',
      'sl 65 amg', 'clk 63 amg', 'cls 63 amg', 'amg gt', 'amg sl', 'amg one',
      'g 63 amg', 'gle 63 amg', 'gls 63 amg', 'amg', 'mercedes-amg',
    ],
  },
};

function clone(model: VehicleSurchargeModel): VehicleSurchargeModel {
  return JSON.parse(JSON.stringify(model));
}

export function loadVehicleSurchargeDraft(): VehicleSurchargeModel | null {
  try {
    const raw = localStorage.getItem(VEHICLE_SURCHARGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VehicleSurchargeModel;
    // Older drafts pre-date the labour rate model — backfill so the editor never breaks.
    return {
      ...parsed,
      labourRateFactor:
        parsed.labourRateFactor ?? { ...LIVE_CODE_SURCHARGE_MODEL.labourRateFactor },
      labourRates:
        parsed.labourRates?.length
          ? [...parsed.labourRates].sort((a, b) => a - b)
          : [...LIVE_CODE_SURCHARGE_MODEL.labourRates],
      labourRateLabels: { ...DEFAULT_LABOUR_RATE_LABELS, ...(parsed.labourRateLabels ?? {}) },
      brandGroups: (parsed.brandGroups ?? []).map(g => ({
        ...g,
        labourRateFactor: g.labourRateFactor ?? null,
        defaultLabourRate: g.defaultLabourRate ?? null,
        blockedLabourRates: g.blockedLabourRates ?? [],
      })),
    };
  } catch {
    return null;
  }
}


const TERMS = [1, 2, 3] as const;
const TERM_LABEL: Record<number, string> = { 1: '1 year', 2: '2 years', 3: '3 years' };

function TermInputs({
  values,
  onChange,
  disabled,
}: {
  values: { 1: number; 2: number; 3: number };
  onChange: (term: 1 | 2 | 3, value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TERMS.map(t => (
        <div key={t} className="space-y-1">
          <Label className="text-xs text-muted-foreground">{TERM_LABEL[t]}</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              £
            </span>
            <Input
              type="number"
              className="pl-6"
              disabled={disabled}
              value={values[t]}
              onChange={e => onChange(t, Math.max(0, Math.round(Number(e.target.value) || 0)))}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Management-only editor for vehicle-specific price adjustments (premium brands,
 * high mileage, older vehicles, motorbikes).
 *
 * DRAFT ONLY: everything here is saved to localStorage for this page and never
 * applied to live quoting. Live pricing keeps using the values hardcoded in
 * src/lib/vehicleValidation.ts until we deliberately wire this model in.
 */
export default function VehicleSurchargeEditor() {
  const [model, setModel] = useState<VehicleSurchargeModel>(() =>
    loadVehicleSurchargeDraft() ?? clone(LIVE_CODE_SURCHARGE_MODEL)
  );
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(() => loadVehicleSurchargeDraft()?.updatedAt ?? null);
  const [makeDrafts, setMakeDrafts] = useState<Record<string, string>>({});
  const [keywordDrafts, setKeywordDrafts] = useState<Record<string, string>>({});
  const [exemptDraft, setExemptDraft] = useState('');
  const [excludedMakeDraft, setExcludedMakeDraft] = useState('');
  const [excludedModelDrafts, setExcludedModelDrafts] = useState<Record<string, string>>({});
  const [newRateDraft, setNewRateDraft] = useState('');
  const [newRateLabelDraft, setNewRateLabelDraft] = useState('');

  const [rateEdits, setRateEdits] = useState<Record<number, string>>({});

  /** The labour rate options currently on offer, lowest first. */
  const rates = useMemo(
    () => [...(model.labourRates ?? [])].sort((a, b) => a - b),
    [model.labourRates]
  );

  /**
   * Changes the £/hour value of an existing option, carrying its factor, label and
   * every per-vehicle-group reference (custom factor, default, blocked) across.
   */
  const commitRateChange = (oldRate: number) => {
    const raw = rateEdits[oldRate];
    setRateEdits(prev => {
      const next = { ...prev };
      delete next[oldRate];
      return next;
    });
    if (raw === undefined) return;
    const newRate = Math.round(Number(raw) || 0);
    if (newRate === oldRate) return;
    if (newRate <= 0) {
      toast.error('Enter a labour rate above £0 per hour');
      return;
    }
    if ((model.labourRates ?? []).includes(newRate)) {
      toast.error(`£${newRate}/hr is already an option`);
      return;
    }
    update(next => {
      next.labourRates = (next.labourRates ?? [])
        .map(x => (x === oldRate ? newRate : x))
        .sort((a, b) => a - b);
      const factor = next.labourRateFactor[oldRate] ?? 1;
      delete next.labourRateFactor[oldRate];
      next.labourRateFactor[newRate] = factor;
      if (next.labourRateLabels) {
        const label = next.labourRateLabels[oldRate];
        delete next.labourRateLabels[oldRate];
        if (label) next.labourRateLabels[newRate] = label;
      }
      for (const g of next.brandGroups) {
        if (g.labourRateFactor) {
          const v = g.labourRateFactor[oldRate];
          delete g.labourRateFactor[oldRate];
          if (v !== undefined) g.labourRateFactor[newRate] = v;
        }
        if (g.defaultLabourRate === oldRate) g.defaultLabourRate = newRate;
        g.blockedLabourRates = (g.blockedLabourRates ?? []).map(x =>
          x === oldRate ? newRate : x
        );
      }
    });
    toast.success(`£${oldRate}/hr changed to £${newRate}/hr`);
  };




  useEffect(() => {
    // Warn on leaving with unsaved figures, matching the age-band editor behaviour.
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const update = (fn: (next: VehicleSurchargeModel) => void) => {
    setModel(prev => {
      const next = clone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  const handleSave = () => {
    const stamped: VehicleSurchargeModel = { ...clone(model), updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(VEHICLE_SURCHARGE_STORAGE_KEY, JSON.stringify(stamped));
      setSavedAt(stamped.updatedAt!);
      setDirty(false);
      toast.success('Vehicle surcharges saved as a draft', {
        description: 'Nothing is live yet — live quoting is unchanged.',
      });
    } catch {
      toast.error('Could not save the draft in this browser');
    }
  };

  const handleReset = () => {
    setModel(clone(LIVE_CODE_SURCHARGE_MODEL));
    setDirty(true);
    toast.info('Reset to the current live code values');
  };

  const changes = useMemo(() => {
    const out: string[] = [];
    const live = LIVE_CODE_SURCHARGE_MODEL;
    for (const g of model.brandGroups) {
      const liveGroup = live.brandGroups.find(x => x.id === g.id);
      for (const t of TERMS) {
        const before = liveGroup?.surcharge[t] ?? 0;
        if (before !== g.surcharge[t]) {
          out.push(`${g.name} — ${TERM_LABEL[t]}: £${before} → £${g.surcharge[t]}`);
        }
      }
      if (!liveGroup) out.push(`New group: ${g.name}`);
      if (g.labourRateFactor) {
        for (const r of rates) {
          const before = live.labourRateFactor[r] ?? 1;
          const after = g.labourRateFactor[r] ?? 1;
          if (before !== after) {
            out.push(`${g.name} — £${r}/hr labour factor: ×${before} → ×${after}`);
          }
        }
      }
      if (g.defaultLabourRate) {
        out.push(`${g.name}: labour rate pre-selected at £${g.defaultLabourRate}/hr`);
      }
      if ((g.blockedLabourRates ?? []).length > 0) {
        out.push(
          `${g.name}: labour rates blocked — ${(g.blockedLabourRates ?? []).map(r => `£${r}/hr`).join(', ')}`
        );
      }
    }
    for (const r of rates) {
      if ((live.labourRateFactor[r] ?? 1) !== (model.labourRateFactor[r] ?? 1)) {
        out.push(
          `Standard £${r}/hr labour factor: ×${live.labourRateFactor[r] ?? 1} → ×${model.labourRateFactor[r] ?? 1}`
        );
      }
    }

    for (const t of TERMS) {
      if (live.mileage.surcharge[t] !== model.mileage.surcharge[t]) {
        out.push(`High mileage — ${TERM_LABEL[t]}: £${live.mileage.surcharge[t]} → £${model.mileage.surcharge[t]}`);
      }
      if (live.age.surcharge[t] !== model.age.surcharge[t]) {
        out.push(`Older vehicle — ${TERM_LABEL[t]}: £${live.age.surcharge[t]} → £${model.age.surcharge[t]}`);
      }
    }
    if (live.motorbikePctOfStandard !== model.motorbikePctOfStandard) {
      out.push(`Motorbikes: ${live.motorbikePctOfStandard}% → ${model.motorbikePctOfStandard}% of standard price`);
    }
    // Excluded makes
    const liveMakes = [...live.excludedMakes].sort().join(', ');
    const draftMakes = [...model.excludedMakes].sort().join(', ');
    if (liveMakes !== draftMakes) {
      out.push(`Excluded makes changed: ${liveMakes || 'none'} → ${draftMakes || 'none'}`);
    }
    // Excluded models per make
    const allMakes = Array.from(new Set([...Object.keys(live.excludedModelsByMake), ...Object.keys(model.excludedModelsByMake)]));
    for (const mk of allMakes) {
      const before = (live.excludedModelsByMake[mk] ?? []).sort().join(', ');
      const after = (model.excludedModelsByMake[mk] ?? []).sort().join(', ');
      if (before !== after) {
        out.push(`Excluded models — ${mk}: ${before || 'none'} → ${after || 'none'}`);
      }
    }
    return out;
  }, [model]);

  return (
    <div className="space-y-4">
      <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
        <FlaskConical className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Draft only — live quoting is untouched.</strong> These figures are saved to this
          page so you can build and review a vehicle-specific pricing model. Customer Step 3/4 and
          the sales Quotes &amp; Orders grid keep using the current live values until we push this
          model live. The dealer portal is never affected.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" /> Vehicle-specific surcharges
              </CardTitle>
              <CardDescription>
                Added on top of the Quotes &amp; Orders grid price for the matching vehicle. Mileage
                and age surcharges never stack — the higher one is applied once.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {savedAt ? (
                <Badge variant="secondary">
                  Draft saved {new Date(savedAt).toLocaleString('en-GB')}
                </Badge>
              ) : (
                <Badge variant="outline">No draft saved</Badge>
              )}
              {dirty && <Badge className="bg-amber-600">Unsaved changes</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {model.brandGroups.map(group => (
            <div key={group.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Input
                  className="max-w-md font-medium"
                  value={group.name}
                  onChange={e =>
                    update(next => {
                      const g = next.brandGroups.find(x => x.id === group.id)!;
                      g.name = e.target.value;
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    update(next => {
                      next.brandGroups = next.brandGroups.filter(x => x.id !== group.id);
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Remove group
                </Button>
              </div>

              <TermInputs
                values={group.surcharge}
                onChange={(t, v) =>
                  update(next => {
                    const g = next.brandGroups.find(x => x.id === group.id)!;
                    g.surcharge[t] = v;
                  })
                }
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Makes</Label>
                  <div className="flex flex-wrap gap-1">
                    {group.makes.map(m => (
                      <Badge key={m} variant="secondary" className="gap-1">
                        {m}
                        <button
                          type="button"
                          aria-label={`Remove ${m}`}
                          onClick={() =>
                            update(next => {
                              const g = next.brandGroups.find(x => x.id === group.id)!;
                              g.makes = g.makes.filter(x => x !== m);
                            })
                          }
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                    {group.makes.length === 0 && (
                      <span className="text-xs text-muted-foreground">No makes — matches on model keywords only</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. maserati"
                      value={makeDrafts[group.id] ?? ''}
                      onChange={e => setMakeDrafts(d => ({ ...d, [group.id]: e.target.value }))}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const value = (makeDrafts[group.id] ?? '').trim().toLowerCase();
                        if (!value) return;
                        update(next => {
                          const g = next.brandGroups.find(x => x.id === group.id)!;
                          if (!g.makes.includes(value)) g.makes.push(value);
                        });
                        setMakeDrafts(d => ({ ...d, [group.id]: '' }));
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Model keywords</Label>
                  <div className="flex flex-wrap gap-1">
                    {group.modelKeywords.map(k => (
                      <Badge key={k} variant="outline" className="gap-1">
                        {k}
                        <button
                          type="button"
                          aria-label={`Remove ${k}`}
                          onClick={() =>
                            update(next => {
                              const g = next.brandGroups.find(x => x.id === group.id)!;
                              g.modelKeywords = g.modelKeywords.filter(x => x !== k);
                            })
                          }
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                    {group.modelKeywords.length === 0 && (
                      <span className="text-xs text-muted-foreground">No keywords</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. gt-line"
                      value={keywordDrafts[group.id] ?? ''}
                      onChange={e => setKeywordDrafts(d => ({ ...d, [group.id]: e.target.value }))}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const value = (keywordDrafts[group.id] ?? '').trim().toLowerCase();
                        if (!value) return;
                        update(next => {
                          const g = next.brandGroups.find(x => x.id === group.id)!;
                          if (!g.modelKeywords.includes(value)) g.modelKeywords.push(value);
                        });
                        setKeywordDrafts(d => ({ ...d, [group.id]: '' }));
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Per-vehicle labour rate settings */}
              <div className="rounded-md border border-sky-200 bg-sky-50/60 dark:bg-sky-950/20 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h5 className="text-sm font-semibold flex items-center gap-1.5">
                      <Wrench className="h-4 w-4 text-sky-600" /> Labour rates for this vehicle group
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      Override the standard labour factor, pre-select a rate, or block rates that are
                      not viable for these vehicles.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      update(next => {
                        const g = next.brandGroups.find(x => x.id === group.id)!;
                        g.labourRateFactor = g.labourRateFactor
                          ? null
                          : { ...next.labourRateFactor };
                      })
                    }
                  >
                    {group.labourRateFactor ? 'Use standard table' : 'Set custom factor'}
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Pre-selected labour rate</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={group.defaultLabourRate ?? ''}
                      onChange={e =>
                        update(next => {
                          const g = next.brandGroups.find(x => x.id === group.id)!;
                          g.defaultLabourRate = e.target.value ? Number(e.target.value) : null;
                        })
                      }
                    >
                      <option value="">Standard default (£70/hr)</option>
                      {rates.map(r => (
                        <option key={r} value={r}>
                          £{r}/hr{model.labourRateLabels?.[r] ? ` — ${model.labourRateLabels[r]}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Blocked labour rates</Label>
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {rates.map(r => {
                        const blocked = (group.blockedLabourRates ?? []).includes(r);
                        return (
                          <Button
                            key={r}
                            type="button"
                            size="sm"
                            variant={blocked ? 'destructive' : 'outline'}
                            onClick={() =>
                              update(next => {
                                const g = next.brandGroups.find(x => x.id === group.id)!;
                                const list = g.blockedLabourRates ?? [];
                                g.blockedLabourRates = blocked
                                  ? list.filter(x => x !== r)
                                  : [...list, r];
                              })
                            }
                          >
                            £{r}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {rates.map(r => {
                    const custom = group.labourRateFactor;
                    const value = custom ? custom[r] ?? 1 : model.labourRateFactor[r] ?? 1;
                    return (
                      <div key={r} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">£{r}/hr — factor</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.1"
                          disabled={!custom}
                          value={value}
                          onChange={e =>
                            update(next => {
                              const g = next.brandGroups.find(x => x.id === group.id)!;
                              if (!g.labourRateFactor) return;
                              g.labourRateFactor[r] = Number(e.target.value) || 1;
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
                {!group.labourRateFactor && (
                  <p className="text-xs text-muted-foreground">
                    Following the standard labour rate table below.
                  </p>
                )}
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={() =>
              update(next => {
                next.brandGroups.push({
                  id: `group-${Date.now()}`,
                  name: 'New vehicle group',
                  makes: [],
                  modelKeywords: [],
                  surcharge: { 1: 0, 2: 0, 3: 0 },
                  labourRateFactor: null,
                  defaultLabourRate: null,
                  blockedLabourRates: [],
                });
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Add vehicle group
          </Button>

          <Separator />

          <div className="space-y-3">
            <div>
              <h4 className="font-semibold flex items-center gap-1.5">
                <Wrench className="h-4 w-4 text-sky-600" /> Standard labour rate table
              </h4>
              <p className="text-xs text-muted-foreground">
                Factor applied to the base price for each labour rate — £70/hr is the reference at
                1.00, so 1.18 means 18% more. Vehicle groups use this unless they have their own
                custom factor above. The example column shows the price on a £499 base.
              </p>
            </div>

            <div className="space-y-2">
              <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[7rem,1fr,8rem,8rem,2.5rem]">
                <span>Maximum covered labour rate</span>
                <span>UX position</span>
                <span>Factor (£70/hr = 1.00)</span>
                <span>Example on £499 base</span>
                <span />
              </div>
              {rates.map(r => {
                const factor = model.labourRateFactor[r] ?? 1;
                const example = Math.round(499 * factor);
                const isReference = factor === 1;
                return (
                  <div
                    key={r}
                    className="grid gap-2 rounded-md border p-2 sm:grid-cols-[7rem,1fr,8rem,8rem,2.5rem] sm:items-center sm:border-0 sm:p-1"
                  >
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        £
                      </span>
                      <Input
                        type="number"
                        className="pl-6 font-semibold"
                        title="Change the £ per hour value for this option"
                        value={rateEdits[r] ?? String(r)}
                        onChange={e => setRateEdits(prev => ({ ...prev, [r]: e.target.value }))}
                        onBlur={() => commitRateChange(r)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRateChange(r);
                          }
                        }}
                      />
                    </div>

                    <Input
                      value={model.labourRateLabels?.[r] ?? ''}
                      placeholder="e.g. Broader garage choice"
                      onChange={e =>
                        update(next => {
                          next.labourRateLabels = { ...(next.labourRateLabels ?? {}) };
                          next.labourRateLabels[r] = e.target.value;
                        })
                      }
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={factor}
                      onChange={e =>
                        update(next => {
                          next.labourRateFactor[r] = Number(e.target.value) || 1;
                        })
                      }
                    />
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">£{example}</span>
                      {isReference && <Badge variant="secondary">Reference</Badge>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Remove this labour rate option"
                      disabled={rates.length <= 2}
                      onClick={() =>
                        update(next => {
                          next.labourRates = (next.labourRates ?? []).filter(x => x !== r);
                          delete next.labourRateFactor[r];
                          if (next.labourRateLabels) delete next.labourRateLabels[r];
                          for (const g of next.brandGroups) {
                            if (g.labourRateFactor) delete g.labourRateFactor[r];
                            if (g.defaultLabourRate === r) g.defaultLabourRate = null;
                            g.blockedLabourRates = (g.blockedLabourRates ?? []).filter(x => x !== r);
                          }
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/40 p-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">New labour rate (£/hour)</Label>
                <Input
                  className="w-36"
                  type="number"
                  value={newRateDraft}
                  placeholder="e.g. 150"
                  onChange={e => setNewRateDraft(e.target.value)}
                />
              </div>
              <div className="space-y-1 min-w-[14rem] flex-1">
                <Label className="text-xs text-muted-foreground">UX position</Label>
                <Input
                  value={newRateLabelDraft}
                  placeholder="e.g. Main dealer network"
                  onChange={e => setNewRateLabelDraft(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  const rate = Math.round(Number(newRateDraft) || 0);
                  if (rate <= 0) {
                    toast.error('Enter a labour rate above £0 per hour');
                    return;
                  }
                  if (rates.includes(rate)) {
                    toast.error(`£${rate}/hr is already an option`);
                    return;
                  }
                  update(next => {
                    next.labourRates = [...(next.labourRates ?? []), rate].sort((a, b) => a - b);
                    next.labourRateFactor[rate] = next.labourRateFactor[rate] ?? 1;
                    next.labourRateLabels = {
                      ...(next.labourRateLabels ?? {}),
                      [rate]: newRateLabelDraft.trim() || `£${rate}/hour cover`,
                    };
                  });
                  setNewRateDraft('');
                  setNewRateLabelDraft('');
                  toast.success(`£${rate}/hr added — set its factor above`);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Add labour rate
              </Button>
            </div>
          </div>


          <Separator />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold">High mileage surcharge</h4>
                <p className="text-xs text-muted-foreground">
                  Applies between the two mileage figures below.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From (miles)</Label>
                  <Input
                    type="number"
                    value={model.mileage.fromMiles}
                    onChange={e =>
                      update(next => {
                        next.mileage.fromMiles = Math.max(0, Math.round(Number(e.target.value) || 0));
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To (miles)</Label>
                  <Input
                    type="number"
                    value={model.mileage.toMiles}
                    onChange={e =>
                      update(next => {
                        next.mileage.toMiles = Math.max(0, Math.round(Number(e.target.value) || 0));
                      })
                    }
                  />
                </div>
              </div>
              <TermInputs
                values={model.mileage.surcharge}
                onChange={(t, v) =>
                  update(next => {
                    next.mileage.surcharge[t] = v;
                  })
                }
              />
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="font-semibold">Older vehicle surcharge</h4>
                <p className="text-xs text-muted-foreground">
                  Applies to vehicles over the first age and up to the second.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Over (years)</Label>
                  <Input
                    type="number"
                    value={model.age.fromYears}
                    onChange={e =>
                      update(next => {
                        next.age.fromYears = Math.max(0, Math.round(Number(e.target.value) || 0));
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Up to (years)</Label>
                  <Input
                    type="number"
                    value={model.age.toYears}
                    onChange={e =>
                      update(next => {
                        next.age.toYears = Math.max(0, Math.round(Number(e.target.value) || 0));
                      })
                    }
                  />
                </div>
              </div>
              <TermInputs
                values={model.age.surcharge}
                onChange={(t, v) =>
                  update(next => {
                    next.age.surcharge[t] = v;
                  })
                }
              />
            </div>
          </div>

          <Separator />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold">Reliability exemption</h4>
              <p className="text-xs text-muted-foreground">
                These makes skip both the mileage and age surcharges.
              </p>
              <div className="flex flex-wrap gap-1">
                {model.reliabilityExemptMakes.map(m => (
                  <Badge key={m} variant="secondary" className="gap-1">
                    {m}
                    <button
                      type="button"
                      aria-label={`Remove ${m}`}
                      onClick={() =>
                        update(next => {
                          next.reliabilityExemptMakes = next.reliabilityExemptMakes.filter(x => x !== m);
                        })
                      }
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. lexus"
                  value={exemptDraft}
                  onChange={e => setExemptDraft(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const value = exemptDraft.trim().toLowerCase();
                    if (!value) return;
                    update(next => {
                      if (!next.reliabilityExemptMakes.includes(value)) {
                        next.reliabilityExemptMakes.push(value);
                      }
                    });
                    setExemptDraft('');
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">Motorbikes</h4>
              <p className="text-xs text-muted-foreground">
                Percentage of the standard vehicle price, floors included.
              </p>
              <div className="relative max-w-[160px]">
                <Input
                  type="number"
                  value={model.motorbikePctOfStandard}
                  onChange={e =>
                    update(next => {
                      next.motorbikePctOfStandard = Math.min(
                        200,
                        Math.max(1, Math.round(Number(e.target.value) || 0))
                      );
                    })
                  }
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================= */}
      {/* Make and Model Exclusions                                     */}
      {/* ============================================================= */}
      <Card className="border-2 border-rose-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ban className="h-5 w-5 text-rose-600" />
            Make and model exclusions
          </CardTitle>
          <CardDescription>
            Vehicles we will not cover at any price. An excluded <strong>make</strong> blocks the
            whole brand; an excluded <strong>model</strong> blocks only that variant under a make we
            otherwise cover. Matches are case-insensitive and ignore punctuation, so the customer
            still gets a clear &ldquo;not eligible&rdquo; message at quote time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Excluded makes — whole brands */}
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-rose-700">Excluded makes</h4>
              <p className="text-xs text-muted-foreground">
                Entire manufacturers we decline to cover (specialist parts, high repair costs).
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {model.excludedMakes.map(m => (
                <Badge key={m} variant="destructive" className="gap-1">
                  {m}
                  <button
                    type="button"
                    aria-label={`Remove ${m}`}
                    onClick={() =>
                      update(next => {
                        next.excludedMakes = next.excludedMakes.filter(x => x !== m);
                      })
                    }
                  >
                    ×
                  </button>
                </Badge>
              ))}
              {model.excludedMakes.length === 0 && (
                <span className="text-xs text-muted-foreground">No makes excluded — every brand is coverable.</span>
              )}
            </div>
            <div className="flex gap-2 max-w-md">
              <Input
                placeholder="e.g. koenigsegg"
                value={excludedMakeDraft}
                onChange={e => setExcludedMakeDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const value = excludedMakeDraft.trim().toLowerCase();
                    if (!value) return;
                    update(next => {
                      if (!next.excludedMakes.includes(value)) next.excludedMakes.push(value);
                    });
                    setExcludedMakeDraft('');
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const value = excludedMakeDraft.trim().toLowerCase();
                  if (!value) return;
                  update(next => {
                    if (!next.excludedMakes.includes(value)) next.excludedMakes.push(value);
                  });
                  setExcludedMakeDraft('');
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Add make
              </Button>
            </div>
          </div>

          <Separator />

          {/* Excluded models — per make */}
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-rose-700">Excluded models by make</h4>
              <p className="text-xs text-muted-foreground">
                Specific variants we decline even though the make itself is coverable.
              </p>
            </div>
            <div className="space-y-4">
              {Object.keys(model.excludedModelsByMake).map(make => (
                <div key={make} className="rounded-lg border border-rose-100 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Input
                      className="max-w-[200px] font-medium capitalize"
                      value={make}
                      onChange={e => {
                        const oldKey = make;
                        const newKey = e.target.value.trim().toLowerCase();
                        if (!newKey || newKey === oldKey) return;
                        update(next => {
                          const models = next.excludedModelsByMake[oldKey] ?? [];
                          delete next.excludedModelsByMake[oldKey];
                          next.excludedModelsByMake[newKey] = models;
                        });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        update(next => {
                          delete next.excludedModelsByMake[make];
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Remove make block
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(model.excludedModelsByMake[make] ?? []).map(mod => (
                      <Badge key={mod} variant="outline" className="gap-1 border-rose-200 text-rose-700">
                        {mod}
                        <button
                          type="button"
                          aria-label={`Remove ${mod}`}
                          onClick={() =>
                            update(next => {
                              next.excludedModelsByMake[make] = (next.excludedModelsByMake[make] ?? []).filter(x => x !== mod);
                            })
                          }
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                    {(model.excludedModelsByMake[make] ?? []).length === 0 && (
                      <span className="text-xs text-muted-foreground">No models listed.</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. s3"
                      value={excludedModelDrafts[make] ?? ''}
                      onChange={e => setExcludedModelDrafts(d => ({ ...d, [make]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const value = (excludedModelDrafts[make] ?? '').trim().toLowerCase();
                          if (!value) return;
                          update(next => {
                            const list = next.excludedModelsByMake[make] ?? [];
                            if (!list.includes(value)) {
                              next.excludedModelsByMake[make] = [...list, value];
                            }
                          });
                          setExcludedModelDrafts(d => ({ ...d, [make]: '' }));
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const value = (excludedModelDrafts[make] ?? '').trim().toLowerCase();
                        if (!value) return;
                        update(next => {
                          const list = next.excludedModelsByMake[make] ?? [];
                          if (!list.includes(value)) {
                            next.excludedModelsByMake[make] = [...list, value];
                          }
                        });
                        setExcludedModelDrafts(d => ({ ...d, [make]: '' }));
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add model
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  update(next => {
                    const key = `new-make-${Date.now()}`;
                    next.excludedModelsByMake[key] = [];
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Add a make block
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Changes vs the current live values</CardTitle>
          <CardDescription>
            A plain-English diff of what would happen when this model is pushed live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Identical to live — nothing would change for customers or agents.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {changes.map(c => (
                <li key={c} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {c}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 p-3 backdrop-blur">
        <span className="text-sm text-muted-foreground">
          Saving keeps this on the Price Updates page only — live pricing is unchanged.
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset to live values
          </Button>
          <Button onClick={handleSave} disabled={!dirty}>
            <Save className="h-4 w-4 mr-1" /> Save figures
          </Button>
        </div>
      </div>
    </div>
  );
}
