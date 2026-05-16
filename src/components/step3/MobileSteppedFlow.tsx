import React from 'react';
import { ArrowRight, ArrowLeft, Check, Lock, Shield, ShieldCheck, Car, Wrench, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CLAIM_LIMIT_TIERS, isPremiumVehicle } from '@/lib/claimLimitTiers';
import { getMarketingSavings, type PaymentPeriod } from '@/lib/pricingMatrix';
import trustpilotStars from '@/assets/trustpilot-5-stars.png';

type PaymentType = '12months' | '24months' | '36months';

interface MobileSteppedFlowProps {
  vehicleData: {
    regNumber: string;
    make?: string;
    model?: string;
    fuelType?: string;
    year?: string;
    mileage?: string;
  };
  onBack: () => void;
  selectedClaimLimit: number | null;
  onClaimLimitChange: (v: number) => void;
  selectedLabourRate: number;
  onLabourRateChange: (v: number) => void;
  paymentType: PaymentType | null;
  onPaymentTypeChange: (v: PaymentType) => void;
  voluntaryExcess: number | null;
  onVoluntaryExcessChange: (v: number) => void;
  availableDurations: PaymentType[];
  currentMonthlyPrice: number;
  currentTotalPrice: number;
  calculateMonthlyPrice: (term: string) => number;
  onContinue: () => void;
  isLoading: boolean;
  isFormValid: boolean;
}

// Repair preference (labour rate) options — order matches mockup top-left to bottom-right
const REPAIR_OPTIONS: {
  value: number;
  title: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  recommended?: boolean;
}[] = [
  { value: 70, title: 'Independent Garages', sub: 'Ideal for your trusted local garage', icon: ShieldCheck, recommended: true },
  { value: 100, title: 'Approved Garage', sub: 'Broader approved network', icon: Building2 },
  { value: 50, title: 'Local Garage', sub: 'Affordable everyday repairs', icon: Car },
  { value: 200, title: 'Expert Garages', sub: 'Main dealers and specialists', icon: Wrench },
];

const EXCESS_OPTIONS = [
  { value: 0, label: '£0', sub: 'Nothing to pay' },
  { value: 50, label: '£50', sub: 'Lower monthly' },
  { value: 100, label: '£100', sub: 'Best balance', best: true },
  { value: 150, label: '£150', sub: 'Lowest monthly' },
];

const TERM_META: Record<PaymentType, { years: string; payments: string; badge?: string; badgeTone?: 'orange' | 'green' }> = {
  '12months': { years: '1 Year', payments: '12 payments' },
  '24months': { years: '2 Years', payments: '24 payments', badge: 'Most Popular', badgeTone: 'orange' },
  '36months': { years: '3 Years', payments: '36 payments', badge: 'Best Value', badgeTone: 'green' },
};

const CLAIM_COPY: Record<number, { title: string; sub: string }> = {
  750: { title: 'Basic cover', sub: 'Good for smaller repairs' },
  2000: { title: 'Most popular', sub: 'Covers most common repairs' },
  3000: { title: 'Higher protection', sub: 'Greater peace of mind' },
  5000: { title: 'Maximum cover', sub: 'Complete confidence' },
};

const STEP_TITLES = ['Cover level & term', 'Repair preference', 'Review your cover'];
const TOTAL_STEPS = 3;

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
}) => {
  const [step, setStep] = React.useState(0);

  const isPremium = isPremiumVehicle(vehicleData?.make);
  const claimTiers = isPremium
    ? CLAIM_LIMIT_TIERS.filter(t => t.value !== 5000)
    : [...CLAIM_LIMIT_TIERS];

  const visibleTerms = (Object.keys(TERM_META) as PaymentType[]).filter(t =>
    availableDurations.includes(t)
  );

  const canAdvance = (() => {
    if (step === 0) return selectedClaimLimit !== null && paymentType !== null;
    if (step === 1) return !!selectedLabourRate && voluntaryExcess !== null;
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
    if (step === 0) onBack();
    else {
      setStep(s => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Footer copy
  const termMeta = paymentType ? TERM_META[paymentType] : TERM_META['24months'];
  const planLabel = `${termMeta.years} Platinum Cover`;
  const pencePerDay = currentMonthlyPrice > 0
    ? Math.round((currentMonthlyPrice * 12 * 100) / 365)
    : 0;
  const dayLabel = pencePerDay >= 100 ? `£${(pencePerDay / 100).toFixed(2)}/day` : `${pencePerDay}p/day`;
  const marketingSavings = paymentType ? getMarketingSavings(paymentType as PaymentPeriod) : 60;
  const paymentsCount = paymentType === '36months' ? 36 : paymentType === '24months' ? 24 : 12;

  return (
    <div className="min-h-screen bg-background pb-[calc(13rem+env(safe-area-inset-bottom))]">
      {/* Top bar */}
      <div className="bg-card border-b border-border sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary transition-colors -ml-1 px-1 py-1"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <a href="/" className="hover:opacity-80">
            <img
              src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png"
              alt="buyawarranty"
              className="h-6 w-auto"
            />
          </a>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            Secure
          </div>
        </div>
      </div>

      {/* Vehicle card */}
      <div className="mx-4 mt-4 bg-card border border-border rounded-xl p-3 flex items-center gap-3">
        <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <Car className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-foreground text-sm leading-tight">
            {vehicleData.year} {vehicleData.make} {vehicleData.model}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <span className="font-mono font-semibold text-foreground">{vehicleData.regNumber}</span>
            {vehicleData.fuelType && <> · {vehicleData.fuelType}</>}
            {vehicleData.mileage && <> · Under {Math.ceil((parseInt(String(vehicleData.mileage).replace(/[^0-9]/g, '')) || 0) / 10000) * 10000} miles</>}
          </div>
        </div>
        <button onClick={onBack} className="text-primary text-sm font-semibold">Edit</button>
      </div>


      {/* Step content */}
      <div className="px-4 mt-4 space-y-6">
        {step === 0 && (
          <>
            {/* Cover level */}
            <section>
              <h2 className="text-base font-bold text-foreground">1. Choose your cover level</h2>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Select the amount we'll pay towards repairs
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {claimTiers.map(tier => {
                  const selected = selectedClaimLimit === tier.value;
                  const copy = CLAIM_COPY[tier.value] || { title: tier.shortName, sub: '' };
                  const recommended = tier.value === 2000;
                  return (
                    <button
                      key={tier.value}
                      onClick={() => onClaimLimitChange(tier.value)}
                      className={cn(
                        'relative text-left rounded-xl border-2 p-3 transition-all',
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/40'
                      )}
                    >
                      {recommended && (
                        <span className="absolute -top-2 right-2 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded">
                          Recommended
                        </span>
                      )}
                      <div className="text-lg font-bold text-foreground leading-tight">
                        £{tier.displayValue.toLocaleString()}
                      </div>
                      <div className="text-xs font-semibold text-foreground mt-1">{copy.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{copy.sub}</div>
                      <div className="mt-2 flex justify-end">
                        <RadioDot selected={selected} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Cover length */}
            <section>
              <h2 className="text-base font-bold text-foreground">2. Choose your cover length</h2>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Longer cover means more savings
              </p>
              <div className="grid grid-cols-3 gap-2">
                {visibleTerms.map(term => {
                  const selected = paymentType === term;
                  const monthly = calculateMonthlyPrice(term);
                  const meta = TERM_META[term];
                  return (
                    <button
                      key={term}
                      onClick={() => onPaymentTypeChange(term)}
                      className={cn(
                        'relative rounded-xl border-2 p-3 text-center transition-all',
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/40'
                      )}
                    >
                      {meta.badge && (
                        <span
                          className={cn(
                            'absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap text-white',
                            meta.badgeTone === 'green' ? 'bg-success' : 'bg-primary'
                          )}
                        >
                          {meta.badge}
                        </span>
                      )}
                      <div className="text-xs font-semibold text-foreground">{meta.years}</div>
                      <div className="text-base font-bold text-foreground mt-1">£{monthly}<span className="text-[10px] font-normal text-muted-foreground">/mo</span></div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{meta.payments}</div>
                      <div className="mt-2 flex justify-center">
                        <RadioDot selected={selected} small />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {step === 1 && (
          <>
            <section>
              <h2 className="text-base font-bold text-foreground">1. Where would you repair your car?</h2>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                This helps us tailor your cover and price
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {REPAIR_OPTIONS.map(opt => {
                  const selected = selectedLabourRate === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => onLabourRateChange(opt.value)}
                      className={cn(
                        'relative text-left rounded-xl border-2 p-3 transition-all min-h-[110px] flex flex-col',
                        selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                      )}
                    >
                      {opt.recommended && (
                        <span className="absolute -top-2 left-2 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded">
                          Recommended
                        </span>
                      )}
                      <Icon className={cn('w-5 h-5 mb-1.5', selected ? 'text-primary' : 'text-muted-foreground')} />
                      <div className="text-sm font-bold text-foreground leading-tight">{opt.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{opt.sub}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="text-base font-bold text-foreground">2. Choose your excess</h2>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Higher excess lowers your monthly payments
              </p>
              <div className="grid grid-cols-4 gap-2">
                {EXCESS_OPTIONS.map(ex => {
                  const selected = voluntaryExcess === ex.value;
                  return (
                    <button
                      key={ex.value}
                      onClick={() => onVoluntaryExcessChange(ex.value)}
                      className={cn(
                        'relative rounded-xl border-2 p-2 text-center transition-all',
                        selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                      )}
                    >
                      {ex.best && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                          Best
                        </span>
                      )}
                      <div className="text-sm font-bold text-foreground">{ex.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{ex.sub}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Review your cover</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Please check everything looks right</p>
            </div>

            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              <ReviewRow label="Cover level" value={`£${getDisplay(selectedClaimLimit).toLocaleString()}`} onEdit={() => setStep(0)} />
              <ReviewRow label="Cover length" value={termMeta.years} onEdit={() => setStep(0)} />
              <ReviewRow label="Repair preference" value={REPAIR_OPTIONS.find(o => o.value === selectedLabourRate)?.title || '—'} onEdit={() => setStep(1)} />
              <ReviewRow label="Excess" value={voluntaryExcess !== null ? `£${voluntaryExcess}` : '—'} onEdit={() => setStep(1)} />
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-bold text-foreground mb-3">What's included</h3>
              <ul className="space-y-2">
                {[
                  'Mechanical & electrical components',
                  'Nationwide garage network',
                  'Labour, parts & diagnosis',
                  'No hidden catches or exclusions',
                  '14-day money-back guarantee',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <a
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm"
            >
              <span className="font-bold text-foreground">Excellent</span>
              <img src={trustpilotStars} alt="Trustpilot 5 stars" className="h-4 w-auto" />
              <span className="text-muted-foreground">4.8 out of 5</span>
            </a>
          </section>
        )}
      </div>

      {/* Sticky quote + CTA footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <div className="px-4 pt-3 pb-[env(safe-area-inset-bottom,8px)]">
          <div className="bg-card rounded-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-muted-foreground">Your quote</div>
                <div className="text-xs font-semibold text-foreground leading-tight">{planLabel}</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-extrabold text-foreground">£{currentMonthlyPrice}</span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </div>
                <div className="text-[11px] text-muted-foreground">Equal to {dayLabel}</div>
              </div>
              <div className="text-right flex-shrink-0">
                {marketingSavings > 0 && (
                  <div className="text-xs font-bold text-success leading-tight">
                    Save £{marketingSavings} today
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {paymentsCount} payments of
                </div>
                <div className="text-[11px] font-semibold text-foreground">£{currentMonthlyPrice}.00</div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              {step > 0 && (
                <button
                  onClick={handleBack}
                  className="flex-shrink-0 px-3 py-3 text-foreground text-sm font-semibold flex items-center gap-1"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
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

            <div className="flex items-center justify-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>Secure checkout · 14 days to cancel</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---- Subcomponents ----

const RadioDot: React.FC<{ selected: boolean; small?: boolean }> = ({ selected, small }) => (
  <div
    className={cn(
      'rounded-full border-2 flex items-center justify-center',
      small ? 'w-4 h-4' : 'w-5 h-5',
      selected ? 'border-primary bg-primary' : 'border-border bg-card'
    )}
  >
    {selected && <div className={cn('rounded-full bg-white', small ? 'w-1.5 h-1.5' : 'w-2 h-2')} />}
  </div>
);

const ReviewRow: React.FC<{ label: string; value: string; onEdit: () => void }> = ({
  label,
  value,
  onEdit,
}) => (
  <div className="flex items-center justify-between px-4 py-3">
    <span className="text-sm text-muted-foreground">{label}</span>
    <div className="flex items-center gap-3">
      <span className="text-sm font-semibold text-foreground">{value}</span>
      <button onClick={onEdit} className="text-primary text-sm font-semibold">Edit</button>
    </div>
  </div>
);

function getDisplay(value: number | null): number {
  if (!value) return 0;
  const tier = CLAIM_LIMIT_TIERS.find(t => t.value === value);
  return tier?.displayValue ?? value;
}

export default MobileSteppedFlow;
