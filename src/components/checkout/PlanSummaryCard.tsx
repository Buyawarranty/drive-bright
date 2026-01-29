import React from 'react';
import { Shield, Check, ExternalLink } from 'lucide-react';

interface PlanSummaryCardProps {
  planName: string;
  vehicleReg: string;
  vehicleMake?: string;
  vehicleModel?: string;
  duration: string;
  claimLimit: number;
  labourRate: number;
  excess: number;
  selectedPayment: 'monthly' | 'full' | null;
  monthlyPrice: number;
  totalPrice: number;
  isLoading?: boolean;
  onPaymentChange: (payment: 'monthly' | 'full') => void;
  onPayClick?: () => void;
  onChangePlan: () => void;
}

const PlanSummaryCard: React.FC<PlanSummaryCardProps> = ({
  planName,
  vehicleReg,
  vehicleMake,
  vehicleModel,
  duration,
  claimLimit,
  labourRate,
  excess,
  selectedPayment,
  monthlyPrice,
  totalPrice,
  isLoading = false,
  onPaymentChange,
  onPayClick,
  onChangePlan,
}) => {
  // Map claim limit display values
  const displayClaimLimit = () => {
    if (claimLimit === 750) return '£1,000';
    if (claimLimit === 1250) return '£2,000';
    if (claimLimit === 2000) return '£3,000';
    return `£${claimLimit.toLocaleString()}`;
  };

  const vehicleDisplay = [vehicleMake, vehicleModel].filter(Boolean).join(' ') || vehicleReg;
  const originalPrice = totalPrice;
  const discountedPrice = Math.round(totalPrice * 0.9);
  const savings = originalPrice - discountedPrice;

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden">
      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-[#0BA360] flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-[#1a1a1a]">
              Your comprehensive vehicle plan is ready
            </h2>
          </div>
          <button
            onClick={onChangePlan}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#1a1a1a] border border-[#E5E5E5] rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Change
          </button>
        </div>

        {/* 14-day guarantee banner */}
        <div className="bg-[#F0FDF4] border border-[#C8F3D2] rounded-lg px-4 py-3 mb-5 flex items-center gap-2">
          <Check className="w-5 h-5 text-[#0BA360] flex-shrink-0" />
          <span className="text-sm text-[#1a1a1a]">Cancel anytime within 14 days for a full refund</span>
        </div>

        {/* Order Summary - Combined Details */}
        <div className="space-y-3 mb-5">
          <div className="flex justify-between items-center py-1">
            <span className="text-gray-600">Plan:</span>
            <span className="font-semibold text-[#1a1a1a]">Comprehensive</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-gray-600">Duration:</span>
            <span className="font-semibold text-[#1a1a1a]">{duration}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-gray-600">Vehicle:</span>
            <span className="font-semibold text-[#1a1a1a] uppercase">{vehicleDisplay}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-gray-600">Registration:</span>
            <span 
              className="font-mono font-bold text-xs uppercase px-2 py-1 rounded border-2 border-black tracking-wider"
              style={{ backgroundColor: '#FCD34D' }}
            >
              {vehicleReg}
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-gray-600">Claim Limit:</span>
            <span className="font-semibold text-[#1a1a1a]">{displayClaimLimit()}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-gray-600">Labour Rate:</span>
            <span className="font-semibold text-[#1a1a1a]">£{labourRate}/hour</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-gray-600">Excess:</span>
            <span className="font-semibold text-[#1a1a1a]">£{excess}</span>
          </div>
        </div>

        {/* Payment Options - Solid fill when selected */}
        <div className="space-y-3 pt-4 border-t border-[#E5E5E5]">
          <p className="text-sm font-semibold text-[#1a1a1a] mb-2">Choose payment method:</p>
          
          {/* Monthly Option */}
          <button 
            onClick={() => onPaymentChange('monthly')}
            className={`w-full text-left rounded-xl px-4 py-4 border-2 transition-all relative ${
              selectedPayment === 'monthly' 
                ? 'bg-[#FF6B00] border-[#FF6B00]' 
                : 'bg-white border-[#E5E5E5] hover:border-[#FF6B00]'
            }`}
          >
            {/* Green tick in corner when selected */}
            {selectedPayment === 'monthly' && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-[#0BA360] rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" strokeWidth={3} />
              </div>
            )}
            <div>
              <span className={`font-bold ${selectedPayment === 'monthly' ? 'text-white' : 'text-[#1a1a1a]'}`}>
                Pay Monthly: £{monthlyPrice}/month
              </span>
              <p className={`text-sm mt-0.5 ${selectedPayment === 'monthly' ? 'text-white/90' : 'text-gray-600'}`}>
                Total £{totalPrice} – 0% APR, 12 payments
              </p>
            </div>
          </button>

          {/* Pay in Full Option */}
          <button 
            onClick={() => onPaymentChange('full')}
            className={`w-full text-left rounded-xl px-4 py-4 border-2 relative transition-all ${
              selectedPayment === 'full' 
                ? 'bg-[#0BA360] border-[#0BA360]' 
                : 'bg-white border-[#E5E5E5] hover:border-[#0BA360]'
            }`}
          >
            {/* Green tick in corner when selected */}
            {selectedPayment === 'full' && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-[#0BA360]" strokeWidth={3} />
              </div>
            )}
            {/* Best Value badge - only show when not selected */}
            {selectedPayment !== 'full' && (
              <div className="absolute top-2 right-2">
                <span className="bg-[#0BA360] text-white text-xs font-bold px-2 py-1 rounded">
                  BEST VALUE
                </span>
              </div>
            )}
            <div className="pr-20">
              <span className={`font-bold ${selectedPayment === 'full' ? 'text-white' : 'text-[#1a1a1a]'}`}>
                Pay in Full: £{discountedPrice}
              </span>
              <p className={`text-sm mt-0.5 ${selectedPayment === 'full' ? 'text-white/90' : 'text-gray-600'}`}>
                Save £{savings} (10% off)
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanSummaryCard;
