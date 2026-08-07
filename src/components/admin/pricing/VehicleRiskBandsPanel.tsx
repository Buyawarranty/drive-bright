import React, { useMemo, useState } from 'react';
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
import { Layers, Plus, RotateCcw, Save, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
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
} from '@/lib/pricing/vehicleRiskBands';

const TONE_CLASS: Record<RiskBand['tone'], string> = {
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  normal: 'bg-muted text-foreground border-border',
  high: 'bg-amber-100 text-amber-900 border-amber-200',
  severe: 'bg-orange-100 text-orange-900 border-orange-200',
  referral: 'bg-destructive/10 text-destructive border-destructive/30',
};

const TONE_OPTIONS: { value: RiskBand['tone']; label: string }[] = [
  { value: 'low', label: 'Green (low)' },
  { value: 'normal', label: 'Grey (normal)' },
  { value: 'high', label: 'Amber (high)' },
  { value: 'severe', label: 'Orange (very high)' },
  { value: 'referral', label: 'Red (referral)' },
];

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const VehicleRiskBandsPanel: React.FC = () => {
  const [config, setConfig] = useState<RiskBandConfig>(() => loadRiskBandConfig());
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState('');
  const [newEntry, setNewEntry] = useState({ make: '', model: '', bandId: 'high' });
  const [testMake, setTestMake] = useState('Land Rover');
  const [testModel, setTestModel] = useState('Range Rover Sport');
  const [testBase, setTestBase] = useState(499);
  const [testType, setTestType] = useState<'car' | 'van' | 'motorbike'>('car');

  const update = (next: RiskBandConfig) => {
    setConfig(next);
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

  const visibleAssignments = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q
      ? config.assignments.filter(a =>
          `${a.make} ${a.model} ${bandById.get(a.bandId)?.name || ''}`.toLowerCase().includes(q)
        )
      : config.assignments;
    return [...list].sort(
      (a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model)
    );
  }, [config.assignments, filter, bandById]);

  const testResult = useMemo(() => {
    const match = matchRiskBand(testMake, testModel, config);
    const priced = applyRiskBand(Number(testBase) || 0, match, testType, config);
    return { match, priced };
  }, [testMake, testModel, testBase, testType, config]);

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
    if (!make) {
      toast.error('Enter a make.');
      return;
    }
    update({
      ...config,
      assignments: [
        { id: newId('assign'), bandId: newEntry.bandId, make, model: newEntry.model.trim(), enabled: true },
        ...config.assignments,
      ],
    });
    setNewEntry({ make: '', model: '', bandId: newEntry.bandId });
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Layers className="h-5 w-5" /> Vehicle type &amp; model-risk bands
              </CardTitle>
              <CardDescription>
                Group makes and models into bands, set the price factor and minimum price for each band.
                Applied last: age base × mileage × powertrain × vehicle type × band factor.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-2" /> Reset
              </Button>
              <Button size="sm" onClick={save} disabled={!dirty}>
                <Save className="h-4 w-4 mr-2" /> {dirty ? 'Save changes' : 'Saved'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription className="text-sm">
              A <strong>referral</strong> band produces no automatic price — the quote goes to manual
              underwriting. Motorbikes always price at the motorbike share of standard, and their band
              floor halves with them.
            </AlertDescription>
          </Alert>

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
                      .filter(b => !b.referral)
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
                        disabled={band.referral}
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
                        disabled={band.referral}
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
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Assignments */}
          <div>
            <h3 className="font-semibold mb-3">Makes &amp; models in each band</h3>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_200px_auto] items-end mb-4">
              <div className="space-y-1">
                <Label className="text-xs">Make</Label>
                <Input
                  placeholder="e.g. Land Rover"
                  value={newEntry.make}
                  onChange={e => setNewEntry({ ...newEntry, make: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Model / trim (blank = whole make)</Label>
                <Input
                  placeholder="e.g. Range Rover Velar"
                  value={newEntry.model}
                  onChange={e => setNewEntry({ ...newEntry, model: e.target.value })}
                />
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

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search makes, models or bands"
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
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-[180px]">
                      <p className="font-medium">
                        {a.make} {a.model || <span className="text-muted-foreground">(all models)</span>}
                      </p>
                      {band && (
                        <p className="text-xs text-muted-foreground">
                          {band.referral
                            ? 'Referral — no automatic price'
                            : `×${band.factor.toFixed(2)}${band.minOneYear ? ` · min £${band.minOneYear}` : ''}`}
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
                    {band && (
                      <Badge variant="outline" className={TONE_CLASS[band.tone]}>
                        {band.name}
                      </Badge>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                      <Switch
                        checked={a.enabled}
                        onCheckedChange={v => patchAssignment(a.id, { enabled: v })}
                      />
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
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Make</Label>
              <Input value={testMake} onChange={e => setTestMake(e.target.value)} />
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

          <div className="rounded-lg border p-4 flex flex-wrap items-center gap-4">
            <Badge variant="outline" className={TONE_CLASS[testResult.match.band.tone]}>
              {testResult.match.band.name}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {testResult.match.isDefault
                ? 'No rule matched — default band used'
                : `Matched: ${testResult.match.assignment?.make} ${testResult.match.assignment?.model || '(all models)'}`}
            </span>
            <div className="ml-auto text-right">
              {testResult.priced.referral ? (
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
