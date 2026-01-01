import React, { useState } from 'react';
import { Check, Zap, ChevronRight, ArrowRight } from 'lucide-react';
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
      
      {/* Radio Options */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
        <label
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => handleSelect('under120k')}
        >
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            isUnder120k 
              ? 'border-brand-orange bg-brand-orange' 
              : 'border-gray-400 group-hover:border-brand-orange'
          }`}>
            {isUnder120k && <span className="w-2.5 h-2.5 bg-white rounded-full" />}
          </span>
          <span className={`text-sm sm:text-base font-bold transition-colors ${
            isUnder120k ? 'text-gray-900' : 'text-gray-700 group-hover:text-gray-900'
          }`}>
            Under 120,000 miles
          </span>
        </label>
        
        <label
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => handleSelect('over120k')}
        >
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            isOver120k 
              ? 'border-brand-orange bg-brand-orange' 
              : 'border-gray-400 group-hover:border-brand-orange'
          }`}>
            {isOver120k && <span className="w-2.5 h-2.5 bg-white rounded-full" />}
          </span>
          <span className={`text-sm sm:text-base font-bold transition-colors ${
            isOver120k ? 'text-gray-900' : 'text-gray-700 group-hover:text-gray-900'
          }`}>
            Over 120,000 miles
          </span>
        </label>
      </div>
      
      {/* Microcopy */}
      <p className="text-sm text-gray-500">
        Don't worry, we'll confirm your exact mileage later.
      </p>

      {/* Get Quote CTA Button */}
      <Button
        onClick={handleGetQuote}
        disabled={!isRegValid || !hasSelection}
        className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-bold py-4 sm:py-5 text-base sm:text-lg rounded-xl shadow-lg transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <span className="flex items-center justify-center gap-2">
          Get my instant quote
          <ArrowRight className="w-5 h-5" />
        </span>
      </Button>
      
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
