import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Check, Info, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ClaimLimitSelectorProps {
  selectedClaimLimit: number | null;
  onClaimLimitChange: (claimLimit: number) => void;
  currentMonthlyPrice: number;
  boostAddon: boolean;
  onBoostChange: (boost: boolean) => void;
  boostPrice: number;
}

// Original claim limit options: £750 / £1,250 / £2,000
const claimLimitOptions = [
  { value: 750, label: '£750', name: 'AutoCare Essential' },
  { value: 1250, label: '£1,250', name: 'AutoCare Advantage', isPopular: true },
  { value: 2000, label: '£2,000', name: 'AutoCare Elite' }
];

const ClaimLimitSelector: React.FC<ClaimLimitSelectorProps> = ({
  selectedClaimLimit,
  onClaimLimitChange,
  currentMonthlyPrice,
  boostAddon,
  onBoostChange,
  boostPrice
}) => {
  const [showExplainer, setShowExplainer] = useState(false);
  
  // Tiny spark effect when boost is clicked
  const triggerBoostSpark = useCallback((event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;
    
    confetti({
      particleCount: 5,
      spread: 70,
      origin: { x, y }
    });
  }, []);

  // Direct selection - no automatic boost for £2,000
  const handleSelect = (limit: number) => {
    onClaimLimitChange(limit);
    // Disable boost if £2,000 is selected (maximum limit)
    if (limit === 2000 && boostAddon) {
      onBoostChange(false);
    }
  };

  // Calculate final claim limit with boost applied (+£1,000 boost)
  const getFinalClaimLimit = () => {
    if (boostAddon && selectedClaimLimit && selectedClaimLimit < 2000) {
      return selectedClaimLimit + 1000;
    }
    return selectedClaimLimit;
  };

  const finalClaimLimit = getFinalClaimLimit();
  const isBoostActive = boostAddon && selectedClaimLimit !== null && selectedClaimLimit < 2000;
  const canShowBoost = selectedClaimLimit !== null && selectedClaimLimit < 2000;

  const handleBoostToggle = (checked: boolean, event?: React.MouseEvent) => {
    if (checked && event) {
      triggerBoostSpark(event);
    }
    onBoostChange(checked);
  };

  return (
    <div className="px-4 py-4 border-t border-border">
      {/* Heading with info icon */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
          3
        </div>
        <h3 className="font-semibold text-lg text-foreground">Single repair amount per claim</h3>
        
        {/* Info icon */}
        <button
          onClick={() => setShowExplainer(!showExplainer)}
          className="relative flex items-center justify-center w-11 h-11 -m-2 rounded-full hover:bg-muted/50 transition-colors"
          aria-label="What is a claim limit?"
          aria-expanded={showExplainer}
        >
          <Info className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
      
      {/* Single helper line */}
      <p className="text-xs text-muted-foreground mb-3">
        Sets the maximum amount we'll pay for each claim.
      </p>

      {/* Expandable Explainer */}
      {showExplainer && (
        <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-foreground mb-2">What is a claim limit?</h4>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                This is the maximum amount we'll pay towards a single repair. Claims can be made up to the value of your car.
              </p>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                For example: with a £2,000 limit, we'll cover repairs up to £2,000 per claim.
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

      {/* Claim Limit Cards - Simplified */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {claimLimitOptions.map((option) => {
          const isSelected = selectedClaimLimit === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
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
              <span className="text-xs text-muted-foreground">{option.name}</span>
              
              {isSelected && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Boost Add-On Section - Simplified */}
      {canShowBoost && (
        <div className="mt-4 pt-4 border-t border-border">
          <div 
            onClick={(e) => {
              if (!isBoostActive) {
                handleBoostToggle(true, e);
              } else {
                handleBoostToggle(false);
              }
            }}
            className={cn(
              "relative p-4 rounded-xl cursor-pointer border-2",
              "transition-all duration-300 ease-out",
              isBoostActive
                ? "bg-success/5 border-success"
                : "bg-card border-border hover:border-success/50"
            )}
          >
            <div className="flex items-center justify-between gap-4">
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-foreground mb-0.5">
                  🚀 Boost your cover by £1,000
                </h4>
                <p className="text-sm text-muted-foreground">
                  Upgrade to £{((selectedClaimLimit || 0) + 1000).toLocaleString()} per claim
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Just £{boostPrice}/month × 12 payments
                </p>
              </div>
              
              {/* Toggle Switch */}
              <div className="flex-shrink-0">
                <div
                  className={cn(
                    "relative inline-flex items-center rounded-full transition-all duration-300",
                    "w-[52px] h-[28px]",
                    isBoostActive 
                      ? "bg-success" 
                      : "bg-muted"
                  )}
                >
                  {/* Toggle Knob */}
                  <span
                    className={cn(
                      "absolute inline-flex items-center justify-center rounded-full bg-white shadow-sm",
                      "w-[22px] h-[22px]",
                      "transition-all duration-300 ease-out",
                      isBoostActive 
                        ? "left-[27px]" 
                        : "left-[3px]"
                    )}
                  >
                    {isBoostActive && (
                      <Check className="w-3 h-3 text-success" strokeWidth={3} />
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Final Claim Limit Summary */}
      {selectedClaimLimit !== null && (
        <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Claim limit: <span className="font-bold">£{finalClaimLimit?.toLocaleString()}</span> per claim
            </span>
            <span className="text-sm font-medium text-success">
              £{currentMonthlyPrice}/month
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimLimitSelector;