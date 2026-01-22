import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Info, X } from 'lucide-react';

interface ExcessSelectorProps {
  selectedExcess: number | null;
  onExcessChange: (excess: number) => void;
  currentMonthlyPrice: number;
}

// Simplified excess options - minimal labels
const excessOptions = [
  { value: 0, label: '£0', description: 'Zero excess' },
  { value: 100, label: '£100', description: 'Best value', isMostPopular: true },
  { value: 250, label: '£250', description: 'Lower monthly cost' },
  { value: 500, label: '£500', description: 'Lowest monthly cost' }
];

const ExcessSelector: React.FC<ExcessSelectorProps> = ({
  selectedExcess,
  onExcessChange,
  currentMonthlyPrice
}) => {
  const [showExplainer, setShowExplainer] = useState(false);

  return (
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
          2
        </div>
        <h3 className="font-semibold text-lg text-foreground">Choose Your Excess</h3>
        
        {/* Info icon with tooltip trigger */}
        <button
          onClick={() => setShowExplainer(!showExplainer)}
          className="relative flex items-center justify-center w-11 h-11 -m-2 rounded-full hover:bg-muted/50 transition-colors"
          aria-label="What is an excess?"
          aria-expanded={showExplainer}
        >
          <Info className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Expandable Explainer */}
      {showExplainer && (
        <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-foreground mb-2">What is an excess?</h4>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                An excess is the amount you pay towards a repair when you make a claim. We cover the rest, up to your claim limit.
              </p>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                For example: with a £100 excess on a £600 repair, you pay £100 and we pay £500.
              </p>
            </div>
            <button
              onClick={() => setShowExplainer(false)}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Excess Cards - Simplified */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {excessOptions.map((option) => {
          const isSelected = selectedExcess === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => onExcessChange(option.value)}
              className={cn(
                "relative py-3 px-2 rounded-lg border-2 text-left transition-all min-h-[70px]",
                isSelected
                  ? "border-success bg-success/10"
                  : "border-border bg-card hover:border-success/50"
              )}
            >
              {option.isMostPopular && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-success text-white text-[8px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap uppercase">
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

      {/* Micro-helper line */}
      <p className="text-xs text-muted-foreground mb-2">
        A higher excess means a lower monthly price.
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
