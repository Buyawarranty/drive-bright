import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check, Info, ArrowRight, Plus, Gift } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import confetti from 'canvas-confetti';

interface ClaimLimitSelectorProps {
  selectedClaimLimit: number | null;
  onClaimLimitChange: (claimLimit: number) => void;
  currentMonthlyPrice: number;
  boostAddon: boolean;
  onBoostChange: (boost: boolean) => void;
  boostPrice: number;
  paymentType?: '12months' | '24months' | '36months';
}

// Claim limit options including £3000 (which uses £2000 base + boost logic)
const claimLimitOptions = [750, 1250, 2000, 3000];

const claimLimitDetails: Record<number, string> = {
  750: "Ideal for minor repairs and maintenance issues. Covers most common mechanical faults.",
  1250: "Our most popular option. Covers major component failures including engine and gearbox.",
  2000: "Comprehensive cover for expensive repairs. Recommended for premium vehicles.",
  3000: "Maximum protection for high-value repairs. Best for luxury and performance vehicles."
};

const ClaimLimitSelector: React.FC<ClaimLimitSelectorProps> = ({
  selectedClaimLimit,
  onClaimLimitChange,
  currentMonthlyPrice,
  boostAddon,
  onBoostChange,
  boostPrice,
  paymentType = '12months'
}) => {
  const isMultiYear = paymentType === '24months' || paymentType === '36months';
  
  // Filter options: hide £1250 for multi-year plans
  const visibleClaimLimits = isMultiYear 
    ? claimLimitOptions.filter(limit => limit !== 1250)
    : claimLimitOptions;
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
  const isBoostActive = boostAddon && selectedClaimLimit === 2000;

  const handleBoostToggle = (checked: boolean, event?: React.MouseEvent) => {
    if (checked && event) {
      triggerBoostSpark(event);
      onClaimLimitChange(2000);
    }
    onBoostChange(checked);
  };

  return (
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
          3
        </div>
        <h3 className="font-semibold text-lg text-foreground">Set your claim limit - cover up to your car's <span className="font-bold">full value</span> 🚗</h3>
      </div>

      {/* Multi-year upgrade message */}
      {isMultiYear && (
        <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <Gift className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-800">
              Free upgrade on multi-year plans!
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              Your cover is upgraded to £2,000 per claim at no extra cost.
            </p>
          </div>
        </div>
      )}

      {/* Claim Limit Cards */}
      <div className={cn(
        "gap-3 mb-3",
        isMultiYear ? "grid grid-cols-3" : "grid grid-cols-2"
      )}>
        {visibleClaimLimits.map((limit) => {
          const isSelected = displayedLimit === limit;
          const isPopular = limit === 1250;
          const isOpen = openDetails === limit;
          
          return (
            <div key={limit} className="relative pt-3">
              {/* Tag - positioned to overlap border */}
              {isPopular && (
                <span className="absolute -top-0 left-3 z-10 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
                  POPULAR
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
                  <button
                    onClick={() => handleSelect(limit)}
                    className="w-full p-4 text-left"
                  >
                    <div className={cn(
                      "font-bold text-foreground",
                      isMultiYear ? "text-lg" : "text-xl"
                    )}>£{limit.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">per claim</div>
                  </button>
                  {/* Divider */}
                  <div className="border-t border-border" />
                  
                  {/* View Details Trigger */}
                  <CollapsibleTrigger className="w-full px-4 py-2 flex items-center justify-between text-sm font-semibold text-foreground hover:text-primary transition-colors">
                    <span>View Details</span>
                    <ChevronDown 
                      className={cn(
                        "w-4 h-4 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )} 
                    />
                  </CollapsibleTrigger>
                  
                  {/* Collapsible Content */}
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-border">
                      <p className="text-sm text-gray-700 leading-relaxed">
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

      {/* Optional add-on Section - Only show for 1-year plans */}
      {!isMultiYear && (
        <div className="mt-4 mb-2">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Optional add-on</h4>
          
          {/* Add Extra Cover Card - Fully Tappable with Improved Toggle */}
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
                        Upgrade Added!
                      </h4>
                    </div>
                    <div className="text-base font-semibold text-green-800">
                      Your cover is now £3,000 per claim 🚀
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      Just £{boostPrice}/month × 12 payments
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="text-lg font-bold text-foreground mb-0.5">
                      🚀 Boost your cover by £1,000
                    </h4>
                    <div className="text-base font-semibold text-foreground">
                      Upgrade to £3,000 per claim
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Just £{boostPrice}/month × 12 payments
                    </div>
                  </>
                )}
              </div>
              
              {/* Improved Toggle Switch */}
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
