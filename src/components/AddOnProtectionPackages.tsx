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
        
        if (addon.priceType === 'monthly') {
          const totalCost = addon.price * months;
          const monthlyPayment = totalCost / 12;
          priceDisplay = addon.price > 0 
            ? `£${monthlyPayment.toFixed(2)}/month`
            : 'FREE';
        } else {
          priceDisplay = isIncluded ? 'FREE' : `£${addon.price}`;
        }
              
              return (
                   <div 
                   key={addon.key}
                   onClick={() => !isIncluded && onAddOnChange(addon.key, !selectedAddOns[addon.key])}
                   className={`relative rounded-lg border transition-all cursor-pointer ${
                     isSelected
                       ? 'border-green-600 bg-green-50' 
                       : 'border-gray-200 bg-white hover:border-green-400'
                   }`}
                 >
                   {/* FREE Badge - Top Left for auto-included */}
                   {isIncluded && (
                     <div className="absolute top-3 left-3 bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded z-10">
                       FREE
                     </div>
                   )}
                   
                   {/* Simple Checkmark - Top Right */}
                   {isSelected && (
                     <div className="absolute top-4 right-4">
                       <Check className="w-5 h-5 text-green-600" strokeWidth={3} />
                     </div>
                   )}
                   
                   <div className="p-6 pt-10">
                     {/* Icon, Title, and Price in one line */}
                     <div className="flex items-center gap-3 mb-3">
                       <div className="text-2xl">{addon.icon}</div>
                       <div className="flex-1">
                         <h4 className="font-bold text-base text-gray-900">{addon.title}</h4>
                       </div>
                       <div className="text-lg font-bold text-gray-900">
                         {priceDisplay}
                       </div>
                     </div>
                     
                     {/* One line benefit */}
                     <p className="text-sm text-gray-600 mb-4">
                       {addon.shortDescription.split('.')[0]}.
                     </p>
                     
                     {/* Simple View Details Link */}
                     <Collapsible open={expandedItems[addon.key]} onOpenChange={() => toggleExpanded(addon.key)}>
                       <CollapsibleTrigger 
                         onClick={(e) => e.stopPropagation()}
                         className="text-sm text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-1"
                       >
                         {expandedItems[addon.key] ? 'Hide details' : 'View details'}
                         {expandedItems[addon.key] ? (
                           <ChevronUp className="h-3 w-3" />
                         ) : (
                           <ChevronDown className="h-3 w-3" />
                         )}
                       </CollapsibleTrigger>
                       
                       <CollapsibleContent className="mt-3 pt-3 border-t border-gray-200">
                         <div className="space-y-2">
                           {addon.bulletPoints.map((point, index) => (
                             <div key={index} className="flex items-start gap-2">
                               <Check className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                               <span className="text-xs text-gray-600">{point}</span>
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