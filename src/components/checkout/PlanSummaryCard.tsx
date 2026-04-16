import React from 'react';
import { Car, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getDisplayClaimLimit } from '@/lib/claimLimitTiers';

interface PlanSummaryCardProps {
  planName: string;
  vehicleReg: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
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
  startDate?: Date | null;
}

const PlanSummaryCard: React.FC<PlanSummaryCardProps> = ({
  planName,
  vehicleReg,
  vehicleMake,
  vehicleModel,
  vehicleYear,
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
  startDate,
}) => {
  const [isOpen, setIsOpen] = React.useState(true);
  const vehicleTitle = [vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(' ');
  const displayClaimLimitText = getDisplayClaimLimit(claimLimit);

  const months = duration.toLowerCase().includes('2 year') ? 24 
    : duration.toLowerCase().includes('3 year') ? 36 
    : 12;

  const formatStartDate = (date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const formatted = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return isToday ? `Today, ${formatted}` : formatted;
  };

  // Mobile: Collapsible accordion
  if (isMobile) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1a1a1a]">Your order summary</span>
              </div>
              <div className="text-gray-500">
                {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="px-4 pb-4 border-t border-[#E5E5E5] pt-3">
              {/* Vehicle & Plan Details Card */}
              <div className="border border-[#E5E5E5] rounded-lg p-3 mb-3">
                {/* Vehicle Header */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-gray-500" />
                    <span className="font-semibold text-[#1a1a1a] text-sm">
                      {vehicleTitle || vehicleReg}
                    </span>
                    <span 
                      className="font-mono font-bold text-[10px] uppercase px-1.5 py-0.5 rounded border border-black tracking-wider"
                      style={{ backgroundColor: '#FCD34D' }}
                    >
                      {vehicleReg}
                    </span>
                  </div>
                  <button
                    onClick={onChangePlan}
                    className="text-xs font-semibold text-[#C4841D] hover:text-[#A36A15] transition-colors"
                  >
                    Change plan
                  </button>
                </div>
                
                <div className="h-px bg-[#E5E5E5] mb-2.5" />
                
                {/* Spec Table */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Cover duration</span>
                    <span className="font-semibold text-[#1a1a1a]">{duration}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Claim limit</span>
                    <span className="font-semibold text-[#1a1a1a]">{displayClaimLimitText}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Your excess</span>
                    <span className="font-semibold text-[#1a1a1a]">£{excess} per claim</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Labour rate</span>
                    <span className="font-semibold text-[#1a1a1a]">Up to £{labourRate}/hr</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Parts covered</span>
                    <span className="font-semibold text-[#1a1a1a]">Comprehensive cover</span>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              {selectedPayment === 'monthly' && (
                <div className="mb-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-bold text-[#1a1a1a]">First payment today</span>
                    <span className="text-xl font-bold text-[#1a1a1a]">£{monthlyPrice}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Then £{monthlyPrice}/month × {months - 1} · Total £{totalPrice} · 0% APR
                  </p>
                </div>
              )}

              {/* Cover Start Date */}
              {startDate && (
                <div className="border border-[#FFD7A8] bg-[#FFF8F0] rounded-lg px-3 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#C4841D] flex-shrink-0" />
                    <div>
                      <p className="text-xs text-[#C4841D] font-medium">Cover start date</p>
                      <p className="text-sm font-bold text-[#1a1a1a]">{formatStartDate(startDate)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => document.getElementById('start-date-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="text-xs font-semibold text-[#C4841D] hover:text-[#A06A15] underline underline-offset-2 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  // Desktop: Full card (fallback, main desktop uses DesktopOrderSummary)
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden">
      <div className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-[#1a1a1a] mb-4">Your order summary</h2>
        
        <div className="border border-[#E5E5E5] rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-[#1a1a1a] text-sm">{vehicleTitle || vehicleReg}</span>
            </div>
            <button onClick={onChangePlan} className="text-xs font-semibold text-[#C4841D]">Change plan</button>
          </div>
          <div className="h-px bg-[#E5E5E5] mb-3" />
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Cover duration</span><span className="font-semibold text-[#1a1a1a]">{duration}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Claim limit</span><span className="font-semibold text-[#1a1a1a]">{displayClaimLimitText}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Your excess</span><span className="font-semibold text-[#1a1a1a]">£{excess} per claim</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Labour rate</span><span className="font-semibold text-[#1a1a1a]">Up to £{labourRate}/hr</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Parts covered</span><span className="font-semibold text-[#1a1a1a]">Comprehensive cover</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanSummaryCard;