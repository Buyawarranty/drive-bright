import React, { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Check } from 'lucide-react';
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
    price: 9,
    priceType: 'monthly',
    badge: 'Best Value',
    badgeColor: 'green',
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
      'Hassle-free claims process',
      'Claim limits apply'
    ]
  },
  {
    key: 'tyre',
    icon: '🛞',
    title: 'Tyre Cover',
    price: 8,
    priceType: 'monthly',
    badge: 'Popular',
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

  return (
    <div className="space-y-2">
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
              
        return (
          <div 
            key={addon.key}
            onClick={() => !isIncluded && onAddOnChange(addon.key, !selectedAddOns[addon.key])}
            className={`relative rounded-lg border-2 transition-all cursor-pointer bg-white ${
              isSelected
                ? 'border-orange-500 shadow-lg shadow-orange-500/30' 
                : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
            }`}
          >
            {/* Top badges row */}
            <div className="flex items-center gap-2 px-3 pt-2">
              {isIncluded && (
                <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                  INCLUDED FREE
                </span>
              )}
              {addon.badge && !isIncluded && (
                <span className={`text-white text-xs font-bold px-2 py-0.5 rounded ${
                  addon.badgeColor === 'green' ? 'bg-green-600' : 'bg-orange-500'
                }`}>
                  {addon.badge}
                </span>
              )}
            </div>
            
            {/* Main content area */}
            <div className="p-3 pt-1">
              <div className="flex items-center justify-between gap-3">
                {/* Left side - Title and price info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{addon.icon}</span>
                    <h4 className="font-semibold text-gray-900 text-sm">{addon.title}</h4>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    <span className="font-bold text-gray-900">{isIncluded ? '£0' : priceText}</span>
                    <span className="mx-1">·</span>
                    {descriptionText}
                  </p>
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
            
            {/* Expandable details */}
            <Collapsible open={expandedItems[addon.key]}>
              <CollapsibleTrigger asChild>
                <button
                  onClick={(e) => toggleExpanded(addon.key, e)}
                  className="w-full px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1 border-t border-gray-100 transition-colors"
                >
                  <span>{expandedItems[addon.key] ? 'Hide details' : 'Details'}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${expandedItems[addon.key] ? 'rotate-180' : ''}`} />
                </button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="px-3 pb-3">
                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  {addon.bulletPoints.map((point, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Check className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" strokeWidth={3} />
                      <span className="text-xs text-gray-600">{point}</span>
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
