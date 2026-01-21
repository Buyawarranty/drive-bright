import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ExcessSelectorProps {
  selectedExcess: number | null;
  onExcessChange: (excess: number) => void;
  currentMonthlyPrice: number;
}

// Updated excess options per requirements: £0, £100, £250, £500
const excessOptions = [
  { value: 0, label: '£0', delta: '+£6/mo', tag: null },
  { value: 100, label: '£100', delta: '£0', tag: 'Most people choose this' },
  { value: 250, label: '£250', delta: '-£4/mo', tag: 'Saver option' },
  { value: 500, label: '£500', delta: '-£8/mo', tag: 'Budget option' }
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

      {/* Excess Cards */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {excessOptions.map((option) => {
          const isSelected = selectedExcess === option.value;
          const isDefault = option.value === 100;
          
          return (
            <button
              key={option.value}
              onClick={() => onExcessChange(option.value)}
              className={cn(
                "relative py-3 px-2 rounded-lg border-2 text-center transition-all flex flex-col items-center justify-center min-h-[80px]",
                isSelected
                  ? "border-success bg-success/10 text-foreground"
                  : "border-border bg-card text-foreground hover:border-success/50"
              )}
            >
              {/* Default indicator */}
              {isDefault && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[8px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                  DEFAULT
                </span>
              )}
              
              {/* Excess amount */}
              <span className="font-bold text-base">{option.label}</span>
              
              {/* Monthly delta */}
              <span className={cn(
                "text-[10px] font-semibold mt-1",
                option.delta.startsWith('-') ? "text-success" : 
                option.delta.startsWith('+') ? "text-orange-600" : 
                "text-muted-foreground"
              )}>
                {option.delta}
              </span>
              
              {/* Selection checkmark */}
              {isSelected && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Tag labels below cards */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {excessOptions.map((option) => (
          <div key={option.value} className="text-center">
            {option.tag && (
              <span className="text-[9px] text-muted-foreground leading-tight block">
                {option.tag}
              </span>
            )}
          </div>
        ))}
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
