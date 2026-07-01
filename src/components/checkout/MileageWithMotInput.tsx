import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useMotMileage } from '@/hooks/useMotMileage';

interface MileageWithMotInputProps {
  registration: string | undefined;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  showValidation?: boolean; // show pink error state on submit
  id?: string;
  label?: string;
}

/**
 * Mileage input mirroring Step 4 (StreamlinedCheckout) UX:
 * - Fetches last MOT reading from mot_history
 * - Blue "Last recorded MOT: X" chip
 * - Quick-select pills: Same as MOT / +2,500 / +5,000
 * - 4-digit confirmation checkbox (values 1,000–9,999 need explicit tick)
 * - Soft MOT cross-check warning if entered mileage < last MOT
 * - Airbnb-pink error box for invalid states
 */
export const MileageWithMotInput: React.FC<MileageWithMotInputProps> = ({
  registration,
  value,
  onChange,
  onBlur,
  showValidation = false,
  id = 'mileage',
  label = "What's your approximate mileage today?",
}) => {
  const { motMileage, isLoading: motLoading } = useMotMileage(registration);
  const numericMot = useMemo(
    () => Number(String(motMileage || '').replace(/[^0-9]/g, '')),
    [motMileage],
  );

  const entered = Number(String(value || '').replace(/[^0-9]/g, '')) || 0;

  const [confirmedLow, setConfirmedLow] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Any manual edit invalidates prior confirmations/dismissals
  useEffect(() => {
    setConfirmedLow(false);
    setWarningDismissed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const quickSelectOptions = useMemo(() => {
    if (!numericMot) return [] as { delta: number; value: number }[];
    return [
      { delta: 0, value: numericMot },
      { delta: 2500, value: numericMot + 2500 },
      { delta: 5000, value: numericMot + 5000 },
    ].filter((o) => o.value <= 150000);
  }, [numericMot]);

  const placeholder = numericMot
    ? `e.g. ${(numericMot + 5000).toLocaleString('en-GB')}`
    : 'e.g. 105,000';

  const overLimit = entered > 150000;
  const isFourDigit = entered >= 1000 && entered < 10000;
  const validValue =
    entered >= 10000 || (isFourDigit && confirmedLow);
  const showMotWarning =
    !warningDismissed &&
    numericMot > 0 &&
    entered >= 1000 &&
    entered < numericMot;
  const suggested = numericMot > 0 ? numericMot + 2500 : 0;

  const errorState =
    (showValidation && !validValue) || overLimit;

  const inputBorder = overLimit
    ? 'border-[#FF385C] focus-visible:ring-[#FF385C]'
    : showValidation && !validValue
      ? 'border-[#FF385C] focus-visible:ring-[#FF385C]'
      : validValue && !showMotWarning
        ? 'border-[#0BA360]'
        : '';

  return (
    <div>
      <Label htmlFor={id} className="block text-base font-semibold text-foreground mb-3">
        {label}
      </Label>

      {numericMot > 0 && (
        <p className="mb-4 text-sm text-[#3A6FA0] bg-[#EAF2FB] border border-[#CFE0F2] rounded-md px-4 py-2.5 inline-block">
          Last recorded MOT:{' '}
          <span className="font-semibold text-[#0F1B3D]">
            {numericMot.toLocaleString('en-GB')} miles
          </span>
        </p>
      )}

      <div className="flex flex-col gap-3">
        <div className="relative">
          {motLoading ? (
            <div className="h-11 sm:h-12 flex items-center gap-2 px-3 border border-border rounded-lg bg-muted/30">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Fetching from MOT history...
              </span>
            </div>
          ) : (
            <>
              <Input
                id={id}
                type="text"
                inputMode="numeric"
                placeholder={placeholder}
                value={entered ? entered.toLocaleString('en-GB') : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  onChange(raw);
                }}
                onBlur={onBlur}
                className={`h-11 sm:h-12 text-base pr-10 ${inputBorder}`}
              />
              {validValue && !showMotWarning && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0BA360] pointer-events-none" />
              )}
            </>
          )}
        </div>

        {numericMot > 0 && (
          <div className="mt-1">
            <p className="text-sm font-medium mb-2 text-[#1F2A44]">
              Or roughly how many miles since your MOT?
            </p>
            <div className="flex flex-wrap gap-2">
              {quickSelectOptions.map((opt) => {
                const pillLabel =
                  opt.delta === 0
                    ? 'Same as MOT'
                    : `+${opt.delta.toLocaleString('en-GB')}`;
                const isSelected = entered === opt.value;
                return (
                  <button
                    type="button"
                    key={opt.delta}
                    onClick={() => {
                      onChange(String(opt.value));
                      setConfirmedLow(true);
                      setWarningDismissed(true);
                    }}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                      isSelected
                        ? 'border-brand-orange bg-brand-orange/10 text-[#1F2A44]'
                        : 'border-[#CFD4DB] bg-white text-[#1F2A44] hover:border-[#1F2A44] hover:bg-muted/30'
                    }`}
                  >
                    {pillLabel}
                  </button>
                );
              })}
            </div>
            {validValue && !showMotWarning && entered > 0 && (
              <p className="mt-2 text-sm text-[#0BA360] flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                We'll use approximately {entered.toLocaleString('en-GB')} miles.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 4-digit confirmation */}
      {isFourDigit && !showMotWarning && (
        <label
          htmlFor={`${id}-confirm-low`}
          className={`mt-3 flex items-start gap-3 rounded-lg border-2 px-3 py-2.5 cursor-pointer transition-colors ${
            confirmedLow
              ? 'border-[#0BA360] bg-[#0BA360]/5'
              : showValidation
                ? 'border-[#FF385C] bg-[#FF385C]/5'
                : 'border-[#F0A500] bg-[#FFF8E5]'
          }`}
        >
          <input
            id={`${id}-confirm-low`}
            type="checkbox"
            checked={confirmedLow}
            onChange={(e) => setConfirmedLow(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#0BA360] flex-shrink-0"
          />
          <span className="text-sm text-[#1F2A44] leading-snug">
            Yes, my mileage really is <strong>{entered.toLocaleString('en-GB')}</strong> miles.
            Please tick to confirm — most cars have 5+ digit mileage.
          </span>
        </label>
      )}

      {/* Errors — Airbnb pink */}
      {overLimit && (
        <div className="mt-2 rounded-lg border-2 border-[#FF385C] bg-[#FF385C]/5 px-3 py-2">
          <p className="text-[#FF385C] text-sm font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            Sorry, we only cover vehicles under 150,000 miles.
          </p>
        </div>
      )}
      {showValidation && !validValue && !overLimit && (
        <div className="mt-2 rounded-lg border-2 border-[#FF385C] bg-[#FF385C]/5 px-3 py-2">
          <p className="text-[#FF385C] text-sm font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            {!entered
              ? 'Please enter your current mileage.'
              : entered < 1000
                ? 'Please enter a valid mileage (at least 1,000).'
                : 'That mileage looks low — please tick the box above to confirm it’s correct.'}
          </p>
        </div>
      )}

      {/* Soft MOT cross-check warning */}
      {showMotWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 mt-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                That looks lower than your last MOT ({numericMot.toLocaleString('en-GB')} miles).
                {suggested > numericMot && (
                  <> Did you mean <span className="font-semibold">{suggested.toLocaleString('en-GB')}</span>?</>
                )}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {suggested > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(String(suggested));
                      setWarningDismissed(true);
                    }}
                    className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
                  >
                    Use {suggested.toLocaleString('en-GB')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setWarningDismissed(true)}
                  className="px-3 py-1.5 rounded-md bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-sm font-semibold transition-colors"
                >
                  Keep {entered.toLocaleString('en-GB')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-muted-foreground mt-3 text-xs">
        Your mileage helps us confirm the right cover for your vehicle.
      </p>
    </div>
  );
};

export default MileageWithMotInput;
