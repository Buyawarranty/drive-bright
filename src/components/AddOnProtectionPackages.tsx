import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Check, CheckCircle2 } from 'lucide-react';
import { getAutoIncludedAddOns } from '@/lib/addOnsUtils';
import { Button } from '@/components/ui/button';

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
      <div className="grid md:grid-cols-3 gap-4">
      {addOnPackages.map((addon) => {
        const isIncluded = isAutoIncluded(addon.key);
        const isSelected = selectedAddOns[addon.key] || isIncluded;
        
        // Calculate price display - always show monthly cost spread over 12 payments
        let priceDisplay;
        let subPriceText = '';
        
        if (addon.priceType === 'monthly') {
          const totalCost = addon.price * months;
          const monthlyPayment = totalCost / 12;
          priceDisplay = addon.price > 0 
            ? `£${monthlyPayment.toFixed(2)}/month`
            : 'Included';
          subPriceText = addon.price > 0 
            ? `Over 12 interest-free payments for ${paymentType === '12months' ? '1' : paymentType === '24months' ? '2' : '3'} year coverage`
            : '';
        } else {
          priceDisplay = isIncluded ? 'Included' : `£${addon.price}`;
          subPriceText = isIncluded ? '' : 'One-time fee';
        }
              
              return (
                   <div 
                   key={addon.key}
                   onClick={() => !isIncluded && onAddOnChange(addon.key, !selectedAddOns[addon.key])}
                   className={`relative rounded-xl transition-all duration-200 overflow-hidden ${
                     isIncluded 
                       ? 'border-2 border-green-600 shadow-md bg-green-50/50 cursor-default' 
                       : isSelected
                         ? 'border-2 border-green-600 shadow-md bg-green-50/50 cursor-pointer hover:shadow-lg' 
                         : 'border-2 border-gray-200 shadow-sm hover:shadow-md hover:border-green-500 bg-white cursor-pointer'
                   }`}
                 >
                   {/* Selected Checkmark Badge - Top Right */}
                   {isSelected && (
                     <div className="absolute top-3 right-3 bg-green-600 rounded-full p-1 shadow-sm z-10">
                       <CheckCircle2 className="w-5 h-5 text-white" />
                     </div>
                   )}
                   
                   {/* FREE Badge - Only for auto-included */}
                   {isIncluded && (
                     <div className="absolute top-3 left-3 bg-green-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                       FREE
                     </div>
                   )}
                   
                   <div className="p-5">
                     {/* Icon and Title */}
                     <div className="flex items-start gap-3 mb-3">
                       <div className="text-3xl flex-shrink-0">{addon.icon}</div>
                       <div className="flex-1 min-w-0">
                         <h4 className="font-bold text-lg text-gray-900 mb-1 leading-tight">{addon.title}</h4>
                       </div>
                     </div>
                     
                     {/* Short Benefit */}
                     <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px]">
                       {addon.shortDescription}
                     </p>
                     
                     {/* Price - Bold and Prominent */}
                     <div className="mb-4 pb-4 border-b border-gray-200">
                       <div className="text-2xl font-bold text-gray-900">
                         {priceDisplay}
                       </div>
                       {subPriceText && (
                         <div className="text-xs text-gray-500 mt-1">
                           {subPriceText}
                         </div>
                       )}
                     </div>
                     
                     {/* View Details Button */}
                     <Collapsible open={expandedItems[addon.key]} onOpenChange={() => toggleExpanded(addon.key)}>
                       <CollapsibleTrigger 
                         onClick={(e) => e.stopPropagation()}
                         className="w-full"
                       >
                         <Button
                           variant="outline"
                           size="sm"
                           className="w-full justify-between group hover:bg-gray-50 border-gray-300"
                         >
                           <span className="text-sm font-medium">
                             {expandedItems[addon.key] ? 'Hide Details' : 'View Details'}
                           </span>
                           {expandedItems[addon.key] ? (
                             <ChevronUp className="h-4 w-4 text-gray-500 group-hover:text-gray-700" />
                           ) : (
                             <ChevronDown className="h-4 w-4 text-gray-500 group-hover:text-gray-700" />
                           )}
                         </Button>
                       </CollapsibleTrigger>
                       
                       <CollapsibleContent className="mt-3">
                         <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                           {addon.bulletPoints.map((point, index) => (
                             <div key={index} className="flex items-start gap-2">
                               <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                               <span className="text-sm text-gray-700">{point}</span>
                             </div>
                           ))}
                         </div>
                       </CollapsibleContent>
                     </Collapsible>
                   </div>
                 </div>
               );
            })}
      </div>
    </div>
  );
};

export default AddOnProtectionPackages;