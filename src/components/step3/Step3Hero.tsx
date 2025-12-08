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
      
      {/* Vehicle Information Card */}
      <div className="bg-secondary rounded-xl p-4 border border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">Vehicle Information</h2>
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary/80 text-sm font-medium p-0 h-auto"
          >
            Edit
          </Button>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">
              {vehicleData.year} {vehicleData.make} {vehicleData.model}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground text-sm">
              {parseInt(vehicleData.mileage || '0').toLocaleString()} miles
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{vehicleData.fuelType}</span>
            <span>•</span>
            <span className="font-mono bg-card px-2 py-0.5 rounded border border-border text-foreground font-semibold">
              {vehicleData.regNumber}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step3Hero;
