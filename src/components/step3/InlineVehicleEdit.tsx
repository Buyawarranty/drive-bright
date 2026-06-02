import React, { useState } from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { EditableVehicleData } from '@/components/EditVehicleDialog';

interface InlineVehicleEditProps {
  initialReg: string;
  initialMileage: string;
  onSave: (vehicle: EditableVehicleData) => void;
  onCancel: () => void;
}

const InlineVehicleEdit: React.FC<InlineVehicleEditProps> = ({
  initialReg,
  initialMileage,
  onSave,
  onCancel,
}) => {
  const [regNumber, setRegNumber] = useState(initialReg.toUpperCase());
  const [mileageSelection, setMileageSelection] = useState<string>(() => {
    const n = parseInt((initialMileage || '').replace(/\D/g, ''), 10);
    if (!n) return '';
    return n >= 120000 ? 'over120k' : 'under120k';
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const formatReg = (input: string) => input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  const handleSubmit = async () => {
    setError('');
    if (regNumber.replace(/\s/g, '').length < 5) {
      setError('Please enter a valid registration.');
      return;
    }
    if (!mileageSelection) {
      setError('Please select your approximate mileage.');
      return;
    }

    setLoading(true);
    try {
      const normalizedReg = regNumber.replace(/\s+/g, '').toUpperCase();
      let resolvedMileage = mileageSelection === 'over120k' ? '130000' : '100000';

      try {
        const { data: motRow } = await supabase
          .from('mot_history')
          .select('mot_tests')
          .or(`registration.eq.${normalizedReg},registration.ilike.%${normalizedReg}%`)
          .limit(1)
          .maybeSingle();

        const raw = motRow?.mot_tests as unknown;
        const tests = Array.isArray(raw) ? (raw as Array<{ odometerValue?: number; completedDate?: string }>) : [];
        if (tests.length > 0) {
          const latest = [...tests].sort((a, b) => {
            const da = a.completedDate ? new Date(a.completedDate).getTime() : 0;
            const db = b.completedDate ? new Date(b.completedDate).getTime() : 0;
            return db - da;
          })[0];
          if (latest?.odometerValue && Number(latest.odometerValue) > 0) {
            resolvedMileage = String(latest.odometerValue);
          }
        }
      } catch (e) {
        console.warn('MOT mileage lookup failed; using bucket fallback', e);
      }

      const { data, error: dvlaError } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registration: normalizedReg },
      });

      const baseVehicle: EditableVehicleData = {
        regNumber: normalizedReg,
        mileage: resolvedMileage,
      };

      if (dvlaError || !data || !data.make) {
        onSave(baseVehicle);
        toast.success('Quote updated');
        return;
      }

      const now = new Date();
      let tooOld = false;
      if (data.manufactureDate) {
        const md = new Date(data.manufactureDate);
        if (!isNaN(md.getTime())) {
          const years = (now.getTime() - md.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          tooOld = years > 15;
        }
      } else {
        const vy = parseInt(data.yearOfManufacture || data.year || '0', 10);
        tooOld = vy > 0 && now.getFullYear() - vy > 15;
      }

      if (tooOld) {
        setError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.');
        setLoading(false);
        return;
      }

      const numericMileage = parseInt(resolvedMileage, 10);
      if (numericMileage > 150000) {
        setError('Maximum mileage is 150,000. Please call us on 0330 229 5040.');
        setLoading(false);
        return;
      }

      onSave({
        ...baseVehicle,
        make: data.make,
        model: data.model,
        fuelType: data.fuelType,
        transmission: data.transmission,
        year: data.yearOfManufacture || data.year,
        vehicleType: data.vehicleType,
        blocked: data.blocked || false,
        blockReason: data.blockReason || '',
      });
      toast.success('Quote updated');
    } catch (e) {
      console.error('Edit vehicle error:', e);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isUnder = mileageSelection === 'under120k';
  const isOver = mileageSelection === 'over120k';

  return (
    <div className="mt-3 bg-white border border-[#e9e9e7] rounded-2xl p-5 shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Registration */}
        <div>
          <label className="block text-sm font-semibold text-[#161616] mb-2">
            Registration
          </label>
          <div className="flex items-stretch rounded-lg overflow-hidden shadow-sm border-2 border-black">
            <div className="bg-blue-600 text-white font-bold px-3 py-2 flex items-center justify-center min-w-[56px]">
              <div className="flex flex-col items-center">
                <div className="text-sm leading-tight">🇬🇧</div>
                <div className="text-xs font-bold leading-none">UK</div>
              </div>
            </div>
            <input
              type="text"
              value={regNumber}
              onChange={(e) => setRegNumber(formatReg(e.target.value))}
              placeholder="Enter reg"
              className="bg-yellow-400 border-none outline-none text-xl text-black flex-1 font-black placeholder:text-black/70 px-3 py-2 uppercase tracking-wider min-w-0"
              maxLength={8}
              disabled={loading}
            />
          </div>
        </div>

        {/* Mileage */}
        <div>
          <label className="block text-sm font-semibold text-[#161616] mb-2">
            Current mileage
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            {([
              { key: 'under120k', label: 'Under 120,000 miles', active: isUnder },
              { key: 'over120k', label: 'Over 120,000 miles', active: isOver },
            ] as const).map((opt) => (
              <label
                key={opt.key}
                className={`relative flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  opt.active
                    ? 'border-brand-orange bg-brand-orange/10'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
              >
                <input
                  type="radio"
                  name="inline-mileage-band"
                  className="sr-only"
                  checked={opt.active}
                  onChange={() => setMileageSelection(opt.key)}
                  disabled={loading}
                />
                <span
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    opt.active ? 'border-brand-orange bg-brand-orange' : 'border-gray-400 bg-white'
                  }`}
                >
                  {opt.active && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </span>
                <span className={`text-sm font-semibold ${opt.active ? 'text-gray-900' : 'text-gray-700'}`}>
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="mt-4 flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-brand-orange hover:bg-orange-700 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Updating quote…
            </>
          ) : (
            'Update vehicle'
          )}
        </Button>
      </div>
    </div>
  );
};

export default InlineVehicleEdit;
