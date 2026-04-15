import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ExcessSelectorProps {
  selectedExcess: number | null;
  onExcessChange: (excess: number) => void;
  currentMonthlyPrice: number;
}

const excessOptions = [
  { value: 0, label: '£0' },
  { value: 50, label: '£50' },
  { value: 100, label: '£100', isRecommended: true },
  { value: 150, label: '£150' },
];

const ExcessSelector: React.FC<ExcessSelectorProps> = ({
  selectedExcess,
  onExcessChange,
  currentMonthlyPrice
}) => {
  return (
    <div className="px-4 sm:px-6 py-5 sm:py-6 border-t border-border">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold flex-shrink-0">
          2
        </div>
        <h3 className="font-semibold text-lg text-foreground">Choose Your Excess</h3>
      </div>

      {/* Excess Chips - matched sizing with other selectors */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4">
        {excessOptions.map((option) => {
          const isSelected = selectedExcess === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => onExcessChange(option.value)}
              className={cn(
                "py-3 px-2 rounded-lg border-2 text-center transition-all relative flex flex-col items-center justify-center min-h-[80px]",
                "active:scale-[0.98]",
                isSelected
                  ? "border-success bg-success/10 text-foreground shadow-sm"
                  : "border-border bg-card text-foreground hover:border-success/50 hover:bg-success/5"
              )}
              aria-pressed={isSelected}
              aria-label={`Set excess to ${option.label}`}
            >
              {option.isRecommended && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-success text-success-foreground text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap uppercase">
                  RECOMMENDED
                </span>
              )}
              <span className="flex items-center justify-center gap-1">
                {isSelected && (
                  <Check className="w-4 h-4 text-success flex-shrink-0" strokeWidth={2.5} />
                )}
                <span className="font-bold text-sm">{option.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Helper Text */}
      <p className="text-sm sm:text-xs text-muted-foreground mb-3 leading-relaxed">
        Excess is what you pay towards a claim. Lower excess = higher monthly cost.
      </p>

      {/* Live Price Update */}
      {selectedExcess !== null && (
        <div className="text-sm font-semibold text-success animate-fade-in flex items-center gap-1.5 bg-success/10 rounded-lg px-3 py-2 inline-flex">
          <Check className="w-4 h-4" />
          Updated price: £{currentMonthlyPrice}/month
        </div>
      )}
    </div>
  );
};

export default ExcessSelector;
