import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Check, Info } from 'lucide-react';
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
    shortDescription: 'Protects key mechanical and electrical parts from natural wear.',
    price: 9.99,
    priceType: 'monthly',
    badge: 'Best Value',
    badgeColor: 'green',
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
    price: 4,
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
    shortDescription: 'Comprehensive cover for accidental, malicious, and puncture-related tyre damage.',
    price: 8,
    priceType: 'monthly',
    badge: 'Popular Choice',
    badgeColor: 'orange',
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
    price: 7,
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
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
      {addOnPackages.map((addon) => {
        const isIncluded = isAutoIncluded(addon.key);
        const isSelected = selectedAddOns[addon.key] || isIncluded;
        
        // Calculate price display - always show monthly cost spread over 12 payments
        let priceDisplay;
        let savingsText = '';
        
        if (addon.priceType === 'monthly') {
          const totalCost = addon.price * months;
          const monthlyPayment = totalCost / 12;
          priceDisplay = addon.price > 0 
            ? `£${monthlyPayment.toFixed(2)}`
            : '£0.00';
          
          // Calculate savings for multi-year plans
          if (months > 12 && addon.price > 0) {
            const savings = (addon.price * months) - (monthlyPayment * 12);
            if (savings > 0) {
              savingsText = `Save £${savings.toFixed(0)}`;
            }
          }
        } else {
          priceDisplay = isIncluded ? '£0.00' : `£${addon.price}`;
        }
              
              return (
                   <div 
                   key={addon.key}
                   onClick={() => !isIncluded && onAddOnChange(addon.key, !selectedAddOns[addon.key])}
                   className={`relative rounded-xl border-2 transition-all cursor-pointer hover:shadow-lg ${
                     isSelected
                       ? 'border-green-600 bg-green-50 shadow-md shadow-green-100' 
                       : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-md'
                   }`}
                 >
                   {/* Marketing Badge - Top Left */}
                   {addon.badge && !isIncluded && (
                     <div className={`absolute -top-3 left-4 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-10 ${
                       addon.badgeColor === 'green' ? 'bg-green-600' : 'bg-orange-500'
                     }`}>
                       {addon.badge}
                     </div>
                   )}
                   
                   {/* FREE Badge - Top Left for auto-included */}
                   {isIncluded && (
                     <div className="absolute -top-3 left-4 bg-gray-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-10">
                       🎉 FREE
                     </div>
                   )}
                   
                   {/* Savings Badge - Top Right */}
                   {savingsText && !isIncluded && (
                     <div className="absolute -top-3 right-4 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-10">
                       {savingsText}
                     </div>
                   )}
                   
                   {/* Checkbox/Tick - Top Right Corner */}
                   <div className="absolute top-4 right-4">
                     {isSelected ? (
                       <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center shadow-md">
                         <Check className="w-5 h-5 text-white" strokeWidth={3} />
                       </div>
                     ) : (
                       <div className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center hover:border-green-500 transition-colors">
                       </div>
                     )}
                   </div>
                   
                   <div className="p-6 pt-8">
                     {/* Icon */}
                     <div className="text-4xl mb-4">{addon.icon}</div>
                     
                     {/* Title */}
                     <h4 className="font-bold text-lg text-gray-900 mb-4 pr-8">{addon.title}</h4>
                     
                      {/* Price with improved hierarchy */}
                      <div className="mb-4">
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-sm text-gray-600 font-medium">Only</span>
                          <span className="text-3xl font-bold text-gray-900">{priceDisplay}</span>
                          <span className="text-sm text-gray-600 font-medium">
                            {addon.priceType === 'one-off' ? ' one-off' : '/month'}
                          </span>
                        </div>
                         {!isIncluded && addon.priceType !== 'one-off' && (
                           <div className="space-y-1">
                             <p className="text-sm text-green-600 font-semibold flex items-center gap-1">
                               <Check className="w-4 h-4 text-green-600" />
                               Only 12 payments (0% APR)
                             </p>
                             {paymentType === '24months' && (
                               <p className="text-sm text-green-600 font-semibold flex items-center gap-1">
                                 <Check className="w-4 h-4 text-green-600" />
                                 2-year cover included
                               </p>
                             )}
                             {paymentType === '36months' && (
                               <p className="text-sm text-green-600 font-semibold flex items-center gap-1">
                                 <Check className="w-4 h-4 text-green-600" />
                                 3-year cover included
                               </p>
                             )}
                           </div>
                         )}
                         {!isIncluded && addon.priceType === 'one-off' && (
                           <p className="text-sm text-green-600 font-semibold flex items-center gap-1">
                             <Check className="w-4 h-4 text-green-600" />
                             One-time payment
                           </p>
                         )}
                        {isIncluded && (
                          <span className="text-xs text-green-700 font-semibold">Included in your plan!</span>
                        )}
                     </div>
                     
                     {/* One short benefit */}
                     <p className="text-sm text-gray-600 mb-4 leading-relaxed min-h-[3rem]">
                       {addon.shortDescription.split('.')[0]}.
                     </p>
                     
                      {/* View Details Button */}
                      <Collapsible open={expandedItems[addon.key]} onOpenChange={() => toggleExpanded(addon.key)}>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                            className="w-full justify-between hover:bg-green-50 hover:border-green-600 hover:text-green-700 transition-all px-4 py-3"
                          >
                            <span className="font-medium flex items-center gap-2">
                              <Info className="w-4 h-4 flex-shrink-0" />
                              {expandedItems[addon.key] ? 'Hide Details' : 'Details'}
                            </span>
                            {expandedItems[addon.key] ? (
                              <ChevronUp className="h-4 w-4 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 flex-shrink-0" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                       
                       <CollapsibleContent className="mt-4 pt-4 border-t border-gray-200">
                         <div className="space-y-2.5">
                           {addon.bulletPoints.map((point, index) => (
                             <div key={index} className="flex items-start gap-2.5">
                               <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                 <Check className="h-3 w-3 text-green-700" strokeWidth={3} />
                               </div>
                               <span className="text-sm text-gray-700 leading-relaxed">{point}</span>
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