import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Check, Lock, Car, Calendar, ChevronDown, ChevronUp, Shield } from 'lucide-react';

import { getDisplayClaimLimit } from '@/lib/claimLimitTiers';

interface DesktopOrderSummaryProps {
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
  fullPrice: number;
  savings: number;
  isLoading: boolean;
  onPayClick: () => void;
  onPaymentChange?: (payment: 'monthly' | 'full') => void;
  onChangePlan?: () => void;
  startDate?: Date | null;
  onStartDateChange?: (date: Date) => void;
}

const DesktopGuarantee = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-4 bg-[#F0FDF4] border border-[#C8F3D2] rounded-lg p-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
          <span className="text-xs font-bold text-[#1a1a1a]">14-day money-back guarantee</span>
        </div>
        <div className="flex items-center gap-2">
          {!isExpanded && (
            <span className="text-xs text-gray-500">Full refund if no claim is made.</span>
          )}
          <span className="text-xs font-semibold text-[#0BA360]">
            {isExpanded ? '' : 'See details'}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-[#0BA360] flex-shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#0BA360] flex-shrink-0" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="mt-3">
          <div className="space-y-3 mb-3">
            <div className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-[#0BA360] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#1a1a1a]">Not happy? <span className="font-semibold">Full refund within 14 days</span> — no questions asked, as long as no claim has been made</p>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-[#0BA360] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#1a1a1a]">If a claim has been submitted within 14 days, a <span className="font-semibold">£40 assessment fee</span> applies on cancellation — to cover the cost of processing your claim</p>
            </div>
          </div>
          <div className="border-t border-[#C8F3D2] pt-2">
            <p className="text-xs text-gray-500">After 14 days, unused cover is refundable pro-rata.</p>
          </div>
        </div>
      )}
    </div>
  );
};

const DesktopOrderSummary: React.FC<DesktopOrderSummaryProps> = ({
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
  fullPrice,
  savings,
  isLoading,
  onPayClick,
  onPaymentChange,
  onChangePlan,
  startDate,
  onStartDateChange,
}) => {
  const vehicleTitle = [vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(' ');
  const displayClaimLimit = getDisplayClaimLimit(claimLimit);

  // Calculate months for display
  const months = duration.toLowerCase().includes('2 year') ? 24 
    : duration.toLowerCase().includes('3 year') ? 36 
    : 12;

  const formatStartDate = (date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const formatted = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return isToday ? `Today, ${formatted}` : formatted;
  };

  return (
    <div className="hidden lg:block w-[340px] flex-shrink-0">
      <div className="sticky top-4 pb-24">
        <Card className="border border-border bg-white rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-5">
            {/* Header */}
            <h2 className="text-lg font-bold text-[#1a1a1a] mb-4">Your order summary</h2>
            
            {/* Vehicle & Plan Details Card */}
            <div className="border border-[#E5E5E5] rounded-lg p-4 mb-4">
              {/* Vehicle Header */}
              <div className="flex items-center justify-between mb-3">
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
                {onChangePlan && (
                  <button
                    onClick={onChangePlan}
                    className="text-xs font-semibold text-[#C4841D] hover:text-[#A36A15] transition-colors"
                  >
                    Change plan
                  </button>
                )}
              </div>
              
              <div className="h-px bg-[#E5E5E5] mb-3" />
              
              {/* Spec Table */}
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Cover duration</span>
                  <span className="font-semibold text-[#1a1a1a]">{duration}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Claim limit</span>
                  <span className="font-semibold text-[#1a1a1a]">{displayClaimLimit}</span>
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

            {/* Payment Toggle Tabs */}
            {onPaymentChange && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => onPaymentChange('monthly')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all border-2 ${
                    selectedPayment === 'monthly'
                      ? 'border-[#FF6B00] bg-[#FFF5EB] text-[#FF6B00]'
                      : 'border-[#E5E5E5] bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => onPaymentChange('full')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all border-2 ${
                    selectedPayment === 'full'
                      ? 'border-[#0BA360] bg-[#F0FDF4] text-[#0BA360]'
                      : 'border-[#E5E5E5] bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  Pay in Full
                  <span className="block text-[10px] font-medium mt-0.5">Save £{savings}</span>
                </button>
              </div>
            )}

            {/* Pricing Section */}
            {selectedPayment === 'monthly' ? (
              <div className="mb-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-[#1a1a1a]">First payment today</span>
                  <span className="text-2xl font-bold text-[#1a1a1a]">£{monthlyPrice}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Then £{monthlyPrice}/month × {months - 1} · Total £{totalPrice} · 0% APR
                </p>
              </div>
            ) : selectedPayment === 'full' ? (
              <div className="mb-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-[#1a1a1a]">Total payment today</span>
                  <span className="text-2xl font-bold text-[#1a1a1a]">£{fullPrice}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  One-off payment · <span className="text-[#0BA360] font-medium">Save £{savings}</span>
                </p>
              </div>
            ) : (
              <div className="mb-4 bg-gray-50 border border-[#E5E5E5] rounded-lg p-3 text-center">
                <p className="text-sm text-gray-600">Choose a payment option above</p>
              </div>
            )}

            {/* Cover Start Date */}
            {startDate && (
              <div className="border border-[#FFD7A8] bg-[#FFF8F0] rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#C4841D]" />
                  <div>
                    <p className="text-xs text-[#C4841D] font-medium">Cover start date</p>
                    <p className="text-sm font-bold text-[#1a1a1a]">{formatStartDate(startDate)}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* CTA Button */}
            <Button
              onClick={onPayClick}
              disabled={isLoading || !selectedPayment}
              className="w-full h-12 text-base font-bold rounded-xl text-white animate-breathing"
              style={{ 
                backgroundColor: !selectedPayment 
                  ? '#CCCCCC' 
                  : selectedPayment === 'monthly' 
                    ? '#FF6B00' 
                    : '#0BA360' 
              }}
            >
              <Lock className="w-4 h-4 mr-2" />
              {selectedPayment 
                ? 'Activate my cover'
                : 'Select payment option'}
            </Button>
            
            {/* 14-day guarantee */}
            <DesktopGuarantee />

            {/* SSL + Trustpilot Footer */}
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500 flex items-center justify-center gap-1.5 mb-3">
                <Lock className="w-3 h-3" />
                256-bit SSL secure checkout
              </p>
              <a 
                href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <span>Rated</span>
                <span className="text-[#1a1a1a] font-semibold">"Excellent"</span>
                <span>on</span>
                <img 
                  src="/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png" 
                  alt="Trustpilot" 
                  className="h-4"
                />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DesktopOrderSummary;