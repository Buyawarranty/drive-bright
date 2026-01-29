import React from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileStickyFooterProps {
  selectedPayment: 'monthly' | 'full' | null;
  monthlyPrice: number;
  fullPrice: number;
  isLoading: boolean;
  isFormValid: boolean;
  onPayClick: () => void;
}

const MobileStickyFooter: React.FC<MobileStickyFooterProps> = ({
  selectedPayment,
  monthlyPrice,
  fullPrice,
  isLoading,
  isFormValid,
  onPayClick,
}) => {
  // Determine button text based on selection
  const getButtonText = () => {
    if (isLoading) return 'Processing...';
    if (selectedPayment === 'monthly') return `Pay £${monthlyPrice} today`;
    if (selectedPayment === 'full') return 'Complete one-time payment';
    return 'Select payment option';
  };

  // Determine button color based on selection
  const getButtonColor = () => {
    if (!selectedPayment) return '#CCCCCC';
    if (selectedPayment === 'monthly') return '#FF6B00';
    return '#28A745';
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] lg:hidden">
      <div className="px-4 py-3">
        {/* Price and CTA Row */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: Price Info */}
          <div className="flex-1 min-w-0">
            {selectedPayment === 'monthly' && (
              <div>
                <p className="text-lg font-bold text-foreground">£{monthlyPrice}/month</p>
                <p className="text-xs text-muted-foreground">12 payments · 0% APR</p>
              </div>
            )}
            {selectedPayment === 'full' && (
              <div>
                <p className="text-lg font-bold text-foreground">£{fullPrice}</p>
                <p className="text-xs text-green-600 font-medium">Save 10% today</p>
              </div>
            )}
            {!selectedPayment && (
              <p className="text-sm text-muted-foreground">Select payment above</p>
            )}
          </div>

          {/* Right: CTA Button */}
          <Button
            onClick={onPayClick}
            disabled={isLoading || !selectedPayment}
            className="px-5 py-5 text-sm font-bold rounded-xl shadow-md flex-shrink-0"
            style={{
              backgroundColor: getButtonColor(),
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
