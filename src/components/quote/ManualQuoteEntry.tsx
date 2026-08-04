import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowRight, Check } from 'lucide-react';

export const MAX_COVERED_MILEAGE = 150000;
export const MIN_VALID_YEAR = 1950;
/** Allow up to one year ahead — next year's model year is valid. */
export const MAX_VALID_YEAR = new Date().getFullYear() + 1;

export const digitsOnly = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 7);
export const formatMileage = (value: string) => {
  const digits = digitsOnly(value);
  return digits ? Number(digits).toLocaleString('en-GB') : '';
};

/** Year is valid when a full 4-digit value between 1950 and current year. */
export const isValidYear = (value: string): boolean => {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length !== 4) return false;
  const yr = Number(digits);
  return yr >= MIN_VALID_YEAR && yr <= MAX_VALID_YEAR;
};

/** Soft validation — never rewrites or clears what the customer typed. */
export const mileageNotice = (value: string): string => {
  const digits = digitsOnly(value);
  if (!digits) return '';
  const miles = Number(digits);
  if (miles < 100) return 'That looks a little low — please enter the mileage in miles (e.g. 50,000).';
  if (miles > MAX_COVERED_MILEAGE) return 'We can only cover vehicles under 150,000 miles.';
  return '';
};

/** Small green tick with no circle, shown when a field has valid content. */
const GreenTick: React.FC<{ show: boolean; className?: string }> = ({ show, className = '' }) => {
  if (!show) return <span className={className} />;
  return (
    <span className={`pointer-events-none flex items-center justify-center text-green-600 ${className}`}>
      <Check className="w-5 h-5" strokeWidth={3} />
    </span>
  );
};

interface MileageFieldProps {
  id: string;
  value: string;
  onChange: (digits: string) => void;
  onEnter?: () => void;
  label?: string;
}

/** Numeric mileage field: mobile keypad, automatic commas, approximate values welcome. */
export const MileageField: React.FC<MileageFieldProps> = ({
  id,
  value,
  onChange,
  onEnter,
  label = "What's your approximate current mileage?",
}) => {
  const notice = mileageNotice(value);
  const digits = digitsOnly(value);
  const miles = Number(digits || '0');
  const valid = miles >= 100 && miles <= MAX_COVERED_MILEAGE;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-[#7A5A00]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9,]*"
          value={formatMileage(value)}
          onChange={(e) => onChange(digitsOnly(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnter) onEnter();
          }}
          placeholder="e.g. 50,000"
          className="w-full h-12 rounded-lg border-2 border-[#E0B24A] bg-white pl-3 pr-16 text-lg font-semibold text-gray-900 outline-none focus:border-[#F0A500]"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
          miles
        </span>
      </div>
      <p className="text-xs text-[#8A6A1F]">
        An approximate figure is fine — no need for the exact dashboard reading.
      </p>
      {notice && (
        <p className="flex items-start gap-1.5 text-sm font-medium text-amber-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{notice}</span>
        </p>
      )}
      <GreenTick show={valid} className="-mt-1" />
    </div>
  );
};

interface ManualVehicleEntryCardProps {
  make: string;
  model: string;
  year: string;
  mileage: string;
  onChange: (patch: { make?: string; model?: string; year?: string; mileage?: string }) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  error?: string;
  idPrefix?: string;
}

/** Manual route shown when a registration can't be matched. */
export const ManualVehicleEntryCard: React.FC<ManualVehicleEntryCardProps> = ({
  make,
  model,
  year,
  mileage,
  onChange,
  onSubmit,
  isSubmitting,
  error,
  idPrefix = 'manual',
}) => {
  const miles = Number(digitsOnly(mileage) || '0');
  const yearValid = isValidYear(year);
  const mileageValid = miles >= 100 && miles <= MAX_COVERED_MILEAGE;
  const canSubmit =
    !!make.trim() && !!model.trim() && yearValid && mileageValid && !isSubmitting;

  const inputCls = (valid: boolean) =>
    `h-12 rounded-lg border-2 bg-white px-3 text-base text-gray-900 outline-none focus:border-[#F0A500] ${
      valid ? 'border-green-500' : 'border-[#E0B24A]'
    }`;

  return (
    <div className="space-y-3 rounded-xl border-2 border-[#F0A500] bg-[#FFF8E5] p-4 text-left animate-fade-in">
      <div>
        <p className="text-base font-semibold text-[#7A5A00]">Tell us about your vehicle</p>
        <p className="text-sm text-[#8A6A1F] mt-1">
          We couldn't match that registration, so pop the details in and we'll price it straight away.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <input
            id={`${idPrefix}-make`}
            value={make}
            onChange={(e) => onChange({ make: e.target.value })}
            placeholder="Make (e.g. Ford)"
            className={`${inputCls(!!make.trim())} w-full pr-10`}
          />
          <GreenTick show={!!make.trim()} className="absolute right-2 top-1/2 -translate-y-1/2" />
        </div>
        <div className="relative">
          <input
            id={`${idPrefix}-model`}
            value={model}
            onChange={(e) => onChange({ model: e.target.value })}
            placeholder="Model (e.g. Focus)"
            className={`${inputCls(!!model.trim())} w-full pr-10`}
          />
          <GreenTick show={!!model.trim()} className="absolute right-2 top-1/2 -translate-y-1/2" />
        </div>
      </div>
      <div className="relative">
        <input
          id={`${idPrefix}-year`}
          type="tel"
          inputMode="numeric"
          value={year.replace(/[^0-9]/g, '').slice(0, 4)}
          onChange={(e) => onChange({ year: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })}
          placeholder="Year (e.g. 2018)"
          className={`${inputCls(yearValid)} w-full pr-10`}
        />
        <GreenTick show={yearValid} className="absolute right-2 top-1/2 -translate-y-1/2" />
      </div>
      {year && !yearValid && (
        <p className="flex items-start gap-1.5 text-sm font-medium text-amber-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Please enter a year between {MIN_VALID_YEAR} and {CURRENT_YEAR}.</span>
        </p>
      )}
      <MileageField
        id={`${idPrefix}-mileage-field`}
        value={mileage}
        onChange={(digits) => onChange({ mileage: digits })}
        onEnter={() => canSubmit && onSubmit()}
      />
      <Button
        onClick={onSubmit}
        disabled={!canSubmit}
        className={`w-full font-bold rounded-xl px-6 py-6 text-lg bg-brand-orange hover:bg-orange-700 text-white shadow-lg ${isSubmitting ? '' : 'animate-breathing'}`}
      >
        <span className="flex items-center justify-center gap-3">
          {isSubmitting ? 'Preparing your instant price…' : 'Get my quote'}
          {!isSubmitting && <ArrowRight className="w-6 h-6" strokeWidth={3} />}
        </span>
      </Button>
      {error && (
        <div className="flex items-center gap-2 text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
};
