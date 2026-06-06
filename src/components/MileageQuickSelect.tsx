import React, { useState, useEffect, useRef } from 'react';
import { Check, Zap, ChevronRight, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MileageQuickSelectProps {
  value: string;
  onChange: (value: string) => void;
  onAutoSubmit?: (mileageValue: string) => void;
  error?: string;
  isLoading?: boolean;
  isRegValid?: boolean;
  autoScrollOnValid?: boolean;
}

const MileageQuickSelect: React.FC<MileageQuickSelectProps> = ({ 
  value, 
  onChange, 
  onAutoSubmit,
  error,
  isLoading = false,
  isRegValid = false,
  autoScrollOnValid = false
}) => {
  const [showLoadingMessage, setShowLoadingMessage] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [helperMessage, setHelperMessage] = useState('');
  const [pulseMileage, setPulseMileage] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mileageRowRef = useRef<HTMLDivElement>(null);
  const prevRegValid = useRef(isRegValid);
  const isUnder120k = value === 'under120k';
  const isOver120k = value === 'over120k';
  const hasSelection = isUnder120k || isOver120k;
  
  // Auto-scroll and highlight when reg becomes valid
  useEffect(() => {
    if (autoScrollOnValid && isRegValid && !prevRegValid.current && !hasSelection) {
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlight(true);
        setTimeout(() => setHighlight(false), 2400);
      }, 200);
    }
    prevRegValid.current = isRegValid;
  }, [isRegValid, autoScrollOnValid, hasSelection]);

  // Reset loading message when isLoading prop changes to false (e.g., after error)
  useEffect(() => {
    if (!isLoading) {
      setShowLoadingMessage(false);
    }
  }, [isLoading]);

  // Also reset loading message when there's an error
  useEffect(() => {
    if (error) {
      setShowLoadingMessage(false);
    }
  }, [error]);
  
  const handleSelect = (selection: string) => {
    onChange(selection);
  };

  const focusRegInput = () => {
    if (typeof document === 'undefined') return;
    const regInput = document.querySelector<HTMLInputElement>('input.bg-yellow-400');
    if (regInput) {
      regInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => regInput.focus({ preventScroll: true }), 250);
      const plate = regInput.closest('div.border-2') as HTMLElement | null;
      if (plate) {
        plate.classList.add('ring-4', 'ring-brand-orange/60', 'animate-pulse');
        setTimeout(() => {
          plate.classList.remove('ring-4', 'ring-brand-orange/60', 'animate-pulse');
        }, 2200);
      }
    }
  };

  const handleGetQuote = () => {
    if (!isRegValid) {
      setHelperMessage('Enter your registration number to continue.');
      focusRegInput();
      return;
    }
    if (!hasSelection) {
      setHelperMessage('Select your approximate mileage to continue.');
      setPulseMileage(true);
      mileageRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setPulseMileage(false), 2200);
      return;
    }
    setHelperMessage('');
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
    <div
      ref={containerRef}
      className={`space-y-3 transition-all duration-500 rounded-xl ${
        highlight
          ? 'bg-brand-orange/5 p-3 -m-3'
          : ''
      }`}
    >
      {/* Headline */}
      <p className="text-base sm:text-lg font-semibold text-gray-800">
        What's your approximate mileage?
      </p>
      
      {/* Card-Style Radio Options */}
      <div ref={mileageRowRef} className={`flex flex-col sm:flex-row gap-3 transition-all rounded-xl ${pulseMileage ? 'ring-4 ring-brand-orange/60 animate-pulse' : ''}`}>
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
      
      {/* Eligibility note */}
      <p className="text-sm text-gray-500 text-center">
        Vehicles up to <span className="font-bold">150,000 miles</span> and <span className="font-bold">15 years old</span>.
      </p>

      {/* Get Quote CTA Button */}
      {(() => {
        const isActive = isRegValid && hasSelection;
        const label = !isRegValid
          ? 'Enter reg for an instant price'
          : !hasSelection
          ? 'Select mileage to see your price'
          : 'Get my instant quote';
        return (
          <Button
            onClick={handleGetQuote}
            style={!isActive ? { backgroundColor: '#FFD8C2', color: '#8A5A45' } : undefined}
            className={`w-full font-bold rounded-xl transition-colors py-6 sm:py-8 text-lg sm:text-xl ${
              isActive
                ? 'bg-brand-orange hover:bg-orange-700 text-white shadow-lg animate-breathing'
                : 'shadow-none hover:brightness-95'
            }`}
          >
            <span className="flex items-center justify-center gap-3">
              {label}
              {isActive && <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={3} />}
            </span>
          </Button>
        );
      })()}

      {/* Helper Message (soft, non-error) */}
      {helperMessage && !isRegValid && (
        <p className="text-sm font-medium text-center" style={{ color: '#8A5A45' }}>
          {helperMessage}
        </p>
      )}
      {helperMessage && isRegValid && !hasSelection && (
        <p className="text-sm font-medium text-center" style={{ color: '#8A5A45' }}>
          {helperMessage}
        </p>
      )}
      
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
