import React from 'react';
import { ArrowRight, Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StickyFooterProps {
  monthlyPrice: number;
  onContinue: () => void;
  isLoading: boolean;
  isValid: boolean;
}

const StickyFooter: React.FC<StickyFooterProps> = ({
  monthlyPrice,
  onContinue,
  isLoading,
  isValid
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Price Summary */}
          <div className="space-y-0.5">
            <div className="text-2xl font-bold text-foreground">
              £{monthlyPrice}/month
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Only 12 payments (0% APR)</span>
            </div>
            <div className="text-sm font-semibold text-foreground">
              Total: £{monthlyPrice * 12}
            </div>
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
