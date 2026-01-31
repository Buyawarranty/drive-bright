import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Flame, Wrench, Search, CheckCircle } from 'lucide-react';
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

  // Calculate Stripe 10% discount savings
  const getStripeSavings = (termId: string): number => {
    const payInFull = getPayInFullPrice(termId);
    return Math.floor(payInFull * 0.10);
  };

  const allTerms: TermOption[] = [
    {
      id: '24months',
      label: '2-Year Cover',
      description: '2-year cover',
      monthlyPrice: getPriceForTerm('24months'),
      isPopular: true
    },
    {
      id: '12months',
      label: '1-Year Cover',
      description: '1-year cover',
      monthlyPrice: getPriceForTerm('12months')
    },
    {
      id: '36months',
      label: '3-Year Cover',
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
      

      <div className="space-y-3">
        {visibleTerms.map((term) => {
          const isSelected = selectedTerm === term.id;
          const payInFullPrice = getPayInFullPrice(term.id);
          const stripeSavings = getStripeSavings(term.id);
          
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
              {/* Badge */}
              {term.isPopular && (
                <span className="absolute -top-2.5 right-4 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  Most popular
                </span>
              )}
              {term.isBestValue && (
                <span className="absolute -top-2.5 right-4 bg-success text-success-foreground text-xs font-bold px-3 py-1 rounded-full">
                  Best value
                </span>
              )}

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {/* Price Headline */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">£{term.monthlyPrice}/month</span>
                    <span className="text-sm font-bold text-muted-foreground">(12 easy payments)</span>
                  </div>
                  
                  {/* Approx cost per month for multi-year plans */}
                  {term.id === '24months' && (
                    <p className="text-sm font-bold text-gray-500 mt-1">
                      Approx. £{Math.floor(term.monthlyPrice / 2)}/month over 2 years
                    </p>
                  )}
                  {term.id === '36months' && (
                    <p className="text-sm font-bold text-gray-500 mt-1">
                      Approx. £{Math.floor(term.monthlyPrice / 3)}/month over 3 years
                    </p>
                  )}
                  
                  {/* Free year benefit line with tick */}
                  {term.id === '24months' && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Check className="w-4 h-4 text-success flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground">No payments in year 2</span>
                    </div>
                  )}
                  {term.id === '36months' && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Check className="w-4 h-4 text-success flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground">No payments in years 2 & 3</span>
                    </div>
                  )}
                  
                  {/* Pay in full */}
                  <div className="text-sm mt-2">
                    <span className="font-bold text-foreground">Pay in full £{payInFullPrice}</span>
                  </div>
                  
                  {/* 10% Stripe discount savings line */}
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-sm font-bold text-success">You save £{stripeSavings} today</span>
                  </div>
                </div>
                
                {/* Selection indicator */}
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ml-3",
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
