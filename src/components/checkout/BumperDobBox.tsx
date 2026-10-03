import React, { useRef, useState } from 'react';
import { ArrowRight, BarChart3, Clock, Lock, ShieldCheck } from 'lucide-react';
import { validateCustomerDob } from '@/lib/customerDob';

type Props = {
  day: string;
  month: string;
  year: string;
  onChange: (next: { dob_day?: string; dob_month?: string; dob_year?: string }) => void;
  onContinue: () => void;
  isLoading?: boolean;
  showError?: boolean;
};

/** "One last detail" — DOB collected on our page before handing over to Bumper. */
export default function BumperDobBox({ day, month, year, onChange, onContinue, isLoading, showError }: Props) {
  const [touched, setTouched] = useState(false);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const error = validateCustomerDob({ day, month, year });
  const complete = !!day && !!month && year.length === 4;
  const visibleError = error && (showError || (touched && complete)) ? error : null;

  const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);
  const inputCls =
    'h-12 w-full rounded-lg border bg-background px-3 text-base outline-none focus:ring-2 focus:ring-primary/30 ' +
    (visibleError ? 'border-destructive' : complete && !error ? 'border-green-500' : 'border-border');

  return (
    <section id="bumper-dob-section" className="mt-4 rounded-xl border-2 border-orange-300 bg-orange-50/60 p-5 sm:p-6">
      <h3 className="text-lg font-bold text-foreground">One last detail</h3>
      <p className="mt-1 text-sm text-foreground">
        We need your date of birth to verify your identity and run a quick soft search for your monthly payment plan.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">This won't affect your credit score and usually takes around 60 seconds.</p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="grid flex-1 grid-cols-[1fr_1fr_1.4fr] gap-2">
          <label className="text-xs text-muted-foreground">
            Day
            <input
              inputMode="numeric" autoComplete="bday-day" placeholder="DD" aria-label="Day of birth"
              className={inputCls} value={day}
              onChange={(e) => {
                const v = digits(e.target.value, 2);
                onChange({ dob_day: v });
                if (v.length === 2) monthRef.current?.focus();
              }}
              onBlur={() => setTouched(true)}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Month
            <input
              ref={monthRef} inputMode="numeric" autoComplete="bday-month" placeholder="MM" aria-label="Month of birth"
              className={inputCls} value={month}
              onChange={(e) => {
                const v = digits(e.target.value, 2);
                onChange({ dob_month: v });
                if (v.length === 2) yearRef.current?.focus();
              }}
              onBlur={() => setTouched(true)}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Year
            <input
              ref={yearRef} inputMode="numeric" autoComplete="bday-year" placeholder="YYYY" aria-label="Year of birth"
              className={inputCls} value={year}
              onChange={(e) => onChange({ dob_year: digits(e.target.value, 4) })}
              onBlur={() => setTouched(true)}
            />
          </label>
        </div>
        <ul className="space-y-1.5 text-sm text-foreground sm:border-l sm:border-border sm:pl-4">
          <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-green-600" /> Soft search</li>
          <li className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-green-600" /> No impact on your credit score</li>
          <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-green-600" /> Usually takes around 60 seconds</li>
        </ul>
      </div>
      {visibleError && <p className="mt-2 text-sm font-medium text-destructive">{visibleError}</p>}

      <button
        type="button"
        disabled={!!error || isLoading}
        onClick={onContinue}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-orange-500 text-base font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? 'Please wait…' : <>Continue with monthly payments <ArrowRight className="h-5 w-5" /></>}
      </button>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" /> We'll run a soft search first. This won't affect your credit score.
      </p>
    </section>
  );
}
