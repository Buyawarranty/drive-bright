import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Star, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TermOption {
  id: '12months' | '24months' | '36months';
  label: string;
  description: string;
  monthlyPrice: number;
  isPopular?: boolean;
  isBestValue?: boolean;
}

interface TermSelectorProps {
  selectedTerm: '12months' | '24months' | '36months' | null;
  onTermChange: (term: '12months' | '24months' | '36months') => void;
  availableDurations: ('12months' | '24months' | '36months')[];
  getPriceForTerm: (term: string) => number;
  getTotalForTerm: (term: string) => number;
  hasAddOnsSelected?: boolean;
  vehicleModel?: string;
  vehicleType?: string;
}

const TermSelector: React.FC<TermSelectorProps> = ({
  selectedTerm,
  onTermChange,
  availableDurations,
  getPriceForTerm,
  getTotalForTerm,
  hasAddOnsSelected = false,
  vehicleModel,
  vehicleType
}) => {
  const vehicleLabel = (vehicleModel && vehicleModel.toLowerCase() !== 'unknown')
    ? vehicleModel
    : (vehicleType || 'vehicle');
  const [showAllOptions, setShowAllOptions] = useState(false);

  // Pay in full price = monthly × 12 (what user actually pays)
  const getPayInFullPrice = (termId: string): number => {
    const monthly = getPriceForTerm(termId);
    return monthly * 12;
  };

  // Calculate Stripe 10% discount savings
  const getStripeSavings = (termId: string): number => {
    const payInFull = getPayInFullPrice(termId);
    return Math.floor(payInFull * 0.10);
  };

  const allTerms: TermOption[] = [
    {
      id: '24months',
      label: '2-year cover',
      description: '2-year cover',
      monthlyPrice: getPriceForTerm('24months'),
      isPopular: true
    },
    {
      id: '12months',
      label: '1-year cover',
      description: '1-year cover',
      monthlyPrice: getPriceForTerm('12months')
    },
    {
      id: '36months',
      label: '3-year cover',
      description: '3-year cover',
      monthlyPrice: getPriceForTerm('36months'),
      isBestValue: true
    }
  ];

  // Filter to available durations
  const terms = allTerms.filter(t => availableDurations.includes(t.id));

  // Default term to show (most popular available)
  const defaultTerm = terms.find(t => t.isPopular) || terms[0];

  // Terms to show based on expand state
  const visibleTerms = showAllOptions ? terms : [defaultTerm];

  const formatDaily = (termId: string, monthlyPrice: number): string => {
    const days = termId === '36months' ? 1095 : termId === '24months' ? 730 : 365;
    const daily = (monthlyPrice * 12) / days;
    return daily < 1 ? `${Math.round(daily * 100)}p` : `£${daily.toFixed(2)}`;
  };

  const handleContinue = (termId: '12months' | '24months' | '36months') => {
    onTermChange(termId);
    // Smooth-scroll to the next section to keep momentum (no flow change)
    setTimeout(() => {
      const next = document.querySelector('[data-step3-next]') as HTMLElement | null;
      if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
    <div className="px-4 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
            1
          </div>
          <h3 className="font-semibold text-lg text-foreground">Choose your cover duration</h3>
        </div>
        <span className="text-sm text-gray-600 font-bold text-center w-full sm:w-auto sm:text-base sm:self-center flex items-center gap-1">All parts included at no extra cost</span>
      </div>

      <div className="space-y-4 pt-3">
        {visibleTerms.map((term) => {
          const isSelected = selectedTerm === term.id;
          const payInFullPrice = getPayInFullPrice(term.id);
          const stripeSavings = getStripeSavings(term.id);
          const dailyPrice = formatDaily(term.id, term.monthlyPrice);

          return (
            <div
              key={term.id}
              className={cn(
                "relative rounded-2xl border-2 transition-all",
                term.isPopular
                  ? "border-[#FF7A00] bg-card shadow-[0_4px_20px_-8px_rgba(255,122,0,0.35)]"
                  : isSelected
                    ? "border-[#FF7A00] bg-card shadow-[0_4px_20px_-8px_rgba(255,122,0,0.35)]"
                    : "border-border bg-card"
              )}
            >
              {/* Top badge */}
              {term.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1.5 bg-[#FF7A00] text-white text-xs sm:text-sm font-bold px-4 py-1.5 rounded-full shadow-md whitespace-nowrap">
                    <Star className="w-3.5 h-3.5 fill-white" />
                    PERFECT FOR YOUR {vehicleLabel.toUpperCase()}
                  </span>
                </div>
              )}
              {term.isBestValue && (
                <div className="absolute -top-3 right-4 z-10">
                  <span className="bg-success text-success-foreground text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                    Best value
                  </span>
                </div>
              )}

              <button
                onClick={() => onTermChange(term.id)}
                className="w-full text-left p-5 sm:p-6 pt-7"
                aria-pressed={isSelected}
              >
                {/* Header row: title + selection indicator */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    {term.isPopular && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Check className="w-4 h-4 text-success" strokeWidth={3} />
                        <span className="text-sm font-semibold text-success">Most popular choice</span>
                      </div>
                    )}
                    <h4 className="text-3xl sm:text-4xl font-extrabold text-foreground leading-tight tracking-tight">
                      {term.label}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-0.5">Platinum Complete Plan</p>
                  </div>
                  <div className={cn(
                    "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0",
                    isSelected
                      ? "bg-[#FF7A00] border-[#FF7A00]"
                      : "border-border bg-card"
                  )}>
                    {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                  </div>
                </div>

                {/* Price hierarchy: daily is HERO, monthly is supporting */}
                <div className="mb-3">
                  <div className="text-xs font-bold text-[#FF7A00] uppercase tracking-wide mb-0.5">Only</div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-4xl sm:text-5xl font-extrabold text-[#FF7A00] leading-none">
                      {dailyPrice}
                    </span>
                    <span className="text-xl sm:text-2xl font-bold text-[#FF7A00] leading-none">/day</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                    <span className="text-base sm:text-lg font-semibold text-foreground">
                      £{term.monthlyPrice}/month
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                      (12 payments only)
                    </span>
                  </div>
                </div>

                {/* Approx cost per month for multi-year plans */}
                {(term.id === '24months' || term.id === '36months') && (
                  <div className="inline-block bg-white/70 border border-border/60 rounded-full px-3 py-1 mb-3">
                    <p className="text-xs sm:text-sm font-semibold text-gray-600">
                      Approx. £{Math.floor(term.monthlyPrice / (term.id === '36months' ? 3 : 2))}/month over {term.id === '36months' ? '3' : '2'} years
                    </p>
                  </div>
                )}

                {/* Free year benefit */}
                {term.id === '24months' && (
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-success flex-shrink-0" strokeWidth={3} />
                      <span className="text-sm font-medium text-foreground">No payments in year 2</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-success flex-shrink-0" strokeWidth={3} />
                      <span className="text-sm font-medium text-foreground">Includes extra benefits</span>
                    </div>
                  </div>
                )}
                {term.id === '36months' && (
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-success flex-shrink-0" strokeWidth={3} />
                      <span className="text-sm font-medium text-foreground">No payments in years 2 & 3</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-success flex-shrink-0" strokeWidth={3} />
                      <span className="text-sm font-medium text-foreground">Includes extra benefits</span>
                    </div>
                  </div>
                )}

                {/* Amplified savings panel */}
                <div className="bg-success/10 border border-success/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-1">
                  <div>
                    <div className="text-xs font-semibold text-success uppercase tracking-wide">Save</div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-success leading-none mt-0.5">
                      £{stripeSavings} today
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Pay in full</div>
                    <div className="text-sm font-bold text-foreground">£{payInFullPrice - stripeSavings}</div>
                    <div className="text-xs text-red-500 line-through">£{payInFullPrice}</div>
                  </div>
                </div>
              </button>

              {/* Forward-driving CTA */}
              <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                <button
                  onClick={() => handleContinue(term.id)}
                  className={cn(
                    "w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-bold text-base transition-all shadow-sm hover:shadow-md",
                    (term.isPopular || isSelected)
                      ? "bg-[#FF7A00] text-white hover:bg-[#e66e00]"
                      : "bg-foreground text-background hover:opacity-90"
                  )}
                >
                  Continue with {term.label}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Show all options toggle */}
        {terms.length > 1 && (
          <button
            onClick={() => setShowAllOptions(!showAllOptions)}
            className="w-full py-3 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 transition-colors"
          >
            {showAllOptions ? (
              <>
                Hide options <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                Show all {terms.length} options <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Live Price Update */}
      {selectedTerm && (
        <div className="mt-3 text-sm font-medium text-success animate-fade-in" data-step3-next>
          Updated price: £{getPriceForTerm(selectedTerm)}/month
        </div>
      )}
    </div>
  );
};

export default TermSelector;
