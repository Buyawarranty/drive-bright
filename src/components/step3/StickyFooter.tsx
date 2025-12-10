import React, { useState } from 'react';
import { ArrowRight, Lock, Star, ChevronUp, ChevronDown } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(true);
  
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
      <div className="max-w-4xl mx-auto px-4 py-3">
        {/* Expanded view - price summary with CTA (default) */}
        {isExpanded && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 text-center space-y-0.5">
                <div className="text-lg font-bold text-foreground">
                  £{monthlyPrice}/Month <span className="text-sm text-muted-foreground font-normal">– 0% APR</span>
                </div>
                <p className="text-sm text-muted-foreground">Only 12 payments</p>
                <p className="text-sm text-foreground">
                  Pay in full: <span className="font-bold">£{payInFullPrice}</span>
                </p>
              </div>
              <button 
                onClick={() => setIsExpanded(false)}
                className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0"
              >
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              </button>
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
          </>
        )}

        {/* Collapsed view - compact */}
        {!isExpanded && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 text-center">
              <div className="text-lg font-bold text-foreground">
                £{monthlyPrice}/Month <span className="text-sm text-muted-foreground font-normal">– 0% APR</span>
              </div>
            </div>
            <button 
              onClick={() => setIsExpanded(true)}
              className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0"
            >
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StickyFooter;
