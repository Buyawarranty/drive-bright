import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getAutoIncludedAddOns } from '@/lib/addOnsUtils';

interface Extra {
  key: string;
  title: string;
  shortDescription: string;
  details?: string[];
  price: number;
  priceType: 'monthly' | 'one-off';
  icon: string;
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

const allExtras: ExtraWithBadge[] = [
  {
    key: 'breakdown',
    title: 'Roadside Assistance',
    shortDescription: '24/7 vehicle recovery cost refund',
    details: ['Covers recovery costs up to £150 per incident', 'Available 24/7 across the UK', 'Includes home start service'],
    price: 4,
    priceType: 'monthly',
    icon: '🚗'
  },
  {
    key: 'wearAndTear',
    title: 'Wear & Tear Cover',
    shortDescription: 'Protects key parts from natural wear',
    details: ['Covers clutch, brake pads, and discs', 'No excess on wear claims', 'Protects against gradual deterioration'],
    price: 9,
    priceType: 'monthly',
    icon: '🔧',
    badge: { text: 'BEST VALUE', color: 'orange' }
  },
  {
    key: 'tyre',
    title: 'Tyre Cover',
    shortDescription: 'Accidental and malicious tyre damage',
    details: ['Up to £150 per tyre replacement', 'Covers accidental damage and vandalism', 'Includes puncture repairs'],
    price: 7,
    priceType: 'monthly',
    icon: '🛞',
    badge: { text: 'POPULAR', color: 'green' }
  },
  {
    key: 'european',
    title: 'Europe Cover',
    shortDescription: 'Full protection across Europe',
    details: ['Valid in all EU countries', 'Same coverage as UK warranty', 'Includes recovery to nearest garage'],
    price: 5,
    priceType: 'monthly',
    icon: '🌍'
  },
  {
    key: 'rental',
    title: 'Vehicle Rental',
    shortDescription: 'Replacement vehicle during repairs',
    details: ['Up to 7 days rental per claim', 'Group A vehicle provided', 'Arranged directly with repair garage'],
    price: 7,
    priceType: 'monthly',
    icon: '🚘'
  },
  {
    key: 'transfer',
    title: 'Transfer Cover',
    shortDescription: 'Transfer warranty to new owner (£19 total)',
    details: ['One-time £19 fee spread across your monthly payments', 'Full warranty continues with new owner', 'Increases vehicle resale value'],
    price: 19,
    priceType: 'one-off',
    icon: '🔁'
  }
];

const ExtrasSelector: React.FC<ExtrasSelectorProps> = ({
  selectedAddOns,
  onAddOnChange,
  paymentType,
  currentMonthlyPrice
}) => {
  const [showAllExtras, setShowAllExtras] = useState(false);
  const [openDetails, setOpenDetails] = useState<string | null>(null);
  const autoIncluded = getAutoIncludedAddOns(paymentType);
  
  // Popular extras shown first
  const popularExtras = allExtras.filter(e => ['breakdown', 'wearAndTear'].includes(e.key));
  const otherExtras = allExtras.filter(e => !['breakdown', 'wearAndTear'].includes(e.key));
  
  const visibleExtras = showAllExtras ? allExtras : popularExtras;

  const renderExtra = (extra: ExtraWithBadge) => {
    const isAutoIncluded = autoIncluded.includes(extra.key);
    const isSelected = selectedAddOns[extra.key] || isAutoIncluded;
    const isDetailsOpen = openDetails === extra.key;
    
    // Calculate display price - all add-ons shown as monthly (split across 12 payments)
    const months = paymentType === '12months' ? 12 : paymentType === '24months' ? 24 : 36;
    const displayPrice = extra.priceType === 'monthly' 
      ? Math.round((extra.price * months) / 12)
      : Math.round(extra.price / 12); // One-off fees split across 12 monthly payments

    return (
      <Collapsible
        key={extra.key}
        open={isDetailsOpen}
        onOpenChange={(open) => setOpenDetails(open ? extra.key : null)}
      >
        <div
          className={cn(
            "rounded-xl border-[2.5px] transition-all overflow-hidden",
            isAutoIncluded
              ? "border-green-200 bg-green-50"
              : isSelected
                ? "border-success bg-success/5"
                : "border-border bg-card"
          )}
        >
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-2xl">{extra.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-foreground">{extra.title}</h4>
                    {isAutoIncluded && (
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200">
                        INCLUDED FREE
                      </span>
                    )}
                    {!isAutoIncluded && extra.badge && (
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
                  {!isAutoIncluded && (
                    <p className="text-sm font-semibold text-foreground mt-1">
                      +£{displayPrice}/month
                    </p>
                  )}
                </div>
              </div>
              
              {!isAutoIncluded && (
                <Switch
                  checked={isSelected}
                  onCheckedChange={(checked) => onAddOnChange(extra.key, checked)}
                  className="data-[state=checked]:bg-success"
                />
              )}
              
              {isAutoIncluded && (
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            
            {/* Details Button */}
            {extra.details && extra.details.length > 0 && (
              <CollapsibleTrigger className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground bg-gray-100 hover:bg-gray-200 hover:text-foreground rounded-lg shadow-sm transition-all duration-200">
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
            <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-border">
              <ul className="space-y-1.5">
                {extra.details?.map((detail, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
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

      <div className="space-y-3">
        {/* Popular Extras Label */}
        {!showAllExtras && (
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Popular extras
          </p>
        )}
        
        <div className={cn(
          "grid gap-3",
          showAllExtras ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
        )}>
          {visibleExtras.map(renderExtra)}
        </div>

        {/* View All Toggle */}
        <button
          onClick={() => setShowAllExtras(!showAllExtras)}
          className="w-full py-3 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 transition-colors border border-border rounded-lg"
        >
          {showAllExtras ? (
            <>
              Show less <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              View all {allExtras.length} extras <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Live Price Update */}
      <div className="mt-3 text-sm font-medium text-success animate-fade-in">
        Updated price: £{currentMonthlyPrice}/month
      </div>
    </div>
  );
};

export default ExtrasSelector;
