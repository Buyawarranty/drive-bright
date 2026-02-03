import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ExcessSelectorProps {
  selectedExcess: number | null;
  onExcessChange: (excess: number) => void;
  currentMonthlyPrice: number;
}

const excessOptions = [0, 50, 100, 150];

const ExcessSelector: React.FC<ExcessSelectorProps> = ({
  selectedExcess,
  onExcessChange,
  currentMonthlyPrice
}) => {
  return (
    <div className="px-4 sm:px-6 py-5 sm:py-6 border-t border-border">
      {/* Header with better mobile spacing */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold flex-shrink-0">
          2
        </div>
        <h3 className="font-semibold text-lg text-foreground">Choose Your Excess</h3>
      </div>

      {/* Excess Chips - Better touch targets for mobile */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4">
        {excessOptions.map((excess) => {
          const isSelected = selectedExcess === excess;
          
          return (
            <button
              key={excess}
              onClick={() => onExcessChange(excess)}
              className={cn(
                // Base styles with improved touch target
                "min-h-[52px] sm:min-h-[48px] py-3 px-2 rounded-xl border-2 text-center font-semibold transition-all duration-200",
                // Active state feedback
                "active:scale-[0.98]",
                // Selected vs unselected
                isSelected
                  ? "border-success bg-success/10 text-foreground shadow-sm"
                  : "border-border bg-card text-foreground hover:border-success/50 hover:bg-success/5"
              )}
              aria-pressed={isSelected}
              aria-label={`Set excess to £${excess}`}
            >
              <span className="flex items-center justify-center gap-1">
                {isSelected && (
                  <Check className="w-4 h-4 text-success flex-shrink-0" strokeWidth={2.5} />
                )}
                <span className="text-base sm:text-sm">£{excess}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Helper Text - Better readability on mobile */}
      <p className="text-sm sm:text-xs text-muted-foreground mb-3 leading-relaxed">
        Excess is what you pay towards a claim. Lower excess = higher monthly cost.
      </p>

      {/* Live Price Update - More prominent on mobile */}
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
