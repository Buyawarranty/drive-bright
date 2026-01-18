import React, { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Check, Info } from 'lucide-react';
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
    price: 20,
    priceType: 'monthly',
    bulletPoints: [
      'Covers engine, gearbox, differential and drivetrain components',
      'Includes critical electrical parts like ECUs and alternators',
      'Protection for factory-fitted systems beyond routine maintenance',
      'Covers unexpected mechanical breakdowns not caused by servicing',
      'Guards against premature part failure before expected lifespan'
    ]
  },
  {
    key: 'breakdown',
    icon: '🚗',
    title: '24/7 Vehicle Recovery',
    price: 4,
    priceType: 'monthly',
    bulletPoints: [
      'Use any 24/7 recovery service',
      'Recovery to a garage or location your choice',
      'Hassle-free claims process'
    ]
  },
  {
    key: 'tyre',
    icon: '🛞',
    title: 'Tyre Cover',
    price: 8,
    priceType: 'monthly',
    badge: 'POPULAR',
    badgeColor: 'orange',
    bulletPoints: [
      'Up to £150 per tyre for repair or replacement',
      'Covers accidental and malicious damage',
      'Up to £50 per puncture repair',
      '£30 roadside assistance contribution'
    ]
  },
  {
    key: 'european',
    icon: '🌍',
    title: 'Europe Cover',
    price: 5,
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
    price: 7,
    priceType: 'monthly',
    bulletPoints: [
      'Daily rental allowance',
      'Minimises disruption to daily life',
      'Seamless integration with Platinum claims'
    ]
  },
  {
    key: 'transfer',
    icon: '🔁',
    title: 'Transfer Cover',
    price: 19,
    priceType: 'one-off',
    bulletPoints: [
      'Increases vehicle resale appeal',
      'Email-based transfer process',
      'Transferable to private buyers'
    ]
  }
];

const AddOnProtectionPackages: React.FC<AddOnProtectionPackagesProps> = ({
  selectedAddOns,
  onAddOnChange,
  paymentType
}) => {
  const [expandedItems, setExpandedItems] = useState<{[key: string]: boolean}>({});

  const autoIncludedAddOns = getAutoIncludedAddOns(paymentType);
  const isAutoIncluded = (addonKey: string) => autoIncludedAddOns.includes(addonKey);

  const toggleExpanded = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getMonthsFromPaymentType = (paymentType: string) => {
    switch (paymentType) {
      case '12months': return 12;
      case '24months': return 24;
      case '36months': return 36;
      default: return 12;
    }
  };

  const months = getMonthsFromPaymentType(paymentType);
  const coverYears = months === 12 ? '1-year' : months === 24 ? '2-year' : '3-year';

  const getBadgeClasses = (badgeColor: string) => {
    switch (badgeColor) {
      case 'blue':
        return 'bg-blue-600 text-white';
      case 'orange':
        return 'bg-orange-500 text-white';
      case 'green':
        return 'bg-green-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {addOnPackages.map((addon) => {
        const isIncluded = isAutoIncluded(addon.key);
        const isSelected = selectedAddOns[addon.key] || isIncluded;
        
        // Calculate price display
        let priceText;
        if (addon.priceType === 'monthly') {
          const totalCost = addon.price * months;
          const monthlyPayment = Math.round(totalCost / 12);
          priceText = `+£${monthlyPayment}/month`;
        } else {
          priceText = `+£${addon.price} one-off`;
        }

        // Build the description line
        let descriptionParts: string[] = [];
        if (isIncluded) {
          descriptionParts.push('Included in your plan');
        } else if (addon.priceType === 'monthly') {
          descriptionParts.push('12 payments');
          descriptionParts.push(`${coverYears} cover`);
        } else {
          descriptionParts.push('One-time payment');
        }
        const descriptionText = descriptionParts.join(' · ');

        // Determine badge to show
        const showIncludedBadge = isIncluded;
        const showAddonBadge = addon.badge && !isIncluded;
              
        return (
          <div 
            key={addon.key}
            onClick={() => !isIncluded && onAddOnChange(addon.key, !selectedAddOns[addon.key])}
            className={`relative rounded-lg border-2 transition-all cursor-pointer bg-white pt-4 ${
              isSelected
                ? 'border-orange-500 shadow-lg shadow-orange-500/30' 
                : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
            }`}
          >
            {/* Overlapping badge - positioned to stick out of box */}
            {(showIncludedBadge || showAddonBadge) && (
              <div className="absolute -top-3 left-3">
                {showIncludedBadge ? (
                  <span className="bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded shadow-sm uppercase">
                    INCLUDED FREE
                  </span>
                ) : showAddonBadge ? (
                  <span className={`text-xs font-semibold px-3 py-1 rounded shadow-sm ${getBadgeClasses(addon.badgeColor || 'gray')}`}>
                    {addon.badge}
                  </span>
                ) : null}
              </div>
            )}
            
            {/* Main content area */}
            <div className="p-3 pt-1">
              <div className="flex items-start justify-between gap-3">
                {/* Left side - Title and price info */}
                <div className="flex-1 min-w-0 flex items-start gap-2">
                  <span className="text-xl flex-shrink-0">{addon.icon}</span>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-base">{addon.title}</h4>
                    <p className="text-sm text-gray-600 mt-0.5">
                      <span className="font-bold text-gray-900">{isIncluded ? '£0' : priceText}</span>
                      <span className="mx-1">·</span>
                      {descriptionText}
                    </p>
                  </div>
                </div>
                
                {/* Right side - Checkbox */}
                <div className="flex-shrink-0">
                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300 bg-white" />
                  )}
                </div>
              </div>
            </div>
            
            {/* Expandable details - styled as dropdown box */}
            <Collapsible open={expandedItems[addon.key]}>
              <CollapsibleTrigger asChild>
                <button
                  onClick={(e) => toggleExpanded(addon.key, e)}
                  className="w-full px-4 py-2.5 text-base text-gray-700 hover:text-gray-900 flex items-center justify-between border-t border-gray-100 transition-colors bg-gray-50 hover:bg-gray-100 rounded-b-lg"
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    <span className="font-medium">Details</span>
                  </div>
                  <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${expandedItems[addon.key] ? 'rotate-180' : ''}`} />
                </button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="px-3 pb-3 bg-gray-50 rounded-b-lg">
                <div className="space-y-1.5 pt-2">
                  {addon.bulletPoints.map((point, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" strokeWidth={3} />
                      <span className="text-sm text-black">{point}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
};

export default AddOnProtectionPackages;
