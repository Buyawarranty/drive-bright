import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import { getAutoIncludedAddOns } from '@/lib/addOnsUtils';

interface AddOnProtectionPackagesProps {
  selectedAddOns: {[key: string]: boolean};
  onAddOnChange: (addOnKey: string, selected: boolean) => void;
  paymentType: '12months' | '24months' | '36months';
}

const addOnPackages = [
  {
    key: 'wearAndTear',
    icon: '🔧',
    title: 'Wear & Tear Cover',
    shortDescription: 'Protects against premature failure of key mechanical and electrical components due to natural wear.',
    price: 9.99,
    priceType: 'monthly',
    bulletPoints: [
      'Covers engine, gearbox, differential and drivetrain components',
      'Includes critical electrical parts like ECUs and alternators',
      'Protection for factory-fitted systems beyond routine maintenance',
      'Covers unexpected mechanical breakdowns not caused by servicing',
      'Guards against premature part failure before expected lifespan',
      'Parts that fail prematurely, outside of their expected service life, and not due to neglect or lack of maintenance.'
    ]
  },
  {
    key: 'breakdown',
    icon: '🚗',
    title: '24/7 Vehicle Recovery',
    shortDescription: 'Quick and easy claims for vehicle recovery costs',
    price: 3.99,
    priceType: 'monthly',
    bulletPoints: [
      'Use any 24/7 recovery service',
      'Recovery to a garage or location your choice',
      'Hassle-free claims process',
      'Claim limits apply',
      'Please note: This is not a breakdown service. It\'s a recovery cost refund service for when you\'ve already been recovered.'
    ]
  },
  {
    key: 'tyre',
    icon: '🛞',
    title: 'Tyre Cover',
    shortDescription: 'Comprehensive protection for accidental, malicious, and puncture-related tyre damage.',
    price: 7.99,
    priceType: 'monthly',
    bulletPoints: [
      'Up to £150 per tyre for repair or replacement',
      'Covers accidental damage',
      'Covers malicious damage (with police report)',
      'Up to £50 per puncture repair',
      '£30 roadside assistance contribution'
    ]
  },
  {
    key: 'european',
    icon: '🌍',
    title: 'Europe Cover',
    shortDescription: 'Enjoy full Platinum-level protection while driving across Europe.',
    price: 5.99,
    priceType: 'monthly',
    bulletPoints: [
      'Same cover level as UK Platinum plan',
      'Valid across Schengen Area countries',
      'Covers mechanical and electrical breakdowns'
    ]
  },
  {
    key: 'rental',
    icon: '🚘',
    title: 'Vehicle Rental',
    shortDescription: 'Stay mobile with a replacement vehicle during repairs.',
    price: 6.99,
    priceType: 'monthly',
    bulletPoints: [
      'Daily rental allowance',
      'Requires prior approval',
      'Minimises disruption to daily life',
      'Seamless integration with Platinum claims'
    ]
  },
  {
    key: 'motFee',
    icon: '🛠️',
    title: 'MOT Test Fee Cover',
    shortDescription: 'Reimbursement of the MOT test fee',
    price: 1.99,
    priceType: 'monthly',
    bulletPoints: [
      'Reimbursement of the MOT test fee',
      'Reduces unexpected costs',
      'Peace of mind for annual testing',
      'Quick and easy claims process'
    ]
  },
  {
    key: 'transfer',
    icon: '🔁',
    title: 'Transfer Cover',
    shortDescription: 'Transfer your remaining warranty to a new owner to boost resale value.',
    price: 19.99,
    priceType: 'one-off',
    bulletPoints: [
      'Increases vehicle resale appeal',
      'Email-based transfer process',
      'Transferable to private buyers',
      'Support available for ownership changes'
    ]
  }
];

const AddOnProtectionPackages: React.FC<AddOnProtectionPackagesProps> = ({
  selectedAddOns,
  onAddOnChange,
  paymentType
}) => {
  const [expandedItems, setExpandedItems] = useState<{[key: string]: boolean}>({});

  // Define auto-included add-ons based on payment type - use imported utility for consistency
  const autoIncludedAddOns = getAutoIncludedAddOns(paymentType);
  
  // Check if an add-on is auto-included
  const isAutoIncluded = (addonKey: string) => autoIncludedAddOns.includes(addonKey);
  
  console.log('🔧 AddOnProtectionPackages - Payment Type:', paymentType);
  console.log('🔧 AddOnProtectionPackages - Auto-included add-ons:', autoIncludedAddOns);
  console.log('🔧 AddOnProtectionPackages - Selected add-ons:', selectedAddOns);

  const toggleExpanded = (key: string) => {
    setExpandedItems(prev => {
      const isCurrentlyOpen = prev[key];
      // Close all items first, then open the clicked one if it wasn't open
      const newState: {[key: string]: boolean} = {};
      addOnPackages.forEach(addon => {
        newState[addon.key] = false;
      });
      if (!isCurrentlyOpen) {
        newState[key] = true;
      }
      return newState;
    });
  };

  // Calculate the number of months based on payment type
  const getMonthsFromPaymentType = (paymentType: string) => {
    switch (paymentType) {
      case '12months': return 12;
      case '24months': return 24;
      case '36months': return 36;
      default: return 12;
    }
  };

  const months = getMonthsFromPaymentType(paymentType);

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Add-On Protection Packages</h2>
        <p className="text-sm text-muted-foreground">Add-on packages must be selected before your warranty is activated, as they can't be added later.</p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-3">
      {addOnPackages.map((addon) => {
        const isIncluded = isAutoIncluded(addon.key);
        const isSelected = selectedAddOns[addon.key] || isIncluded;
        
        // Calculate price display - always show monthly cost spread over 12 payments
        let priceDisplay;
        let showSpreadText = false;
        
        if (addon.priceType === 'monthly') {
          // For 2-year and 3-year plans, show the cost spread over 12 monthly payments
          const totalCost = addon.price * months;
          const monthlyPayment = totalCost / 12; // Always spread over 12 payments
          priceDisplay = addon.price > 0 
            ? `Only £${monthlyPayment.toFixed(2)} per month`
            : 'Included';
          showSpreadText = addon.price > 0;
        } else {
          priceDisplay = isIncluded ? 'Included' : `Just £${addon.price} one-time fee`;
        }
              
              return (
                 <div 
                   key={addon.key}
                   onClick={() => !isIncluded && onAddOnChange(addon.key, !selectedAddOns[addon.key])}
                   className={`relative p-4 rounded-lg transition-all duration-200 bg-white ${
                     isIncluded 
                       ? 'border-2 border-green-500 shadow-lg shadow-green-500/30 cursor-default' 
                       : isSelected
                         ? 'border-2 border-orange-500 shadow-lg shadow-orange-500/30 cursor-pointer' 
                         : 'border border-gray-300 shadow-sm hover:shadow-md hover:border-orange-300 hover:bg-gray-50 cursor-pointer'
                   }`}
                 >
                   {/* FREE badge in bottom left for auto-included add-ons */}
                   {isIncluded && (
                     <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                       FREE
                     </div>
                   )}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="text-xl mt-1">{addon.icon}</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base text-foreground mb-1">{addon.title}</h4>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{addon.shortDescription}</p>
                         <div className={`text-base font-bold ${isIncluded ? 'text-green-600' : 'text-black'}`}>
                           {priceDisplay}
                            {showSpreadText && (
                              <div className="text-sm font-normal text-muted-foreground">
                                Spread over 12 interest-free payments for full {paymentType === '12months' ? '1 year' : paymentType === '24months' ? '2 year' : '3 year'} coverage.
                              </div>
                            )}
                         </div>
                      </div>
                    </div>
                    <Checkbox 
                      checked={isSelected}
                      disabled={isIncluded}
                      onCheckedChange={(checked) => !isIncluded && onAddOnChange(addon.key, !!checked)}
                      className={`h-4 w-4 border-2 flex-shrink-0 ${
                        isIncluded 
                          ? 'border-green-500 bg-green-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500'
                          : 'border-black data-[state=checked]:bg-black data-[state=checked]:border-black'
                      }`}
                    />
                  </div>

                  <Collapsible open={expandedItems[addon.key]} onOpenChange={() => toggleExpanded(addon.key)}>
                    <div className="flex justify-end">
                      <CollapsibleTrigger 
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        <span>Read more</span>
                        {expandedItems[addon.key] ? (
                          <ChevronUp className="h-3 w-3" strokeWidth={3} />
                        ) : (
                          <ChevronDown className="h-3 w-3" strokeWidth={3} />
                        )}
                      </CollapsibleTrigger>
                    </div>
                     <CollapsibleContent className="mt-2">
                       <div className="space-y-1">
                         {addon.bulletPoints.map((point, index) => (
                           <div key={index} className="flex items-start gap-2">
                             <Check className="h-3 w-3 text-green-500 mt-1 flex-shrink-0" strokeWidth={3} />
                             <span className="text-sm text-muted-foreground">{point}</span>
                           </div>
                         ))}
                         <div className="mt-3 pt-2 border-t border-gray-200">
                           <p className="text-xs text-muted-foreground italic">
                             Full details available in our Platinum Warranty Plan – see below for more information.
                           </p>
                         </div>
                       </div>
                     </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
      </div>
    </div>
  );
};

export default AddOnProtectionPackages;