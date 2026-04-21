import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Star, ArrowRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
    // Always show in £ format (e.g. 189p -> £1.89) when >= £1, otherwise pence
    return daily >= 1 ? `£${daily.toFixed(2)}` : `${Math.round(daily * 100)}p`;
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
          // Headline monthly = the actual instalment (paid over 12 months for ALL terms)
          const displayMonthly = term.monthlyPrice;
          // "Equal to" daily = cost spread across the full cover period (value framing)
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
                    MOST POPULAR CHOICE
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

                {/* Price hierarchy: monthly £ + daily pence side-by-side */}
                <div className="mb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-extrabold text-foreground leading-none">
                        £{displayMonthly}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-foreground leading-none">/mo</span>
                    </div>
                    <div className="h-10 w-px bg-border" aria-hidden="true" />
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold text-gray-500 leading-none mb-1">Equal to</span>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-3xl sm:text-4xl font-bold text-gray-500 leading-none tracking-tight">
                          {dailyPrice}
                        </span>
                        <span className="text-sm font-medium text-gray-500 leading-none">/day over term</span>
                        {(term.id === '24months' || term.id === '36months') && (
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                  className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                                  aria-label="More info about daily price"
                                >
                                  <Info className="w-3.5 h-3.5" strokeWidth={2.5} />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                                This works out at {dailyPrice} a day across your {term.id === '36months' ? '3 years' : '2 years'} of cover. As payments are spread over 12 months, your monthly instalment will be £{displayMonthly}.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-gray-500 mt-1">
                        over {term.id === '36months' ? '3 years' : term.id === '24months' ? '2 years' : '1 year'} of cover
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    12 payments only · 0% APR
                  </p>
                </div>


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

                {/* Pay-in-full panel: large price left, smaller savings right */}
                <div className="bg-success/10 border border-success/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-1">
                  <div>
                    <div className="text-xs font-semibold text-foreground">Pay in full</div>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-4xl sm:text-5xl font-extrabold text-foreground leading-none">£{payInFullPrice - stripeSavings}</span>
                      <span className="text-sm text-foreground/60 line-through">£{payInFullPrice}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Save 10%</div>
                    <div className="text-base sm:text-lg font-bold text-foreground leading-none mt-0.5">
                      £{stripeSavings} today
                    </div>
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
