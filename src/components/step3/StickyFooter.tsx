import React from 'react';
import { ArrowRight } from 'lucide-react';
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
  onContinue,
  isLoading,
  isValid
}) => {

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] z-50">
      <div className="max-w-4xl mx-auto px-4 py-3">
        {/* Button only - summary text hidden */}
        <Button
          onClick={onContinue}
          disabled={isLoading || !isValid}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 rounded-xl text-base gap-2 animate-cta-enhanced"
        >
          {isLoading ? (
            'Loading...'
          ) : (
            <>
              Continue to Checkout
              <ArrowRight className="w-5 h-5" strokeWidth={3} />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default StickyFooter;
