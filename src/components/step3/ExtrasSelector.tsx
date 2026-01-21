import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getAutoIncludedAddOns } from '@/lib/addOnsUtils';
import { TRANSFER_COVER_PRICE } from '@/lib/pricingMatrix';

interface Extra {
  key: string;
  title: string;
  shortDescription: string;
  details?: string[];
  price: number;
  priceType: 'monthly' | 'one-off';
  icon: string;
  group: 'included' | 'claim-protection' | 'mobility' | 'ownership';
}

interface ExtrasSelectorProps {
  selectedAddOns: { [key: string]: boolean };
  onAddOnChange: (key: string, selected: boolean) => void;
  paymentType: '12months' | '24months' | '36months';
  currentMonthlyPrice: number;
}

interface ExtraWithBadge extends Extra {
  badge?: { text: string; color: 'orange' | 'green' };
}

// Regrouped add-ons per the spec
const allExtras: ExtraWithBadge[] = [
  // Included as standard - 24/7 Vehicle Recovery
  {
    key: 'breakdown',
    title: '24/7 Vehicle Recovery',
    shortDescription: 'Roadside assistance and recovery service',
    details: ['Covers recovery costs up to £150 per incident', 'Available 24/7 across the UK', 'Includes home start service'],
    price: 0,
    priceType: 'monthly',
    icon: '🚗',
    group: 'included'
  },
  // Claim Protection group
  {
    key: 'wearAndTear',
    title: 'Wear & Tear Cover',
    shortDescription: 'Protects clutch, brakes, and wear items',
    details: ['Covers clutch, brake pads, and discs', 'No excess on wear claims', 'Protects against gradual deterioration'],
    price: 5,
    priceType: 'monthly',
    icon: '🔧',
    group: 'claim-protection',
    badge: { text: 'ADVANCED', color: 'orange' }
  },
  // Mobility & Breakdown bundle
  {
    key: 'extendedMobility',
    title: 'Extended Mobility Cover',
    shortDescription: 'Hire car + European cover bundle',
    details: [
      'Up to 7 days hire car per claim',
      'Full coverage across Europe',
      'Same protection as UK warranty abroad'
    ],
    price: 7,
    priceType: 'monthly',
    icon: '🌍',
    group: 'mobility'
  },
  // Ownership extras
  {
    key: 'transfer',
    title: 'Transfer Cover',
    shortDescription: 'Transfer warranty to new owner',
    details: ['One-time £19 fee', 'Full warranty continues with new owner', 'Increases vehicle resale value', 'Handy if you sell privately'],
    price: TRANSFER_COVER_PRICE,
    priceType: 'one-off',
    icon: '🔁',
    group: 'ownership'
  }
];

const ExtrasSelector: React.FC<ExtrasSelectorProps> = ({
  selectedAddOns,
  onAddOnChange,
  paymentType,
  currentMonthlyPrice
}) => {
  const [openDetails, setOpenDetails] = useState<string | null>(null);
  const autoIncluded = getAutoIncludedAddOns(paymentType);
  
  // Group extras by category
  const includedExtras = allExtras.filter(e => e.group === 'included');
  const claimProtectionExtras = allExtras.filter(e => e.group === 'claim-protection');
  const mobilityExtras = allExtras.filter(e => e.group === 'mobility');
  const ownershipExtras = allExtras.filter(e => e.group === 'ownership');

  const renderExtra = (extra: ExtraWithBadge, isIncludedSection = false) => {
    const isAutoIncluded = autoIncluded.includes(extra.key) || extra.group === 'included';
    const isSelected = selectedAddOns[extra.key] || isAutoIncluded;
    const isDetailsOpen = openDetails === extra.key;
    
    // Calculate display price
    const displayPrice = extra.priceType === 'monthly' 
      ? extra.price
      : extra.price;

    return (
      <Collapsible
        key={extra.key}
        open={isDetailsOpen}
        onOpenChange={(open) => setOpenDetails(open ? extra.key : null)}
      >
        <div
          className={cn(
            "rounded-xl border-2 transition-all overflow-hidden",
            isAutoIncluded || isIncludedSection
              ? "border-green-200 bg-green-50"
              : isSelected
                ? "border-success bg-success/5"
                : "border-border bg-card"
          )}
        >
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-2xl flex-shrink-0">{extra.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-foreground">{extra.title}</h4>
                    {(isAutoIncluded || isIncludedSection) && (
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200">
                        INCLUDED FREE
                      </span>
                    )}
                    {!isAutoIncluded && !isIncludedSection && extra.badge && (
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        extra.badge.color === 'orange' 
                          ? "bg-orange-500 text-white"
                          : "bg-green-500 text-white"
                      )}>
                        {extra.badge.text}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{extra.shortDescription}</p>
                  {!isAutoIncluded && !isIncludedSection && extra.price > 0 && (
                    <p className="text-sm font-semibold text-foreground mt-1">
                      {extra.priceType === 'one-off' 
                        ? `£${displayPrice} one-off` 
                        : `+£${displayPrice}/month`}
                    </p>
                  )}
                </div>
              </div>
              
              {!isAutoIncluded && !isIncludedSection && (
                <Switch
                  checked={isSelected}
                  onCheckedChange={(checked) => {
                    // Handle the extended mobility bundle - enable both rental and european
                    if (extra.key === 'extendedMobility') {
                      onAddOnChange('rental', checked);
                      onAddOnChange('european', checked);
                    }
                    onAddOnChange(extra.key, checked);
                  }}
                  className="data-[state=checked]:bg-success flex-shrink-0"
                />
              )}
              
              {(isAutoIncluded || isIncludedSection) && (
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            
            {/* Details Button */}
            {extra.details && extra.details.length > 0 && (
              <CollapsibleTrigger className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground bg-muted hover:bg-muted/80 hover:text-foreground rounded-lg shadow-sm transition-all duration-200">
                <Info className="w-4 h-4" />
                <span>Details</span>
                <ChevronDown 
                  className={cn(
                    "w-4 h-4 transition-transform duration-300",
                    isDetailsOpen && "rotate-180"
                  )} 
                />
              </CollapsibleTrigger>
            )}
          </div>
          
          {/* Collapsible Details Content */}
          <CollapsibleContent className="animate-accordion-down">
            <div className="px-4 pb-4 pt-2 bg-muted/50 border-t border-border">
              <ul className="space-y-1.5">
                {extra.details?.map((detail, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  return (
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
          5
        </div>
        <h3 className="font-semibold text-lg text-foreground">Optional Add-Ons</h3>
      </div>

      <div className="space-y-4">
        {/* Included as Standard */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Included as Standard
          </p>
          <div className="space-y-2">
            {includedExtras.map(extra => renderExtra(extra, true))}
          </div>
        </div>

        {/* Claim Protection */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Claim Protection
          </p>
          <div className="space-y-2">
            {claimProtectionExtras.map(extra => renderExtra(extra))}
          </div>
        </div>

        {/* Mobility & Breakdown */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Mobility & Breakdown
          </p>
          <div className="space-y-2">
            {mobilityExtras.map(extra => renderExtra(extra))}
          </div>
        </div>

        {/* Ownership Extras */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Ownership Extras
          </p>
          <div className="space-y-2">
            {ownershipExtras.map(extra => renderExtra(extra))}
          </div>
        </div>
      </div>

      {/* Live Price Update */}
      <div className="mt-4 text-sm font-medium text-success animate-fade-in">
        Updated price: £{currentMonthlyPrice}/month
      </div>
    </div>
  );
};

export default ExtrasSelector;