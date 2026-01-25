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

// Original claim limit options - actual backend values
const claimLimitOptions = [
  { value: 1000, label: '£1,000', name: 'AutoCare Essential' },
  { value: 2000, label: '£2,000', name: 'AutoCare Advantage', isPopular: true },
  { value: 3000, label: '£3,000', name: 'AutoCare Elite' }
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

  // Direct selection - no automatic boost for max limit (3000)
  const handleSelect = (limit: number) => {
    onClaimLimitChange(limit);
    // Disable boost if max limit is selected
    if (limit === 3000 && boostAddon) {
      onBoostChange(false);
    }
  };

  // Calculate final claim limit with boost applied (+£500)
  const getFinalClaimLimit = () => {
    if (boostAddon && selectedClaimLimit && selectedClaimLimit < 3000) {
      return selectedClaimLimit + 500;
    }
    return selectedClaimLimit;
  };

  const finalClaimLimit = getFinalClaimLimit();
  const isBoostActive = boostAddon && selectedClaimLimit !== null && selectedClaimLimit < 3000;
  const canShowBoost = selectedClaimLimit !== null && selectedClaimLimit < 3000;

  const handleBoostToggle = (checked: boolean, event?: React.MouseEvent) => {
    if (checked && event) {
      triggerBoostSpark(event);
    }
    onBoostChange(checked);
  };

  return (
    <div className="px-4 py-6 bg-white rounded-2xl border border-[#E8E8E8] mx-4 mt-4">
      {/* Heading with info icon */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-[#000000] text-white flex items-center justify-center text-sm font-bold">
          4
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">🛡️</span>
          <h3 className="font-semibold text-lg text-[#000000]">Single repair amount per claim</h3>
        </div>
        
        {/* Details button */}
        <button
          onClick={() => setShowExplainer(!showExplainer)}
          className="ml-2 px-3 py-1 text-xs font-medium text-[#3A8F45] bg-[#F0FDF4] border border-[#3A8F45]/20 rounded-full hover:bg-[#E8F5E9] transition-colors"
        >
          ⓘ Details
        </button>
      </div>
      
      {/* Helper line */}
      <p className="text-sm text-[#666666] mb-4 ml-9">
        🔧 Set your claim limit - cover up to your car's full value 🚗
      </p>

      {/* Expandable Explainer */}
      {showExplainer && (
        <div className="mb-4 p-4 rounded-xl bg-[#F5F5F5] border border-[#E8E8E8] text-left animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-[#000000] mb-2">What is a claim limit?</h4>
              <p className="text-sm text-[#666666] leading-relaxed mb-2">
                This is the maximum amount we'll pay towards a single repair. Claims can be made up to the value of your car.
              </p>
              <p className="text-xs text-[#888888] leading-relaxed">
                For example: with a £2,000 limit, we'll cover repairs up to £2,000 per claim.
              </p>
            </div>
            <button
              onClick={() => setShowExplainer(false)}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#E8E8E8] transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-[#888888]" />
            </button>
          </div>
        </div>
      )}

      {/* Claim Limit Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {claimLimitOptions.map((option) => {
          const isSelected = selectedClaimLimit === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "relative p-4 rounded-xl border-2 text-center transition-all",
                isSelected
                  ? "border-[#3A8F45] bg-[#F0FDF4]"
                  : "border-[#E8E8E8] bg-white hover:border-[#3A8F45]/50"
              )}
            >
              {option.isPopular && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#E65100] text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap uppercase">
                  MOST POPULAR
                </span>
              )}
              
              <p className="text-sm font-medium text-[#000000] mb-1">{option.name}</p>
              <p className="text-2xl font-bold text-[#000000]">{option.label}</p>
              <p className="text-xs text-[#888888]">per claim</p>
              
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-[#3A8F45] rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Boost Add-On Section */}
      {canShowBoost && (
        <div className="mt-4">
          <p className="text-xs text-[#888888] uppercase font-semibold mb-2">OPTIONAL ADD-ON</p>
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
                ? "bg-[#F0FDF4] border-[#3A8F45]"
                : "bg-[#F5F5F5] border-[#E8E8E8] hover:border-[#3A8F45]/50"
            )}
          >
            <div className="flex items-center justify-between gap-4">
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-[#000000] mb-0.5">
                  ⚡ Add +£500 extra cover
                </h4>
                <p className="text-sm text-[#666666]">
                  Upgrade to £{((selectedClaimLimit || 0) + 500).toLocaleString()} per claim
                </p>
                <p className="text-xs text-[#888888] mt-1">
                  +£{boostPrice}/month × 12 payments
                </p>
              </div>
              
              {/* Toggle Switch */}
              <div className="flex-shrink-0">
                <div
                  className={cn(
                    "relative inline-flex items-center rounded-full transition-all duration-300",
                    "w-[52px] h-[28px]",
                    isBoostActive 
                      ? "bg-[#3A8F45]" 
                      : "bg-[#CCCCCC]"
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
                      <Check className="w-3 h-3 text-[#3A8F45]" strokeWidth={3} />
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimLimitSelector;