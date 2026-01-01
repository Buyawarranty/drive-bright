import React, { useState } from 'react';
import { Check, Zap } from 'lucide-react';

interface MileageQuickSelectProps {
  value: string;
  onChange: (value: string) => void;
  onAutoSubmit?: () => void;
  error?: string;
  isLoading?: boolean;
}

const MileageQuickSelect: React.FC<MileageQuickSelectProps> = ({ 
  value, 
  onChange, 
  onAutoSubmit,
  error,
  isLoading = false 
}) => {
  const [showLoadingMessage, setShowLoadingMessage] = useState(false);
  const isUnder120k = value === 'under120k';
  const isOver120k = value === 'over120k';
  
  const handleSelect = (selection: string) => {
    onChange(selection);
    
    if (onAutoSubmit) {
      setShowLoadingMessage(true);
      setTimeout(() => {
        onAutoSubmit();
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
      <p className="text-base sm:text-lg font-bold text-gray-900">
        What's your approximate mileage?
      </p>
      
      {/* Quick Select Buttons - Light grey with orange border, solid orange when selected */}
      <div className="flex gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => handleSelect('under120k')}
          className={`flex-1 py-4 sm:py-5 px-4 sm:px-6 rounded-xl border-2 font-bold text-sm sm:text-base transition-all duration-200 transform ${
            isUnder120k
              ? 'border-brand-orange bg-brand-orange text-white shadow-[0_0_20px_rgba(249,115,22,0.5)] scale-[1.02]'
              : 'border-brand-orange/60 bg-gray-100 text-gray-700 hover:border-brand-orange hover:bg-brand-orange/10 hover:text-brand-orange hover:shadow-[0_0_15px_rgba(249,115,22,0.3)] hover:scale-[1.02]'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {isUnder120k && <Check className="w-5 h-5" strokeWidth={3} />}
            Under 120,000 miles
          </span>
        </button>
        
        <button
          type="button"
          onClick={() => handleSelect('over120k')}
          className={`flex-1 py-4 sm:py-5 px-4 sm:px-6 rounded-xl border-2 font-bold text-sm sm:text-base transition-all duration-200 transform ${
            isOver120k
              ? 'border-brand-orange bg-brand-orange text-white shadow-[0_0_20px_rgba(249,115,22,0.5)] scale-[1.02]'
              : 'border-brand-orange/60 bg-gray-100 text-gray-700 hover:border-brand-orange hover:bg-brand-orange/10 hover:text-brand-orange hover:shadow-[0_0_15px_rgba(249,115,22,0.3)] hover:scale-[1.02]'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {isOver120k && <Check className="w-5 h-5" strokeWidth={3} />}
            Over 120,000 miles
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
