import React from 'react';
import { Lock, Shield, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DesktopStickyBottomBarProps {
  selectedPayment: 'monthly' | 'full' | null;
  monthlyPrice: number;
  fullPrice: number;
  isLoading: boolean;
  isFormValid: boolean;
  onPayClick: () => void;
  isVisible: boolean;
}

const DesktopStickyBottomBar: React.FC<DesktopStickyBottomBarProps> = ({
  selectedPayment,
  monthlyPrice,
  fullPrice,
  isLoading,
  isFormValid,
  onPayClick,
  isVisible,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E5E5] hidden lg:block">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between gap-6">
          {/* Left: Payment summary */}
          <div className="flex items-center gap-4">
            {selectedPayment === 'monthly' ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Pay Monthly:</span>
                <span className="text-xl font-bold text-[#1a1a1a]">£{monthlyPrice}/mo</span>
                <span className="text-xs text-gray-500">× 12 months</span>
              </div>
            ) : selectedPayment === 'full' ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Pay in Full:</span>
                <span className="text-xl font-bold text-[#1a1a1a]">£{fullPrice}</span>
                <span className="text-xs text-[#0BA360] font-medium">10% savings</span>
              </div>
            ) : (
              <span className="text-sm text-gray-600">Select a payment option above</span>
            )}
          </div>

          {/* Center: Trust signals */}
          <div className="hidden xl:flex items-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-[#0BA360]" />
              Instant cover
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#0BA360]" />
              14-day refund
            </span>
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-[#0BA360]" />
              Secure payment
            </span>
            <a 
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:opacity-80"
            >
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-[#00B67A] text-[#00B67A]" />
                ))}
              </div>
              <span>Trustpilot</span>
            </a>
          </div>

          {/* Right: CTA Button */}
          <Button
            onClick={onPayClick}
            disabled={isLoading || !selectedPayment}
            className="px-8 py-5 text-base font-bold rounded-xl animate-breathing whitespace-nowrap"
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
                {selectedPayment 
                  ? 'Activate my cover'
                  : 'Select payment option'}
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DesktopStickyBottomBar;
