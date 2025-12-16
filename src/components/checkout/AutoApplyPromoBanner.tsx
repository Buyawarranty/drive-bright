import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Check, X } from 'lucide-react';
import { trackEvent } from '@/utils/analytics';

// Configuration flags
const CONFIG = {
  PROMO_CODE: '5PERCENTSAVENOW',
  PROMO_PERCENT: 0.05,
  COUNTDOWN_SECONDS: 1200, // 20 minutes
  ALLOW_REAPPLY: true,
  NON_STACKING: true // apply best available only
};

interface AutoApplyPromoBannerProps {
  currentDiscounts: Array<{
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    discountAmount: number;
  }>;
  basePrice: number;
  onApplyPromo: (discount: {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    discountAmount: number;
  }) => void;
  onRemovePromo: (code: string) => void;
}

export const AutoApplyPromoBanner: React.FC<AutoApplyPromoBannerProps> = ({
  currentDiscounts,
  basePrice,
  onApplyPromo,
  onRemovePromo
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(CONFIG.COUNTDOWN_SECONDS);
  const [isExpired, setIsExpired] = useState(false);
  const [isAutoApplied, setIsAutoApplied] = useState(false);
  const [showBetterDiscountNote, setShowBetterDiscountNote] = useState(false);
  const hasTrackedApply = useRef(false);
  const hasTracked300 = useRef(false);
  const hasTracked60 = useRef(false);
  const hasTrackedExpiry = useRef(false);

  // Calculate 5% discount amount
  const promoDiscountAmount = Math.floor(basePrice * CONFIG.PROMO_PERCENT);

  // Check if there's a better existing discount
  const existingBetterDiscount = currentDiscounts.find(d => {
    const existingAmount = d.type === 'percentage' 
      ? Math.floor(basePrice * (d.value / 100)) 
      : d.discountAmount;
    return existingAmount > promoDiscountAmount && d.code !== CONFIG.PROMO_CODE;
  });

  // Check if our promo is already applied
  const isPromoApplied = currentDiscounts.some(d => d.code === CONFIG.PROMO_CODE);

  // Auto-apply promo on mount
  useEffect(() => {
    // Don't apply if already expired or already applied
    if (isExpired || isPromoApplied) return;

    // Check session/localStorage for existing promo state
    const savedPromoState = sessionStorage.getItem('autoPromo5Percent');
    if (savedPromoState) {
      const state = JSON.parse(savedPromoState);
      if (state.expired) {
        setIsExpired(true);
        return;
      }
      if (state.secondsRemaining > 0) {
        setSecondsRemaining(state.secondsRemaining);
      }
    }

    // If there's a better discount, show note but don't apply ours
    if (CONFIG.NON_STACKING && existingBetterDiscount) {
      setShowBetterDiscountNote(true);
      return;
    }

    // Apply the promo code
    if (!isAutoApplied && !isPromoApplied) {
      const discount = {
        code: CONFIG.PROMO_CODE,
        type: 'percentage' as const,
        value: 5,
        discountAmount: promoDiscountAmount
      };
      
      onApplyPromo(discount);
      setIsAutoApplied(true);

      // Track analytics
      if (!hasTrackedApply.current) {
        trackEvent('promo_auto_applied', { 
          promo_code: CONFIG.PROMO_CODE, 
          timestamp: Date.now() 
        });
        hasTrackedApply.current = true;
      }
    }
  }, [existingBetterDiscount, isExpired, isPromoApplied, isAutoApplied, onApplyPromo, promoDiscountAmount]);

  // Countdown timer
  useEffect(() => {
    if (isExpired) return;

    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        const newValue = prev - 1;
        
        // Save state to session
        sessionStorage.setItem('autoPromo5Percent', JSON.stringify({
          secondsRemaining: newValue,
          expired: newValue <= 0
        }));

        // Track at 5 minutes (300s)
        if (newValue === 300 && !hasTracked300.current) {
          trackEvent('promo_timer_tick', { remaining_seconds: 300 });
          hasTracked300.current = true;
        }

        // Track at 1 minute (60s)
        if (newValue === 60 && !hasTracked60.current) {
          trackEvent('promo_timer_tick', { remaining_seconds: 60 });
          hasTracked60.current = true;
        }

        // Handle expiry
        if (newValue <= 0) {
          setIsExpired(true);
          if (isPromoApplied) {
            onRemovePromo(CONFIG.PROMO_CODE);
          }
          if (!hasTrackedExpiry.current) {
            trackEvent('promo_expired', {});
            hasTrackedExpiry.current = true;
          }
          return 0;
        }

        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isExpired, isPromoApplied, onRemovePromo]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle reapply
  const handleReapply = useCallback(() => {
    if (!CONFIG.ALLOW_REAPPLY) return;

    // Reset state
    setIsExpired(false);
    setSecondsRemaining(CONFIG.COUNTDOWN_SECONDS);
    hasTracked300.current = false;
    hasTracked60.current = false;
    hasTrackedExpiry.current = false;

    // Clear session storage
    sessionStorage.removeItem('autoPromo5Percent');

    // Apply the promo
    const discount = {
      code: CONFIG.PROMO_CODE,
      type: 'percentage' as const,
      value: 5,
      discountAmount: promoDiscountAmount
    };
    
    onApplyPromo(discount);
    setIsAutoApplied(true);

    trackEvent('promo_reapplied', { 
      promo_code: CONFIG.PROMO_CODE, 
      timestamp: Date.now() 
    });
  }, [onApplyPromo, promoDiscountAmount]);

  // Calculate progress percentage (starts at 100%, decreases to 0%)
  const progressPercent = (secondsRemaining / CONFIG.COUNTDOWN_SECONDS) * 100;

  // If there's a better discount and non-stacking is enabled, show note
  if (showBetterDiscountNote && existingBetterDiscount) {
    return (
      <div 
        className="promo-banner mb-4 px-4 py-3 rounded-xl border bg-green-50 border-green-200"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-6 h-6 bg-[#2BB673] rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
          <p className="text-sm text-gray-700">
            We automatically apply your best available saving.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`promo-banner mb-4 rounded-xl border overflow-hidden transition-all duration-300 ${
        isExpired ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 shadow-sm'
      }`}
      role="status"
      aria-live="polite"
    >
      {!isExpired ? (
        <div className="p-4">
          {/* Main content - Benefit → Action → Timer hierarchy */}
          <div className="flex items-start gap-3">
            {/* Checkmark icon */}
            <div className="flex-shrink-0 w-7 h-7 bg-[#2BB673] rounded-full flex items-center justify-center mt-0.5">
              <Check className="w-4 h-4 text-white" strokeWidth={3} />
            </div>
            
            <div className="flex-1 min-w-0">
              {/* Benefit line */}
              <p className="text-base font-semibold text-gray-900">
                5% discount applied — <span className="text-[#2BB673]">You save £{promoDiscountAmount}</span>
              </p>
              
              {/* Action line */}
              <p className="text-sm text-gray-600 mt-0.5">
                Complete checkout now to lock in your cover
              </p>
            </div>
          </div>
          
          {/* Timer bar section */}
          <div className="mt-4">
            {/* Progress bar */}
            <div 
              className="h-2 rounded-full bg-gray-100 overflow-hidden"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Offer expires in ${formatTime(secondsRemaining)}`}
            >
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ 
                  width: `${progressPercent}%`,
                  background: `linear-gradient(90deg, #2BB673 0%, #FF9F1A 100%)`
                }}
              />
            </div>
            
            {/* Time label */}
            <p className="text-sm text-gray-700 mt-2 text-center font-medium">
              Offer ends in{' '}
              <span 
                className="font-mono font-bold text-gray-900 text-base"
                aria-label={`${Math.floor(secondsRemaining / 60)} minutes and ${secondsRemaining % 60} seconds remaining`}
              >
                {formatTime(secondsRemaining)}
              </span>
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-7 h-7 bg-gray-400 rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-white" strokeWidth={3} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                This offer has expired. You can still complete your cover.
              </p>
            </div>
            
            {CONFIG.ALLOW_REAPPLY && (
              <button
                onClick={handleReapply}
                className="text-sm font-medium text-[#FF9F1A] hover:text-orange-600 underline underline-offset-2 transition-colors flex-shrink-0"
              >
                Reapply code
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoApplyPromoBanner;
