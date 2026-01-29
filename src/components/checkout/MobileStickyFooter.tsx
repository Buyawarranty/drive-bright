import React from 'react';
import { Lock, Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileStickyFooterProps {
  selectedPayment: 'monthly' | 'full' | null;
  monthlyPrice: number;
  fullPrice: number;
  originalPrice?: number;
  isLoading: boolean;
  isFormValid: boolean;
  onPayClick: () => void;
  onPaymentChange?: (payment: 'monthly' | 'full') => void;
}

const MobileStickyFooter: React.FC<MobileStickyFooterProps> = ({
  selectedPayment,
  monthlyPrice,
  fullPrice,
  originalPrice,
  isLoading,
  isFormValid,
  onPayClick,
  onPaymentChange,
}) => {
  const savings = (originalPrice || fullPrice * 1.1) - fullPrice;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E5E5] lg:hidden">
      <div className="px-4 py-3">
        {/* Selected Payment Display */}
        <div className="mb-3">
          {selectedPayment === 'monthly' && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-[#1a1a1a]">£{monthlyPrice}/month</p>
                <p className="text-xs text-gray-600">12 payments · 0% APR</p>
              </div>
              <div className="flex items-center gap-1 text-[#0BA360]">
                <Check className="w-4 h-4" />
                <span className="text-xs font-medium">Monthly</span>
              </div>
            </div>
          )}
          {selectedPayment === 'full' && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-[#1a1a1a]">£{fullPrice}</p>
                <p className="text-xs font-medium text-[#0BA360]">Save £{Math.floor(savings)} (10% off)</p>
              </div>
              <div className="flex items-center gap-1 text-[#0BA360]">
                <Check className="w-4 h-4" />
                <span className="text-xs font-medium">Pay in Full</span>
              </div>
            </div>
          )}
          {!selectedPayment && (
            <p className="text-sm text-gray-600 text-center">Select payment method above</p>
          )}
        </div>

        {/* CTA Button */}
        <Button
          onClick={onPayClick}
          disabled={isLoading || !selectedPayment}
          className="w-full py-5 text-base font-bold rounded-xl"
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
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
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
        <div className="flex items-center justify-center gap-3 mt-2 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-[#0BA360]" />
            256-bit SSL
          </span>
          <span>•</span>
          <a 
            href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1"
          >
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-2.5 h-2.5 fill-[#00B67A] text-[#00B67A]" />
              ))}
            </div>
            <img 
              src="/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png" 
              alt="Trustpilot" 
              className="h-3"
            />
          </a>
        </div>
      </div>
    </div>
  );
};

export default MobileStickyFooter;
