import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface TermOption {
  id: '12months' | '24months' | '36months';
  label: string;
  subtitle: string;
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

  // Pay in full price = monthly × 12 (what user actually pays)
  const getPayInFullPrice = (termId: string): number => {
    const monthly = getPriceForTerm(termId);
    return monthly * 12;
  };

  // Calculate cost per month of cover (total ÷ months of cover)
  const getCostPerMonthOfCover = (termId: string): number => {
    const total = getTotalForTerm(termId);
    const coverMonths = termId === '12months' ? 12 : termId === '24months' ? 24 : 36;
    return Math.round(total / coverMonths);
  };

  // Calculate pay in full discount (10% off)
  const getPayInFullDiscount = (termId: string): { wasPrice: number; nowPrice: number; savings: number } => {
    const total = getTotalForTerm(termId);
    const savings = Math.round(total * 0.10);
    return {
      wasPrice: total,
      nowPrice: total - savings,
      savings
    };
  };

  const allTerms: TermOption[] = [
    {
      id: '24months',
      label: '2-Year Cover',
      subtitle: 'Better value per month',
      monthlyPrice: getPriceForTerm('24months'),
      isPopular: true
    },
    {
      id: '12months',
      label: '1-Year Cover',
      subtitle: 'Short-term protection',
      monthlyPrice: getPriceForTerm('12months')
    },
    {
      id: '36months',
      label: '3-Year Cover',
      subtitle: 'Lowest cost per month of cover',
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

  // Get card styling based on term type
  const getCardStyles = (term: TermOption, isSelected: boolean) => {
    if (term.isBestValue) {
      return {
        border: isSelected ? 'border-green-500' : 'border-green-300',
        bg: isSelected ? 'bg-green-50/50' : 'bg-white',
        hover: 'hover:border-green-400'
      };
    }
    if (term.isPopular) {
      return {
        border: isSelected ? 'border-orange-500' : 'border-orange-300',
        bg: isSelected ? 'bg-orange-50/50' : 'bg-white',
        hover: 'hover:border-orange-400'
      };
    }
    // 1-year - neutral/grey
    return {
      border: isSelected ? 'border-slate-400' : 'border-slate-200',
      bg: isSelected ? 'bg-slate-50/50' : 'bg-white',
      hover: 'hover:border-slate-300'
    };
  };

  return (
    <div className="px-4 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
            1
          </div>
          <h3 className="font-semibold text-lg text-foreground">Choose your cover duration</h3>
        </div>
      </div>

      <div className="space-y-4">
        {visibleTerms.map((term) => {
          const isSelected = selectedTerm === term.id;
          const costPerMonth = getCostPerMonthOfCover(term.id);
          const totalCost = getTotalForTerm(term.id);
          const monthlyPayment = term.monthlyPrice;
          const payInFull = getPayInFullDiscount(term.id);
          const cardStyles = getCardStyles(term, isSelected);
          
          return (
            <button
              key={term.id}
              onClick={() => onTermChange(term.id)}
              className={cn(
                "w-full p-4 sm:p-5 rounded-xl border-2 text-left transition-all relative",
                cardStyles.border,
                cardStyles.bg,
                cardStyles.hover,
                isSelected && "shadow-md"
              )}
            >
              {/* Badges */}
              {term.isPopular && (
                <span className="absolute -top-3 right-4 bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm uppercase tracking-wide">
                  Most Popular
                </span>
              )}
              {term.isBestValue && (
                <span className="absolute -top-3 right-4 bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm uppercase tracking-wide">
                  Best Value
                </span>
              )}

              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Term label and subtitle */}
                  <div className="mb-3 sm:mb-4">
                    <span className="font-bold text-lg sm:text-xl text-foreground block">{term.label}</span>
                    <p className="text-sm text-muted-foreground">{term.subtitle}</p>
                  </div>
                  
                  {/* Cost per month of cover - HERO PRICE */}
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Cost per month of cover</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn(
                        "text-3xl sm:text-4xl font-bold",
                        term.isBestValue && "text-green-600",
                        term.isPopular && "text-orange-600",
                        !term.isBestValue && !term.isPopular && "text-slate-700"
                      )}>
                        £{costPerMonth}
                      </span>
                      <span className="text-base text-muted-foreground">per month</span>
                    </div>
                  </div>

                  {/* Payment breakdown - muted grey */}
                  <div className="mb-4 space-y-1.5">
                    <p className="text-sm text-slate-500">
                      Paid monthly for 12 months
                    </p>
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold">£{monthlyPayment} per month</span>
                    </p>
                    {term.id === '24months' && (
                      <p className="text-sm font-medium text-orange-600">No payments in year 2</p>
                    )}
                    {term.id === '36months' && (
                      <p className="text-sm font-medium text-green-600">No payments in years 2 or 3</p>
                    )}
                    <p className="text-sm text-slate-600">
                      Total cost <span className="font-semibold">£{totalCost}</span>
                    </p>
                  </div>

                  {/* Pay in full option - only for 2 and 3 year */}
                  {(term.id === '24months' || term.id === '36months') && (
                    <div className={cn(
                      "rounded-lg px-3 py-2.5 mb-4",
                      term.isBestValue ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"
                    )}>
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">Or pay in full and save 10%</p>
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm text-slate-400 line-through">Was £{payInFull.wasPrice}</span>
                        <span className={cn(
                          "text-base font-bold",
                          term.isBestValue ? "text-green-700" : "text-orange-700"
                        )}>
                          Now £{payInFull.nowPrice}
                        </span>
                        <span className="text-xs text-slate-500">— one-off payment</span>
                      </div>
                      <p className={cn(
                        "text-sm font-semibold mt-1",
                        term.isBestValue ? "text-green-600" : "text-orange-600"
                      )}>
                        Save £{payInFull.savings}
                      </p>
                    </div>
                  )}

                  {/* Key benefits */}
                  <div className="space-y-1.5">
                    {term.id === '12months' && (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-slate-600">Ideal for short-term protection</span>
                      </div>
                    )}
                    
                    {term.id === '24months' && (
                      <>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          <span className="text-sm text-slate-700">Lower cost per month of cover</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          <span className="text-sm text-slate-700">Covers two MOT cycles</span>
                        </div>
                      </>
                    )}
                    
                    {term.id === '36months' && (
                      <>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-slate-700">Lowest cost per month of cover</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-slate-700">Price locked for longer</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Selection indicator */}
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ml-3 mt-1",
                  isSelected
                    ? term.isBestValue 
                      ? "bg-green-500 border-green-500"
                      : term.isPopular 
                        ? "bg-orange-500 border-orange-500"
                        : "bg-slate-500 border-slate-500"
                    : "border-slate-300 bg-white"
                )}>
                  {isSelected && <Check className="w-4 h-4 text-white" />}
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

      {/* Global explainer line */}
      <p className="text-center text-sm text-slate-500 mt-5 px-2">
        You pay monthly for 12 months on every plan. Longer cover continues automatically with no further payments.
      </p>
    </div>
  );
};

export default TermSelector;
