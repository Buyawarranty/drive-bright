import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';

interface CoverageDetailsProps {
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
  payment_type?: string;
}

const CoverageDetailsDisplay: React.FC<CoverageDetailsProps> = ({
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
  payment_type = '12months'
}) => {
  // Determine which add-ons are auto-included based on payment type
  const getAutoIncludedAddOns = (paymentType: string): string[] => {
    const normalizedType = paymentType?.toLowerCase().replace(/[^a-z0-9]/g, '') || '12months';
    
    const mapping: { [key: string]: string } = {
      '12months': '12months',
      'monthly': '12months',
      '1year': '12months',
      'yearly': '12months',
      '24months': '24months',
      '2year': '24months',
      'twoyearly': '24months',
      '36months': '36months',
      '3year': '36months',
      'threeyearly': '36months'
    };
    
    const normalizedPaymentType = mapping[normalizedType] || '12months';
    
    switch (normalizedPaymentType) {
      case '24months':
        return ['breakdown_recovery', 'mot_fee'];
      case '36months':
        return ['breakdown_recovery', 'mot_fee', 'vehicle_rental', 'tyre_cover'];
      default:
        return [];
    }
  };

  const autoIncluded = getAutoIncludedAddOns(payment_type);
  
  const coverageItems = [
    { label: 'MOT Test Fee', value: mot_fee, key: 'mot_fee', icon: '🔧' },
    { label: 'Tyre Cover', value: tyre_cover, key: 'tyre_cover', icon: '🛞' },
    { label: 'Wear & Tear', value: wear_tear, key: 'wear_tear', icon: '🛠️' },
    { label: 'European Cover', value: europe_cover, key: 'europe_cover', icon: '🇪🇺' },
    { label: 'Transfer Cover', value: transfer_cover, key: 'transfer_cover', icon: '🔁' },
    { label: 'Vehicle Recovery', value: breakdown_recovery, key: 'breakdown_recovery', icon: '🚗' },
    { label: 'Hire Car', value: vehicle_rental, key: 'vehicle_rental', icon: '🚙' },
    { label: 'MOT Repair', value: mot_repair, key: 'mot_repair', icon: '🔧' },
    { label: 'Lost Key Cover', value: lost_key, key: 'lost_key', icon: '🗝️' },
    { label: 'Consequential Loss', value: consequential, key: 'consequential', icon: '⚠️' }
  ].filter(item => item.value); // Only show items that are actually selected/purchased

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">Coverage Details</h4>
      {claim_limit && (
        <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-orange-800">Claim Limit</span>
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              £{claim_limit.toLocaleString()}
            </Badge>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {coverageItems.map((item) => {
          const isAutoIncluded = autoIncluded.includes(item.key);
          const statusLabel = isAutoIncluded ? 'FREE' : 'PAID';
          const statusColor = isAutoIncluded ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
          
          return (
            <div key={item.label} className="flex items-center justify-between p-3 bg-muted/30 rounded-md border">
              <span className="text-sm flex items-center gap-2 font-medium">
                <CheckCircle className="h-4 w-4 text-green-600" />
                {item.label}
              </span>
              <Badge className={`text-xs font-semibold ${statusColor} border-0`}>
                {statusLabel}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CoverageDetailsDisplay;