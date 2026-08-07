import React, { useState } from 'react';
import { Loader2, Search, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { preciseVehicleAgeYears } from '@/lib/vehicleAge';
import { getExclusionReason } from '@/lib/vehicleExclusions';
import { matchModelFloor } from '@/lib/pricing/modelFloorMatch';

/** A vehicle resolved from the same DVLA + MOT lookup the homepage uses. */
export type ResolvedTestVehicle = {
  reg: string;
  make: string;
  model: string;
  fuelType: string;
  vehicleType: string;
  year: string;
  registrationDate?: string;
  manufactureDate?: string;
  ageYears: number | null;
  mileage: number | null;
  mileageSource: 'mot' | 'unknown';
  exclusionReason: string | null;
};

/** Map a resolved vehicle onto the band keys the pricing replica uses. */
export function mapVehicleToBandKeys(
  vehicle: ResolvedTestVehicle,
  model: {
    ageBands: any[];
    mileageBands: any[];
    powertrains: any[];
    vehicleTypes: any[];
    modelFloors: any[];
  }
) {
  const out: {
    ageKey?: string;
    mileageKey?: string;
    powertrainKey?: string;
    typeKey?: string;
    floorKey?: string;
  } = {};

  // Age band — labels are ranges like "6–7 years" / "12 years" / "Over 15 years".
  const age = vehicle.ageYears;
  if (age != null) {
    const parsed = model.ageBands.map(b => {
      const key = String(b.key);
      if (key.endsWith('+')) return { b, min: parseFloat(key), max: Infinity };
      const [lo, hi] = key.split('-');
      const min = parseFloat(lo);
      const max = hi ? parseFloat(hi) + 1 : min + 1;
      return { b, min, max };
    });
    const hit = parsed.find(p => age >= p.min && age < p.max) ?? parsed[parsed.length - 1];
    if (hit) out.ageKey = hit.b.key;
  }

  // Mileage band — min/max are numeric on the band.
  if (vehicle.mileage != null) {
    const mb =
      model.mileageBands.find(
        b => vehicle.mileage! >= Number(b.min) && (b.max == null || vehicle.mileage! <= Number(b.max))
      ) ?? model.mileageBands[model.mileageBands.length - 1];
    if (mb) out.mileageKey = mb.key;
  }

  // Powertrain from the DVLA fuel type.
  const fuel = (vehicle.fuelType || '').toLowerCase();
  let ptKey = 'petrol';
  if (fuel.includes('diesel')) ptKey = 'diesel';
  else if (fuel.includes('electric')) ptKey = 'ev';
  else if (fuel.includes('plug')) ptKey = 'phev';
  else if (fuel.includes('hybrid')) ptKey = 'hev';
  if (model.powertrains.some(p => p.key === ptKey)) out.powertrainKey = ptKey;

  // Vehicle type.
  const vt = `${vehicle.vehicleType || ''} ${vehicle.model || ''}`.toLowerCase();
  let typeKey = 'car';
  if (/motorc|motorb|bike|scooter|moped/.test(vt)) typeKey = 'motorbike';
  else if (/van|lcv|panel|commercial/.test(vt)) typeKey = 'van';
  if (model.vehicleTypes.some(t => t.key === typeKey)) out.typeKey = typeKey;

  // Model-specific floor / exclusion, using the same matcher as live pricing.
  try {
    const match = matchModelFloor(
      `${vehicle.make} ${vehicle.model}`.trim(),
      model.modelFloors as any
    );
    out.floorKey = match?.floor?.key ?? 'none';
  } catch {
    out.floorKey = 'none';
  }


  return out;
}

/** Reg entry + DVLA/MOT lookup, identical data sources to the homepage quote box. */
const RegLookupBar: React.FC<{
  onResolved: (vehicle: ResolvedTestVehicle) => void;
  compact?: boolean;
}> = ({ onResolved, compact }) => {
  const [reg, setReg] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resolved, setResolved] = useState<ResolvedTestVehicle | null>(null);

  const lookup = async () => {
    const normalizedReg = reg.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    setError('');
    if (normalizedReg.length < 5) {
      setError('Please enter a valid registration.');
      return;
    }
    setLoading(true);
    try {
      const spacedReg =
        normalizedReg.length > 3
          ? `${normalizedReg.slice(0, -3)} ${normalizedReg.slice(-3)}`
          : normalizedReg;

      const [dvla, mot] = await Promise.all([
        supabase.functions.invoke('dvla-vehicle-lookup', { body: { registrationNumber: normalizedReg } }),
        supabase
          .from('mot_history')
          .select('mot_tests')
          .in('registration', [normalizedReg, spacedReg])
          .limit(1)
          .maybeSingle(),
      ]);

      const data: any = dvla.data;
      if (dvla.error || !data?.make) {
        setError("We couldn't find that registration with the DVLA. Please double-check and try again.");
        return;
      }

      const rawTests = mot.data?.mot_tests as unknown;
      const tests = Array.isArray(rawTests)
        ? (rawTests as Array<{ odometerValue?: number; completedDate?: string }>)
        : [];
      const latest = [...tests]
        .sort((a, b) => {
          const da = a.completedDate ? new Date(a.completedDate).getTime() : 0;
          const db = b.completedDate ? new Date(b.completedDate).getTime() : 0;
          return db - da;
        })
        .find(t => t.odometerValue && Number(t.odometerValue) > 0);

      const vehicle: ResolvedTestVehicle = {
        reg: normalizedReg,
        make: data.make ?? '',
        model: data.model ?? '',
        fuelType: data.fuelType ?? '',
        vehicleType: data.vehicleType ?? '',
        year: String(data.yearOfManufacture ?? data.year ?? ''),
        registrationDate: data.registrationDate ?? undefined,
        manufactureDate: data.manufactureDate ?? undefined,
        ageYears: preciseVehicleAgeYears({
          registrationDate: data.registrationDate,
          manufactureDate: data.manufactureDate,
          yearOfManufacture: data.yearOfManufacture ?? data.year,
        } as any),
        mileage: latest?.odometerValue ? Number(latest.odometerValue) : null,
        mileageSource: latest?.odometerValue ? 'mot' : 'unknown',
        exclusionReason: getExclusionReason(data.make, data.model),
      };

      setResolved(vehicle);
      onResolved(vehicle);
    } catch (e) {
      console.error('Reg lookup failed', e);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={compact ? 'space-y-2' : 'rounded-lg border bg-muted/30 p-4 space-y-2'}>
      {!compact && (
        <div className="text-sm font-semibold">Look up a real vehicle (same DVLA + MOT data as the homepage)</div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-stretch overflow-hidden rounded-lg border-2 border-black shadow-sm">
          <div className="flex min-w-[46px] items-center justify-center bg-blue-600 px-2 text-xs font-bold text-white">
            UK
          </div>
          <input
            value={reg}
            onChange={e => setReg(e.target.value.replace(/[^A-Za-z0-9 ]/g, '').toUpperCase())}
            onKeyDown={e => {
              if (e.key === 'Enter') lookup();
            }}
            placeholder="ENTER REG"
            maxLength={8}
            disabled={loading}
            className="w-[150px] bg-yellow-400 px-3 py-2 text-lg font-black uppercase tracking-wider text-black outline-none placeholder:text-black/60"
          />
        </div>
        <Button onClick={lookup} disabled={loading} size="sm">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          {loading ? 'Looking up…' : 'Load vehicle'}
        </Button>
        {resolved && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">
              {resolved.make} {resolved.model}
            </span>
            <Badge variant="outline">{resolved.year || '—'}</Badge>
            <Badge variant="outline">
              {resolved.ageYears != null ? `${resolved.ageYears.toFixed(1)} yrs` : 'age unknown'}
            </Badge>
            <Badge variant="outline">
              {resolved.mileage != null
                ? `${resolved.mileage.toLocaleString()} mi (MOT)`
                : 'mileage not on MOT'}
            </Badge>
            {resolved.fuelType ? <Badge variant="outline">{resolved.fuelType}</Badge> : null}
            {resolved.exclusionReason ? (
              <Badge variant="destructive">Excluded: {resolved.exclusionReason}</Badge>
            ) : null}
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
    </div>
  );
};

export default RegLookupBar;
