import React from 'react';
import { cn } from '@/lib/utils';
import { EXCESS_MONTHLY_ADJUSTMENT } from '@/lib/pricingMatrix';

interface ExcessSelectorProps {
  selectedExcess: number | null;
  onExcessChange: (excess: number) => void;
  currentMonthlyPrice: number;
}

// Updated excess options: £0, £100, £250, £500
const excessOptions = [
  { value: 0, label: '£0', adjustment: '+£6/mo', description: 'Worry-free' },
  { value: 100, label: '£100', adjustment: '£0/mo', description: 'Most popular', isDefault: true },
  { value: 250, label: '£250', adjustment: '-£4/mo', description: 'Save monthly' },
  { value: 500, label: '£500', adjustment: '-£8/mo', description: 'Best savings' }
];

const ExcessSelector: React.FC<ExcessSelectorProps> = ({
  selectedExcess,
  onExcessChange,
  currentMonthlyPrice
}) => {
  return (
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
          2
        </div>
        <h3 className="font-semibold text-lg text-foreground">Choose Your Excess</h3>
      </div>

      {/* Excess Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {excessOptions.map((option) => {
          const isSelected = selectedExcess === option.value;
          const adjustment = EXCESS_MONTHLY_ADJUSTMENT[option.value] || 0;
          
          return (
            <button
              key={option.value}
              onClick={() => onExcessChange(option.value)}
              className={cn(
                "py-3 px-2 rounded-lg border-2 text-center transition-all min-h-[88px] flex flex-col items-center justify-center relative",
                isSelected
                  ? "border-success bg-success/10 text-foreground"
                  : "border-border bg-card text-foreground hover:border-success/50"
              )}
            >
              {option.isDefault && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap uppercase">
                  MOST POPULAR
                </span>
              )}
              <span className="font-bold text-lg">{option.label}</span>
              <span className={cn(
                "text-xs font-semibold mt-1",
                adjustment < 0 ? "text-success" : adjustment > 0 ? "text-primary" : "text-muted-foreground"
              )}>
                {option.adjustment}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{option.description}</span>
            </button>
          );
        })}
      </div>

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground mb-2">
        You only pay the excess when you make a successful claim.
      </p>

      {/* Live Price Update */}
      {selectedExcess !== null && (
        <div className="text-sm font-medium text-success animate-fade-in">
          Updated price: £{currentMonthlyPrice}/month
        </div>
      )}
    </div>
  );
};

export default ExcessSelector;