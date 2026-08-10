import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Ban, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useClaim5kBlocklist } from '@/hooks/useClaim5kBlocklist';
import type { Claim5kBlockRule } from '@/lib/claimLimitTiers';
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
 * Management editor for vehicles blocked from the £5,000 claim limit.
 * Blocks by make, or by make + model for a narrower block, and each rule can be
 * switched off (unblocked) without deleting it.
 */
export default function Claim5kBlocklistEditor() {
  const { rules, loading, saving, save } = useClaim5kBlocklist();
  const [draft, setDraft] = useState<Claim5kBlockRule[]>([]);
  const [newMake, setNewMake] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newFuel, setNewFuel] = useState<FuelFilter>('any');
  const [fuelFilter, setFuelFilter] = useState<FuelFilter | 'all'>('all');

  useEffect(() => {
    if (!loading) setDraft(rules);
  }, [loading, rules]);

  const update = (id: string, patch: Partial<Claim5kBlockRule>) =>
    setDraft(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const addRule = () => {
    const make = newMake.trim();
    const model = newModel.trim();
    if (!make && !model) {
      toast.error('Enter a make, a model, or both');
      return;
    }
    setDraft(prev => [
      ...prev,
      { id: `rule-${Date.now()}`, make, model: model || null, fuel: newFuel, blocked: true },
    ]);
    setNewMake('');
    setNewModel('');
    setNewFuel('any');
  };


  const handleSave = async () => {
    const ok = await save(draft);
    toast[ok ? 'success' : 'error'](
      ok ? '£5,000 blocklist saved and applied live' : 'Could not save the blocklist'
    );
  };

  const activeCount = draft.filter(r => r.blocked).length;
  const visible =
    fuelFilter === 'all' ? draft : draft.filter(r => normalizeFuelFilter(r.fuel) === fuelFilter);
  const fuelSuffix = (rule: Claim5kBlockRule) => {
    const f = normalizeFuelFilter(rule.fuel);
    return f === 'any' ? '' : ` (${FUEL_LABEL[f].toLowerCase()} only)`;
  };

  return (
    <div className="rounded-lg border-2 border-rose-300 bg-rose-50/50 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Ban className="h-5 w-5 text-rose-700" />
            Vehicles blocked from the £5,000 claim limit
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Blocked vehicles fall back to £3,000 cover on Quotes &amp; Orders and the customer
            journey. Enter a make on its own to block the whole make, a make plus a model to block
            just that model, or a model on its own to block that model across every make. Switch a
            rule off to unblock without deleting it. Pick a fuel type to block only that
            powertrain, e.g. diesel Range Rovers.

          </p>
        </div>
        <Badge variant="outline" className="bg-white">
          {activeCount} blocked
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Filter by fuel</span>
        <Select value={fuelFilter} onValueChange={v => setFuelFilter(v as FuelFilter | 'all')}>
          <SelectTrigger className="h-9 w-[190px] bg-white">
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
      </div>

      <div className="space-y-2">
        {visible.map(rule => (
          <div
            key={rule.id}
            className="flex flex-wrap items-center gap-2 rounded-md border bg-white p-2"
          >
            <Input
              value={rule.make}
              onChange={e => update(rule.id!, { make: e.target.value })}
              placeholder="Make (blank = all makes)"
              className="w-48"
            />
            <Input
              value={rule.model ?? ''}
              onChange={e => update(rule.id!, { model: e.target.value || null })}
              placeholder="Model (blank = all models)"
              className="w-48"
            />
            <Select
              value={normalizeFuelFilter(rule.fuel)}
              onValueChange={v => update(rule.id!, { fuel: v as FuelFilter })}
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
            <span className="text-xs text-muted-foreground flex-1 min-w-[8rem]">
              {(!rule.make && rule.model
                ? `Blocks ${rule.model} across all makes`
                : rule.model
                  ? `Blocks ${rule.make} ${rule.model} only`
                  : `Blocks all ${rule.make}`) + fuelSuffix(rule)}
            </span>

            <div className="flex items-center gap-2">
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
        ))}
        {!visible.length && (
          <p className="text-sm text-muted-foreground">
            {draft.length
              ? 'No blocks match that fuel filter.'
              : 'No blocks — every vehicle can be quoted at £5,000.'}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Input
          value={newMake}
          onChange={e => setNewMake(e.target.value)}
          placeholder="Make to block"
          className="w-48 bg-white"
        />
        <Input
          value={newModel}
          onChange={e => setNewModel(e.target.value)}
          placeholder="Model (optional)"
          className="w-48 bg-white"
        />
        <Select value={newFuel} onValueChange={v => setNewFuel(v as FuelFilter)}>
          <SelectTrigger className="w-[170px] bg-white">
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
          <Save className="h-4 w-4 mr-1" /> Save blocklist
        </Button>
      </div>
    </div>
  );
}
