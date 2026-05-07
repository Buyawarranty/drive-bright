import React from 'react';
import { ArrowRight, ArrowLeft, Check, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CLAIM_LIMIT_TIERS, isPremiumVehicle } from '@/lib/claimLimitTiers';
import Step3Header from './Step3Header';

type PaymentType = '12months' | '24months' | '36months';

interface MobileSteppedFlowProps {
  vehicleData: {
    regNumber: string;
    make?: string;
    model?: string;
    fuelType?: string;
    year?: string;
  };
  onBack: () => void;
  // Selections
  selectedClaimLimit: number | null;
  onClaimLimitChange: (v: number) => void;
  selectedLabourRate: number;
  onLabourRateChange: (v: number) => void;
  paymentType: PaymentType | null;
  onPaymentTypeChange: (v: PaymentType) => void;
  voluntaryExcess: number | null;
  onVoluntaryExcessChange: (v: number) => void;
  availableDurations: PaymentType[];
  // Pricing
  currentMonthlyPrice: number;
  currentTotalPrice: number;
  calculateMonthlyPrice: (term: string) => number;
  // Continue
  onContinue: () => void;
  isLoading: boolean;
  isFormValid: boolean;
}

const LABOUR_RATES = [
  { value: 50, label: 'Local garages', sub: 'Small independents, best value' },
  { value: 75, label: 'Independent', sub: 'Trusted local garages', popular: true },
  { value: 100, label: 'Approved', sub: 'Nationwide branded chains' },
  { value: 150, label: 'Expert', sub: 'Main dealers & specialists' },
];

const TERMS: { value: PaymentType; label: string; sub: string; popular?: boolean }[] = [
  { value: '12months', label: '1 Year cover', sub: 'Pay over 12 months' },
  { value: '24months', label: '2 Years cover', sub: 'Year 2 free · best value', popular: true },
  { value: '36months', label: '3 Years cover', sub: 'Years 2 & 3 free' },
];

const EXCESSES = [
  { value: 0, label: 'No excess', sub: 'Pay nothing per claim' },
  { value: 50, label: '£50 excess', sub: 'Lower your monthly cost' },
  { value: 100, label: '£100 excess', sub: 'Most popular balance', popular: true },
  { value: 150, label: '£150 excess', sub: 'Cheapest monthly price' },
];

const STEP_TITLES = [
  "What's your car worth?",
  'Where do you get it fixed?',
  'How long do you want cover?',
  'Choose your excess',
  'Review your cover',
];

const STEP_SUBTITLES = [
  'Set your claim limit to match your car value.',
  'Pick the labour rate that suits your usual garage.',
  'Longer terms unlock free years.',
  'Excess is what you pay towards a claim. Lower excess = higher monthly cost.',
  "You're all set — review and continue.",
];

const TOTAL_STEPS = 5;

const MobileSteppedFlow: React.FC<MobileSteppedFlowProps> = ({
  vehicleData,
  onBack,
  selectedClaimLimit,
  onClaimLimitChange,
  selectedLabourRate,
  onLabourRateChange,
  paymentType,
  onPaymentTypeChange,
  voluntaryExcess,
  onVoluntaryExcessChange,
  availableDurations,
  currentMonthlyPrice,
  currentTotalPrice,
  calculateMonthlyPrice,
  onContinue,
  isLoading,
  isFormValid,
}) => {
  const [step, setStep] = React.useState(0);

  const isPremium = isPremiumVehicle(vehicleData?.make);
  const claimTiers = isPremium
    ? CLAIM_LIMIT_TIERS.filter(t => t.value !== 5000)
    : [...CLAIM_LIMIT_TIERS];

  const visibleTerms = TERMS.filter(t => availableDurations.includes(t.value));

  const canAdvance = (() => {
    if (step === 0) return selectedClaimLimit !== null;
    if (step === 1) return selectedLabourRate !== null;
    if (step === 2) return paymentType !== null;
    if (step === 3) return voluntaryExcess !== null;
    return true;
  })();

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onContinue();
    }
  };

  const handleBack = () => {
    if (step === 0) {
      onBack();
    } else {
      setStep(s => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Whisper price after selection
  const whisper = currentMonthlyPrice > 0
    ? `From £${currentMonthlyPrice}/mo with this choice`
    : null;

  return (
    <div className="min-h-screen bg-background pb-[calc(14rem+env(safe-area-inset-bottom))]">
      <Step3Header currentStep={0} />

      {/* Progress bar */}
      <div className="px-4 pt-4">
        <div className="flex gap-1.5 mb-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-1.5 rounded-full transition-colors',
                i < step ? 'bg-success' : i === step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
        <p className="text-primary text-sm font-semibold text-center">
          Step {step + 1} of {TOTAL_STEPS} — {STEP_TITLES[step].toLowerCase()}
        </p>
      </div>

      {/* Vehicle chip */}
      <div className="mx-4 mt-4 bg-blue-50 rounded-lg px-3 py-2 flex items-center justify-between text-sm">
        <span className="text-foreground">
          {vehicleData.year} {vehicleData.make} · {vehicleData.fuelType}{' '}
          <span className="ml-1 inline-block bg-yellow-300 text-foreground font-bold px-1.5 py-0.5 rounded">
            {vehicleData.regNumber}
          </span>
        </span>
        <button onClick={onBack} className="text-primary font-semibold">
          Change
        </button>
      </div>

      {/* Card */}
      <div className="mx-4 mt-4 bg-card border border-border rounded-2xl p-4 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
            {step + 1}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground leading-tight">
              {STEP_TITLES[step]}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {STEP_SUBTITLES[step]}
            </p>
          </div>
          <Info className="w-5 h-5 text-success flex-shrink-0 mt-1" />
        </div>

        {/* Step content */}
        {step === 0 && (
          <div className="space-y-2.5">
            {claimTiers.map(tier => {
              const selected = selectedClaimLimit === tier.value;
              return (
                <OptionRow
                  key={tier.value}
                  selected={selected}
                  popular={tier.popular}
                  onClick={() => onClaimLimitChange(tier.value)}
                  primary={`£${(tier.displayValue ?? tier.value).toLocaleString()} limit`}
                  secondary={getCarValueLabel(tier.value)}
                  trailing={tier.name}
                />
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2.5">
            {LABOUR_RATES.map(rate => {
              const selected = selectedLabourRate === rate.value;
              return (
                <OptionRow
                  key={rate.value}
                  selected={selected}
                  popular={rate.popular}
                  onClick={() => onLabourRateChange(rate.value)}
                  primary={`£${rate.value}/hr · ${rate.label}`}
                  secondary={rate.sub}
                />
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2.5">
            {visibleTerms.map(term => {
              const selected = paymentType === term.value;
              const monthly = calculateMonthlyPrice(term.value);
              return (
                <OptionRow
                  key={term.value}
                  selected={selected}
                  popular={term.popular}
                  onClick={() => onPaymentTypeChange(term.value)}
                  primary={term.label}
                  secondary={term.sub}
                  trailing={`£${monthly}/mo`}
                />
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2.5">
            {EXCESSES.map(ex => {
              const selected = voluntaryExcess === ex.value;
              const monthly = paymentType ? calculateMonthlyPrice(paymentType) : 0;
              return (
                <OptionRow
                  key={ex.value}
                  selected={selected}
                  popular={ex.popular}
                  onClick={() => onVoluntaryExcessChange(ex.value)}
                  primary={ex.label}
                  secondary={ex.sub}
                  trailing={selected && monthly ? `£${monthly}/mo` : undefined}
                />
              );
            })}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <SummaryRow label="Cover term" value={termLabel(paymentType)} />
            <SummaryRow
              label="Claim limit"
              value={`£${getDisplay(selectedClaimLimit).toLocaleString()} per claim`}
            />
            <SummaryRow label="Labour rate" value={`£${selectedLabourRate}/hr`} />
            <SummaryRow label="Voluntary excess" value={voluntaryExcess !== null ? `£${voluntaryExcess}` : '—'} />
            <div className="border-t border-border pt-3 mt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Monthly price</span>
                <span className="text-2xl font-bold text-foreground">
                  £{currentMonthlyPrice}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-right">
                Total £{currentTotalPrice} over 12 payments
              </p>
            </div>
          </div>
        )}

        {/* Whisper */}
        {step < 4 && canAdvance && whisper && (
          <p className="mt-4 text-center text-sm font-semibold text-success animate-fade-in">
            {whisper}
          </p>
        )}
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-3 flex items-center gap-3 z-50">
        <button
          onClick={handleBack}
          className="flex-shrink-0 px-4 py-3 text-foreground font-semibold flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!canAdvance || isLoading}
          className={cn(
            'flex-1 py-3.5 rounded-lg font-bold text-base flex items-center justify-center gap-2 transition-colors',
            canAdvance && !isLoading
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {step === TOTAL_STEPS - 1
            ? isLoading
              ? 'Loading…'
              : 'Continue to checkout'
            : 'Continue'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ---- Subcomponents ----

interface OptionRowProps {
  selected: boolean;
  popular?: boolean;
  onClick: () => void;
  primary: string;
  secondary?: string;
  trailing?: string;
}

const OptionRow: React.FC<OptionRowProps> = ({
  selected,
  popular,
  onClick,
  primary,
  secondary,
  trailing,
}) => (
  <button
    onClick={onClick}
    className={cn(
      'relative w-full text-left rounded-xl border-2 p-3.5 transition-all',
      selected
        ? 'border-primary bg-primary/5'
        : 'border-border bg-card hover:border-primary/50'
    )}
  >
    {popular && (
      <span className="absolute -top-2 right-3 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">
        Most popular
      </span>
    )}
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-bold text-foreground text-base leading-tight">{primary}</div>
        {secondary && (
          <div className="text-xs text-muted-foreground mt-0.5">{secondary}</div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {trailing && (
          <span className="text-sm font-semibold text-foreground">{trailing}</span>
        )}
        {selected ? (
          <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full border-2 border-border" />
        )}
      </div>
    </div>
  </button>
);

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-semibold text-foreground">{value}</span>
  </div>
);

// ---- Helpers ----

function getCarValueLabel(value: number): string {
  if (value === 750) return 'Car value up to £5,000';
  if (value === 2000) return 'Car value £5k–£12k';
  if (value === 3000) return 'Car value £12k–£25k';
  if (value === 5000) return 'Car value over £25k';
  return '';
}

function getDisplay(value: number | null): number {
  if (!value) return 0;
  const tier = CLAIM_LIMIT_TIERS.find(t => t.value === value);
  return tier?.displayValue ?? value;
}

function termLabel(t: PaymentType | null): string {
  if (t === '12months') return '1 Year';
  if (t === '24months') return '2 Years (Year 2 free)';
  if (t === '36months') return '3 Years (Years 2 & 3 free)';
  return '—';
}

export default MobileSteppedFlow;
