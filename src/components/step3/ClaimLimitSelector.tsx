import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CLAIM_LIMIT_TIERS, PREMIUM_CLAIM_MONTHLY, isPremiumVehicle } from '@/lib/claimLimitTiers';
import ClaimLimitDetails from './ClaimLimitDetails';

interface ClaimLimitSelectorProps {
  selectedClaimLimit: number | null;
  onClaimLimitChange: (claimLimit: number) => void;
  currentMonthlyPrice: number;
  boostAddon: boolean;
  onBoostChange: (boost: boolean) => void;
  boostPrice: number;
  paymentType?: '12months' | '24months' | '36months';
  vehicleMake?: string;
}

const ClaimLimitSelector: React.FC<ClaimLimitSelectorProps> = ({
  selectedClaimLimit,
  onClaimLimitChange,
  currentMonthlyPrice,
  boostAddon,
  onBoostChange,
  boostPrice,
  paymentType = '12months',
  vehicleMake
}) => {
  const [openDetails, setOpenDetails] = useState<number | null>(null);
  
  // Filter out £5000 for premium vehicles (Tesla, Jaguar, Range Rover, Porsche)
  const isPremium = isPremiumVehicle(vehicleMake);
  const visibleTiers = isPremium 
    ? CLAIM_LIMIT_TIERS.filter(t => t.value !== 5000)
    : [...CLAIM_LIMIT_TIERS];

  // Handle selection - £3000 uses boost internally, £5000 is direct
  const handleSelect = (limit: number) => {
    if (limit === 3000) {
      // £3000 = £2000 base + boost addon
      onClaimLimitChange(2000);
      onBoostChange(true);
    } else if (limit === 5000) {
      onClaimLimitChange(5000);
      onBoostChange(false);
    } else {
      onClaimLimitChange(limit);
      onBoostChange(false);
    }
  };

  // Determine which tier to highlight
  const getDisplayedLimit = () => {
    if (boostAddon && selectedClaimLimit === 2000) return 3000;
    return selectedClaimLimit;
  };

  const displayedLimit = getDisplayedLimit();

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-5 border-t border-border">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold flex-shrink-0">
          3
        </div>
        <h3 className="font-semibold text-lg text-foreground">
          Set your claim limit 🚗
        </h3>
      </div>

      {/* Claim Limit Cards */}
      <div className={cn(
        "gap-2 sm:gap-3 mb-3",
        visibleTiers.length <= 3 ? "grid grid-cols-3" : "grid grid-cols-2"
      )}>
        {visibleTiers.map((tier) => {
          const isSelected = displayedLimit === tier.value;
          const isPopular = tier.popular;
          const isOpen = openDetails === tier.value;
          
          return (
            <div key={tier.value} className="relative pt-3">
              {/* MOST POPULAR tag */}
              {isPopular && (
                <span className="absolute -top-0 left-2 sm:left-3 z-10 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
                  MOST POPULAR
                </span>
              )}
              
              <Collapsible open={isOpen} onOpenChange={(open) => setOpenDetails(open ? tier.value : null)}>
                <div
                  className={cn(
                    "rounded-lg border-2 transition-all bg-white shadow-sm",
                    isSelected
                      ? "border-success"
                      : "border-border hover:border-success/50"
                  )}
                >
                  <button
                    onClick={() => handleSelect(tier.value)}
                    className="w-full p-3 sm:p-4 text-left"
                  >
                    <div className="text-[11px] sm:text-xs font-semibold text-muted-foreground mb-0.5">
                      {tier.name}
                    </div>
                    <div className={cn(
                      "font-bold text-foreground",
                      visibleTiers.length > 3 ? "text-lg" : "text-xl"
                    )}>
                      £{tier.value.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">per claim</div>
                    {/* Show monthly cost indicator for premium tiers */}
                    {tier.value === 5000 && (
                      <div className="text-[10px] sm:text-xs text-[#0BA360] font-medium mt-1">
                        Just {Math.round((PREMIUM_CLAIM_MONTHLY[paymentType] * 12) / 365 * 100)}p/day more
                      </div>
                    )}
                    {tier.value === 3000 && (
                      <div className="text-[10px] sm:text-xs text-[#0BA360] font-medium mt-1">
                        Just {Math.round((boostPrice * 12) / 365 * 100)}p/day more
                      </div>
                    )}
                  </button>
                  
                  {/* Divider */}
                  <div className="border-t border-border" />
                  
                  {/* View Details Trigger */}
                  <CollapsibleTrigger className="w-full px-3 sm:px-4 py-2 flex items-center justify-between text-sm font-semibold text-foreground hover:text-primary transition-colors">
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
                    <div className="px-3 sm:px-4 pb-4 pt-3 bg-white border-t border-border">
                      <ClaimLimitDetails />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </div>
          );
        })}
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
