import React from 'react';
import { Car, Gauge, Calendar, Fuel, Edit, Shield, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TrustpilotHeader from '@/components/TrustpilotHeader';

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
      <div className="text-center mb-4">
        <p className="text-sm sm:text-base text-muted-foreground">
          All plans include <button type="button" onClick={() => document.getElementById('whats-covered')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="font-bold underline underline-offset-2 decoration-success/60 hover:decoration-success cursor-pointer transition-colors text-foreground"><strong>full comprehensive cover</strong></button> - choose your length of cover
          and level of protection
        </p>
      </div>

      {/* Trust Badges Row */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm">
          <CheckCircle className="w-5 h-5 text-success fill-success/20" />
          <span className="font-medium text-foreground">Easy Claims, Fast Payout</span>
        </div>
        <TrustpilotHeader className="flex-shrink-0" />
        <div className="flex items-center gap-1.5 text-sm">
          <Shield className="w-5 h-5 text-amber-500 fill-amber-500/20" />
          <span className="font-medium text-foreground">14-day money-back guarantee</span>
        </div>
      </div>

      {/* Pricing Banner */}
      <div className="bg-muted border border-border rounded-xl px-4 py-3 text-center mb-6">
        <p className="text-sm sm:text-base text-foreground">
          From <span className="text-lg sm:text-xl font-bold text-primary">£19/month</span> - <strong>tailored to your car, your garage, your budget</strong>
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          12 interest-free payments  ·  Longer cover = better value, locked in today's price
        </p>
      </div>
      
      {/* Vehicle Information Card */}
      <div className="bg-secondary rounded-xl p-4 border border-border">
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
        
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono bg-card px-2 py-0.5 rounded border border-border text-foreground font-semibold">
            {vehicleData.regNumber}
          </span>
          <span>•</span>
          <span>{vehicleData.fuelType}</span>
        </div>
      </div>
    </div>
  );
};

export default Step3Hero;
