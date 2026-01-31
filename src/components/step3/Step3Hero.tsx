import React from 'react';
import { Car, Gauge, Calendar, Fuel, Edit } from 'lucide-react';
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

const Step3Hero: React.FC<Step3HeroProps> = ({ vehicleData, onBack }) => {
  return (
    <div className="px-4 py-6">
      {/* Hero Text */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Get Covered in 60 Seconds
        </h1>
        <p className="text-muted-foreground text-sm">
          Choose your plan, customise options, and pay in 12 easy instalments.
        </p>
      </div>
      
      {/* Vehicle Information Card - Centered on mobile */}
      <div className="bg-secondary rounded-xl p-4 border border-border">
        {/* Header with title and change button */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <h2 className="font-semibold text-foreground text-center">
            {vehicleData.year} {vehicleData.make} {vehicleData.model}
          </h2>
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary/80 text-sm font-medium p-0 h-auto"
          >
            Change
          </Button>
        </div>
        
        {/* Vehicle details - centered */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono bg-card px-2 py-0.5 rounded border border-border text-foreground font-semibold">
              {vehicleData.regNumber}
            </span>
            <span>•</span>
            <span>{vehicleData.fuelType}</span>
            <span>•</span>
            <span>
              {parseInt(vehicleData.mileage || '0') >= 120000 ? 'Over 120,000 miles' : 'Under 120,000 miles'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step3Hero;
