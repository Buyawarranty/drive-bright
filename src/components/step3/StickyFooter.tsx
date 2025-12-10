import React from 'react';
import { ArrowRight, Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StickyFooterProps {
  monthlyPrice: number;
  totalPrice: number;
  freeYearText?: string;
  onContinue: () => void;
  isLoading: boolean;
  isValid: boolean;
}

const StickyFooter: React.FC<StickyFooterProps> = ({
  monthlyPrice,
  totalPrice,
  freeYearText,
  onContinue,
  isLoading,
  isValid
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl border-t border-border shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-50">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Price Summary */}
          <div className="space-y-0.5">
            <div className="text-xl font-bold text-foreground">
              £{monthlyPrice}/Month – 0% APR
            </div>
            <p className="text-xs text-muted-foreground">Only 12 payments</p>
            <p className="text-xs text-muted-foreground">Total: £{totalPrice}</p>
            {freeYearText && (
              <p className="text-xs text-muted-foreground">{freeYearText}</p>
            )}
          </div>
          
          {/* CTA Button */}
          <Button
            onClick={onContinue}
            disabled={isLoading || !isValid}
            className="bg-success hover:bg-success/90 text-success-foreground font-semibold px-6 py-6 rounded-xl text-base gap-2 animate-cta-enhanced"
          >
            {isLoading ? (
              'Loading...'
            ) : (
              <>
                Continue to Checkout
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>
        </div>
        
        {/* Trust signals */}
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Secure checkout</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            <span>14-day money-back</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickyFooter;
