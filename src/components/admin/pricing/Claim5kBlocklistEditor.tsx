import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Ban, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useClaim5kBlocklist } from '@/hooks/useClaim5kBlocklist';
import type { Claim5kBlockRule } from '@/lib/claimLimitTiers';

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

  useEffect(() => {
    if (!loading) setDraft(rules);
  }, [loading, rules]);

  const update = (id: string, patch: Partial<Claim5kBlockRule>) =>
    setDraft(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const addRule = () => {
    const make = newMake.trim();
    if (!make) {
      toast.error('Enter a vehicle make to block');
      return;
    }
    setDraft(prev => [
      ...prev,
      { id: `rule-${Date.now()}`, make, model: newModel.trim() || null, blocked: true },
    ]);
    setNewMake('');
    setNewModel('');
  };

  const handleSave = async () => {
    const ok = await save(draft);
    toast[ok ? 'success' : 'error'](
      ok ? '£5,000 blocklist saved and applied live' : 'Could not save the blocklist'
    );
  };

  const activeCount = draft.filter(r => r.blocked).length;

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
            journey. Leave Model blank to block the whole make, or add a model to block just that
            model. Switch a rule off to unblock without deleting it.
          </p>
        </div>
        <Badge variant="outline" className="bg-white">
          {activeCount} blocked
        </Badge>
      </div>

      <div className="space-y-2">
        {draft.map(rule => (
          <div
            key={rule.id}
            className="flex flex-wrap items-center gap-2 rounded-md border bg-white p-2"
          >
            <Input
              value={rule.make}
              onChange={e => update(rule.id!, { make: e.target.value })}
              placeholder="Make (e.g. Land Rover)"
              className="w-48"
            />
            <Input
              value={rule.model ?? ''}
              onChange={e => update(rule.id!, { model: e.target.value || null })}
              placeholder="Model (optional)"
              className="w-48"
            />
            <span className="text-xs text-muted-foreground flex-1 min-w-[8rem]">
              {rule.model ? `Blocks ${rule.make} ${rule.model} only` : `Blocks all ${rule.make}`}
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
        {!draft.length && (
          <p className="text-sm text-muted-foreground">
            No blocks — every vehicle can be quoted at £5,000.
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
