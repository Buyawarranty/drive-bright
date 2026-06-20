import React, { useEffect, useRef, useState } from 'react';
import { X, Clock, Check, Tag, Lock, ArrowRight, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CODE = 'SAVE25';
const DISCOUNT_AMOUNT = 25;
const COUNTDOWN_SECONDS = 15 * 60; // 15 minutes
const INACTIVITY_MS = 20 * 1000; // 20 seconds
const STORAGE_KEY = 'baw_save25_state_v1';

type StoredState = {
  status: 'shown' | 'dismissed' | 'applied';
  email?: string;
  shownAt?: number;
  expiresAt?: number;
};

interface Save50PromoPopupProps {
  orderTotal: number;
  customerEmail?: string;
  vehicleReg?: string;
  hasDiscountApplied: boolean;
  /**
   * When true (e.g. the embedded Stripe card form is open), the popup must
   * stay suppressed. Card-detail typing happens inside Stripe's iframe and
   * does NOT bubble window events, so the inactivity timer would otherwise
   * fire while the user is mid-payment and make them think their previously
   * applied promo was lost.
   */
  suppress?: boolean;
  onApplied: (discount: {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    stripe_coupon_id?: string;
    stripe_promo_code_id?: string;
  }) => void;
}

const readState = (): StoredState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredState) : null;
  } catch {
    return null;
  }
};

const writeState = (s: StoredState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

export const Save50PromoPopup: React.FC<Save50PromoPopupProps> = ({
  orderTotal,
  customerEmail,
  vehicleReg,
  hasDiscountApplied,
  suppress = false,
  onApplied,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [isApplying, setIsApplying] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [copied, setCopied] = useState(false);
  const inactivityTimer = useRef<number | null>(null);
  const hasShownThisSession = useRef(false);

  // Auto-close if the parent suppresses (e.g. user opened Stripe payment form)
  useEffect(() => {
    if (suppress && isOpen) setIsOpen(false);
  }, [suppress, isOpen]);

  // Check eligibility & decide whether to arm the inactivity timer
  useEffect(() => {
    if (suppress) return;
    if (hasDiscountApplied) return;

    const stored = readState();

    // Already used or dismissed permanently on this device
    if (stored?.status === 'applied') return;
    if (stored?.status === 'dismissed') return;

    // If a previous session armed the timer, restore remaining time
    if (stored?.status === 'shown' && stored.expiresAt) {
      const remaining = Math.floor((stored.expiresAt - Date.now()) / 1000);
      if (remaining <= 0) {
        // Window already passed — burn the offer
        writeState({ ...stored, status: 'dismissed' });
        return;
      }
      // Re-open immediately with the existing timer
      setSecondsLeft(remaining);
      setIsOpen(true);
      hasShownThisSession.current = true;
      return;
    }

    // Arm 20s inactivity timer (any user interaction resets it)
    const reset = () => {
      if (hasShownThisSession.current) return;
      if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
      inactivityTimer.current = window.setTimeout(() => {
        if (hasShownThisSession.current) return;
        hasShownThisSession.current = true;
        const expiresAt = Date.now() + COUNTDOWN_SECONDS * 1000;
        writeState({
          status: 'shown',
          email: customerEmail,
          shownAt: Date.now(),
          expiresAt,
        });
        setSecondsLeft(COUNTDOWN_SECONDS);
        setIsOpen(true);
      }, INACTIVITY_MS);
    };

    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
    };
  }, [orderTotal, customerEmail, hasDiscountApplied, suppress]);

  // Countdown
  useEffect(() => {
    if (!isOpen || isExpired) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          const stored = readState();
          if (stored && stored.status === 'shown') {
            writeState({ ...stored, status: 'dismissed' });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isOpen, isExpired]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    const stored = readState();
    // Mark dismissed so it can't reappear on this device
    writeState({
      status: 'dismissed',
      email: customerEmail,
      shownAt: stored?.shownAt,
      expiresAt: stored?.expiresAt,
    });
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(CODE);
      setCopied(true);
      toast.success('Code copied to clipboard', { duration: 2000 });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy code');
    }
  };

  const handleApply = async () => {
    if (isApplying || isExpired) return;
    setIsApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-discount-code', {
        body: {
          code: CODE,
          customerEmail: customerEmail?.trim().toLowerCase() || undefined,
          vehicleReg: vehicleReg || undefined,
          orderAmount: orderTotal,
        },
      });

      if (error || !data?.valid) {
        const msg = data?.error || 'This code can\'t be applied right now.';
        toast.error(msg);
        // If it's a "you've already used this code" rejection, lock it for this device
        if (typeof msg === 'string' && /already used/i.test(msg)) {
          writeState({ status: 'applied', email: customerEmail });
        }
        return;
      }

      const dc = data.discountCode;
      onApplied({
        code: CODE,
        type: dc.type,
        value: dc.value,
        stripe_coupon_id: dc.stripe_coupon_id,
        stripe_promo_code_id: dc.stripe_promo_code_id,
      });

      writeState({ status: 'applied', email: customerEmail });
      toast.success(`🎉 ${CODE} applied, £${DISCOUNT_AMOUNT} off your order!`, {
        style: {
          background: '#E91E63',
          color: '#ffffff',
          fontWeight: '600',
          borderRadius: '8px',
          border: 'none',
        },
        duration: 5000,
      });
      setIsOpen(false);
    } catch (err) {
      console.error('[Save50PromoPopup] apply failed', err);
      toast.error('Something went wrong applying the code.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save50-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={handleClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
      />

      {/* Modal */}
      <div className="relative w-full max-w-[22rem] sm:max-w-sm lg:max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in max-h-[92vh] overflow-y-auto">
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Dismiss offer"
          className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-10 w-9 h-9 rounded-full bg-white/95 hover:bg-gray-100 flex items-center justify-center transition-colors shadow-sm"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        {/* Local keyframes for header car + CTA breathing */}
        <style>{`
          @keyframes save25-car-drive {
            0%   { transform: translateX(-14%) rotate(-2deg); }
            45%  { transform: translateX(0) rotate(0deg); }
            55%  { transform: translateX(0) rotate(0deg); }
            100% { transform: translateX(14%) rotate(2deg); }
          }
          @keyframes save25-car-bob {
            0%, 100% { transform: translateY(0); }
            50%      { transform: translateY(-2px); }
          }
          @keyframes save25-wheel-spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @keyframes save25-breathe {
            0%, 100% { transform: scale(1);    box-shadow: 0 6px 16px -6px rgba(242,106,31,0.55); }
            50%      { transform: scale(1.02); box-shadow: 0 12px 28px -8px rgba(242,106,31,0.75); }
          }
          .save25-breathe { animation: save25-breathe 2.8s ease-in-out infinite; transform-origin: center; will-change: transform; }
        `}</style>

        {/* Orange header */}
        <div className="bg-[#F26A1F] px-6 sm:px-8 pt-8 sm:pt-10 pb-7 sm:pb-8 text-center text-white">
          <div className="relative inline-flex items-center justify-center w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full border-2 border-white/90 mb-3 sm:mb-4 overflow-hidden">
            <div
              className="flex items-center justify-center"
              style={{ animation: 'save25-car-bob 1.6s ease-in-out infinite' }}
            >
              <div style={{ animation: 'save25-car-drive 2.6s ease-in-out infinite alternate' }}>
                <svg
                  viewBox="0 0 64 36"
                  className="w-10 h-10 sm:w-11 sm:h-11"
                  fill="white"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Solid car silhouette — hatchback / SUV profile */}
                  <path
                    d="M5 24
                       C5 22.3 6.3 21 8 21
                       L9 21
                       C9.6 17.2 11.5 14 14 12
                       L20 8.5
                       C22 7.3 24.3 6.8 26.6 6.8
                       L38 6.8
                       C41 6.8 43.8 8.2 45.7 10.5
                       L50 16
                       L56 17.2
                       C58.4 17.7 60 19.8 60 22.2
                       L60 24
                       C60 25.4 58.9 26.5 57.5 26.5
                       L52 26.5
                       A6 6 0 0 0 40 26.5
                       L24 26.5
                       A6 6 0 0 0 12 26.5
                       L7.5 26.5
                       C6.1 26.5 5 25.4 5 24 Z
                       M22 11 L20 16 L31 16 L31 10 L26.6 10 C24.9 10 23.3 10.4 22 11 Z
                       M33 10 L33 16 L46 16 L43 12 C41.8 10.7 40.1 10 38.3 10 L33 10 Z"
                  />
                  {/* Wheels — dark with white hub, spinning */}
                  <g style={{ transformOrigin: '18px 26.5px', animation: 'save25-wheel-spin 0.6s linear infinite' }}>
                    <circle cx="18" cy="26.5" r="5" fill="#1a1a1a" />
                    <circle cx="18" cy="26.5" r="1.6" fill="white" />
                    <rect x="17.2" y="22.3" width="1.6" height="8.4" fill="white" opacity="0.85" />
                    <rect x="13.8" y="25.7" width="8.4" height="1.6" fill="white" opacity="0.85" />
                  </g>
                  <g style={{ transformOrigin: '46px 26.5px', animation: 'save25-wheel-spin 0.6s linear infinite' }}>
                    <circle cx="46" cy="26.5" r="5" fill="#1a1a1a" />
                    <circle cx="46" cy="26.5" r="1.6" fill="white" />
                    <rect x="45.2" y="22.3" width="1.6" height="8.4" fill="white" opacity="0.85" />
                    <rect x="41.8" y="25.7" width="8.4" height="1.6" fill="white" opacity="0.85" />
                  </g>
                  {/* Headlight accent */}
                  <circle cx="57" cy="21" r="1.2" fill="#F26A1F" />
                </svg>
              </div>
            </div>
          </div>
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-white/95">
            Limited time offer
          </p>
          <h2
            id="save50-title"
            className="text-[44px] sm:text-[56px] leading-none font-black mt-2 sm:mt-3 tracking-tight"
          >
            SAVE £{DISCOUNT_AMOUNT}
          </h2>
          <p className="text-base sm:text-lg mt-2 sm:mt-3 text-gray-900 font-medium">
            on your warranty today
          </p>
          <div className="mt-4 sm:mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/90">
            <Clock className="w-4 h-4 text-white" strokeWidth={2.4} />
            <span className="text-sm font-semibold text-white tabular-nums">
              Offer reserved for 15 minutes
            </span>
          </div>
        </div>

        {/* White body */}
        <div className="px-5 sm:px-6 py-5 sm:py-6 bg-white">
          {/* Discount-applied card */}
          <div className="bg-[#F5F6F7] rounded-xl border border-gray-200 p-4 sm:p-5 mb-5 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#2BB673]">
                  Discount applied
                </span>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#2BB673]">
                  <Check className="w-3 h-3 text-white" strokeWidth={3.5} />
                </span>
              </div>
              <p className="text-2xl sm:text-[28px] font-extrabold text-gray-900 tracking-wide leading-tight">
                {CODE}
              </p>
            </div>
            <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#E6F4EC] flex items-center justify-center">
              <Tag className="w-6 h-6 sm:w-7 sm:h-7 text-[#1F5D3A]" strokeWidth={2} />
            </div>
          </div>
          <p className="text-sm sm:text-base text-gray-600 text-center mb-5 -mt-2">
            No promo code needed
          </p>

          {/* CTA — pulsating breathing (animation on wrapper so the button hit-area stays stable) */}
          <div className="save25-breathe rounded-2xl">
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying}
              className="relative z-10 w-full h-14 sm:h-[60px] px-6 rounded-2xl bg-[#F26A1F] hover:bg-[#e25f15] text-white font-bold text-base sm:text-lg inline-flex items-center justify-center gap-2.5 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isApplying ? 'Applying…' : (
                <>
                  <span>Continue with £{DISCOUNT_AMOUNT} saving</span>
                  <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
                </>
              )}
            </button>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-600 inline-flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-gray-500" strokeWidth={2} />
              Secure & trusted checkout
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Not valid with any other promotions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Save50PromoPopup;
