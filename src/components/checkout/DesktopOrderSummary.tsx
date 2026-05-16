import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Check, Lock, Car, Calendar, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { getDisplayClaimLimit } from '@/lib/claimLimitTiers';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';

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
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4 rounded-xl border border-[#E5E5E5] bg-white p-4">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
        <h3 className="text-sm font-bold text-[#1a1a1a]">Good to know</h3>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2.5 mt-3">
        {/* Cover starts today */}
        <div className="flex items-start gap-3 rounded-lg bg-[#E8F6EF] border border-[#B8E2CE] px-4 py-3">
          <span className="flex-shrink-0 mt-2 w-2 h-2 rounded-full bg-[#0BA360]" />
          <p className="text-sm text-[#1a1a1a] leading-relaxed">
            <strong>Cover starts today.</strong> Your vehicle is protected from the moment payment is confirmed.
          </p>
        </div>

        {/* 14-day cooling-off period */}
        <div className="flex items-start gap-3 rounded-lg bg-[#E8F6EF] border border-[#B8E2CE] px-4 py-3">
          <span className="flex-shrink-0 mt-2 w-2 h-2 rounded-full bg-[#0BA360]" />
          <p className="text-sm text-[#1a1a1a] leading-relaxed">
            <strong>14-day cooling-off period.</strong> Refund minus days covered and a £40 processing fee if no claim made.
          </p>
        </div>

        {/* Using your cover */}
        <div className="flex items-start gap-3 rounded-lg bg-[#FFF5EB] border border-[#FFD9A8] px-4 py-3">
          <span className="flex-shrink-0 mt-2 w-2 h-2 rounded-full bg-[#FF6B00]" />
          <p className="text-sm text-[#1a1a1a] leading-relaxed">
            <strong>Using your cover.</strong> Your warranty runs for its full term, giving you continuous protection throughout. Please note that once a claim has been made, your policy is no longer eligible for a refund.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const DesktopDeclaration = () => {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4 rounded-xl border border-[#E5E5E5] bg-white">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-left px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#0BA360]" />
          <h3 className="text-sm font-bold text-[#1a1a1a]">About your cover</h3>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-3">
        <p className="text-xs text-[#1a1a1a] leading-relaxed">
          You're protected as soon as your payment is confirmed.
        </p>
        <div>
          <h4 className="text-xs font-bold text-[#1a1a1a] mb-1">How claims work</h4>
          <p className="text-xs text-[#1a1a1a] leading-relaxed">
            Claims can be made after your first 14 days of cover.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
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

  // Per-day pricing - MUST derive from monthlyPrice * 12 (actual paid) for consistency with Step 3
  const totalCoverDays = Math.round((months / 12) * 365);
  const monthlyPaidTotal = monthlyPrice * 12;
  const monthlyPencePerDay = monthlyPaidTotal > 0 && totalCoverDays > 0 ? Math.round((monthlyPaidTotal * 100) / totalCoverDays) : 0;
  const fullPencePerDay = fullPrice > 0 && totalCoverDays > 0 ? Math.round((fullPrice * 100) / totalCoverDays) : 0;

  const formatStartDate = (date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const formatted = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return isToday ? `Today, ${formatted}` : formatted;
  };

  const [summaryOpen, setSummaryOpen] = useState(true);

  return (
    <div className="hidden lg:block w-[340px] flex-shrink-0">
      <div className="sticky top-4 pb-24">
        <Card className="border border-border bg-white rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-5">
            <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-[#1a1a1a]">Your order summary</h2>
                {summaryOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
              </CollapsibleTrigger>
              <CollapsibleContent>
            
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
                      : 'border-[#FFE0C4] bg-[#FFF8F3] text-[#FF6B00] hover:border-[#FF6B00]'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => onPaymentChange('full')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all border-2 ${
                    selectedPayment === 'full'
                      ? 'border-[#0BA360] bg-[#F0FDF4] text-[#0BA360]'
                      : 'border-[#B8E2CE] bg-[#F0FAF4] text-[#0BA360] hover:border-[#0BA360]'
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
                <span className="block text-sm font-bold text-[#1a1a1a]">First payment today</span>
                <div className="text-2xl font-bold text-[#1a1a1a] leading-none mt-1">
                  £{monthlyPrice}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Equal to {monthlyPencePerDay >= 100 ? `£${(monthlyPencePerDay / 100).toFixed(2)}` : `${monthlyPencePerDay}p`}/day over term
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  £{monthlyPrice}/month × 12 payments · Paid over 12 months · Covers {months} months · 0% APR
                </p>
              </div>
            ) : selectedPayment === 'full' ? (
              <div className="mb-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-[#1a1a1a]">Total payment today</span>
                  <span className="text-2xl font-bold text-[#1a1a1a]">£{fullPrice}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Equal to {fullPencePerDay >= 100 ? `£${(fullPencePerDay / 100).toFixed(2)}` : `${fullPencePerDay}p`}/day over term · <span className="text-[#0BA360] font-medium">Save £{savings}</span>
                </p>
              </div>
            ) : (
              <div className="mb-4 bg-gray-50 border border-[#E5E5E5] rounded-lg p-3 text-center">
                <p className="text-sm text-gray-600">Choose a payment option above</p>
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
            
            {/* Declaration - expandable */}
            <DesktopDeclaration />

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
                className="inline-flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <span>Rated</span>
                <span className="text-[#1a1a1a] font-semibold">"Excellent"</span>
                <img src={trustpilotLogo} alt="Trustpilot" className="h-4 w-auto" loading="lazy" />
              </a>
            </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DesktopOrderSummary;