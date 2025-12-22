import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check, Info, ArrowRight, Plus } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
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

  return (
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
          3
        </div>
        <h3 className="font-semibold text-lg text-foreground">Choose Your Claim Limit</h3>
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

      {/* Optional Add-ons Section */}
      <div className="mt-6 mb-2">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Optional Add-ons</h4>
        
        {/* Boost Claim Limit Card */}
        <div 
          onClick={(e) => {
            const isCurrentlyChecked = boostAddon && selectedClaimLimit === 2000;
            if (!isCurrentlyChecked) {
              triggerBoostSpark(e);
              onClaimLimitChange(2000);
              onBoostChange(true);
            } else {
              onBoostChange(false);
            }
          }}
          className={cn(
            "relative p-4 rounded-xl cursor-pointer transition-all",
            "bg-muted/30 border",
            boostAddon && selectedClaimLimit === 2000
              ? "border-emerald-500 bg-emerald-50/50 shadow-sm"
              : "border-border hover:border-emerald-300 hover:bg-muted/50"
          )}
        >
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {/* Title with icon and badge */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">🚀</span>
                <span className="font-semibold text-foreground">Boost Claim Limit</span>
                <Badge variant="outline" className="text-[10px] font-medium border-muted-foreground/30 text-muted-foreground">
                  Add-on
                </Badge>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px] text-center">
                      <p className="text-xs">This add-on increases your claim limit by £1,000 for just £5/month</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              {/* Subtitle */}
              <p className="text-sm text-muted-foreground mb-3">Add £1,000 extra cover</p>
              
              {/* Before/After Display */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-muted-foreground">Current limit:</span>
                <span className="font-semibold text-foreground">
                  £{selectedClaimLimit ? selectedClaimLimit.toLocaleString() : '1,250'}
                </span>
                <ArrowRight className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-emerald-600">
                  £{selectedClaimLimit ? (selectedClaimLimit + 1000).toLocaleString() : '2,250'}
                </span>
              </div>
              
              {/* +£1000 highlight */}
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-sm font-medium">
                <Plus className="w-3 h-3" />
                £1,000 extra cover
              </div>
              
              {/* Price */}
              <p className="text-xs text-muted-foreground mt-2">
                + £{boostPrice}/month × 12 payments
              </p>
            </div>
            
            {/* Checkbox */}
            <div className="flex-shrink-0 mt-1">
              {boostAddon && selectedClaimLimit === 2000 ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 bg-background" />
              )}
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
