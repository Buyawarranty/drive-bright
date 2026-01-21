import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check, Info, Plus } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import confetti from 'canvas-confetti';
import { CLAIM_LIMIT_MONTHLY_ADJUSTMENT, BOOST_CLAIM_LIMIT_MONTHLY, BOOST_CLAIM_LIMIT_AMOUNT } from '@/lib/pricingMatrix';

interface ClaimLimitSelectorProps {
  selectedClaimLimit: number | null;
  onClaimLimitChange: (claimLimit: number) => void;
  currentMonthlyPrice: number;
  boostAddon: boolean;
  onBoostChange: (boost: boolean) => void;
  boostPrice: number;
}

// New claim limit options: £1,000, £2,000, £3,000
const claimLimitOptions = [1000, 2000, 3000];

const claimLimitDetails: Record<number, string> = {
  1000: "Covers most common mechanical faults and minor repairs. Ideal for older or lower-value vehicles.",
  2000: "Our most popular option. Covers major component failures including engine and gearbox.",
  3000: "Maximum protection for high-value repairs. Best for luxury and performance vehicles."
};

const claimLimitLabels: Record<number, { title: string; badge?: string; adjustment: string }> = {
  1000: { title: '£1,000', adjustment: '£0/month' },
  2000: { title: '£2,000', badge: 'POPULAR', adjustment: '+£6/month' },
  3000: { title: '£3,000', adjustment: '+£10/month' }
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
  
  // Boost is disabled when £3,000 is selected
  const isBoostDisabled = selectedClaimLimit === 3000;
  
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

  const handleSelect = (limit: number) => {
    onClaimLimitChange(limit);
    // Auto-disable boost if selecting £3,000
    if (limit === 3000 && boostAddon) {
      onBoostChange(false);
    }
  };

  const handleBoostToggle = (checked: boolean, event?: React.MouseEvent) => {
    if (isBoostDisabled) return;
    if (checked && event) {
      triggerBoostSpark(event);
    }
    onBoostChange(checked);
  };

  // Calculate effective claim limit with boost
  const effectiveClaimLimit = boostAddon && selectedClaimLimit ? selectedClaimLimit + BOOST_CLAIM_LIMIT_AMOUNT : selectedClaimLimit;

  return (
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
          3
        </div>
        <h3 className="font-semibold text-lg text-foreground">Set Your Claim Limit</h3>
      </div>

      {/* Claim Limit Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {claimLimitOptions.map((limit) => {
          const isSelected = selectedClaimLimit === limit;
          const labelInfo = claimLimitLabels[limit];
          const isOpen = openDetails === limit;
          
          return (
            <div key={limit} className="relative pt-3">
              {/* Tag - positioned to overlap border */}
              {labelInfo.badge && (
                <span className="absolute -top-0 left-3 z-10 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
                  {labelInfo.badge}
                </span>
              )}
              
              <Collapsible open={isOpen} onOpenChange={(open) => setOpenDetails(open ? limit : null)}>
                <div
                  className={cn(
                    "rounded-lg border-2 transition-all bg-card shadow-sm min-h-[120px]",
                    isSelected
                      ? "border-success"
                      : "border-border hover:border-success/50"
                  )}
                >
                  {/* Main Card Content */}
                  <button
                    onClick={() => handleSelect(limit)}
                    className="w-full p-4 text-left min-h-[88px]"
                  >
                    <div className="font-bold text-xl text-foreground">{labelInfo.title}</div>
                    <div className="text-xs text-muted-foreground mb-1">per claim</div>
                    <div className={cn(
                      "text-sm font-semibold",
                      limit === 1000 ? "text-muted-foreground" : "text-primary"
                    )}>
                      {labelInfo.adjustment}
                    </div>
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
                    <div className="px-4 pb-4 pt-2 bg-muted/50 border-t border-border">
                      <p className="text-sm text-muted-foreground leading-relaxed">
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

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground mb-3">
        Most repairs cost hundreds; higher limits help with big failures.
      </p>

      {/* Boost Add-on Section */}
      <div className="mt-4 mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Claim Protection</h4>
        
        {/* Add Extra Cover Card - Fully Tappable */}
        <div 
          onClick={(e) => {
            if (isBoostDisabled) return;
            handleBoostToggle(!boostAddon, e);
          }}
          className={cn(
            "relative p-4 rounded-xl border-2 overflow-hidden transition-all duration-300 ease-out transform",
            isBoostDisabled
              ? "bg-muted/30 border-border opacity-50 cursor-not-allowed"
              : boostAddon
                ? "bg-gradient-to-br from-green-50 to-green-100 border-green-500 shadow-[0_0_16px_rgba(34,197,94,0.35)] scale-[1.01] cursor-pointer"
                : "bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 hover:border-orange-400 hover:shadow-lg hover:scale-[1.005] cursor-pointer"
          )}
        >
          {/* Animated background pulse when active */}
          {boostAddon && !isBoostDisabled && (
            <div className="absolute inset-0 bg-green-400/10 animate-pulse pointer-events-none" />
          )}
          
          <div className="relative flex items-center gap-4">
            {/* Content */}
            <div className="flex-1 min-w-0">
              {isBoostDisabled ? (
                <>
                  <h4 className="text-base font-semibold text-muted-foreground">
                    Boost not available
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Already at maximum £3,000 claim limit
                  </p>
                </>
              ) : boostAddon ? (
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
                    Your cover is now £{effectiveClaimLimit?.toLocaleString()} per claim 🚀
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    +£{BOOST_CLAIM_LIMIT_MONTHLY}/month
                  </div>
                </>
              ) : (
                <>
                  <h4 className="text-lg font-bold text-foreground mb-0.5">
                    🚀 Add +£{BOOST_CLAIM_LIMIT_AMOUNT} extra cover
                  </h4>
                  <div className="text-base font-semibold text-foreground">
                    Upgrade to £{selectedClaimLimit ? (selectedClaimLimit + BOOST_CLAIM_LIMIT_AMOUNT).toLocaleString() : '1,500'} per claim
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    +£{BOOST_CLAIM_LIMIT_MONTHLY}/month
                  </div>
                </>
              )}
            </div>
            
            {/* Toggle Switch */}
            {!isBoostDisabled && (
              <div className="flex-shrink-0">
                <div
                  className={cn(
                    "relative inline-flex items-center justify-between rounded-full transition-all duration-300 ease-out",
                    "w-[68px] h-[36px] px-1",
                    boostAddon 
                      ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.5)]" 
                      : "bg-gray-300"
                  )}
                >
                  {/* ON/OFF Labels */}
                  <span className={cn(
                    "text-[11px] font-bold uppercase pl-1.5 transition-all duration-200",
                    boostAddon ? "text-white" : "text-transparent"
                  )}>
                    ON
                  </span>
                  <span className={cn(
                    "text-[11px] font-bold uppercase pr-1.5 transition-all duration-200",
                    boostAddon ? "text-transparent" : "text-gray-500"
                  )}>
                    OFF
                  </span>
                  
                  {/* Toggle Knob */}
                  <span
                    className={cn(
                      "absolute inline-flex items-center justify-center rounded-full bg-white shadow-md",
                      "w-[28px] h-[28px] top-1",
                      "transition-all duration-300 ease-out",
                      boostAddon 
                        ? "left-[36px] shadow-lg" 
                        : "left-1"
                    )}
                  >
                    {boostAddon ? (
                      <Check className="w-4 h-4 text-green-500" strokeWidth={3} />
                    ) : (
                      <Plus className="w-4 h-4 text-gray-400" strokeWidth={2} />
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Price Update */}
      {selectedClaimLimit !== null && (
        <div className="mt-3 text-sm font-medium text-success animate-fade-in">
          Updated price: £{currentMonthlyPrice}/month
        </div>
      )}
    </div>
  );
};

export default ClaimLimitSelector;