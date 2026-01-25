import React from 'react';
import { cn } from '@/lib/utils';

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
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
          2
        </div>
        <h3 className="font-semibold text-lg text-foreground">Choose Your Excess</h3>
      </div>

      {/* Excess Chips */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {excessOptions.map((excess) => {
          const isSelected = selectedExcess === excess;
          
          return (
            <button
              key={excess}
              onClick={() => onExcessChange(excess)}
              className={cn(
                "py-3 px-2 rounded-lg border-2 text-center font-semibold transition-all",
                isSelected
                  ? "border-success bg-success/10 text-foreground"
                  : "border-border bg-card text-foreground hover:border-success/50"
              )}
            >
              £{excess}
            </button>
          );
        })}
      </div>

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground mb-2">
        Excess is what you pay towards a claim. Lower excess = higher monthly cost.
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
