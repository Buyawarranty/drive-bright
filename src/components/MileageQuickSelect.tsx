import React, { useState } from 'react';
import { Check, Zap, ChevronRight, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MileageQuickSelectProps {
  value: string;
  onChange: (value: string) => void;
  onAutoSubmit?: (mileageValue: string) => void;
  error?: string;
  isLoading?: boolean;
  isRegValid?: boolean;
}

const MileageQuickSelect: React.FC<MileageQuickSelectProps> = ({ 
  value, 
  onChange, 
  onAutoSubmit,
  error,
  isLoading = false,
  isRegValid = false
}) => {
  const [showLoadingMessage, setShowLoadingMessage] = useState(false);
  const isUnder120k = value === 'under120k';
  const isOver120k = value === 'over120k';
  const hasSelection = isUnder120k || isOver120k;
  
  const handleSelect = (selection: string) => {
    onChange(selection);
  };

  const handleGetQuote = () => {
    if (onAutoSubmit && hasSelection) {
      setShowLoadingMessage(true);
      const mileageValue = value === 'under120k' ? '100000' : '130000';
      setTimeout(() => {
        onAutoSubmit(mileageValue);
      }, 800);
    }
  };

  // Show loading message state
  if (showLoadingMessage || isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-3 py-6 px-4 rounded-xl bg-gradient-to-r from-brand-orange/10 to-brand-orange/5 border-2 border-brand-orange/30">
          <Zap className="w-5 h-5 text-brand-orange animate-pulse" />
          <span className="text-base sm:text-lg font-semibold text-brand-orange">
            Preparing your instant price…
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {/* Headline */}
      <p className="text-base sm:text-lg font-semibold text-gray-800">
        What's your approximate mileage?
      </p>
      
      {/* Card-Style Radio Options */}
      <div className="flex flex-col sm:flex-row gap-3">
        <label
          className={`relative flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
            isUnder120k 
              ? 'border-brand-orange bg-brand-orange/10' 
              : 'border-gray-300 bg-white hover:border-gray-400'
          }`}
          onClick={() => handleSelect('under120k')}
        >
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
            isUnder120k 
              ? 'border-brand-orange bg-brand-orange' 
              : 'border-gray-400'
          }`}>
            {isUnder120k && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </span>
          <span className={`text-sm sm:text-base font-bold ${
            isUnder120k ? 'text-gray-900' : 'text-gray-700'
          }`}>
            Under 120,000 miles
          </span>
        </label>
        
        <label
          className={`relative flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
            isOver120k 
              ? 'border-brand-orange bg-brand-orange/10' 
              : 'border-gray-300 bg-white hover:border-gray-400'
          }`}
          onClick={() => handleSelect('over120k')}
        >
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
            isOver120k 
              ? 'border-brand-orange bg-brand-orange' 
              : 'border-gray-400'
          }`}>
            {isOver120k && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </span>
          <span className={`text-sm sm:text-base font-bold ${
            isOver120k ? 'text-gray-900' : 'text-gray-700'
          }`}>
            Over 120,000 miles
          </span>
        </label>
      </div>

      {/* Get Quote CTA Button */}
      <Button
        onClick={handleGetQuote}
        disabled={!isRegValid || !hasSelection}
        className="w-full bg-brand-orange hover:bg-orange-700 text-white font-bold py-6 sm:py-8 text-lg sm:text-xl rounded-xl shadow-lg transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 animate-cta-enhanced"
      >
        <span className="flex items-center justify-center gap-3">
          Get my instant quote
          <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={3} />
        </span>
      </Button>
      
      {/* Microcopy */}
      <p className="text-sm text-gray-500 text-center">
        Don't worry, we'll confirm your exact mileage later.
      </p>
      
      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 font-medium text-left bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
};

export default MileageQuickSelect;
