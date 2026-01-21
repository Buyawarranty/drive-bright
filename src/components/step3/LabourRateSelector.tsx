import React from 'react';
import { cn } from '@/lib/utils';
import { LABOUR_RATE_MONTHLY_ADJUSTMENT } from '@/lib/pricingMatrix';

interface LabourRateSelectorProps {
  selectedLabourRate: number;
  onLabourRateChange: (rate: number) => void;
  currentMonthlyPrice: number;
}

// Updated labour rate options with new adjustments
const labourRateOptions = [
  { rate: 50, label: '£50/hr', description: 'Local Garages', adjustment: '-£5/mo', isBestValue: true },
  { rate: 70, label: '£70/hr', description: 'Independent', adjustment: '£0/mo', isPopular: true, isDefault: true },
  { rate: 100, label: '£100/hr', description: 'Approved', adjustment: '+£4/mo' },
  { rate: 200, label: '£200/hr', description: 'Specialist', adjustment: '+£24/mo' }
];

const LabourRateSelector: React.FC<LabourRateSelectorProps> = ({
  selectedLabourRate,
  onLabourRateChange,
  currentMonthlyPrice
}) => {
  return (
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
          4
        </div>
        <h3 className="font-semibold text-lg text-foreground">Choose Your Labour Rate</h3>
      </div>

      {/* Labour Rate Chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        {labourRateOptions.map((option) => {
          const isSelected = selectedLabourRate === option.rate;
          const adjustment = LABOUR_RATE_MONTHLY_ADJUSTMENT[option.rate] || 0;
          
          return (
            <button
              key={option.rate}
              onClick={() => onLabourRateChange(option.rate)}
              className={cn(
                "py-3 px-2 rounded-lg border-2 text-center transition-all relative flex flex-col items-center justify-center min-h-[100px]",
                isSelected
                  ? "border-success bg-success/10 text-foreground"
                  : "border-border bg-card text-foreground hover:border-success/50"
              )}
            >
              {option.isBestValue && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-success text-success-foreground text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap uppercase">
                  BEST VALUE
                </span>
              )}
              {option.isPopular && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap uppercase">
                  MOST POPULAR
                </span>
              )}
              <span className="font-bold text-sm">{option.label}</span>
              <span className="text-xs text-muted-foreground mt-1">{option.description}</span>
              <span className={cn(
                "text-xs font-semibold mt-1",
                adjustment < 0 ? "text-success" : adjustment > 0 ? "text-primary" : "text-muted-foreground"
              )}>
                {option.adjustment}
              </span>
            </button>
          );
        })}
      </div>

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground mb-2">
        Independent garages typically charge around £50-£70/hr; franchised workshops around £90+/hr. Your choice sets the labour rate we'll cover.
      </p>

      {/* Live Price Update */}
      <div className="text-sm font-medium text-success animate-fade-in">
        Updated price: £{currentMonthlyPrice}/month
      </div>
    </div>
  );
};

export default LabourRateSelector;