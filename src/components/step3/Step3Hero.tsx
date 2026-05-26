import React from 'react';
import { Check, Car, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Step3HeroProps {
  vehicleData: {
    regNumber: string;
    make?: string;
    model?: string;
    year?: string;
    mileage?: string;
    fuelType?: string;
  };
  onBack: () => void;
}

const formatMileage = (mileage?: string) => {
  if (!mileage) return null;
  const n = parseInt(String(mileage).replace(/[^0-9]/g, '')) || 0;
  const rounded = Math.ceil(n / 10000) * 10000;
  return `Under ${(rounded / 1000).toLocaleString()}k miles`;
};

const Step3Hero: React.FC<Step3HeroProps> = ({ vehicleData, onBack }) => {
  const mileageLabel = formatMileage(vehicleData.mileage);
  const titleCaseMake = vehicleData.make
    ? vehicleData.make.charAt(0).toUpperCase() + vehicleData.make.slice(1).toLowerCase()
    : '';

  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      {/* Headline */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
          One complete warranty,<br className="hidden sm:block" /> tailored to your car.
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Customise your cover below
        </p>
      </div>

      {/* Vehicle bar */}
      <div className="bg-muted/60 border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm sm:text-base text-foreground min-w-0">
          <Car className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="font-semibold">
            {vehicleData.year} {titleCaseMake} {vehicleData.model}
          </span>
          {vehicleData.fuelType && (
            <span className="text-muted-foreground">· {vehicleData.fuelType}</span>
          )}
          {mileageLabel && (
            <span className="text-muted-foreground">· {mileageLabel}</span>
          )}
          <span className="ml-1 font-mono font-bold text-foreground bg-[hsl(var(--reg-plate,48_100%_60%))] bg-yellow-300 px-2 py-0.5 rounded text-sm">
            {vehicleData.regNumber}
          </span>
        </div>
        <Button
          onClick={onBack}
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
        >
          <Pencil className="w-3.5 h-3.5" />
          Change
        </Button>
      </div>

      {/* Trust strip */}
      <div className="mt-3 grid grid-cols-3 divide-x divide-border border border-border rounded-xl bg-card">
        {[
          'Easy claims',
          '14-day refund',
          'Fast payouts',
        ].map((label) => (
          <div key={label} className="flex items-center justify-center gap-1.5 py-2.5 text-xs sm:text-sm text-foreground">
            <Check className="w-4 h-4 text-success" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Step3Hero;
