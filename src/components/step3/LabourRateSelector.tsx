import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface LabourRateSelectorProps {
  selectedLabourRate: number;
  onLabourRateChange: (rate: number) => void;
  currentMonthlyPrice: number;
}

// Simplified labour rate options - no delta pricing displayed
const labourRateOptions = [
  { rate: 50, label: '£50/hr', description: 'Local garages' },
  { rate: 70, label: '£70/hr', description: 'Independent garages', isPopular: true },
  { rate: 100, label: '£100/hr', description: 'Approved garages' },
  { rate: 200, label: '£200/hr', description: 'Expert garages' }
];

const LabourRateSelector: React.FC<LabourRateSelectorProps> = ({
  selectedLabourRate,
  onLabourRateChange,
  currentMonthlyPrice
}) => {
  return (
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
          4
        </div>
        <h3 className="font-semibold text-lg text-foreground">Choose Your Labour Rate</h3>
      </div>

      {/* Single helper line */}
      <p className="text-xs text-muted-foreground mb-3">
        This sets the hourly rate we'll cover at the garage.
      </p>

      {/* Labour Rate Cards - Simplified */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        {labourRateOptions.map((option) => {
          const isSelected = selectedLabourRate === option.rate;
          
          return (
            <button
              key={option.rate}
              onClick={() => onLabourRateChange(option.rate)}
              className={cn(
                "relative py-3 px-2 rounded-lg border-2 text-left transition-all min-h-[70px]",
                isSelected
                  ? "border-success bg-success/10"
                  : "border-border bg-card hover:border-success/50"
              )}
            >
              {option.isPopular && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[8px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap uppercase">
                  MOST POPULAR
                </span>
              )}
              
              <span className="font-bold text-sm text-foreground block">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
              
              {isSelected && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Helper Text Below Cards */}
      <p className="text-xs text-muted-foreground mb-2">
        Covers most UK garages. Choose a higher rate if you use main dealers or specialists.
      </p>

      {/* Live Price Update */}
      <div className="text-sm font-medium text-success animate-fade-in">
        Updated price: £{currentMonthlyPrice}/month
      </div>
    </div>
  );
};

export default LabourRateSelector;
