import React from 'react';
import { Lock, Shield, Clock } from 'lucide-react';
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
  const savings = (originalPrice || fullPrice * 1.11) - fullPrice;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E5E5] lg:hidden">
      <div className="px-4 py-2">
        {/* Trust Signals Row */}
        <div className="flex items-center justify-center gap-3 mb-1.5 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-[#0BA360]" />
            256-bit encryption
          </span>
          <a 
            href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:opacity-80"
          >
            <img 
              src="/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png" 
              alt="Trustpilot" 
              className="h-4 object-contain"
            />
            <span className="underline underline-offset-2">Rated Excellent</span>
          </a>
        </div>

        {/* CTA Button */}
        <Button
          onClick={onPayClick}
          disabled={isLoading || !selectedPayment}
          className="w-full py-5 text-base font-bold rounded-xl animate-breathing"
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
                ? `Pay £${fullPrice} now`
                : 'Select payment option'}
            </span>
          )}
        </Button>

        {/* Trust Strip */}
        <div className="flex items-center justify-center gap-2 mt-1.5 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-[#0BA360]" />
            Instant cover
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#0BA360]" />
            14-day refund
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-[#0BA360]" />
            Secure
          </span>
        </div>
      </div>
    </div>
  );
};

export default MobileStickyFooter;
