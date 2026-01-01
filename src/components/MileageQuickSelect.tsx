import React, { useState } from 'react';
import { Check, Zap, ChevronRight } from 'lucide-react';

interface MileageQuickSelectProps {
  value: string;
  onChange: (value: string) => void;
  onAutoSubmit?: (mileageValue: string) => void; // Now passes the mileage value
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
  
  const handleSelect = (selection: string) => {
    onChange(selection);
    
    // Only auto-submit if reg is valid
    if (onAutoSubmit && isRegValid) {
      setShowLoadingMessage(true);
      // Pass the selection value directly to avoid state timing issues
      const mileageValue = selection === 'under120k' ? '100000' : '130000';
      setTimeout(() => {
        onAutoSubmit(mileageValue);
      }, 800);
    }
  };

  // Show loading message state - only when reg is valid and we're submitting
  if ((showLoadingMessage && isRegValid) || isLoading) {
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
      <p className="text-base sm:text-lg font-bold text-gray-900">
        What's your approximate mileage?
      </p>
      
      {/* Quick Select Buttons */}
      <div className="flex gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => handleSelect('under120k')}
          className={`relative overflow-visible flex-1 py-4 sm:py-5 px-4 sm:px-6 rounded-xl border-2 font-bold text-sm sm:text-base transition-all duration-200 transform ${
            isUnder120k
              ? 'border-brand-orange bg-brand-orange text-white scale-[1.02]'
              : 'border-gray-300 bg-white text-gray-600 hover:border-brand-orange hover:bg-brand-orange hover:text-white hover:scale-[1.02]'
          }`}
        >
          {isUnder120k && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md z-10">
              <Check className="w-4 h-4 text-white" strokeWidth={3} />
            </span>
          )}
          <span className="flex items-center justify-center gap-2">
            Under 120,000 miles
            <ChevronRight className={`w-5 h-5 ${isUnder120k ? 'text-white' : 'text-gray-400'}`} />
          </span>
        </button>
        
        <button
          type="button"
          onClick={() => handleSelect('over120k')}
          className={`relative overflow-visible flex-1 py-4 sm:py-5 px-4 sm:px-6 rounded-xl border-2 font-bold text-sm sm:text-base transition-all duration-200 transform ${
            isOver120k
              ? 'border-brand-orange bg-brand-orange text-white scale-[1.02]'
              : 'border-gray-300 bg-white text-gray-600 hover:border-brand-orange hover:bg-brand-orange hover:text-white hover:scale-[1.02]'
          }`}
        >
          {isOver120k && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md z-10">
              <Check className="w-4 h-4 text-white" strokeWidth={3} />
            </span>
          )}
          <span className="flex items-center justify-center gap-2">
            Over 120,000 miles
            <ChevronRight className={`w-5 h-5 ${isOver120k ? 'text-white' : 'text-gray-400'}`} />
          </span>
        </button>
      </div>
      
      {/* Microcopy - larger size */}
      <p className="text-sm sm:text-base text-gray-500 text-left">
        Don't worry, we'll confirm your exact mileage later.
      </p>
      
      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive font-medium text-left">
          {error}
        </p>
      )}
    </div>
  );
};

export default MileageQuickSelect;
