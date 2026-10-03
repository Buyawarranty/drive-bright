import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, CalendarDays, Check, Clock3, LockKeyhole, Phone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { validateCustomerDob } from '@/lib/customerDob';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.png.asset.json';
import bumperLogo from '@/assets/bumper-logo-transparent.png';

type Props = {
  day: string;
  month: string;
  year: string;
  onChange: (next: { dob_day?: string; dob_month?: string; dob_year?: string }) => void;
  onBack: () => void;
  onContinue: () => void;
  isLoading: boolean;
  showError: boolean;
  monthlyPrice: number;
  totalPrice: number;
  vehicleReg: string;
  vehicleName: string;
  duration: string;
  planName: string;
  claimLimit: number;
  excess: number;
  labourRate: number;
  startDate?: Date;
};

const steps = [
  { label: 'Vehicle', complete: true },
  { label: 'Cover', complete: true },
  { label: 'Details', complete: true },
  { label: 'Date of birth', complete: false },
];

export default function BumperDobPage({
  day,
  month,
  year,
  onChange,
  onBack,
  onContinue,
  isLoading,
  showError,
  monthlyPrice,
  totalPrice,
  vehicleReg,
  vehicleName,
  duration,
  planName,
  claimLimit,
  excess,
  labourRate,
  startDate,
}: Props) {
  const [touched, setTouched] = useState(false);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const validationError = validateCustomerDob({ day, month, year });
  const complete = Boolean(day && month && year.length === 4);
  const visibleError = validationError && (showError || (touched && complete)) ? validationError : null;
  const digits = (value: string, length: number) => value.replace(/\D/g, '').slice(0, length);
  const inputClass = `h-14 w-full rounded-md border bg-background px-4 text-lg font-semibold text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ${
    visibleError ? 'border-destructive' : complete && !validationError ? 'border-success' : 'border-input'
  }`;
  const startLabel = startDate
    ? startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Today';

  return (
    <div className="min-h-screen bg-secondary/55 text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-3 sm:px-6">
          <img src={buyawarrantyLogo.url} alt="Buy A Warranty" className="h-8 w-auto sm:h-10" />
          <div className="hidden flex-1 items-center justify-center md:flex">
            {steps.map((step, index) => (
              <React.Fragment key={step.label}>
                <div className="flex min-w-20 flex-col items-center gap-1">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step.complete ? 'bg-success text-success-foreground' : 'bg-primary text-primary-foreground'}`}>
                    {step.complete ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
                  </span>
                  <span className={`text-xs font-medium ${step.complete ? 'text-muted-foreground' : 'text-primary'}`}>{step.label}</span>
                </div>
                {index < steps.length - 1 && <span className="mb-5 h-px w-12 bg-border lg:w-20" />}
              </React.Fragment>
            ))}
          </div>
          <a href="tel:03302295040" className="flex items-center gap-2 text-sm font-bold text-foreground sm:text-base">
            <Phone className="h-4 w-4" />
            <span>0330 229 5040</span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isLoading} className="mb-5 -ml-3 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to review and pay
        </Button>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-5 sm:px-8 sm:py-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-primary">Monthly payments</p>
                  <h1 className="mt-1 text-2xl font-bold sm:text-3xl">One last detail</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                    Enter your date of birth so Bumper can verify your identity and run a quick eligibility check.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Powered by</span>
                  <img src={bumperLogo} alt="Bumper" className="h-5 w-auto" />
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-8">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 sm:p-6">
                <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_240px] md:items-end">
                  <div>
                    <h2 className="text-base font-bold">Your date of birth</h2>
                    <div className="mt-4 grid grid-cols-[1fr_1fr_1.45fr] gap-2 sm:gap-3">
                      <label className="text-xs font-medium text-muted-foreground">
                        Day
                        <input
                          inputMode="numeric"
                          autoComplete="bday-day"
                          placeholder="DD"
                          aria-label="Day of birth"
                          className={inputClass}
                          value={day}
                          onChange={(event) => {
                            const value = digits(event.target.value, 2);
                            onChange({ dob_day: value });
                            if (value.length === 2) monthRef.current?.focus();
                          }}
                          onBlur={() => setTouched(true)}
                        />
                      </label>
                      <label className="text-xs font-medium text-muted-foreground">
                        Month
                        <input
                          ref={monthRef}
                          inputMode="numeric"
                          autoComplete="bday-month"
                          placeholder="MM"
                          aria-label="Month of birth"
                          className={inputClass}
                          value={month}
                          onChange={(event) => {
                            const value = digits(event.target.value, 2);
                            onChange({ dob_month: value });
                            if (value.length === 2) yearRef.current?.focus();
                          }}
                          onBlur={() => setTouched(true)}
                        />
                      </label>
                      <label className="text-xs font-medium text-muted-foreground">
                        Year
                        <span className="relative block">
                          <input
                            ref={yearRef}
                            inputMode="numeric"
                            autoComplete="bday-year"
                            placeholder="YYYY"
                            aria-label="Year of birth"
                            className={`${inputClass} pr-11`}
                            value={year}
                            onChange={(event) => onChange({ dob_year: digits(event.target.value, 4) })}
                            onBlur={() => setTouched(true)}
                          />
                          <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        </span>
                      </label>
                    </div>
                    {visibleError && <p role="alert" className="mt-2 text-sm font-semibold text-destructive">{visibleError}</p>}
                  </div>

                  <ul className="space-y-3 border-t border-border pt-5 text-sm md:border-l md:border-t-0 md:pl-6 md:pt-0">
                    <li className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-success" /> Soft eligibility search</li>
                    <li className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-success" /> No impact on your credit score</li>
                    <li className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-success" /> Usually takes around 60 seconds</li>
                  </ul>
                </div>
              </div>

              <Button
                type="button"
                size="lg"
                disabled={Boolean(validationError) || isLoading}
                onClick={onContinue}
                className="mt-5 h-13 w-full text-base font-bold"
              >
                {isLoading ? 'Connecting securely…' : <>Continue to eligibility check <ArrowRight className="h-5 w-5" /></>}
              </Button>
              <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                <LockKeyhole className="h-4 w-4" /> Your details are encrypted and sent securely to Bumper.
              </p>
            </div>
          </section>

          <aside className="overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:sticky lg:top-5">
            <div className="border-b border-border p-5">
              <h2 className="text-lg font-bold">Your order summary</h2>
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{vehicleName || 'Your vehicle'}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{duration} · {planName}</p>
                  <p className="text-sm text-muted-foreground">Starts {startLabel}</p>
                </div>
                <span className="rounded border border-foreground/30 bg-secondary px-2 py-1 font-mono text-xs font-bold uppercase">{vehicleReg}</span>
              </div>
              <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Claim limit</dt><dd className="font-semibold">£{claimLimit.toLocaleString()}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Your excess</dt><dd className="font-semibold">£{excess} per claim</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Labour rate</dt><dd className="font-semibold">Up to £{labourRate}/hr</dd></div>
              </dl>
            </div>

            <div className="border-b border-primary/20 bg-primary/5 p-5">
              <p className="text-sm font-bold">Your monthly payment plan</p>
              <p className="mt-1 text-3xl font-bold text-primary">£{monthlyPrice} today</p>
              <p className="mt-1 text-sm">Then 11 monthly payments of £{monthlyPrice}</p>
              <p className="mt-1 text-sm font-semibold">£{totalPrice} total payable · 0% APR</p>
              <div className="mt-4 grid grid-cols-12 gap-1" aria-label="12 monthly payments">
                {Array.from({ length: 12 }, (_, index) => (
                  <span key={index} className={`flex aspect-square items-center justify-center rounded-full text-[10px] font-bold ${index === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                    {index + 1}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-5">
              <p className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-5 w-5 text-success" /> What’s included?</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {['Mechanical and electrical components', 'Nationwide approved repairers', 'Parts, labour and diagnostics', 'Claims handled by real people'].map((item) => (
                  <li key={item} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-success" strokeWidth={3} /> {item}</li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        <div className="mt-5 grid gap-3 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground sm:grid-cols-3 sm:text-sm">
          <p className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-success" /> 256-bit SSL secure checkout</p>
          <p className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-success" /> Soft search only</p>
          <p className="flex items-center gap-2"><Phone className="h-5 w-5 text-success" /> UK support 0330 229 5040</p>
        </div>
      </main>
    </div>
  );
}