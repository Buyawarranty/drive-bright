import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import MileageQuickSelect from './MileageQuickSelect';

export interface EditableVehicleData {
  regNumber: string;
  mileage: string;
  make?: string;
  model?: string;
  fuelType?: string;
  transmission?: string;
  year?: string;
  manufactureDate?: string;
  vehicleType?: string;
  blocked?: boolean;
  blockReason?: string;
}

interface EditVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialReg?: string;
  initialMileage?: string;
  onSave: (vehicle: EditableVehicleData) => void;
}

const EditVehicleDialog: React.FC<EditVehicleDialogProps> = ({
  open,
  onOpenChange,
  initialReg = '',
  initialMileage = '',
  onSave,
}) => {
  const { toast } = useToast();
  const [regNumber, setRegNumber] = useState(initialReg.toUpperCase());
  const [mileageSelection, setMileageSelection] = useState<string>(() => {
    const n = parseInt((initialMileage || '').replace(/\D/g, ''), 10);
    if (!n) return '';
    return n >= 120000 ? 'over120k' : 'under120k';
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setRegNumber(initialReg.toUpperCase());
      const n = parseInt((initialMileage || '').replace(/\D/g, ''), 10);
      setMileageSelection(!n ? '' : n >= 120000 ? 'over120k' : 'under120k');
      setError('');
    }
  }, [open, initialReg, initialMileage]);

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
      // Look up MOT mileage first; fall back to representative bucket value
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

      // DVLA lookup
      const { data, error: dvlaError } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registration: normalizedReg },
      });

      const baseVehicle: EditableVehicleData = {
        regNumber: normalizedReg,
        mileage: resolvedMileage,
      };

      if (dvlaError || !data || !data.make) {
        toast({
          title: 'Vehicle updated',
          description: "We couldn't find full DVLA details — you can continue with your registration.",
        });
        onSave(baseVehicle);
        onOpenChange(false);
        return;
      }

      // Age check (15 years)
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
      toast({ title: 'Vehicle updated', description: 'Your quote has been refreshed.' });
      onOpenChange(false);
    } catch (e) {
      console.error('Edit vehicle error:', e);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change your vehicle</DialogTitle>
          <DialogDescription>
            Enter your registration and approximate mileage — we'll refresh your quote.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Reg plate input — matches homepage styling */}
          <div className="flex items-stretch rounded-lg overflow-hidden shadow-md border-2 border-black w-full">
            <div className="bg-blue-600 text-white font-bold px-3 py-3 flex items-center justify-center min-w-[64px]">
              <div className="flex flex-col items-center">
                <div className="text-base leading-tight">🇬🇧</div>
                <div className="text-sm font-bold leading-none">UK</div>
              </div>
            </div>
            <input
              type="text"
              value={regNumber}
              onChange={(e) => setRegNumber(formatReg(e.target.value))}
              placeholder="Enter reg"
              className="bg-yellow-400 border-none outline-none text-2xl text-black flex-1 font-black placeholder:text-black/70 px-3 py-3 uppercase tracking-wider min-w-0"
              maxLength={8}
            />
          </div>

          <MileageQuickSelect
            value={mileageSelection}
            onChange={setMileageSelection}
            error={error}
            isLoading={loading}
            isRegValid={regNumber.replace(/\s/g, '').length >= 5}
          />

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating…</> : 'Update vehicle'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditVehicleDialog;
