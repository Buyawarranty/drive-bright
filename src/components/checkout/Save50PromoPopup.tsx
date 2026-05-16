import React, { useEffect, useRef, useState } from 'react';
import { X, Car, Clock, Check, Tag, Lock, ArrowRight } from 'lucide-react';
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
                  viewBox="0 0 48 32"
                  className="w-9 h-9 sm:w-10 sm:h-10"
                  fill="none"
                  stroke="white"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 22h40" />
                  <path d="M7 22l3-9h22l5 6 6 1v2" />
                  <path d="M10 13l2-5h14l4 5" />
                  <g style={{ transformOrigin: '14px 24px', animation: 'save25-wheel-spin 0.6s linear infinite' }}>
                    <circle cx="14" cy="24" r="3.2" />
                    <line x1="14" y1="21" x2="14" y2="27" />
                    <line x1="11" y1="24" x2="17" y2="24" />
                  </g>
                  <g style={{ transformOrigin: '36px 24px', animation: 'save25-wheel-spin 0.6s linear infinite' }}>
                    <circle cx="36" cy="24" r="3.2" />
                    <line x1="36" y1="21" x2="36" y2="27" />
                    <line x1="33" y1="24" x2="39" y2="24" />
                  </g>
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
              Offer reserved for {Math.max(1, Math.ceil(secondsLeft / 60))} minutes
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

          {/* Benefit rows */}
          <ul className="mb-5">
            <li className="flex items-start gap-3 py-3 border-b border-gray-100">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#E6F4EC] flex items-center justify-center mt-0.5">
                <Check className="w-4 h-4 text-[#1F5D3A]" strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                  £{DISCOUNT_AMOUNT} discount applied instantly
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">No code needed</p>
              </div>
            </li>
            <li className="flex items-start gap-3 py-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#E6F4EC] flex items-center justify-center mt-0.5">
                <Check className="w-4 h-4 text-[#1F5D3A]" strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                  Expires in {Math.max(1, Math.ceil(secondsLeft / 60))} minutes
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  Don't miss out on this exclusive saving
                </p>
              </div>
            </li>
          </ul>

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
