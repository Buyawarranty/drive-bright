import React from 'react';
import { ArrowRight, Lock, Star } from 'lucide-react';
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
  // Calculate pay in full price (10% discount)
  const payInFullPrice = Math.floor(totalPrice * 0.9);

  // Determine cover duration from freeYearText
  const getCoverDuration = () => {
    if (freeYearText?.includes('2 & 3')) return '3-Year Cover';
    if (freeYearText?.includes('2')) return '2-Year Cover';
    return '1-Year Cover';
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] z-50">
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Main content grid */}
        <div className="flex items-start justify-between gap-4">
          {/* Left: Trustpilot */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-black">Trustpilot</span>
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-green-500 text-green-500" />
                ))}
              </div>
            </div>
          </div>

          {/* Center: Price Summary */}
          <div className="flex-1 text-center space-y-0.5">
            <div className="text-lg font-bold text-foreground">
              £{monthlyPrice}/Month – 0% APR
            </div>
            <p className="text-sm text-muted-foreground">Only 12 payments</p>
            <p className="text-sm text-foreground">
              Pay in full: <span className="font-bold">£{payInFullPrice}</span>
            </p>
          </div>

          {/* Right: Cover details */}
          <div className="text-right space-y-0.5">
            {freeYearText && (
              <p className="text-sm font-medium text-foreground">
                {freeYearText} 🎉
              </p>
            )}
            <p className="text-sm text-muted-foreground">{getCoverDuration()}</p>
            <p className="text-xs text-muted-foreground">14 days to cancel</p>
          </div>
        </div>
        
        {/* CTA Button - Full width */}
        <div className="mt-3">
          <Button
            onClick={onContinue}
            disabled={isLoading || !isValid}
            className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold py-6 rounded-xl text-base gap-2 animate-cta-enhanced"
          >
            {isLoading ? (
              'Loading...'
            ) : (
              <>
                Continue to checkout
                <ArrowRight className="w-5 h-5" strokeWidth={3} />
              </>
            )}
          </Button>
        </div>
        
        {/* Trust signal */}
        <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
          <Lock className="w-3 h-3" />
          <span>Secure checkout – No hidden fees</span>
        </div>
      </div>
    </div>
  );
};

export default StickyFooter;
