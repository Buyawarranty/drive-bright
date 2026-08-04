import React, { useState, useEffect, useRef } from 'react';
import { Zap, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { MileageField, digitsOnly, MAX_COVERED_MILEAGE } from '@/components/quote/ManualQuoteEntry';

interface MileageQuickSelectProps {
  /** Legacy band value ('under120k' | 'over120k') — kept so existing parents keep working. */
  value: string;
  /** Called with the derived band so parent gating state stays in sync. */
  onChange: (value: string) => void;
  /** Called with the EXACT mileage used for pricing (MOT reading or customer entry). */
  onAutoSubmit?: (mileageValue: string) => void;
  error?: string;
  isLoading?: boolean;
  isRegValid?: boolean;
  autoScrollOnValid?: boolean;
  /** Optional: pass the reg from the parent. Falls back to reading the yellow plate input. */
  regNumber?: string;
  ctaLabels?: {
    enterReg?: string;
    selectMileage?: string;
    submit?: string;
  };
}

/**
 * Reg-only quote CTA. Pricing is mileage based, so the mileage is read from the
 * vehicle's latest MOT odometer reading instead of asking for a 120k band.
 * The customer is only asked for mileage when no MOT reading exists.
 */
const MileageQuickSelect: React.FC<MileageQuickSelectProps> = ({
  value,
  onChange,
  onAutoSubmit,
  error,
  isLoading = false,
  isRegValid = false,
  autoScrollOnValid = false,
  regNumber,
  ctaLabels,
}) => {
  const [isFetchingMileage, setIsFetchingMileage] = useState(false);
  const [helperMessage, setHelperMessage] = useState('');
  const [needsMileage, setNeedsMileage] = useState(false);
  const [manualMileage, setManualMileage] = useState('');
  const [localError, setLocalError] = useState('');
  const [highlight, setHighlight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevRegValid = useRef(isRegValid);

  // Auto-scroll and highlight when reg becomes valid
  useEffect(() => {
    if (autoScrollOnValid && isRegValid && !prevRegValid.current) {
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlight(true);
        setTimeout(() => setHighlight(false), 2400);
      }, 200);
    }
    prevRegValid.current = isRegValid;
  }, [isRegValid, autoScrollOnValid]);

  // Reset transient state when the reg is cleared/changed back to invalid
  useEffect(() => {
    if (!isRegValid) {
      setNeedsMileage(false);
      setLocalError('');
    }
  }, [isRegValid]);

  useEffect(() => {
    if (!isLoading) setIsFetchingMileage(false);
  }, [isLoading]);

  useEffect(() => {
    if (error) setIsFetchingMileage(false);
  }, [error]);

  const readRegFromDom = (): string => {
    if (regNumber && regNumber.trim()) return regNumber.replace(/\s/g, '').toUpperCase();
    if (typeof document === 'undefined') return '';
    const input = document.querySelector<HTMLInputElement>('input.bg-yellow-400');
    return (input?.value || '').replace(/\s/g, '').toUpperCase();
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

  /** Remember where the quoted mileage came from so checkout can confirm it. */
  const rememberMileageSource = (
    source: 'mot' | 'customer',
    mileageValue: number,
    motDate?: string | null,
  ) => {
    try {
      localStorage.setItem('baw_mileage_source', source);
      if (source === 'mot') {
        localStorage.setItem('baw_mot_mileage', String(mileageValue));
        if (motDate) localStorage.setItem('baw_mot_mileage_date', motDate);
        localStorage.removeItem('baw_customer_mileage');
      } else {
        localStorage.removeItem('baw_mot_mileage');
        localStorage.removeItem('baw_mot_mileage_date');
        localStorage.setItem('baw_customer_mileage', String(mileageValue));
      }
    } catch {
      // ignore storage failures (private mode)
    }
  };

  const bandFor = (miles: number) => (miles <= 120000 ? 'under120k' : 'over120k');

  const submitMileage = (miles: number, source: 'mot' | 'customer', motDate?: string | null) => {
    rememberMileageSource(source, miles, motDate);
    onChange(bandFor(miles));
    onAutoSubmit?.(String(miles));
  };

  const askForMileage = () => {
    setNeedsMileage(true);
    setIsFetchingMileage(false);
    setTimeout(() => {
      const el = document.getElementById('mqs-mileage-field');
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleGetQuote = async () => {
    setHelperMessage('');
    setLocalError('');

    if (!isRegValid) {
      setHelperMessage('Enter your registration number to continue.');
      focusRegInput();
      return;
    }

    if (!onAutoSubmit) {
      // Parent handles submission itself (e.g. edit vehicle dialog).
      onChange(value || 'under120k');
      return;
    }

    const reg = readRegFromDom();
    if (!reg) {
      setHelperMessage('Enter your registration number to continue.');
      focusRegInput();
      return;
    }

    setIsFetchingMileage(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registration: reg, registrationNumber: reg },
      });

      if (fnError) {
        askForMileage();
        return;
      }

      const motMileage = Number(String(data?.motMileage ?? '').replace(/[^0-9]/g, ''));
      if (motMileage > 0) {
        if (motMileage > MAX_COVERED_MILEAGE) {
          setIsFetchingMileage(false);
          setLocalError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
          return;
        }
        submitMileage(motMileage, 'mot', data?.motMileageDate ?? null);
        return;
      }

      // No MOT odometer reading — ask the customer for their mileage.
      askForMileage();
    } catch {
      askForMileage();
    }
  };

  const submitTypedMileage = () => {
    const miles = Number(digitsOnly(manualMileage) || '0');
    if (miles < 100 || miles > MAX_COVERED_MILEAGE) return;
    setIsFetchingMileage(true);
    submitMileage(miles, 'customer');
  };

  // Show loading message state
  if (isFetchingMileage || isLoading) {
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

  const displayError = error || localError;

  return (
    <div
      ref={containerRef}
      className={`space-y-3 transition-all duration-500 rounded-xl ${
        highlight ? 'bg-brand-orange/5 p-3 -m-3' : ''
      }`}
    >
      {needsMileage ? (
        <div className="space-y-3 rounded-xl border-2 border-[#F0A500] bg-[#FFF8E5] p-4 text-left">
          <div>
            <p className="text-base font-semibold text-[#7A5A00]">We just need your current mileage</p>
            <p className="text-sm text-[#8A6A1F] mt-1">
              We couldn't find an MOT reading for this vehicle, so pop your mileage in and we'll price it
              straight away.
            </p>
          </div>
          <MileageField
            id="mqs-mileage-field"
            value={manualMileage}
            onChange={(digits) => {
              setManualMileage(digits);
              if (localError) setLocalError('');
            }}
            onEnter={submitTypedMileage}
          />
          <Button
            onClick={submitTypedMileage}
            disabled={
              Number(digitsOnly(manualMileage) || '0') < 100 ||
              Number(digitsOnly(manualMileage) || '0') > MAX_COVERED_MILEAGE
            }
            className="w-full font-bold rounded-xl px-6 py-6 text-lg bg-brand-orange hover:bg-orange-700 text-white shadow-lg animate-breathing"
          >
            <span className="flex items-center justify-center gap-3">
              {ctaLabels?.submit ?? 'Get my quote'}
              <ArrowRight className="w-6 h-6" strokeWidth={3} />
            </span>
          </Button>
          <p className="text-xs text-[#8A6A1F]">
            We'll prefill this for you at checkout so you don't have to type it again.
          </p>
        </div>
      ) : (
        <>
          {/* Eligibility note */}
          <p className="text-sm text-gray-500 text-center">
            Protection for vehicles up to <span className="font-bold">150,000 miles</span> and{' '}
            <span className="font-bold">15 years old</span>.
          </p>

          {isRegValid ? (
            <Button
              onClick={handleGetQuote}
              className="w-full font-bold rounded-xl transition-colors py-6 sm:py-8 text-lg sm:text-xl bg-brand-orange hover:bg-orange-700 text-white shadow-lg animate-breathing"
            >
              <span className="flex items-center justify-center gap-3">
                {ctaLabels?.submit ?? 'Get my quote'}
                <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={3} />
              </span>
            </Button>
          ) : (
            <button
              type="button"
              onClick={handleGetQuote}
              className="w-full text-center rounded-xl border border-[#F0D6C3] bg-[#FBE4D6]/50 hover:bg-[#FBE4D6]/70 transition-colors px-3 py-2.5 flex items-center justify-center gap-3"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/70 ring-1 ring-[#EBC9B0] flex-shrink-0">
                <ShieldCheck className="w-4 h-4" style={{ color: '#B07A5C' }} strokeWidth={2} />
              </span>
              <span className="flex flex-col leading-tight text-center">
                <span className="text-sm font-semibold" style={{ color: '#8A5A45' }}>
                  {ctaLabels?.enterReg ?? 'Enter reg for an instant price'}
                </span>
                <span className="text-xs mt-0.5" style={{ color: '#B07A5C' }}>
                  We'll instantly find your car details and mileage.
                </span>
              </span>
            </button>
          )}
        </>
      )}

      {/* Helper Message (soft, non-error) */}
      {helperMessage && (
        <p className="text-sm font-medium text-center" style={{ color: '#8A5A45' }}>
          {helperMessage}
        </p>
      )}

      {/* Error Message */}
      {displayError && (
        <div className="flex items-center gap-2 text-red-600 font-medium text-left bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{displayError}</span>
        </div>
      )}
    </div>
  );
};

export default MileageQuickSelect;
