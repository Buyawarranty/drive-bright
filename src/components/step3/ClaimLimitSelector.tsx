import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import { CLAIM_LIMIT_TIERS, isPremiumVehicle, getClaimLimitSurcharge } from '@/lib/claimLimitTiers';
import ClaimLimitDetails from './ClaimLimitDetails';

interface ClaimLimitSelectorProps {
  selectedClaimLimit: number | null;
  onClaimLimitChange: (claimLimit: number) => void;
  currentMonthlyPrice: number;
  boostAddon: boolean;
  onBoostChange: (boost: boolean) => void;
  boostPrice: number;
  paymentType?: '12months' | '24months' | '36months' | null;
  vehicleMake?: string;
  voluntaryExcess?: number;
}

const ClaimLimitSelector: React.FC<ClaimLimitSelectorProps> = ({
  selectedClaimLimit,
  onClaimLimitChange,
  currentMonthlyPrice,
  boostAddon,
  onBoostChange,
  boostPrice,
  paymentType,
  vehicleMake,
  voluntaryExcess = 100
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Filter out £5000 for premium vehicles
  const isPremium = isPremiumVehicle(vehicleMake);
  const visibleTiers = isPremium
    ? CLAIM_LIMIT_TIERS.filter(t => t.value !== 5000)
    : [...CLAIM_LIMIT_TIERS];

  const handleSelect = (limit: number) => {
    onClaimLimitChange(limit);
    onBoostChange(false);
  };

  const displayedLimit = selectedClaimLimit;

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-5 border-t border-border">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold flex-shrink-0">
          2
        </div>
        <h3 className="font-semibold text-lg text-foreground">
          🔧 Choose how much we cover per repair — unlimited claims, parts & labour included 🚗
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

          return (
            <div key={tier.value} className="relative pt-3">
              {isPopular && (
                <span className="absolute -top-0 left-1/2 -translate-x-1/2 z-10 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide whitespace-nowrap">
                  MOST POPULAR
                </span>
              )}

              <button
                onClick={() => handleSelect(tier.value)}
                className={cn(
                  "w-full rounded-lg border-2 transition-all bg-white shadow-sm p-3 sm:p-4 text-left",
                  isSelected
                    ? "border-success"
                    : "border-border hover:border-success/50"
                )}
              >
                <div className="text-[11px] sm:text-xs font-semibold text-muted-foreground mb-0.5">
                  {tier.name}
                </div>
                <div className={cn(
                  "font-bold text-foreground",
                  visibleTiers.length > 3 ? "text-lg" : "text-xl"
                )}>
                  £{(tier.displayValue ?? tier.value).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">per claim</div>
              </button>
            </div>
          );
        })}
      </div>

      {/* View Details Trigger - opens modal */}
      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors mb-3"
      >
        <Info className="w-4 h-4" />
        How much cover do I need?
      </button>

      {/* Live Price Update */}
      {selectedClaimLimit !== null && (
        <div className="text-sm font-medium text-success animate-fade-in">
          Updated price: £{currentMonthlyPrice}/month
        </div>
      )}

      <ClaimLimitDetails
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        selectedClaimLimit={selectedClaimLimit}
        onConfirm={handleSelect}
      />
    </div>
  );
};

export default ClaimLimitSelector;
