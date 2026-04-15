import React from 'react';
import { Lock, Shield, Clock, Check } from 'lucide-react';
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
  minimised?: boolean;
  trustStripOnly?: boolean;
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
  minimised = false,
  trustStripOnly = false,
}) => {
  // Hide completely when inline CTA is visible, UNLESS we're at the bottom (trustStripOnly)
  if (minimised && !trustStripOnly) {
    return null;
  }

  // Trust strip only mode — show just the trust messaging, no CTA
  if (trustStripOnly) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E5E5] lg:hidden transition-all duration-300">
        <div className="px-4 py-2.5 pb-[env(safe-area-inset-bottom,8px)]">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#0BA360]" />
              Easy Claims
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#0BA360]" />
              Secure
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#0BA360]" />
              Instant Activation
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E5E5] lg:hidden transition-all duration-300">
      <div className="px-4 py-2">
        {/* CTA Button */}
        <Button
          onClick={onPayClick}
          disabled={isLoading || !selectedPayment}
          aria-label={
            selectedPayment
              ? 'Activate my cover'
              : 'Select payment option'
          }
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
              {selectedPayment 
                ? 'Activate my cover'
                : 'Select payment option'}
            </span>
          )}
        </Button>

        {/* Trust Strip */}
        <div className="flex items-center justify-center gap-2 mt-1.5 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-[#0BA360]" />
            Easy Claims
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-[#0BA360]" />
            Secure
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#0BA360]" />
            Instant Activation
          </span>
        </div>
      </div>
    </div>
  );
};

export default MobileStickyFooter;
