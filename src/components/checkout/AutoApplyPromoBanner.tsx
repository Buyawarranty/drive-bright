import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Unlock, Check, X, Gift } from 'lucide-react';
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
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showBetterDiscountNote, setShowBetterDiscountNote] = useState(false);
  const hasTrackedApply = useRef(false);
  const hasTracked300 = useRef(false);
  const hasTracked60 = useRef(false);
  const hasTrackedExpiry = useRef(false);
  const timerStarted = useRef(false);

  // Calculate 5% discount amount (always round down)
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

  // Reset unlocked state if promo was removed by user
  useEffect(() => {
    if (isUnlocked && !isPromoApplied && !isExpired) {
      // Promo was unlocked but no longer in currentDiscounts - user removed it
      setIsUnlocked(false);
      sessionStorage.removeItem('autoPromo5Percent');
    }
  }, [isPromoApplied, isUnlocked, isExpired]);

  // Check for existing state on mount
  useEffect(() => {
    const savedPromoState = sessionStorage.getItem('autoPromo5Percent');
    if (savedPromoState) {
      const state = JSON.parse(savedPromoState);
      if (state.expired) {
        setIsExpired(true);
        return;
      }
      if (state.unlocked) {
        setIsUnlocked(true);
        timerStarted.current = true;
      }
      if (state.secondsRemaining > 0) {
        setSecondsRemaining(state.secondsRemaining);
      }
    }

    // If there's a better discount, show note
    if (CONFIG.NON_STACKING && existingBetterDiscount) {
      setShowBetterDiscountNote(true);
    }
  }, [existingBetterDiscount]);

  // Handle unlock click
  const handleUnlock = useCallback(() => {
    if (isUnlocked || isExpired) return;

    // Start animation
    setIsAnimating(true);

    // Apply the promo code after brief animation
    setTimeout(() => {
      const discount = {
        code: CONFIG.PROMO_CODE,
        type: 'percentage' as const,
        value: 5,
        discountAmount: promoDiscountAmount
      };
      
      onApplyPromo(discount);
      setIsUnlocked(true);
      timerStarted.current = true;
      setIsAnimating(false);

      // Save state
      sessionStorage.setItem('autoPromo5Percent', JSON.stringify({
        unlocked: true,
        secondsRemaining: CONFIG.COUNTDOWN_SECONDS,
        expired: false
      }));

      // Track analytics
      if (!hasTrackedApply.current) {
        trackEvent('promo_unlocked', { 
          promo_code: CONFIG.PROMO_CODE, 
          timestamp: Date.now() 
        });
        hasTrackedApply.current = true;
      }
    }, 400);
  }, [isUnlocked, isExpired, onApplyPromo, promoDiscountAmount]);

  // Countdown timer - only starts after unlock
  useEffect(() => {
    if (isExpired || !isUnlocked) return;

    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        const newValue = prev - 1;
        
        // Save state to session
        sessionStorage.setItem('autoPromo5Percent', JSON.stringify({
          unlocked: true,
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
  }, [isExpired, isUnlocked, isPromoApplied, onRemovePromo]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle reapply
  const handleReapply = useCallback(() => {
    if (!CONFIG.ALLOW_REAPPLY) return;

    // Reset all state first
    hasTracked300.current = false;
    hasTracked60.current = false;
    hasTrackedExpiry.current = false;

    // Clear session storage first
    sessionStorage.removeItem('autoPromo5Percent');

    // Reset state with fresh values
    setIsExpired(false);
    setSecondsRemaining(CONFIG.COUNTDOWN_SECONDS);
    setIsUnlocked(true);
    timerStarted.current = true;

    // Save fresh state to session
    sessionStorage.setItem('autoPromo5Percent', JSON.stringify({
      unlocked: true,
      secondsRemaining: CONFIG.COUNTDOWN_SECONDS,
      expired: false
    }));

    // Apply the promo
    const discount = {
      code: CONFIG.PROMO_CODE,
      type: 'percentage' as const,
      value: 5,
      discountAmount: promoDiscountAmount
    };
    
    onApplyPromo(discount);

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

  // LOCKED STATE - Show unlock button
  if (!isUnlocked && !isExpired) {
    return (
      <div 
        className="promo-banner mb-4 rounded-xl border overflow-hidden bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200 shadow-sm"
        role="status"
        aria-live="polite"
      >
        <div className="p-4">
          <button
            onClick={handleUnlock}
            disabled={isAnimating}
            className={`w-full flex items-center justify-between gap-3 transition-all duration-300 ${
              isAnimating ? 'scale-95 opacity-80' : 'hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Lock/Gift Icon with animation */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                isAnimating 
                  ? 'bg-[#2BB673] rotate-12 scale-110' 
                  : 'bg-[#FF9F1A]'
              }`}>
                {isAnimating ? (
                  <Unlock className="w-5 h-5 text-white" strokeWidth={2.5} />
                ) : (
                  <Gift className="w-5 h-5 text-white" strokeWidth={2.5} />
                )}
              </div>
              
              <div className="text-left">
                <p className={`text-base font-bold transition-all duration-300 ${
                  isAnimating ? 'text-[#2BB673]' : 'text-gray-900'
                }`}>
                  {isAnimating ? 'Unlocking...' : 'Unlock 5% discount'}
                </p>
                <p className="text-sm text-gray-600">
                  Save <span className="font-bold text-[#2BB673]">£{promoDiscountAmount}</span> on your order
                </p>
              </div>
            </div>
            
            {/* Unlock Button */}
            <div className={`flex-shrink-0 px-4 py-2 rounded-lg font-bold text-sm transition-all duration-300 ${
              isAnimating 
                ? 'bg-[#2BB673] text-white' 
                : 'bg-[#FF9F1A] text-white hover:bg-orange-500'
            }`}>
              {isAnimating ? (
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Applied!
                </span>
              ) : (
                'Tap to unlock'
              )}
            </div>
          </button>
        </div>
      </div>
    );
  }

  // UNLOCKED STATE - Show applied discount with timer
  return (
    <div 
      className={`promo-banner mb-4 rounded-xl border overflow-hidden transition-all duration-500 ${
        isExpired 
          ? 'bg-gray-50 border-gray-200' 
          : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-md'
      }`}
      role="status"
      aria-live="polite"
    >
      {!isExpired ? (
        <div className="p-4">
          {/* Congratulations Header */}
          <div className="text-center mb-3">
            <p className="text-lg font-bold text-gray-900">
              🎉 Congratulations! You've Unlocked an Extra 5% Off!
            </p>
          </div>
          
          {/* Main content - Applied state */}
          <div className="flex items-start gap-3 bg-white/60 rounded-lg p-3">
            {/* Checkmark icon */}
            <div className="flex-shrink-0 w-7 h-7 bg-[#2BB673] rounded-full flex items-center justify-center mt-0.5 animate-scale-in">
              <Check className="w-4 h-4 text-white" strokeWidth={3} />
            </div>
            
            <div className="flex-1 min-w-0">
              {/* Benefit line */}
              <p className="text-base font-semibold text-gray-900">
                5% discount applied - <span className="text-[#2BB673] animate-fade-in">You save £{promoDiscountAmount}</span>
              </p>
              
              {/* Action line */}
              <p className="text-sm text-gray-600 mt-0.5">
                Complete checkout now to lock in your cover
              </p>
            </div>
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
