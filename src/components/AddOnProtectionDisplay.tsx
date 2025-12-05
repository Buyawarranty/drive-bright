import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';
import { getAutoIncludedAddOns } from '@/lib/addOnsUtils';
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';

interface AddOnProtectionDisplayProps {
  mot_fee?: boolean;
  tyre_cover?: boolean;
  wear_tear?: boolean;
  europe_cover?: boolean;
  transfer_cover?: boolean;
  breakdown_recovery?: boolean;
  vehicle_rental?: boolean;
  mot_repair?: boolean;
  lost_key?: boolean;
  consequential?: boolean;
  claim_limit?: number;
  voluntary_excess?: number;
  payment_type?: string;
  className?: string;
}

const AddOnProtectionDisplay: React.FC<AddOnProtectionDisplayProps> = ({
  mot_fee,
  tyre_cover,
  wear_tear,
  europe_cover,
  transfer_cover,
  breakdown_recovery,
  vehicle_rental,
  mot_repair,
  lost_key,
  consequential,
  claim_limit,
  voluntary_excess,
  payment_type = '12months',
  className = ''
}) => {
  // Get auto-included add-ons based on payment type
  const autoIncludedAddOnKeys = getAutoIncludedAddOns(payment_type);
  
  // Calculate duration text based on payment type
  const getDurationText = () => {
    const months = getWarrantyDurationInMonths(payment_type);
    const years = Math.floor(months / 12);
    return years === 1 ? '1 Year' : `${years} Year${years > 1 ? 's' : ''}`;
  };
  
  const durationText = getDurationText();
  
  // Map component keys to utility keys for consistency
  const keyMapping: { [key: string]: string } = {
    'mot_fee': 'motFee',
    'tyre_cover': 'tyre',
    'wear_tear': 'wearAndTear',
    'europe_cover': 'european',
    'transfer_cover': 'transfer',
    'breakdown_recovery': 'breakdown',
    'vehicle_rental': 'rental',
    'mot_repair': 'motRepair',
    'lost_key': 'lostKey',
    'consequential': 'consequential'
  };
  
  const addOnItems = [
    { 
      key: 'tyre_cover', 
      label: 'Tyre Cover', 
      value: tyre_cover, 
      icon: '🛞',
      description: 'Protection for tyres'
    },
    { 
      key: 'wear_tear', 
      label: 'Wear & Tear Cover', 
      value: wear_tear, 
      icon: '🛠️',
      description: 'Covers general wear and tear components'
    },
    { 
      key: 'europe_cover', 
      label: 'European Breakdown Cover', 
      value: europe_cover, 
      icon: '🇪🇺',
      description: 'Breakdown assistance across Europe'
    },
    { 
      key: 'transfer_cover', 
      label: 'Warranty Transfer Cover', 
      value: transfer_cover, 
      icon: '🔁',
      description: 'Transfer warranty to new owner'
    },
    { 
      key: 'breakdown_recovery', 
      label: 'Vehicle Recovery Service', 
      value: breakdown_recovery, 
      icon: '🚗',
      description: 'Recovery claimback'
    },
    { 
      key: 'vehicle_rental', 
      label: 'Hire Car Provision', 
      value: vehicle_rental, 
      icon: '🚙',
      description: 'Replacement vehicle during repairs'
    },
    { 
      key: 'mot_repair', 
      label: 'MOT Failure Repair Cover', 
      value: mot_repair, 
      icon: '🔧',
      description: 'Covers repairs needed for MOT failure'
    },
    { 
      key: 'lost_key', 
      label: 'Lost Key Cover', 
      value: lost_key, 
      icon: '🗝️',
      description: 'Replacement of lost or stolen keys'
    },
    { 
      key: 'consequential', 
      label: 'Consequential Loss Cover', 
      value: consequential, 
      icon: '⚠️',
      description: 'Additional costs from covered breakdowns'
    }
  ];

  // Filter for active add-ons: either explicitly purchased OR auto-included
  const activeAddOns = addOnItems.filter(item => {
    const mappedKey = keyMapping[item.key] || item.key;
    const isAutoIncluded = autoIncludedAddOnKeys.includes(mappedKey);
    return item.value || isAutoIncluded; // Show if purchased OR auto-included
  });

  // Don't render anything if there are no add-ons
  if (activeAddOns.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardContent className="space-y-4 pt-6">
        {/* Add-On Protection Packages */}
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-green-700 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Add-On Protection Packages
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {activeAddOns.map((item) => {
              const mappedKey = keyMapping[item.key] || item.key;
              const isAutoIncluded = autoIncludedAddOnKeys.includes(mappedKey);
              const statusLabel = isAutoIncluded ? 'FREE' : 'PAID';
              const statusColor = isAutoIncluded 
                ? 'bg-green-100 text-green-800 border-green-200' 
                : 'bg-blue-100 text-blue-800 border-blue-200';
              
              return (
                <div 
                  key={item.key} 
                  className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-lg">{item.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium text-green-900">{item.label} - {durationText}</div>
                      <div className="text-xs text-green-700 mt-1">{item.description}</div>
                    </div>
                  </div>
                  <Badge className={`text-xs font-semibold ${statusColor} border`}>
                    {statusLabel}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AddOnProtectionDisplay;