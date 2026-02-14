import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Calendar, CheckCircle2, Car, Gauge, Wrench, PoundSterling, FileText } from 'lucide-react';
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';

interface OrderSummaryProps {
  plan?: string;
  paymentType?: string;
  warrantyStartDate?: string;
  duration?: string;
  monthlyPrice?: number;
  totalPrice?: number;
  originalPrice?: number;
  // Additional order details
  vehicle?: string;
  vehicleReg?: string;
  mileage?: string;
  claimLimit?: number;
  labourRate?: number;
  excess?: number;
  addons?: string; // JSON string of protection add-ons
  paidInFull?: boolean;
  warrantyNumber?: string;
  source?: string; // 'stripe' or 'bumper'
}

// Check if a string looks like a UUID
const isUUID = (str: string | undefined | null): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  plan,
  paymentType,
  warrantyStartDate,
  duration,
  monthlyPrice,
  totalPrice,
  originalPrice,
  vehicle,
  vehicleReg,
  mileage,
  claimLimit,
  labourRate,
  excess,
  addons,
  paidInFull,
  warrantyNumber,
  source
}) => {
  const formatDate = (date: string | undefined): string => {
    if (!date) {
      const today = new Date();
      return today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Parse duration - BULLETPROOF parsing
  const getDurationDisplay = () => {
    const durationValue = duration || paymentType || '';
    const lower = durationValue.toString().toLowerCase().trim();
    
    console.log('[ORDER-SUMMARY] Duration parsing:', { duration, paymentType, durationValue, lower });
    
    // Empty check - default to 1 Year only as last resort
    if (!lower) {
      console.warn('[ORDER-SUMMARY] No duration value provided');
      return '1 Year';
    }
    
    // Direct number checks (24, 36, etc.)
    if (lower === '24' || lower === '2') return '2 Years';
    if (lower === '36' || lower === '3') return '3 Years';
    if (lower === '48' || lower === '4') return '4 Years';
    if (lower === '60' || lower === '5') return '5 Years';
    if (lower === '12' || lower === '1') return '1 Year';
    
    // Month-based formats (24months, 36months, etc.) - check these BEFORE 12
    if (lower.includes('24') || lower.includes('two')) return '2 Years';
    if (lower.includes('36') || lower.includes('three')) return '3 Years';
    if (lower.includes('48') || lower.includes('four')) return '4 Years';
    if (lower.includes('60') || lower.includes('five')) return '5 Years';
    if (lower.includes('12') || lower.includes('one')) return '1 Year';
    
    // Handle 'yearly', 'monthly', 'annual' and similar
    if (lower.includes('yearly') || lower.includes('annual') || lower.includes('monthly')) return '1 Year';
    
    // Final fallback - use utility function for any remaining cases
    const months = getWarrantyDurationInMonths(durationValue);
    console.log('[ORDER-SUMMARY] Using utility function, months:', months);
    if (months >= 36) return '3 Years';
    if (months >= 24) return '2 Years';
    if (months >= 12) return '1 Year';
    
    console.warn('[ORDER-SUMMARY] Could not parse duration, defaulting to 1 Year:', durationValue);
    return '1 Year';
  };

  const hasSavings = originalPrice && totalPrice && originalPrice > totalPrice;
  const savings = hasSavings ? originalPrice - totalPrice : 0;

  // Parse add-ons from JSON string
  const parsedAddons = React.useMemo(() => {
    if (!addons) return {};
    try {
      return JSON.parse(addons);
    } catch {
      return {};
    }
  }, [addons]);

  // Get list of included add-ons
  const includedAddons = React.useMemo(() => {
    const addonLabels: Record<string, string> = {
      breakdown_recovery: '24/7 Vehicle Recovery',
      breakdownRecovery: '24/7 Vehicle Recovery',
      vehicle_rental: 'Vehicle Rental',
      vehicleRental: 'Vehicle Rental',
      europe_cover: 'European Cover',
      europeCover: 'European Cover',
      tyre_cover: 'Tyre Cover',
      tyreCover: 'Tyre Cover',
      wear_tear: 'Wear & Tear',
      wearTear: 'Wear & Tear',
      transfer_cover: 'Transfer Cover',
      transferCover: 'Transfer Cover',
      lost_key: 'Lost Key Cover',
      lostKey: 'Lost Key Cover',
      consequential: 'Consequential Damage',
      mot_repair: 'MOT Repair Cover',
      motRepair: 'MOT Repair Cover',
    };

    return Object.entries(parsedAddons)
      .filter(([key, value]) => value === true && addonLabels[key])
      .map(([key]) => addonLabels[key]);
  }, [parsedAddons]);

  // Determine payment method display based on source
  const paymentMethodDisplay = source === 'bumper' ? 'Paid via Bumper (0% APR)' : 
    (paidInFull ? 'Paid in Full' : 'Paid Monthly');

  // Format labour rate display
  const getLabourRateLabel = (rate: number) => {
    if (rate <= 40) return 'Local Garages';
    if (rate <= 50) return 'Independent Garages';
    if (rate <= 70) return 'Approved Garages';
    return 'Expert Garages';
  };

  return (
    <Card className="border border-border shadow-sm bg-background">
      <CardContent className="p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
            <Shield className="w-6 h-6 text-green-600" />
          </div>
          Order Summary
        </h2>
        
        <div className="space-y-4">
          {/* Warranty Reference Number - Prominent Display */}
          {warrantyNumber && (
            <div className="bg-green-50 rounded-lg p-4 border border-green-200 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Your Warranty Reference Number</p>
              <p className="text-xl font-bold text-foreground font-mono">{warrantyNumber}</p>
            </div>
          )}
          
          {/* Plan Details Grid */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Plan</p>
              <p className="font-semibold text-foreground">{isUUID(plan) ? 'Platinum' : (plan || 'Platinum')}</p>
            </div>
            {vehicle && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Vehicle</p>
                <p className="font-semibold text-foreground">{vehicle}</p>
              </div>
            )}
            {mileage && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Mileage</p>
                <p className="font-semibold text-foreground">{mileage} miles</p>
              </div>
            )}
            {claimLimit && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Claim Limit</p>
                <p className="font-semibold text-foreground">£{claimLimit.toLocaleString()}</p>
              </div>
            )}
            {labourRate && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Labour Rate</p>
                <p className="font-semibold text-foreground">£{labourRate}/hour</p>
              </div>
            )}
            {excess !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Excess</p>
                <p className="font-semibold text-foreground">£{excess}</p>
              </div>
            )}
            {vehicleReg && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Registration</p>
                <p className="font-semibold text-foreground uppercase">{vehicleReg}</p>
              </div>
            )}
          </div>

          {/* Payment Section */}
          {totalPrice && (
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <PoundSterling className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-foreground">{paymentMethodDisplay}</span>
                </div>
                <div className="text-right">
                  {hasSavings && (
                    <p className="text-sm text-muted-foreground line-through">£{originalPrice}</p>
                  )}
                  <p className="text-2xl font-bold text-foreground">£{totalPrice}</p>
                </div>
              </div>
              
              {monthlyPrice && source === 'bumper' && (
                <p className="text-sm text-muted-foreground">
                  12 payments of £{monthlyPrice.toFixed(2)}/month
                </p>
              )}

              {hasSavings && (
                <div className="mt-2 pt-2 border-t border-green-200">
                  <p className="text-sm font-semibold text-green-600">
                    💰 You Saved £{savings}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Included Protection Add-ons */}
          {includedAddons.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                Included Protection
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {includedAddons.map((addon, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-foreground">{addon}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Warranty Start Date */}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <Calendar className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Warranty Start Date</p>
              <p className="font-semibold text-foreground">
                {formatDate(warrantyStartDate)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
