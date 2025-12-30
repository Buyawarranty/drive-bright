import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check, Info, ArrowRight, Plus } from 'lucide-react';
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
        <h3 className="font-semibold text-lg text-foreground">Set your claim limit - cover up to your car's full value 🚗</h3>
      </div>

      {/* Claim Limit Cards */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {claimLimitOptions.map((limit) => {
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
                  {/* Main Card Content */}
                  <button
                    onClick={() => handleSelect(limit)}
                    className="w-full p-4 text-left"
                  >
                    <div className="font-bold text-xl text-foreground">£{limit.toLocaleString()}</div>
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

      {/* Optional add-on Section */}
      <div className="mt-4 mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Optional add-on</h4>
        
        {/* Add Extra Cover Card - with Toggle Switch */}
        <div 
          onClick={(e) => {
            if (!isBoostActive) {
              handleBoostToggle(true, e);
            } else {
              handleBoostToggle(false);
            }
          }}
          className={cn(
            "relative p-4 rounded-lg cursor-pointer transition-all border-2 min-h-[88px] flex items-center",
            isBoostActive
              ? "bg-green-50 border-green-500 ring-2 ring-green-400"
              : "bg-orange-50 border-orange-200 hover:border-orange-400"
          )}
        >
          <div className="flex items-start justify-between w-full">
            <div className="flex-1">
              {isBoostActive ? (
                <>
                  <h4 className="text-lg font-bold text-green-700 mb-1">
                    ✅ Upgrade Added!
                  </h4>
                  <div className="text-base font-semibold text-green-800">
                    Your cover is now £3,000 per claim 🚀
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Just £{boostPrice}/mo × 12 payments
                  </div>
                </>
              ) : (
                <>
                  <h4 className="text-lg font-bold text-foreground mb-1">
                    🚀 Boost your cover by £1,000
                  </h4>
                  <div className="text-base font-semibold text-foreground">
                    Upgrade to £3,000 per claim
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Just £{boostPrice}/mo × 12 payments
                  </div>
                </>
              )}
            </div>
            <div className="flex-shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
              <Switch 
                checked={isBoostActive}
                onCheckedChange={(checked) => handleBoostToggle(checked)}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
          </div>
        </div>
      </div>

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
