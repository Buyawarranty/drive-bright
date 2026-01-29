import React from 'react';
import { Shield, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  isMobile?: boolean;
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
  isMobile = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(!isMobile);

  // Map claim limit display values
  const displayClaimLimit = () => {
    if (claimLimit === 750) return '£1,000';
    if (claimLimit === 1250) return '£2,000';
    if (claimLimit === 2000) return '£3,000';
    return `£${claimLimit.toLocaleString()}`;
  };

  const vehicleDisplay = [vehicleMake, vehicleModel].filter(Boolean).join(' ') || vehicleReg;

  // Mobile: Collapsible accordion
  if (isMobile) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-[#0BA360] flex-shrink-0" />
                <span className="font-semibold text-[#1a1a1a]">Your Plan Summary</span>
              </div>
              <div className="text-gray-500">
                {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="px-4 pb-4 border-t border-[#E5E5E5] pt-3">
              {/* 14-day guarantee banner */}
              <div className="bg-[#F0FDF4] border border-[#C8F3D2] rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                <span className="text-xs text-[#1a1a1a]">Cancel anytime within 14 days for a full refund</span>
              </div>

              {/* Plan Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Plan:</span>
                  <span className="font-semibold text-[#1a1a1a]">Comprehensive</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-semibold text-[#1a1a1a]">{duration}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Vehicle:</span>
                  <span 
                    className="font-mono font-bold text-xs uppercase px-1.5 py-0.5 rounded border border-black"
                    style={{ backgroundColor: '#FCD34D' }}
                  >
                    {vehicleReg}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Claim Limit:</span>
                  <span className="font-semibold text-[#1a1a1a]">{displayClaimLimit()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Labour Rate:</span>
                  <span className="font-semibold text-[#1a1a1a]">£{labourRate}/hour</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Excess:</span>
                  <span className="font-semibold text-[#1a1a1a]">£{excess}</span>
                </div>
              </div>

              {/* Change Plan Link */}
              <button
                onClick={onChangePlan}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#1a1a1a] mt-3"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Change plan
              </button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  // Desktop: Full card with header
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
        <div className="space-y-3">
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
      </div>
    </div>
  );
};

export default PlanSummaryCard;
