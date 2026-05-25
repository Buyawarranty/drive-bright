import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Info } from 'lucide-react';
import ExcessDetails from './ExcessDetails';

interface ExcessSelectorProps {
  selectedExcess: number | null;
  onExcessChange: (excess: number) => void;
  currentMonthlyPrice: number;
}

const excessOptions = [
  { value: 0, label: '£0', description: 'Nothing to pay', hint: '+£14/mo' },
  { value: 50, label: '£50', description: 'Lower monthly', hint: '+£10/mo' },
  { value: 100, label: '£100', description: 'Balanced', hint: '+£4/mo' },
  { value: 150, label: '£150', description: 'Best balance', hint: 'Best balance', isRecommended: true },
  { value: 250, label: '£250', description: 'Save more', hint: '−£9/mo' },
  { value: 500, label: '£500', description: 'Biggest saving', hint: '−£24/mo' },
];

const ExcessSelector: React.FC<ExcessSelectorProps> = ({
  selectedExcess,
  onExcessChange,
  currentMonthlyPrice
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 border-t border-border">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold flex-shrink-0">
          4
        </div>
        <h3 className="font-semibold text-lg text-foreground">Choose Your Excess</h3>
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="ml-auto flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg bg-white hover:bg-green-50 transition-colors border border-green-200 shadow-sm flex-shrink-0"
        >
          <Info className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-medium text-green-600">Details</span>
        </button>
      </div>

      <ExcessDetails
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        selectedExcess={selectedExcess}
        onConfirm={onExcessChange}
      />

      {/* Excess Chips - matched sizing with other selectors */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3 mb-4">
        {excessOptions.map((option) => {
          const isSelected = selectedExcess === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => onExcessChange(option.value)}
              className={cn(
                "py-4 px-3 rounded-lg border-2 text-center transition-all relative flex flex-col items-center justify-start gap-1 min-h-[110px]",
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
                  Best
                </span>
              )}
              <span className="flex items-center justify-center gap-1">
                {isSelected && (
                  <Check className="w-4 h-4 text-success flex-shrink-0" strokeWidth={2.5} />
                )}
                <span className="font-bold text-base">{option.label}</span>
              </span>
              <span className="text-xs font-semibold text-foreground leading-tight">{option.description}</span>
              <span className="text-[11px] text-muted-foreground leading-tight mt-auto">{option.hint}</span>
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
