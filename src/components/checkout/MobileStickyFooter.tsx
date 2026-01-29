import React, { useState } from 'react';
import { Lock, ArrowRight, Check, ChevronUp, ChevronDown } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);
  const savings = (originalPrice || fullPrice * 1.1) - fullPrice;

  // Determine button text based on selection
  const getButtonText = () => {
    if (isLoading) return 'Processing...';
    if (selectedPayment === 'monthly') return `Pay £${monthlyPrice} today`;
    if (selectedPayment === 'full') return `Pay £${fullPrice} now`;
    return 'Select payment option';
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#DADADA] shadow-[0_-4px_20px_rgba(0,0,0,0.1)] lg:hidden">
      <div className="px-4 py-3">
        {/* Expand/Collapse for payment options */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between mb-3"
        >
          <span className="text-sm font-medium text-[#1a1a1a]">
            {selectedPayment === 'monthly' ? 'Pay Monthly selected' : selectedPayment === 'full' ? 'Pay in Full selected' : 'Choose payment method'}
          </span>
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </button>

        {/* Payment Options - Expanded */}
        {expanded && (
          <div className="space-y-2 mb-3">
            {/* Pay Monthly Option */}
            <button
              type="button"
              onClick={() => onPaymentChange?.('monthly')}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-150 ${
                selectedPayment === 'monthly'
                  ? 'bg-[#1a1a1a] border-[#1a1a1a]'
                  : 'bg-[#FFF8F5] border-[#FFD9BF]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-semibold ${selectedPayment === 'monthly' ? 'text-white' : 'text-[#1a1a1a]'}`}>
                    Pay Monthly: £{monthlyPrice}/month
                  </p>
                  <p className={`text-xs mt-0.5 ${selectedPayment === 'monthly' ? 'text-white/70' : 'text-[#1a1a1a]'}`}>
                    Total £{originalPrice || monthlyPrice * 12} – 0% APR, 12 payments
                  </p>
                </div>
                {selectedPayment === 'monthly' && (
                  <Check className="w-5 h-5 text-white flex-shrink-0" />
                )}
              </div>
            </button>

            {/* Pay in Full Option */}
            <button
              type="button"
              onClick={() => onPaymentChange?.('full')}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-150 ${
                selectedPayment === 'full'
                  ? 'bg-[#1a1a1a] border-[#1a1a1a]'
                  : 'bg-[#F0FDF4] border-[#C8F3D2]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-semibold ${selectedPayment === 'full' ? 'text-white' : 'text-[#1a1a1a]'}`}>
                    Pay in Full: £{fullPrice}
                  </p>
                  <p className={`text-xs mt-0.5 ${selectedPayment === 'full' ? 'text-white/70' : 'text-[#1a1a1a]'}`}>
                    Save £{Math.floor(savings)} (10% off)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span 
                    className="text-xs font-bold px-2 py-0.5 rounded"
                    style={{ backgroundColor: '#0BA360', color: '#FFFFFF' }}
                  >
                    BEST VALUE
                  </span>
                  {selectedPayment === 'full' && (
                    <Check className="w-5 h-5 text-white flex-shrink-0" />
                  )}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Price and CTA Row */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: Price Info */}
          <div className="flex-1 min-w-0">
            {selectedPayment === 'monthly' && (
              <div>
                <p className="text-lg font-bold text-foreground">£{monthlyPrice}/month</p>
                <p className="text-xs text-[#1a1a1a]">12 payments · 0% APR</p>
              </div>
            )}
            {selectedPayment === 'full' && (
              <div>
                <p className="text-lg font-bold text-foreground">£{fullPrice}</p>
                <p className="text-xs font-medium" style={{ color: '#0BA360' }}>Save 10% today</p>
              </div>
            )}
            {!selectedPayment && (
              <p className="text-sm text-[#1a1a1a]">Select payment above</p>
            )}
          </div>

          {/* Right: CTA Button - Black when selected */}
          <Button
            onClick={onPayClick}
            disabled={isLoading || !selectedPayment}
            className="px-5 py-5 text-sm font-bold rounded-xl flex-shrink-0"
            style={{
              backgroundColor: !selectedPayment ? '#CCCCCC' : '#1a1a1a',
              color: !selectedPayment ? '#666666' : '#FFFFFF',
              boxShadow: 'none',
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
                {getButtonText()}
              </span>
            )}
          </Button>
        </div>

        {/* Trust line */}
        <p className="text-center text-xs text-muted-foreground mt-2">
          🔒 Secure checkout · 14-day money-back guarantee
        </p>
      </div>
    </div>
  );
};

export default MobileStickyFooter;
