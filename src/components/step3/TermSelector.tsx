import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TermOption {
  id: '12months' | '24months' | '36months';
  label: string;
  years: number;
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
      years: 2,
      monthlyPrice: getPriceForTerm('24months'),
      isPopular: true
    },
    {
      id: '12months',
      label: '1-Year Cover',
      years: 1,
      monthlyPrice: getPriceForTerm('12months')
    },
    {
      id: '36months',
      label: '3-Year Cover',
      years: 3,
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
      <div className="flex items-center gap-2 mb-6">
        <div className="w-7 h-7 rounded-full bg-[#000000] text-white flex items-center justify-center text-sm font-bold">
          1
        </div>
        <h3 className="font-semibold text-lg text-[#000000]">Choose your cover duration</h3>
      </div>

      <div className="space-y-4">
        {visibleTerms.map((term) => {
          const isSelected = selectedTerm === term.id;
          const costPerMonth = getCostPerMonthOfCover(term.id);
          const totalCost = getTotalForTerm(term.id);
          const monthlyPayment = term.monthlyPrice;
          const payInFull = getPayInFullDiscount(term.id);
          
          return (
            <div
              key={term.id}
              onClick={() => onTermChange(term.id)}
              className={cn(
                "w-full p-5 sm:p-6 rounded-lg border bg-white cursor-pointer transition-all relative",
                isSelected ? "border-[#000000] border-2" : "border-[#EDEDED] hover:border-[#777777]"
              )}
            >
              {/* Header with title and radio */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-xl font-bold text-[#000000]">{term.label}</h4>
                  {term.isPopular && (
                    <span className="inline-block mt-1 text-xs font-medium text-[#777777] uppercase tracking-wide">
                      Most Popular
                    </span>
                  )}
                  {term.isBestValue && (
                    <span className="inline-block mt-1 text-xs font-medium text-[#777777] uppercase tracking-wide">
                      Best Value
                    </span>
                  )}
                </div>
                
                {/* Radio indicator */}
                <div className={cn(
                  "w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-1",
                  isSelected ? "border-[#000000] bg-[#000000]" : "border-[#777777] bg-white"
                )}>
                  {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
              </div>

              {/* Hero price */}
              <div className="mb-5">
                <span className="text-4xl sm:text-5xl font-bold text-[#000000]">£{costPerMonth}</span>
                <span className="text-base text-[#777777] ml-2">per month</span>
              </div>

              {/* Payment breakdown */}
              <div className="space-y-2 mb-5 pb-5 border-b border-[#EDEDED]">
                <p className="text-sm text-[#333333]">
                  Paid monthly for 12 months{' '}
                  <span className="font-bold text-[#000000]">£{monthlyPayment} per month</span>
                </p>
                {term.id === '24months' && (
                  <p className="text-sm text-[#333333]">No payments in year 2</p>
                )}
                {term.id === '36months' && (
                  <p className="text-sm text-[#333333]">No payments in years 2 or 3</p>
                )}
                <p className="text-sm text-[#333333]">
                  Total cost <span className="font-bold text-[#000000]">£{totalCost}</span>
                </p>
              </div>

              {/* Pay in full option */}
              <div className="mb-5">
                <p className="text-sm text-[#333333] mb-2">Or pay in full and save 10%</p>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm text-[#777777] line-through">Was £{payInFull.wasPrice}</span>
                  <span className="text-lg font-bold text-[#3A8F45]">Now £{payInFull.nowPrice}</span>
                </div>
                <p className="text-sm font-semibold text-[#3A8F45] mt-1">
                  You save £{payInFull.savings}
                </p>
              </div>

              {/* Action links */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <button 
                  className="text-[#000000] underline underline-offset-2 hover:text-[#333333] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  See what's included
                </button>
                <button 
                  className="text-[#000000] underline underline-offset-2 hover:text-[#333333] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  View full cover details
                </button>
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-4 left-4 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#000000]" strokeWidth={2.5} />
                  <span className="text-xs font-medium text-[#000000] uppercase tracking-wide">Selected</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Show all options toggle */}
        {terms.length > 1 && (
          <button
            onClick={() => setShowAllOptions(!showAllOptions)}
            className="w-full py-3 px-4 text-sm font-medium text-[#000000] bg-white border border-[#000000] rounded-lg hover:bg-[#F2F2F2] flex items-center justify-center gap-2 transition-colors"
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
      <p className="text-center text-sm text-[#777777] mt-6">
        You pay monthly for 12 months on every plan. Longer cover continues automatically with no further payments.
      </p>
    </div>
  );
};

export default TermSelector;
