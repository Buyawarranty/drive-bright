import React from 'react';
import { cn } from '@/lib/utils';

interface ClaimLimitSelectorProps {
  selectedClaimLimit: number | null;
  onClaimLimitChange: (claimLimit: number) => void;
  currentMonthlyPrice: number;
  boostAddon: boolean;
  onBoostChange: (boost: boolean) => void;
  boostPrice: number;
}

// Claim limit options including £3000 (which uses £2000 base + boost logic)
const claimLimitOptions = [750, 1250, 2000, 3000];

const ClaimLimitSelector: React.FC<ClaimLimitSelectorProps> = ({
  selectedClaimLimit,
  onClaimLimitChange,
  currentMonthlyPrice,
  boostAddon,
  onBoostChange,
  boostPrice
}) => {
  // Handle selection - £3000 option automatically enables boost
  const handleSelect = (limit: number) => {
    if (limit === 3000) {
      // £3000 = £2000 base + boost addon
      onClaimLimitChange(2000);
      onBoostChange(true);
    } else {
      onClaimLimitChange(limit);
      onBoostChange(false);
    }
  };

  // Determine which option to highlight
  const getDisplayedLimit = () => {
    if (boostAddon && selectedClaimLimit === 2000) {
      return 3000;
    }
    return selectedClaimLimit;
  };

  const displayedLimit = getDisplayedLimit();

  return (
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
          3
        </div>
        <h3 className="font-semibold text-lg text-foreground">Choose Your Claim Limit</h3>
      </div>

      {/* Claim Limit Chips */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {claimLimitOptions.map((limit) => {
          const isSelected = displayedLimit === limit;
          const isPopular = limit === 1250;
          
          return (
            <button
              key={limit}
              onClick={() => handleSelect(limit)}
              className={cn(
                "py-3 px-2 rounded-lg border-2 text-center transition-all relative",
                isSelected
                  ? "border-success bg-success/10"
                  : "border-border bg-card hover:border-success/50"
              )}
            >
              {isPopular && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                  Popular
                </span>
              )}
              <div className="font-semibold text-foreground">£{limit.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground">per claim</div>
            </button>
          );
        })}
      </div>

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground mb-2">
        Claim limit is the maximum we pay per repair. Higher limit = more protection.
      </p>

      {/* Live Price Update */}
      {selectedClaimLimit !== null && (
        <div className="text-sm font-medium text-success animate-fade-in">
          Updated price: £{currentMonthlyPrice}/month
        </div>
      )}
    </div>
  );
};

export default ClaimLimitSelector;
