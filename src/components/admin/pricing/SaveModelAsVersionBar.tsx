import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePricingVersions } from '@/hooks/usePricingVersions';
import { buildAdminMatrixFromModel } from './AgeBandPricingPreview';

/**
 * SAVE A PREVIEWED MODEL AS A NEW NAMED PRICING MODEL (DRAFT).
 * Takes any model in the shape the Step 2 previews use, names it and stores it
 * as a draft pricing version. Nothing goes live here — publish it from the
 * Price grid tab or a Push live bar once you're happy with it.
 */

/** Turn a preview model into the vehicle factor model stored on a version. */
export function previewModelToVehicleFactors(m: any) {
  if (!m || !Array.isArray(m.bands) || !m.bands.length) return null;
  return {
    bands: m.bands.map((b: any) => ({ key: String(b.key), oneYear: b.oneYear ?? null })),
    refBandKey: String(m.refBandKey ?? m.bands[0]?.key ?? ''),
    mileageBands: (m.mileageBands || []).map((b: any) => ({
      min: Number(b.min) || 0,
      max: b.max === null || b.max === undefined ? null : Number(b.max),
      factor: b.factor === null || b.factor === undefined ? null : Number(b.factor),
    })),
    powertrains: (m.powertrains || []).map((p: any) => ({ key: String(p.key), factor: Number(p.factor) })),
    vehicleTypes: (m.vehicleTypes || []).map((t: any) => ({
      key: String(t.key),
      factor: t.factor === null || t.factor === undefined ? null : Number(t.factor),
    })),
    modelRisks: Array.isArray(m.modelRisks) ? m.modelRisks : undefined,
    modelFloors: Array.isArray(m.modelFloors) ? m.modelFloors : undefined,
    claimLimits: Array.isArray(m.claimLimits) ? m.claimLimits : undefined,
    labourRates: Array.isArray(m.labourRates) ? m.labourRates : undefined,
    excessFactors: Array.isArray(m.excessFactors) ? m.excessFactors : undefined,
    twoYearMult: m.twoYearMult === undefined ? undefined : Number(m.twoYearMult),
    threeYearMult: m.threeYearMult === undefined ? undefined : Number(m.threeYearMult),
    payInFullFactor: m.payInFullFactor === undefined ? undefined : Number(m.payInFullFactor),
    absoluteMinTotal: m.absoluteMinTotal === undefined ? undefined : Number(m.absoluteMinTotal),
  } as any;
}

const SaveModelAsVersionBar: React.FC<{
  /** Named sources the manager can save from (usually the two compared models). */
  sources: { key: string; label: string; getModel: () => any }[];
  websiteDiscountPct?: number;
  /** Called after a successful save with the new version id. */
  onSaved?: (versionId: string) => void;
}> = ({ sources, websiteDiscountPct = 10, onSaved }) => {
  const { createVersion } = usePricingVersions();
  const [sourceKey, setSourceKey] = useState(sources[0]?.key ?? '');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const source = sources.find(s => s.key === sourceKey) ?? sources[0];

  async function save() {
    const label = name.trim();
    if (!label) {
      toast.error('Give the pricing model a name first');
      return;
    }
    const model = source?.getModel();
    const vehicleFactors = previewModelToVehicleFactors(model);
    if (!vehicleFactors) {
      toast.error('That model has no figures to save yet');
      return;
    }
    setSaving(true);
    try {
      const matrix = buildAdminMatrixFromModel({
        ...model,
        refBandKey: vehicleFactors.refBandKey,
        websiteDiscountPct,
      });
      const v = await createVersion(
        label,
        matrix as any,
        websiteDiscountPct,
        notes.trim() || `Saved from ${source?.label ?? 'a comparison preview'}.`,
        Array.isArray(model.claimLimits)
          ? model.claimLimits.map((c: any) => ({ limit: Number(c.limit), factor: Number(c.factor) }))
          : null,
        Array.isArray(model.labourRates)
          ? model.labourRates.map((l: any) => ({
              rate: Number(l.rate),
              factor: Number(l.factor),
              label: l.uxPosition ?? l.label ?? null,
            }))
          : null,
        vehicleFactors
      );
      toast.success(`Saved “${label}” as a draft pricing model (not live)`);
      setName('');
      setNotes('');
      onSaved?.(v.id);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the pricing model');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-2 border-dashed">
      <CardContent className="flex flex-wrap items-end gap-3 p-4">
        <div>
          <Label className="text-xs">Save which model?</Label>
          <select
            className="mt-1 h-9 min-w-[240px] rounded-md border bg-background px-2 text-sm"
            value={sourceKey}
            onChange={e => setSourceKey(e.target.value)}
          >
            {sources.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Name this pricing model</Label>
          <Input
            className="mt-1 h-9 min-w-[220px]"
            placeholder="e.g. Sept 2026 trial"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="min-w-[240px] flex-1">
          <Label className="text-xs">Note (optional)</Label>
          <Input
            className="mt-1 h-9"
            placeholder="Why this model exists"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Create &amp; save model
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          Saved as a <strong>draft</strong> — it appears in the model dropdowns and in the Price grid tab,
          and only reaches customers when you push it live.
        </p>
      </CardContent>
    </Card>
  );
};

export default SaveModelAsVersionBar;
