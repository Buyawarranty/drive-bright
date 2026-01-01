import React from 'react';
import { Check } from 'lucide-react';

interface MileageQuickSelectProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const MileageQuickSelect: React.FC<MileageQuickSelectProps> = ({ value, onChange, error }) => {
  const isUnder120k = value === 'under120k';
  const isOver120k = value === 'over120k';
  
  return (
    <div className="space-y-3">
      {/* Headline */}
      <p className="text-sm sm:text-base font-semibold text-gray-800">
        What's your approximate mileage?
      </p>
      
      {/* Quick Select Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange('under120k')}
          className={`flex-1 py-3 px-4 rounded-lg border-2 font-semibold text-sm sm:text-base transition-all ${
            isUnder120k
              ? 'border-brand-orange bg-brand-orange/10 text-brand-orange shadow-[0_0_10px_rgba(249,115,22,0.4)]'
              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {isUnder120k && <Check className="w-4 h-4" />}
            Under 120,000 miles
          </span>
        </button>
        
        <button
          type="button"
          onClick={() => onChange('over120k')}
          className={`flex-1 py-3 px-4 rounded-lg border-2 font-semibold text-sm sm:text-base transition-all ${
            isOver120k
              ? 'border-brand-orange bg-brand-orange/10 text-brand-orange shadow-[0_0_10px_rgba(249,115,22,0.4)]'
              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {isOver120k && <Check className="w-4 h-4" />}
            Over 120,000 miles
          </span>
        </button>
      </div>
      
      {/* Microcopy */}
      <p className="text-xs sm:text-sm text-gray-500 text-left">
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
