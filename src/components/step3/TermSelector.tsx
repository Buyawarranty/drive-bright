import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TermOption {
  id: '12months' | '24months' | '36months';
  label: string;
  subtitle: string;
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
}

const TermSelector: React.FC<TermSelectorProps> = ({
  selectedTerm,
  onTermChange,
  availableDurations,
  getPriceForTerm,
  getTotalForTerm,
  hasAddOnsSelected = false
}) => {
  const [showAllOptions, setShowAllOptions] = useState(false);

  // Calculate savings for each term (promotional savings)
  const getSavingsForTerm = (termId: string): number => {
    if (termId === '24months') return 100;
    if (termId === '36months') return 200;
    return 0;
  };

  // Pay in full price = monthly × 12 (what user actually pays)
  const getPayInFullPrice = (termId: string): number => {
    const monthly = getPriceForTerm(termId);
    return monthly * 12;
  };

  // Calculate "was" price = pay in full + savings
  const getWasPriceForTerm = (termId: string): number => {
    const payInFull = getPayInFullPrice(termId);
    const savings = getSavingsForTerm(termId);
    return payInFull + savings;
  };

  // Calculate equivalent monthly cost of cover (total ÷ months of cover)
  const getEquivalentMonthly = (termId: string): number => {
    const total = getTotalForTerm(termId);
    const coverMonths = termId === '12months' ? 12 : termId === '24months' ? 24 : 36;
    return Math.floor(total / coverMonths);
  };

  // Calculate per-year cost
  const getPerYearCost = (termId: string): number => {
    const total = getTotalForTerm(termId);
    const years = termId === '12months' ? 1 : termId === '24months' ? 2 : 3;
    return Math.floor(total / years);
  };

  const allTerms: TermOption[] = [
    {
      id: '24months',
      label: '2-Year Cover',
      subtitle: 'Better value per month',
      description: '24 months of cover. Most drivers choose this. Better value than renewing yearly.',
      monthlyPrice: getPriceForTerm('24months'),
      isPopular: true
    },
    {
      id: '12months',
      label: '1-Year Cover',
      subtitle: 'Short-term protection',
      description: '12 months of cover. Ideal if you\'re changing your car soon or just want short-term protection.',
      monthlyPrice: getPriceForTerm('12months')
    },
    {
      id: '36months',
      label: '3-Year Cover',
      subtitle: 'Lowest cost per month of cover',
      description: '36 months of cover. Best value over time. Locks in your price with no annual renewals.',
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

  return (
    <div className="px-4 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
            1
          </div>
          <h3 className="font-semibold text-lg text-foreground">Choose your cover duration</h3>
        </div>
      </div>
      
      {/* Value explanation microcopy - trust-building */}
      <div className="mb-4 px-3 py-2.5 rounded-lg text-sm bg-slate-50 border border-slate-200">
        <div className="flex items-start gap-2">
          <Search className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="text-slate-600">
            All plans are paid over 12 monthly instalments. Longer cover periods cost less per month of protection.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {visibleTerms.map((term) => {
          const isSelected = selectedTerm === term.id;
          const savings = getSavingsForTerm(term.id);
          const payInFullPrice = getPayInFullPrice(term.id);
          const equivalentMonthly = getEquivalentMonthly(term.id);
          const perYearCost = getPerYearCost(term.id);
          const showEquivalent = term.id !== '12months';
          
          return (
            <button
              key={term.id}
              onClick={() => onTermChange(term.id)}
              className={cn(
                "w-full p-4 rounded-xl border-2 text-left transition-all relative",
                isSelected
                  ? "border-success bg-success/5"
                  : "border-border bg-card hover:border-success/50"
              )}
            >
              {/* Badge - refined, trust-focused styling */}
              {term.isPopular && (
                <span className="absolute -top-2.5 right-4 bg-orange-100 text-orange-800 border border-orange-200 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                  Most popular
                </span>
              )}
              {term.isBestValue && (
                <span className="absolute -top-2.5 right-4 bg-green-100 text-green-800 border border-green-200 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                  Best value
                </span>
              )}

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Term label */}
                  <div className="mb-1">
                    <span className="font-bold text-lg text-foreground">{term.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{term.subtitle}</p>
                  
                  {/* Monthly payment headline */}
                  <div className="mb-2">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-2xl font-bold text-foreground">£{term.monthlyPrice}</span>
                      <span className="text-base text-muted-foreground">per month</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">for 12 months</p>
                  </div>
                  
                  {/* Total cost */}
                  <div className="text-sm text-muted-foreground mb-3">
                    Total cost: <span className="font-semibold text-foreground">£{payInFullPrice}</span>
                  </div>
                  
                  {/* Value per month of cover - KEY DIFFERENTIATOR */}
                  {term.id === '12months' && (
                    <div className="bg-gray-100 rounded-lg px-3 py-2">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">£{term.monthlyPrice}/month</span> of cover
                      </p>
                    </div>
                  )}
                  
                  {term.id === '24months' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                      <p className="text-sm text-orange-800">
                        Works out at <span className="font-bold">£{equivalentMonthly}/month</span> of cover
                      </p>
                      <p className="text-xs text-orange-600 mt-0.5">24 months protection, paid over 12</p>
                    </div>
                  )}
                  
                  {term.id === '36months' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <p className="text-sm text-green-800">
                        Works out at <span className="font-bold">£{equivalentMonthly}/month</span> of cover
                      </p>
                      <p className="text-xs text-green-600 mt-0.5">36 months protection, paid over 12</p>
                    </div>
                  )}
                  
                  {/* Key benefits for longer plans */}
                  {term.id === '24months' && (
                    <div className="mt-2.5 space-y-1">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">Covers 2 MOT cycles</span>
                      </div>
                    </div>
                  )}
                  
                  {term.id === '36months' && (
                    <div className="mt-2.5 space-y-1">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">Best value over time</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">Price locked — no renewals</span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Selection indicator */}
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ml-3 mt-1",
                  isSelected
                    ? "bg-success border-success"
                    : "border-border bg-card"
                )}>
                  {isSelected && <Check className="w-4 h-4 text-success-foreground" />}
                </div>
              </div>
            </button>
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
        <div className="mt-3 text-sm font-medium text-success animate-fade-in">
          Updated price: £{getPriceForTerm(selectedTerm)}/month
        </div>
      )}
    </div>
  );
};

export default TermSelector;
