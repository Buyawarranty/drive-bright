import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Check, Lock, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface DesktopOrderSummaryProps {
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
  fullPrice: number;
  savings: number;
  isLoading: boolean;
  onPayClick: () => void;
}

const DesktopGuarantee = () => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between bg-[#F0FDF4] border border-[#C8F3D2] rounded-lg px-3 py-2 text-left transition-all hover:bg-[#E8FAF0]"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
          <span className="text-xs font-bold text-[#1a1a1a]">14-day money-back guarantee</span>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
      </button>
      {expanded && (
        <div className="mt-2 border border-[#E5E5E5] rounded-lg p-3 text-xs animate-fade-in">
          <p className="text-gray-600 mb-2">Enjoy full flexibility when you start your cover:</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-[#0BA360] flex-shrink-0 mt-0.5" />
              <p className="text-[#1a1a1a]">Cancel within 14 days for a <span className="font-semibold">full refund</span> if no claim has been made</p>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-[#0BA360] flex-shrink-0 mt-0.5" />
              <p className="text-[#1a1a1a]">If a claim is made within 14 days, a small <span className="font-semibold">£40 handling fee</span> plus any assessment costs</p>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-[#0BA360] flex-shrink-0 mt-0.5" />
              <p className="text-[#1a1a1a]">After 14 days, any refunds are <span className="font-semibold">pro-rated</span> based on time remaining</p>
            </div>
          </div>
          <p className="text-gray-500 mt-2">Designed to keep things fair for everyone.</p>
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
}) => {
  const vehicleDisplay = [vehicleMake, vehicleModel].filter(Boolean).join(' ') || vehicleReg;

  return (
    <div className="hidden lg:block w-[340px] flex-shrink-0">
      <div className="sticky top-4 pb-24">
        <Card className="border border-border bg-white rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-5">
            {/* Header */}
            <h2 className="text-lg sm:text-xl font-bold text-[#1a1a1a] mb-4">Order Summary</h2>
            
            {/* Plan Description */}
            <p className="text-sm text-gray-600 mb-4">
              Comprehensive cover for your{' '}
              <span className="font-semibold text-[#1a1a1a]">{vehicleDisplay.toUpperCase()}</span>
            </p>
            
            <div className="h-px bg-border mb-4" />
            
            {/* Dynamic Payment Section based on selection */}
            {selectedPayment === 'monthly' ? (
              <>
                {/* Monthly Payment Summary */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600">Today's payment:</p>
                  <p className="text-3xl font-bold text-[#1a1a1a]">£{monthlyPrice}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Then £{monthlyPrice}/month • 12 payments • 0% APR
                  </p>
                </div>
              </>
            ) : selectedPayment === 'full' ? (
              <>
                {/* Pay in Full Summary */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600">Today's payment:</p>
                  <p className="text-3xl font-bold text-[#1a1a1a]">£{fullPrice}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    One-off payment • <span className="text-[#0BA360] font-medium">Save £{savings} (10% off)</span>
                  </p>
                </div>
              </>
            ) : (
              <div className="mb-4 bg-gray-50 border border-[#E5E5E5] rounded-lg p-3 text-center">
                <p className="text-sm text-gray-600">Select payment method on left</p>
              </div>
            )}
            
            {/* Cover Highlights */}
            <div className="space-y-2.5 mb-5">
              <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                <span>Complete mechanical & electrical cover</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                <span>Easy claims, fast payout</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                <span>Use any VAT-registered garage</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                <span>UK-based claims team</span>
              </div>
            </div>
            
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
              {selectedPayment === 'monthly' 
                ? `Pay £${monthlyPrice} today`
                : selectedPayment === 'full'
                ? `Pay £${fullPrice} now`
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
                <span className="text-[#00B67A] font-semibold">"Excellent"</span>
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
