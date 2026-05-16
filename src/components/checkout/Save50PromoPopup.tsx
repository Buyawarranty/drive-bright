import React, { useEffect, useRef, useState } from 'react';
import { X, Car, Clock, Check, Copy } from 'lucide-react';
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
      toast.success(`🎉 ${CODE} applied — £${DISCOUNT_AMOUNT} off your order!`, {
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

        {/* Top accent band */}
        <div className="bg-gradient-to-br from-[#FF8C00] via-[#FF6B00] to-[#E91E63] px-5 sm:px-6 pt-6 sm:pt-7 pb-5 sm:pb-6 text-center text-white">
          <div className="relative inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/20 backdrop-blur mb-2.5 sm:mb-3 overflow-hidden">
            <Car
              className="w-6 h-6 sm:w-7 sm:h-7 text-white animate-[car-drive_2.2s_ease-in-out_infinite]"
              strokeWidth={2.5}
            />
          </div>
          <style>{`
            @keyframes car-drive {
              0%   { transform: translateX(-140%); opacity: 0; }
              15%  { opacity: 1; }
              50%  { transform: translateX(0); opacity: 1; }
              85%  { opacity: 1; }
              100% { transform: translateX(140%); opacity: 0; }
            }
          `}</style>
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider opacity-90">
            One-time offer just for you
          </p>
          <h2 id="save50-title" className="text-3xl sm:text-4xl font-extrabold mt-1">
            £{DISCOUNT_AMOUNT} OFF
          </h2>
          <p className="text-sm sm:text-base mt-1 opacity-95">your warranty today</p>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 py-5 sm:py-6">
          {/* Code chip */}
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
                  Your code
                </p>
                <p className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-wider select-all break-all">{CODE}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-600 flex-shrink-0">
                <Clock className="w-4 h-4 text-[#E91E63]" />
                <span className="font-semibold tabular-nums">
                  {isExpired ? 'Expired' : formatTime(secondsLeft)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(CODE);
                  } else {
                    const ta = document.createElement('textarea');
                    ta.value = CODE;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                  }
                  toast.success('Code copied!');
                } catch {
                  toast.error('Could not copy. Long-press the code to copy.');
                }
              }}
              aria-label="Copy code"
              className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 active:scale-[0.99] transition-all text-xs font-semibold text-gray-700 shadow-sm"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy code
            </button>
          </div>

          {/* Bullets */}
          <ul className="space-y-2 mb-5 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-[#2BB673] mt-0.5 flex-shrink-0" />
              <span>Applies instantly with one tap, no typing needed.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-[#2BB673] mt-0.5 flex-shrink-0" />
              <span>Reserved just for you — exclusive to this order.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-[#2BB673] mt-0.5 flex-shrink-0" />
              <span>Claim within the next 15 minutes.</span>
            </li>
          </ul>

          {/* CTA */}
          {isExpired ? (
            <button
              type="button"
              onClick={handleClose}
              className="w-full h-12 rounded-xl bg-gray-200 text-gray-600 font-semibold text-base"
            >
              Offer expired — close
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying}
              className="w-full h-12 sm:h-13 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#E91E63] text-white font-bold text-base shadow-md hover:shadow-lg active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isApplying ? 'Applying…' : `Apply £${DISCOUNT_AMOUNT} off now`}
            </button>
          )}

          <p className="text-[11px] text-center text-gray-500 mt-3">
            Your best-value discount — not valid with other promotions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Save50PromoPopup;
