import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check, Info, Plus } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import confetti from 'canvas-confetti';

interface ClaimLimitSelectorProps {
  selectedClaimLimit: number | null;
  onClaimLimitChange: (claimLimit: number) => void;
  currentMonthlyPrice: number;
  boostAddon: boolean;
  onBoostChange: (boost: boolean) => void;
  boostPrice: number;
}

// Updated claim limit options: £1,000 / £2,000 / £3,000 only
const claimLimitOptions = [1000, 2000, 3000];

const claimLimitDetails: Record<number, string> = {
  1000: "Standard cover for common repairs. A sensible choice for reliable vehicles.",
  2000: "Our most popular option. Covers major component failures including engine and gearbox.",
  3000: "Maximum protection for high-value repairs. Best for luxury and performance vehicles."
};

const ClaimLimitSelector: React.FC<ClaimLimitSelectorProps> = ({
  selectedClaimLimit,
  onClaimLimitChange,
  currentMonthlyPrice,
  boostAddon,
  onBoostChange,
  boostPrice
}) => {
  const [openDetails, setOpenDetails] = useState<number | null>(null);
  
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

  // Direct selection - no automatic boost for £3,000
  const handleSelect = (limit: number) => {
    onClaimLimitChange(limit);
    // Disable boost if £3,000 is selected (maximum limit)
    if (limit === 3000 && boostAddon) {
      onBoostChange(false);
    }
  };

  // Calculate final claim limit with boost applied
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
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
          3
        </div>
        <h3 className="font-semibold text-lg text-foreground">Set your claim limit</h3>
      </div>
      
      {/* Helper text */}
      <p className="text-xs text-muted-foreground mb-3">
        Maximum claim limit per repair. Most repairs cost hundreds; higher limits help with big failures.
      </p>

      {/* Claim Limit Cards */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {claimLimitOptions.map((limit) => {
          const isSelected = selectedClaimLimit === limit;
          const isPopular = limit === 2000;
          const isOpen = openDetails === limit;
          
          return (
            <div key={limit} className="relative pt-3">
              {/* Tag - positioned to overlap border */}
              {isPopular && (
                <span className="absolute -top-0 left-2 z-10 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                  MOST POPULAR
                </span>
              )}
              
              <Collapsible open={isOpen} onOpenChange={(open) => setOpenDetails(open ? limit : null)}>
                <div
                  className={cn(
                    "rounded-lg border-2 transition-all bg-white shadow-sm",
                    isSelected
                      ? "border-success"
                      : "border-border hover:border-success/50"
                  )}
                >
                  {/* Main Card Content */}
                  <button
                    onClick={() => handleSelect(limit)}
                    className="w-full p-3 text-left"
                  >
                    <div className="font-bold text-lg text-foreground">£{limit.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">per repair</div>
                  </button>
                  
                  {/* Divider */}
                  <div className="border-t border-border" />
                  
                  {/* View Details Trigger */}
                  <CollapsibleTrigger className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-foreground hover:text-primary transition-colors">
                    <span>Details</span>
                    <ChevronDown 
                      className={cn(
                        "w-3 h-3 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )} 
                    />
                  </CollapsibleTrigger>
                  
                  {/* Collapsible Content */}
                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-1 bg-muted/50 border-t border-border">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {claimLimitDetails[limit]}
                      </p>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </div>
          );
        })}
      </div>

      {/* Boost Add-On Section - Only shown for £1,000 and £2,000 */}
      {canShowBoost && (
        <div className="mt-4 mb-2">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Boost Your Cover</h4>
          
          {/* Add Extra Cover Card - Fully Tappable */}
          <div 
            onClick={(e) => {
              if (!isBoostActive) {
                handleBoostToggle(true, e);
              } else {
                handleBoostToggle(false);
              }
            }}
            className={cn(
              "relative p-4 rounded-xl cursor-pointer border-2 overflow-hidden",
              "transition-all duration-300 ease-out transform",
              isBoostActive
                ? "bg-gradient-to-br from-green-50 to-green-100 border-green-500 shadow-[0_0_16px_rgba(34,197,94,0.35)] scale-[1.01]"
                : "bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 hover:border-orange-400 hover:shadow-lg hover:scale-[1.005]"
            )}
          >
            {/* Animated background pulse when active */}
            {isBoostActive && (
              <div className="absolute inset-0 bg-green-400/10 animate-pulse pointer-events-none" />
            )}
            
            <div className="relative flex items-center gap-4">
              {/* Content */}
              <div className="flex-1 min-w-0">
                {isBoostActive ? (
                  <>
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                      </div>
                      <h4 className="text-lg font-bold text-green-700">
                        Boost Added!
                      </h4>
                    </div>
                    <div className="text-base font-semibold text-green-800">
                      Your claim limit is now £{finalClaimLimit?.toLocaleString()} per repair 🚀
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      +£{boostPrice}/month × 12 payments
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="text-lg font-bold text-foreground mb-0.5">
                      🚀 Add +£500 extra cover
                    </h4>
                    <div className="text-base font-semibold text-foreground">
                      Your claim limit becomes £{((selectedClaimLimit || 0) + 500).toLocaleString()} per repair
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      +£{boostPrice}/month × 12 payments
                    </div>
                  </>
                )}
              </div>
              
              {/* Toggle Switch */}
              <div className="flex-shrink-0">
                <div
                  className={cn(
                    "relative inline-flex items-center justify-between rounded-full transition-all duration-300 ease-out",
                    "w-[68px] h-[36px] px-1",
                    isBoostActive 
                      ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.5)]" 
                      : "bg-gray-300"
                  )}
                >
                  {/* ON/OFF Labels */}
                  <span className={cn(
                    "text-[11px] font-bold uppercase pl-1.5 transition-all duration-200",
                    isBoostActive ? "text-white" : "text-transparent"
                  )}>
                    ON
                  </span>
                  <span className={cn(
                    "text-[11px] font-bold uppercase pr-1.5 transition-all duration-200",
                    isBoostActive ? "text-transparent" : "text-gray-500"
                  )}>
                    OFF
                  </span>
                  
                  {/* Toggle Knob */}
                  <span
                    className={cn(
                      "absolute inline-flex items-center justify-center rounded-full bg-white shadow-md",
                      "w-[28px] h-[28px] top-1",
                      "transition-all duration-300 ease-out",
                      isBoostActive 
                        ? "left-[36px] shadow-lg" 
                        : "left-1"
                    )}
                  >
                    {isBoostActive ? (
                      <Check className="w-4 h-4 text-green-500" strokeWidth={3} />
                    ) : (
                      <Plus className="w-4 h-4 text-gray-400" strokeWidth={2} />
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
              Maximum claim limit: <span className="font-bold">£{finalClaimLimit?.toLocaleString()}</span> per repair
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
