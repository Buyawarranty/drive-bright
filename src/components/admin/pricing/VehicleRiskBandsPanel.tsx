import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Layers, Plus, RotateCcw, Rocket, Save, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchLivePricingVersionLabel,
  publishRiskBandsToLiveVersion,
} from '@/lib/pricing/publishRiskBands';
import {
  DEFAULT_RISK_BAND_CONFIG,
  RiskBand,
  RiskBandAssignment,
  RiskBandConfig,
  applyRiskBand,
  clampBandFactor,
  loadRiskBandConfig,
  matchRiskBand,
  saveRiskBandConfig,
  DEFAULT_BLOCK_MESSAGE,
  DEFAULT_GLOBAL_MIN_TOTAL,
  globalMinTotalFor,
} from '@/lib/pricing/vehicleRiskBands';
import { Textarea } from '@/components/ui/textarea';
import {
  FUEL_FILTER_OPTIONS,
  FUEL_LABEL,
  normalizeFuelFilter,
  type FuelFilter,
} from '@/lib/pricing/fuelCategory';
import { getExclusionReason, isVehicleExcluded } from '@/lib/vehicleExclusions';
import {
  loadExclusionDraft,
  primeLiveExclusions,
  type ExclusionDraft,
} from '@/lib/pricing/liveVehicleExclusions';


const TONE_CLASS: Record<RiskBand['tone'], string> = {
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  normal: 'bg-muted text-foreground border-border',
  high: 'bg-amber-100 text-amber-900 border-amber-200',
  severe: 'bg-orange-100 text-orange-900 border-orange-200',
  referral: 'bg-destructive/10 text-destructive border-destructive/30',
  blocked: 'bg-destructive text-destructive-foreground border-destructive',
};

const TONE_OPTIONS: { value: RiskBand['tone']; label: string }[] = [
  { value: 'low', label: 'Green (low)' },
  { value: 'normal', label: 'Grey (normal)' },
  { value: 'high', label: 'Amber (high)' },
  { value: 'severe', label: 'Orange (very high)' },
  { value: 'referral', label: 'Red (referral)' },
  { value: 'blocked', label: 'Red solid (not covered)' },
];

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const VehicleRiskBandsPanel: React.FC = () => {
  const [config, setConfig] = useState<RiskBandConfig>(() => loadRiskBandConfig());
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState('');
  const [newEntry, setNewEntry] = useState<{ make: string; model: string; bandId: string; fuel: FuelFilter }>({
    make: '',
    model: '',
    bandId: 'high',
    fuel: 'any',
  });
  const [fuelFilter, setFuelFilter] = useState<FuelFilter | 'all'>('all');
  const [testFuel, setTestFuel] = useState<string>('Petrol');
  const [testMake, setTestMake] = useState('Land Rover');
  const [testModel, setTestModel] = useState('Range Rover Sport');
  const [testBase, setTestBase] = useState(499);
  const [testType, setTestType] = useState<'car' | 'van' | 'motorbike'>('car');
  const [liveVersionLabel, setLiveVersionLabel] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchLivePricingVersionLabel()
      .then(setLiveVersionLabel)
      .catch(() => setLiveVersionLabel(null));
  }, []);

  /** Excluded-vehicle settings: pushed-live extras plus the manager's local draft. */
  const [exclusionDraft, setExclusionDraft] = useState<ExclusionDraft>(() => loadExclusionDraft());
  const [exclusionsVersion, setExclusionsVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (!alive) return;
      setExclusionDraft(loadExclusionDraft());
      setExclusionsVersion(v => v + 1);
    };
    primeLiveExclusions().then(refresh).catch(refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      alive = false;
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  /** Every change is persisted straight away so a toggle can never be lost. */
  const update = (next: RiskBandConfig) => {
    setConfig(next);
    saveRiskBandConfig(next);
    setDirty(true);
  };

  const bandById = useMemo(() => {
    const map = new Map<string, RiskBand>();
    config.bands.forEach(b => map.set(b.id, b));
    return map;
  }, [config.bands]);

  const countsByBand = useMemo(() => {
    const counts: Record<string, number> = {};
    config.assignments.forEach(a => {
      counts[a.bandId] = (counts[a.bandId] || 0) + 1;
    });
    return counts;
  }, [config.assignments]);

  /** Unpublished excluded-vehicle additions still count as a clash — flagged as draft. */
  const draftExclusionReason = (make?: string | null, model?: string | null): string | null => {
    const m = (make || '').trim().toLowerCase();
    const mod = (model || '').trim().toLowerCase();
    if (m && exclusionDraft.makes.some(x => {
      const e = x.trim().toLowerCase();
      return e && (m === e || m.startsWith(`${e} `));
    })) {
      return `${make} — make on the excluded list (draft, not live yet)`;
    }
    const combined = `${m} ${mod}`.trim();
    const rule = exclusionDraft.modelRules.find(r => {
      const rm = (r.make || '').trim().toLowerCase();
      const rmod = (r.model || '').trim().toLowerCase();
      if (!rmod) return false;
      const makeOk = !rm || m === rm || m.includes(rm);
      return makeOk && (mod.includes(rmod) || combined.includes(rmod));
    });
    return rule
      ? `${rule.label || rule.model} — model on the excluded list (draft, not live yet)`
      : null;
  };

  /** Band rules that point at a make/model already on the excluded list (live or draft). */
  const excludedClashes = useMemo(
    () =>
      config.assignments
        .map(a => {
          if (!a.enabled) return null;
          const liveHit = isVehicleExcluded(a.make, a.model);
          const reason = liveHit
            ? getExclusionReason(a.make, a.model) || 'On the excluded vehicles list'
            : draftExclusionReason(a.make, a.model);
          if (!reason) return null;
          return {
            id: a.id,
            label: `${a.make || '(all makes)'} ${a.model || '(all models)'}`.trim(),
            reason,
            draftOnly: !liveHit,
          };
        })
        .filter((x): x is { id: string; label: string; reason: string; draftOnly: boolean } => x !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.assignments, exclusionDraft, exclusionsVersion]
  );
  const clashIds = useMemo(() => new Set(excludedClashes.map(c => c.id)), [excludedClashes]);

  /** £500 base worked through each band for car / van / motorbike, for confirmation. */
  const typeFactorCheck = useMemo(() => {
    const base = 500;
    return config.bands.map(band => {
      const match = { band, assignment: null, isDefault: false };
      const types = (['car', 'van', 'motorbike'] as const).map(t => ({
        type: t,
        result: applyRiskBand(base, match, t, config),
      }));
      return { band, types };
    });
  }, [config]);



  const visibleAssignments = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = config.assignments;
    if (fuelFilter !== 'all') list = list.filter(a => normalizeFuelFilter(a.fuel) === fuelFilter);
    if (q) {
      list = list.filter(a =>
        `${a.make} ${a.model} ${FUEL_LABEL[normalizeFuelFilter(a.fuel)]} ${bandById.get(a.bandId)?.name || ''}`
          .toLowerCase()
          .includes(q)
      );
    }
    return [...list].sort(
      (a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model)
    );
  }, [config.assignments, filter, fuelFilter, bandById]);

  const testResult = useMemo(() => {
    const match = matchRiskBand(testMake, testModel, config, testFuel);
    const priced = applyRiskBand(Number(testBase) || 0, match, testType, config);
    return { match, priced };
  }, [testMake, testModel, testBase, testType, testFuel, config]);

  const patchBand = (id: string, patch: Partial<RiskBand>) => {
    update({ ...config, bands: config.bands.map(b => (b.id === id ? { ...b, ...patch } : b)) });
  };

  const patchAssignment = (id: string, patch: Partial<RiskBandAssignment>) => {
    update({
      ...config,
      assignments: config.assignments.map(a => (a.id === id ? { ...a, ...patch } : a)),
    });
  };

  const addBand = () => {
    const band: RiskBand = {
      id: newId('band'),
      name: 'New band',
      factor: 1,
      minOneYear: null,
      referral: false,
      tone: 'normal',
    };
    update({ ...config, bands: [...config.bands, band] });
  };

  const removeBand = (id: string) => {
    if (config.assignments.some(a => a.bandId === id)) {
      toast.error('Move the vehicles out of this band first.');
      return;
    }
    if (config.defaultBandId === id) {
      toast.error('This is the default band — pick another default first.');
      return;
    }
    update({ ...config, bands: config.bands.filter(b => b.id !== id) });
  };

  const addAssignment = () => {
    const make = newEntry.make.trim();
    const model = newEntry.model.trim();
    if (!make && !model) {
      toast.error('Enter a make, a model, or both.');
      return;
    }
    update({
      ...config,
      assignments: [
        { id: newId('assign'), bandId: newEntry.bandId, make, model, fuel: newEntry.fuel, enabled: true },
        ...config.assignments,
      ],
    });
    setNewEntry({ make: '', model: '', bandId: newEntry.bandId, fuel: 'any' });
    // A live search or fuel filter would hide the row we just added and make it
    // look like nothing saved — clear both so the new entry is always visible.
    setFilter('');
    setFuelFilter('all');
    const bandName = bandById.get(newEntry.bandId)?.name ?? 'band';
    toast.success(
      `Saved — ${[make, model].filter(Boolean).join(' ')} added to ${bandName}. Push live to apply it to quotes.`
    );
  };


  const save = () => {
    saveRiskBandConfig(config);
    setDirty(false);
    toast.success('Risk bands saved.');
  };

  const reset = () => {
    setConfig(DEFAULT_RISK_BAND_CONFIG);
    setDirty(true);
    toast.info('Reset to the starter bands — save to keep it.');
  };

  /** Attach these bands to whichever pricing version is live right now. */
  const pushLive = async () => {
    setPublishing(true);
    try {
      saveRiskBandConfig(config);
      setDirty(false);
      const result = await publishRiskBandsToLiveVersion(config);
      if (!result.published) {
        toast.error(result.reason || 'Could not push the bands live.');
        return;
      }
      setLiveVersionLabel(result.versionLabel ?? liveVersionLabel);
      setLastPublishedAt(new Date().toLocaleString('en-GB'));
      toast.success(
        `Bands are live on "${result.versionLabel}" — Quotes & Orders and Steps 3–4 now use them.`
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not push the bands live.');
    } finally {
      setPublishing(false);
    }
  };



  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Layers className="h-5 w-5" /> Global settings — vehicle type, model-risk bands &amp; minimum price
              </CardTitle>
              <CardDescription>
                <strong>These are global settings.</strong> The vehicle type factors, the makes and models in
                each band and the minimum price floor apply to <strong>every</strong> pricing model — July
                codebase, Aug hybrid, the age-based builder, Quotes &amp; Orders and Steps 3–4. They are applied
                last: age base × mileage × powertrain × vehicle type × band factor, then the floors.
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Reset
                </Button>
                <Button variant="outline" size="sm" onClick={save} disabled={!dirty}>
                  <Save className="h-4 w-4 mr-2" /> {dirty ? 'Save changes' : 'Saved'}
                </Button>
                <Button size="sm" onClick={pushLive} disabled={publishing}>
                  <Rocket className="h-4 w-4 mr-2" />
                  {publishing ? 'Pushing live…' : 'Push live'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-right">
                {liveVersionLabel
                  ? <>Live pricing version: <strong>{liveVersionLabel}</strong></>
                  : 'No pricing version is live yet'}
                {lastPublishedAt ? ` · pushed ${lastPublishedAt}` : ''}
              </p>
            </div>

          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription className="text-sm">
              A <strong>referral</strong> band produces no automatic price — the quote goes to manual
              underwriting. Motorbikes always price at the motorbike share of standard, and their band
              floor halves with them.
              <br />
              <strong>Excluded vehicles always win:</strong> anything on the site-wide excluded list is
              declined at registration lookup, so a band never overrides it — no clash is possible.
            </AlertDescription>
          </Alert>

          {excludedClashes.length > 0 && (
            <Alert className="border-destructive/40 bg-destructive/5">
              <AlertDescription className="text-sm">
                <strong>{excludedClashes.length} band rule{excludedClashes.length === 1 ? '' : 's'} overlap the excluded list</strong>{' '}
                and will never price — the vehicle is declined first. Remove them, or take the vehicle off the
                excluded list if you do want to cover it.
                <ul className="mt-2 list-disc pl-5 space-y-0.5">
                  {excludedClashes.map(c => (
                    <li key={c.id}>
                      <span className="font-medium">{c.label}</span> — {c.reason}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}


          {/* Global minimum price floor */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <h3 className="font-semibold mb-1">Minimum price floor (global)</h3>
            <p className="text-xs text-muted-foreground mb-3">
              The cheapest total we ever quote, on any pricing model and any band. Applied after every
              factor and after each band's own minimum.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="global-min-total">Minimum total (£)</Label>
                <Input
                  id="global-min-total"
                  type="number"
                  min={0}
                  step="1"
                  value={config.globalMinTotal}
                  onChange={e =>
                    update({
                      ...config,
                      globalMinTotal: Math.max(0, Math.round(Number(e.target.value) || 0)),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Default £{DEFAULT_GLOBAL_MIN_TOTAL}.
                </p>
              </div>
              <div className="space-y-1">
                <Label>Cars &amp; vans</Label>
                <Input value={`£${globalMinTotalFor(config, 'car')}`} disabled />
                <p className="text-xs text-muted-foreground">Floor as quoted.</p>
              </div>
              <div className="space-y-1">
                <Label>Motorbikes</Label>
                <Input value={`£${globalMinTotalFor(config, 'motorbike')}`} disabled />
                <p className="text-xs text-muted-foreground">Half of standard, per the bike rule.</p>
              </div>
            </div>
            <Alert className="mt-3">
              <AlertDescription className="text-xs">
                <strong>Staff only:</strong> in Quotes &amp; Orders agents get a note when a price lands on or
                below £{globalMinTotalFor(config, 'car')} — anything cheaper needs an uploaded price match.
                <br />
                <strong>Website:</strong> Steps 3–4 simply show this as the lowest price available, with no
                warning or mention of a floor to the customer.
              </AlertDescription>
            </Alert>
          </div>

          {/* Vehicle type factors */}
          <div>
            <h3 className="font-semibold mb-3">Vehicle type factors</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Passenger car</Label>
                <Input value="1.00" disabled />
                <p className="text-xs text-muted-foreground">Reference vehicle type.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="van-factor">Van / commercial</Label>
                <Input
                  id="van-factor"
                  type="number"
                  step="0.01"
                  value={config.vehicleTypes.van}
                  onChange={e =>
                    update({
                      ...config,
                      vehicleTypes: { ...config.vehicleTypes, van: clampBandFactor(Number(e.target.value)) },
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">Commercial-vehicle uplift.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="bike-factor">Motorbike</Label>
                <Input
                  id="bike-factor"
                  type="number"
                  step="0.01"
                  value={config.vehicleTypes.motorbike}
                  onChange={e =>
                    update({
                      ...config,
                      vehicleTypes: {
                        ...config.vehicleTypes,
                        motorbike: clampBandFactor(Number(e.target.value)),
                      },
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">0.50 = half of standard, floors halve too.</p>
              </div>
            </div>

            {/* Confirmation: how each band prices per vehicle type */}
            <div className="mt-4 rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2 font-medium">Band</th>
                    <th className="p-2 font-medium">Factor</th>
                    <th className="p-2 font-medium">Car (£500 base)</th>
                    <th className="p-2 font-medium">Van ×{config.vehicleTypes.van.toFixed(2)}</th>
                    <th className="p-2 font-medium">Motorbike ×{config.vehicleTypes.motorbike.toFixed(2)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {typeFactorCheck.map(({ band, types }) => (
                    <tr key={band.id}>
                      <td className="p-2">
                        <Badge variant="outline" className={TONE_CLASS[band.tone]}>
                          {band.name}
                        </Badge>
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {band.blocked || band.referral ? '—' : `×${band.factor.toFixed(2)}`}
                        {band.minOneYear ? ` · min £${band.minOneYear}` : ''}
                      </td>
                      {types.map(({ type, result }) => (
                        <td key={type} className="p-2">
                          {result.blocked
                            ? 'Not covered'
                            : result.referral
                            ? 'Referral'
                            : `£${result.price}${result.floorApplied ? ' (floor)' : ''}`}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Worked example only. Type factor is applied after the band factor; motorbike floors are halved.
            </p>
          </div>


          <Separator />

          {/* Bands */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Risk bands</h3>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Default band</Label>
                <Select
                  value={config.defaultBandId}
                  onValueChange={v => update({ ...config, defaultBandId: v })}
                >
                  <SelectTrigger className="h-8 w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.bands
                      .filter(b => !b.referral && !b.blocked)
                      .map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={addBand}>
                  <Plus className="h-4 w-4 mr-2" /> Add band
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {config.bands.map(band => (
                <div key={band.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="outline" className={TONE_CLASS[band.tone]}>
                      {countsByBand[band.id] || 0} vehicles
                    </Badge>
                    <Input
                      className="h-9 max-w-[240px]"
                      value={band.name}
                      onChange={e => patchBand(band.id, { name: e.target.value })}
                    />
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Price factor</Label>
                      <Input
                        className="h-9 w-[90px]"
                        type="number"
                        step="0.01"
                        value={band.factor}
                        disabled={band.referral || band.blocked}
                        onChange={e => patchBand(band.id, { factor: clampBandFactor(Number(e.target.value)) })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Min 1-year £</Label>
                      <Input
                        className="h-9 w-[110px]"
                        type="number"
                        placeholder="global floor"
                        value={band.minOneYear ?? ''}
                        disabled={band.referral || band.blocked}
                        onChange={e =>
                          patchBand(band.id, {
                            minOneYear: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                          })
                        }
                      />
                    </div>
                    <Select value={band.tone} onValueChange={v => patchBand(band.id, { tone: v as RiskBand['tone'] })}>
                      <SelectTrigger className="h-9 w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TONE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={band.referral}
                        onCheckedChange={v => patchBand(band.id, { referral: v })}
                      />
                      <Label className="text-xs">Referral only</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={band.blocked === true}
                        onCheckedChange={v =>
                          patchBand(band.id, {
                            blocked: v,
                            referral: v ? false : band.referral,
                            tone: v ? 'blocked' : band.tone === 'blocked' ? 'normal' : band.tone,
                            blockMessage: v ? band.blockMessage || DEFAULT_BLOCK_MESSAGE : band.blockMessage,
                          })
                        }
                      />
                      <Label className="text-xs">Not covered (block)</Label>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto text-destructive"
                      onClick={() => removeBand(band.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    className="h-9"
                    placeholder="Internal note — when to use this band"
                    value={band.note || ''}
                    onChange={e => patchBand(band.id, { note: e.target.value })}
                  />
                  {band.blocked && (
                    <div className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                      <Label className="text-xs font-semibold">Customer message shown when declined</Label>
                      <Textarea
                        className="min-h-[76px] text-sm"
                        value={band.blockMessage ?? DEFAULT_BLOCK_MESSAGE}
                        placeholder={DEFAULT_BLOCK_MESSAGE}
                        onChange={e => patchBand(band.id, { blockMessage: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Keep it polite and explanatory — this wording is read by the customer or the agent
                        on the call.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Assignments */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="font-semibold">Makes &amp; models in each band</h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={save} disabled={!dirty}>
                  <Save className="h-4 w-4 mr-2" /> {dirty ? 'Save changes' : 'Saved'}
                </Button>
                <Button size="sm" onClick={pushLive} disabled={publishing}>
                  <Rocket className="h-4 w-4 mr-2" />
                  {publishing ? 'Pushing live…' : 'Push live'}
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_170px_200px_auto] items-end mb-4">
              <div className="space-y-1">
                <Label className="text-xs">Make</Label>
                <Input
                  placeholder="e.g. Land Rover (blank = all makes)"
                  value={newEntry.make}
                  onChange={e => setNewEntry({ ...newEntry, make: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Model / trim (blank = all models)</Label>
                <Input
                  placeholder="e.g. Range Rover Velar (blank = all models)"
                  value={newEntry.model}
                  onChange={e => setNewEntry({ ...newEntry, model: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fuel type</Label>
                <Select
                  value={newEntry.fuel}
                  onValueChange={v => setNewEntry({ ...newEntry, fuel: v as FuelFilter })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUEL_FILTER_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.value === 'any' ? 'All fuel types' : o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Band</Label>
                <Select value={newEntry.bandId} onValueChange={v => setNewEntry({ ...newEntry, bandId: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.bands.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addAssignment}>
                <Plus className="h-4 w-4 mr-2" /> Add vehicle
              </Button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Select value={fuelFilter} onValueChange={v => setFuelFilter(v as FuelFilter | 'all')}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All fuel types</SelectItem>
                  {FUEL_FILTER_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search makes, models, fuel or bands"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
            </div>

            <div className="rounded-lg border divide-y">
              {visibleAssignments.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No vehicles match that search.</p>
              )}
              {visibleAssignments.map(a => {
                const band = bandById.get(a.bandId);
                const clashes = clashIds.has(a.id);
                return (
                <div key={a.id} className={`flex flex-wrap items-center gap-3 p-3 ${clashes ? 'bg-destructive/5' : ''}`}>

                    <div className="min-w-[180px]">
                      <p className="font-medium">
                        {a.make || <span className="text-muted-foreground">(all makes)</span>}{' '}
                        {a.model || <span className="text-muted-foreground">(all models)</span>}
                      </p>
                      {normalizeFuelFilter(a.fuel) !== 'any' && (
                        <p className="text-xs font-medium text-primary">
                          {FUEL_LABEL[normalizeFuelFilter(a.fuel)]} only
                        </p>
                      )}
                      {band && (
                        <p className="text-xs text-muted-foreground">
                          {band.blocked
                            ? 'Not covered — declined politely'
                            : band.referral
                            ? 'Referral — no automatic price'
                            : `×${band.factor.toFixed(2)}${band.minOneYear ? ` · min £${band.minOneYear}` : ''}`}
                        </p>
                      )}
                      {clashes && (
                        <p className="text-xs font-semibold text-destructive">
                          Excluded list wins — never quoted
                        </p>
                      )}
                    </div>

                    <Select value={a.bandId} onValueChange={v => patchAssignment(a.id, { bandId: v })}>
                      <SelectTrigger className="h-9 w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {config.bands.map(b => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-9 w-[190px]"
                      value={a.model}
                      placeholder="Model / trim"
                      onChange={e => patchAssignment(a.id, { model: e.target.value })}
                    />
                    <Select
                      value={normalizeFuelFilter(a.fuel)}
                      onValueChange={v => patchAssignment(a.id, { fuel: v as FuelFilter })}
                    >
                      <SelectTrigger className="h-9 w-[170px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FUEL_FILTER_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {band && (
                      <Badge variant="outline" className={TONE_CLASS[band.tone]}>
                        {band.name}
                      </Badge>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                      <Switch
                        id={`rule-${a.id}`}
                        checked={a.enabled}
                        onCheckedChange={v => patchAssignment(a.id, { enabled: v })}
                      />
                      <Label htmlFor={`rule-${a.id}`} className="text-xs w-8">
                        {a.enabled ? 'On' : 'Off'}
                      </Label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() =>
                          update({ ...config, assignments: config.assignments.filter(x => x.id !== a.id) })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tester */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test a vehicle</CardTitle>
          <CardDescription>
            Check which band a make and model lands in, and what it does to a base price.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs">Make</Label>
              <Input value={testMake} onChange={e => setTestMake(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fuel type (as DVLA)</Label>
              <Input
                value={testFuel}
                placeholder="e.g. Diesel"
                onChange={e => setTestFuel(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Model</Label>
              <Input value={testModel} onChange={e => setTestModel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Base price £ (1 year)</Label>
              <Input type="number" value={testBase} onChange={e => setTestBase(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vehicle type</Label>
              <Select value={testType} onValueChange={v => setTestType(v as typeof testType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="car">Passenger car</SelectItem>
                  <SelectItem value="van">Van / commercial</SelectItem>
                  <SelectItem value="motorbike">Motorbike</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isVehicleExcluded(testMake, testModel) && (
            <Alert className="border-destructive/40 bg-destructive/5">
              <AlertDescription className="text-sm">
                <strong>On the excluded vehicles list</strong> — {getExclusionReason(testMake, testModel)}. This
                vehicle is declined at registration lookup, so the band below is never reached.
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border p-4 flex flex-wrap items-center gap-4">

            <Badge variant="outline" className={TONE_CLASS[testResult.match.band.tone]}>
              {testResult.match.band.name}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {testResult.match.isDefault
                ? 'No rule matched — default band used'
                : `Matched: ${testResult.match.assignment?.make || '(all makes)'} ${testResult.match.assignment?.model || '(all models)'}`}
            </span>
            <div className="ml-auto text-right">
              {testResult.priced.blocked ? (
                <div className="max-w-md text-left">
                  <p className="text-lg font-bold text-destructive">Not covered</p>
                  <p className="text-xs text-muted-foreground">{testResult.priced.blockMessage}</p>
                </div>
              ) : testResult.priced.referral ? (
                <p className="text-lg font-bold text-destructive">Referral — no automatic price</p>
              ) : (
                <>
                  <p className="text-2xl font-bold">£{testResult.priced.price}</p>
                  <p className="text-xs text-muted-foreground">
                    ×{testResult.priced.factorUsed.toFixed(2)} applied
                    {testResult.priced.floorApplied ? ' · band minimum applied' : ''}
                  </p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VehicleRiskBandsPanel;
