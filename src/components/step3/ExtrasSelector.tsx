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

const allExtras: Extra[] = [
  {
    key: 'breakdown',
    title: 'Roadside Assistance',
    shortDescription: '24/7 vehicle recovery cost refund',
    price: 4,
    priceType: 'monthly',
    icon: '🚗'
  },
  {
    key: 'wearAndTear',
    title: 'Wear & Tear Cover',
    shortDescription: 'Protects key parts from natural wear',
    price: 9,
    priceType: 'monthly',
    icon: '🔧'
  },
  {
    key: 'tyre',
    title: 'Tyre Cover',
    shortDescription: 'Accidental and malicious tyre damage',
    price: 8,
    priceType: 'monthly',
    icon: '🛞'
  },
  {
    key: 'european',
    title: 'Europe Cover',
    shortDescription: 'Full protection across Europe',
    price: 5,
    priceType: 'monthly',
    icon: '🌍'
  },
  {
    key: 'rental',
    title: 'Vehicle Rental',
    shortDescription: 'Replacement vehicle during repairs',
    price: 7,
    priceType: 'monthly',
    icon: '🚘'
  },
  {
    key: 'transfer',
    title: 'Transfer Cover',
    shortDescription: 'Transfer warranty to new owner',
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
  
  const autoIncluded = getAutoIncludedAddOns(paymentType);
  
  // Popular extras shown first
  const popularExtras = allExtras.filter(e => ['breakdown', 'wearAndTear'].includes(e.key));
  const otherExtras = allExtras.filter(e => !['breakdown', 'wearAndTear'].includes(e.key));
  
  const visibleExtras = showAllExtras ? allExtras : popularExtras;

  const renderExtra = (extra: Extra) => {
    const isAutoIncluded = autoIncluded.includes(extra.key);
    const isSelected = selectedAddOns[extra.key] || isAutoIncluded;
    
    // Calculate display price
    const months = paymentType === '12months' ? 12 : paymentType === '24months' ? 24 : 36;
    const displayPrice = extra.priceType === 'monthly' 
      ? Math.round((extra.price * months) / 12)
      : extra.price;

    return (
      <div
        key={extra.key}
        className={cn(
          "p-4 rounded-xl border-2 transition-all",
          isSelected
            ? "border-success bg-success/5"
            : "border-border bg-card"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <span className="text-2xl">{extra.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-foreground">{extra.title}</h4>
                {isAutoIncluded && (
                  <span className="bg-success text-success-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                    FREE
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{extra.shortDescription}</p>
              {!isAutoIncluded && (
                <p className="text-sm font-semibold text-foreground mt-1">
                  +£{displayPrice}{extra.priceType === 'monthly' ? '/month' : ' one-off'}
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
            <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
              <Check className="w-4 h-4 text-success-foreground" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
          5
        </div>
        <h3 className="font-semibold text-lg text-foreground">Add Extras</h3>
      </div>

      <div className="space-y-3">
        {/* Popular Extras Label */}
        {!showAllExtras && (
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Popular extras
          </p>
        )}
        
        {visibleExtras.map(renderExtra)}

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
