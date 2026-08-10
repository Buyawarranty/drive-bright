import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Ban, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useClaim5kBlocklist } from '@/hooks/useClaim5kBlocklist';
import {
  BLOCKABLE_CLAIM_LIMITS,
  normalizeBlockedLimits,
  type Claim5kBlockRule,
} from '@/lib/claimLimitTiers';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FUEL_FILTER_OPTIONS,
  FUEL_LABEL,
  normalizeFuelFilter,
  type FuelFilter,
} from '@/lib/pricing/fuelCategory';

/**
 * Management editor for claim-limit blocks.
 * A rule can target a make, a make + model, a model on its own, a single fuel
 * type, or one exact registration, and chooses which claim limits it blocks.
 * £2,000 is never blockable — it is the reference tier every price is built on.
 */
const LIMIT_LABEL: Record<number, string> = {
  750: '£1,000 Basic',
  3000: '£3,000 Elite',
  5000: '£5,000 Premium',
};

export default function Claim5kBlocklistEditor() {
  const { rules, loading, saving, save } = useClaim5kBlocklist();
  const [draft, setDraft] = useState<Claim5kBlockRule[]>([]);
  const [newMake, setNewMake] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newReg, setNewReg] = useState('');
  const [newFuel, setNewFuel] = useState<FuelFilter>('any');
  const [newLimits, setNewLimits] = useState<number[]>([5000]);
  const [fuelFilter, setFuelFilter] = useState<FuelFilter | 'all'>('all');
  const [limitFilter, setLimitFilter] = useState<'all' | string>('all');

  useEffect(() => {
    if (!loading) setDraft(rules);
  }, [loading, rules]);

  const update = (id: string, patch: Partial<Claim5kBlockRule>) =>
    setDraft(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const toggleLimit = (id: string, limit: number) => {
    setDraft(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const current = normalizeBlockedLimits(r.limits);
        const next = current.includes(limit)
          ? current.filter(l => l !== limit)
          : [...current, limit];
        if (!next.length) {
          toast.error('A rule must block at least one claim limit');
          return r;
        }
        return { ...r, limits: next };
      })
    );
  };

  const toggleNewLimit = (limit: number) =>
    setNewLimits(prev => (prev.includes(limit) ? prev.filter(l => l !== limit) : [...prev, limit]));

  const addRule = () => {
    const make = newMake.trim();
    const model = newModel.trim();
    const registration = newReg.trim().toUpperCase();
    if (!make && !model && !registration) {
      toast.error('Enter a make, a model or a registration');
      return;
    }
    if (!newLimits.length) {
      toast.error('Pick at least one claim limit to block');
      return;
    }
    setDraft(prev => [
      ...prev,
      {
        id: `rule-${Date.now()}`,
        make: registration ? '' : make,
        model: registration ? null : model || null,
        registration: registration || null,
        fuel: registration ? 'any' : newFuel,
        limits: [...newLimits],
        blocked: true,
      },
    ]);
    setNewMake('');
    setNewModel('');
    setNewReg('');
    setNewFuel('any');
    setNewLimits([5000]);
  };

  const handleSave = async () => {
    const ok = await save(draft);
    toast[ok ? 'success' : 'error'](
      ok ? 'Claim limit blocks saved and applied live' : 'Could not save the blocklist'
    );
  };

  const activeCount = draft.filter(r => r.blocked).length;
  const visible = draft.filter(r => {
    if (fuelFilter !== 'all' && normalizeFuelFilter(r.fuel) !== fuelFilter) return false;
    if (limitFilter !== 'all' && !normalizeBlockedLimits(r.limits).includes(Number(limitFilter)))
      return false;
    return true;
  });

  const scopeText = (rule: Claim5kBlockRule) => {
    const fuel = normalizeFuelFilter(rule.fuel);
    const fuelSuffix = fuel === 'any' ? '' : ` (${FUEL_LABEL[fuel].toLowerCase()} only)`;
    const limits = normalizeBlockedLimits(rule.limits)
      .map(l => LIMIT_LABEL[l] || `£${l.toLocaleString()}`)
      .join(', ');
    if (rule.registration) return `Blocks ${limits} on ${rule.registration.toUpperCase()} only`;
    const who = !rule.make && rule.model
      ? `${rule.model} across all makes`
      : rule.model
        ? `${rule.make} ${rule.model}`
        : `all ${rule.make}`;
    return `Blocks ${limits} on ${who}${fuelSuffix}`;
  };

  return (
    <div className="rounded-lg border-2 border-rose-300 bg-rose-50/50 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Ban className="h-5 w-5 text-rose-700" />
            Claim limit blocks
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Blocked claim limits disappear from Quotes &amp; Orders and the customer journey. Target a
            make on its own, a make plus a model, a model across every make, a single fuel type, or one
            exact registration — then tick which claim limits that rule blocks. £2,000 is always
            available because every price is built from it. Switch a rule off to unblock without
            deleting it.
          </p>
        </div>
        <Badge variant="outline" className="bg-white">
          {activeCount} active
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Filter by fuel</span>
        <Select value={fuelFilter} onValueChange={v => setFuelFilter(v as FuelFilter | 'all')}>
          <SelectTrigger className="h-9 w-[180px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rules</SelectItem>
            {FUEL_FILTER_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs font-medium text-muted-foreground">Filter by claim limit</span>
        <Select value={limitFilter} onValueChange={setLimitFilter}>
          <SelectTrigger className="h-9 w-[180px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All claim limits</SelectItem>
            {BLOCKABLE_CLAIM_LIMITS.map(l => (
              <SelectItem key={l} value={String(l)}>
                {LIMIT_LABEL[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {visible.map(rule => {
          const limits = normalizeBlockedLimits(rule.limits);
          return (
            <div key={rule.id} className="space-y-2 rounded-md border bg-white p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={rule.make}
                  onChange={e => update(rule.id!, { make: e.target.value })}
                  placeholder="Make (blank = all makes)"
                  className="w-44"
                  disabled={!!rule.registration}
                />
                <Input
                  value={rule.model ?? ''}
                  onChange={e => update(rule.id!, { model: e.target.value || null })}
                  placeholder="Model (blank = all models)"
                  className="w-44"
                  disabled={!!rule.registration}
                />
                <Input
                  value={rule.registration ?? ''}
                  onChange={e =>
                    update(rule.id!, { registration: e.target.value.toUpperCase() || null })
                  }
                  placeholder="Reg (one vehicle)"
                  className="w-36 uppercase"
                />
                <Select
                  value={normalizeFuelFilter(rule.fuel)}
                  onValueChange={v => update(rule.id!, { fuel: v as FuelFilter })}
                  disabled={!!rule.registration}
                >
                  <SelectTrigger className="h-9 w-[160px]">
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

                <div className="flex items-center gap-2 ml-auto">
                  <span
                    className={`text-xs font-semibold ${
                      rule.blocked ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {rule.blocked ? 'Blocked' : 'Allowed'}
                  </span>
                  <Switch
                    checked={rule.blocked}
                    onCheckedChange={next => update(rule.id!, { blocked: next })}
                    className="data-[state=checked]:bg-rose-600"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDraft(prev => prev.filter(r => r.id !== rule.id))}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Blocks:</span>
                {BLOCKABLE_CLAIM_LIMITS.map(l => {
                  const on = limits.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => toggleLimit(rule.id!, l)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        on
                          ? 'border-rose-500 bg-rose-600 text-white'
                          : 'border-border bg-background text-muted-foreground hover:border-rose-300'
                      }`}
                    >
                      {LIMIT_LABEL[l]}
                    </button>
                  );
                })}
                <span className="ml-2 text-xs text-muted-foreground">{scopeText(rule)}</span>
              </div>
            </div>
          );
        })}
        {!visible.length && (
          <p className="text-sm text-muted-foreground">
            {draft.length
              ? 'No rules match those filters.'
              : 'No blocks — every vehicle can be quoted at every claim limit.'}
          </p>
        )}
      </div>

      <div className="space-y-2 border-t pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={newMake}
            onChange={e => setNewMake(e.target.value)}
            placeholder="Make to block"
            className="w-44 bg-white"
          />
          <Input
            value={newModel}
            onChange={e => setNewModel(e.target.value)}
            placeholder="Model (optional)"
            className="w-44 bg-white"
          />
          <Input
            value={newReg}
            onChange={e => setNewReg(e.target.value.toUpperCase())}
            placeholder="Or one reg"
            className="w-36 bg-white uppercase"
          />
          <Select value={newFuel} onValueChange={v => setNewFuel(v as FuelFilter)}>
            <SelectTrigger className="w-[160px] bg-white">
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
          <Button variant="outline" onClick={addRule}>
            <Plus className="h-4 w-4 mr-1" /> Add block
          </Button>
          <Button onClick={handleSave} disabled={saving || loading} className="ml-auto">
            <Save className="h-4 w-4 mr-1" /> Save blocks
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Claim limits to block:</span>
          {BLOCKABLE_CLAIM_LIMITS.map(l => {
            const on = newLimits.includes(l);
            return (
              <button
                key={l}
                type="button"
                onClick={() => toggleNewLimit(l)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  on
                    ? 'border-rose-500 bg-rose-600 text-white'
                    : 'border-border bg-white text-muted-foreground hover:border-rose-300'
                }`}
              >
                {LIMIT_LABEL[l]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
