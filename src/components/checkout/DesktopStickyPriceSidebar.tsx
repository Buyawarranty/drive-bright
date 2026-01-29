import React from 'react';
import { Check, Lock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DesktopStickyPriceSidebarProps {
  planName: string;
  vehicleReg: string;
  duration: string;
  claimLimit: number;
  labourRate: number;
  excess: number;
  monthlyPrice: number;
  fullPrice: number;
  originalPrice: number;
  selectedPayment: 'monthly' | 'full' | null;
  isLoading: boolean;
  isFormValid: boolean;
  onPayClick: () => void;
  onPaymentChange?: (payment: 'monthly' | 'full') => void;
}

const DesktopStickyPriceSidebar: React.FC<DesktopStickyPriceSidebarProps> = ({
  planName,
  vehicleReg,
  duration,
  claimLimit,
  labourRate,
  excess,
  monthlyPrice,
  fullPrice,
  originalPrice,
  selectedPayment,
  isLoading,
  isFormValid,
  onPayClick,
  onPaymentChange,
}) => {
  // Map claim limit display values
  const displayClaimLimit = () => {
    if (claimLimit === 750) return '£1,000';
    if (claimLimit === 1250) return '£2,000';
    if (claimLimit === 2000) return '£3,000';
    return `£${claimLimit.toLocaleString()}`;
  };

  const savings = originalPrice - fullPrice;

  return (
    <div className="sticky top-4">
      <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#E5E5E5]">
          <h3 className="text-base font-semibold text-[#1a1a1a]">Order Summary</h3>
        </div>

        <div className="p-4 space-y-4">
          {/* Plan Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Plan</span>
              <span className="font-medium text-[#1a1a1a]">Comprehensive</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Vehicle</span>
              <span 
                className="font-mono font-bold text-xs uppercase px-1.5 py-0.5 rounded border border-black"
                style={{ backgroundColor: '#FCD34D' }}
              >
                {vehicleReg}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Duration</span>
              <span className="font-medium text-[#1a1a1a]">{duration}</span>
            </div>
          </div>

          <div className="h-px bg-[#E5E5E5]" />

          {/* Coverage */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Claim limit</span>
              <span className="font-medium text-[#1a1a1a]">{displayClaimLimit()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Labour rate</span>
              <span className="font-medium text-[#1a1a1a]">£{labourRate}/hr</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Excess</span>
              <span className="font-medium text-[#1a1a1a]">£{excess}</span>
            </div>
          </div>

          <div className="h-px bg-[#E5E5E5]" />

          {/* Selected Payment Display - Solid fill with tick */}
          <div className="space-y-2">
            {selectedPayment === 'monthly' && (
              <div className="bg-[#FF6B00] rounded-xl p-3 relative">
                <div className="absolute top-2 right-2 w-5 h-5 bg-[#0BA360] rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Pay Monthly</p>
                  <p className="text-lg font-bold text-white">£{monthlyPrice}/month</p>
                  <p className="text-xs text-white/80 mt-0.5">12 payments · 0% APR</p>
                </div>
              </div>
            )}
            {selectedPayment === 'full' && (
              <div className="bg-[#0BA360] rounded-xl p-3 relative">
                <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-[#0BA360]" strokeWidth={3} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Pay in Full</p>
                  <p className="text-lg font-bold text-white">£{fullPrice}</p>
                  <p className="text-xs text-white/80 mt-0.5">Save £{savings} (10% off)</p>
                </div>
              </div>
            )}
            {!selectedPayment && (
              <div className="bg-gray-50 border border-[#E5E5E5] rounded-xl p-3 text-center">
                <p className="text-sm text-gray-600">Select payment method on left</p>
              </div>
            )}
          </div>

          {/* CTA Button */}
          <Button
            onClick={onPayClick}
            disabled={isLoading || !selectedPayment}
            className="w-full py-5 text-base font-bold rounded-xl transition-all duration-150"
            style={{
              backgroundColor: !selectedPayment 
                ? '#CCCCCC' 
                : selectedPayment === 'monthly'
                  ? '#FF6B00'
                  : '#0BA360',
              color: '#FFFFFF',
            }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Lock className="w-4 h-4" />
                {selectedPayment === 'monthly' 
                  ? `Pay £${monthlyPrice} today` 
                  : selectedPayment === 'full'
                  ? 'Complete one-time payment'
                  : 'Select payment option'}
              </span>
            )}
          </Button>

          {/* Trust Strip */}
          <div className="text-center space-y-2 pt-2">
            <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
              <Lock className="w-3 h-3 text-[#0BA360]" />
              256-bit SSL encryption
            </p>
            <a 
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-xs text-gray-600 hover:text-[#1a1a1a]"
            >
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-[#00B67A] text-[#00B67A]" />
                ))}
              </div>
              <img 
                src="/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png" 
                alt="Trustpilot" 
                className="h-4"
              />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopStickyPriceSidebar;
