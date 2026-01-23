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

  const getCostPerMonthOfCover = (termId: string): number => {
    const total = getTotalForTerm(termId);
    const years = termId === '12months' ? 1 : termId === '24months' ? 2 : 3;
    const coverMonths = years * 12;
    const monthlyInstalment = getPriceForTerm(termId);
    
    // Base CPM calculation (rounded to nearest pound)
    let cpm = Math.round(total / coverMonths);
    
    // Guardrail: CPM × years must be >= monthly instalment
    // This ensures the representative CPM never looks cheaper than the actual payment
    while (cpm * years < monthlyInstalment) {
      cpm += 1;
    }
    
    return cpm;
  };

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

  const terms = allTerms.filter(t => availableDurations.includes(t.id));
  const defaultTerm = terms.find(t => t.isPopular) || terms[0];
  const visibleTerms = showAllOptions ? terms : [defaultTerm];

  return (
    <div className="px-4 py-6">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-7 h-7 rounded-full bg-[#000000] text-white flex items-center justify-center text-sm font-bold">
          1
        </div>
        <h3 className="font-semibold text-lg text-[#000000]">Choose your cover duration</h3>
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {visibleTerms.map((term) => {
          const isSelected = selectedTerm === term.id;
          const costPerMonth = getCostPerMonthOfCover(term.id);
          const totalCost = getTotalForTerm(term.id);
          const monthlyPayment = term.monthlyPrice;
          const payInFull = getPayInFullDiscount(term.id);
          const showPayInFull = term.id !== '12months';
          
          return (
            <div
              key={term.id}
              onClick={() => onTermChange(term.id)}
              className={cn(
                "w-full p-6 rounded-lg border bg-[#FAFAFA] cursor-pointer transition-all",
                isSelected 
                  ? "border-[#000000] border-2" 
                  : "border-[#E5E5E5] hover:border-[#999999]"
              )}
            >
              {/* Header Row */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h4 className="text-lg font-bold text-[#000000]">{term.label}</h4>
                  {isSelected && (
                    <span className="text-xs font-medium text-[#000000] uppercase tracking-wider">
                      ✓ Selected
                    </span>
                  )}
                </div>
                
                {/* Radio */}
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  isSelected ? "border-[#000000] bg-[#000000]" : "border-[#999999] bg-white"
                )}>
                  {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
              </div>

              {/* Price - show equivalent for multi-year */}
              {term.id !== '12months' && (
                <div className="mb-4">
                  <p className="text-sm text-[#555555] mb-1">Cost per month of cover</p>
                  <span className="text-3xl font-bold text-[#000000]">£{costPerMonth}</span>
                  <span className="text-sm text-[#777777] ml-1">per month</span>
                </div>
              )}
              
              {/* For 1-year, just show the monthly payment */}
              {term.id === '12months' && (
                <div className="mb-4">
                  <span className="text-3xl font-bold text-[#000000]">£{monthlyPayment}</span>
                  <span className="text-sm text-[#777777] ml-1">per month</span>
                </div>
              )}

              {/* Details */}
              <div className="space-y-1 text-sm text-[#333333]">
                <p>
                  Paid monthly for 12 months <span className="font-semibold text-[#000000]">£{monthlyPayment}/month</span>
                </p>
                {term.id === '24months' && (
                  <p className="text-[#777777]">No payments in year 2</p>
                )}
                {term.id === '36months' && (
                  <p className="text-[#777777]">No payments in years 2 or 3</p>
                )}
                <p>Total cost <span className="font-semibold text-[#000000]">£{totalCost}</span></p>
              </div>

              {/* Pay in Full - only for multi-year */}
              {showPayInFull && (
                <div className="mt-5 pt-5 border-t border-[#E5E5E5]">
                  <p className="text-sm text-[#777777] mb-1">Or pay in full and save 10%</p>
                  <p className="text-sm">
                    <span className="text-[#999999] line-through">Was £{payInFull.wasPrice}</span>
                    <span className="text-[#3A8F45] font-semibold ml-2">now £{payInFull.nowPrice}</span>
                  </p>
                  <p className="text-sm font-semibold text-[#3A8F45]">You save £{payInFull.savings}</p>
                </div>
              )}

              {/* Links */}
              <div className="flex gap-4 mt-5 text-xs">
                <button 
                  className="text-[#333333] underline hover:text-[#000000]"
                  onClick={(e) => e.stopPropagation()}
                >
                  See what's included
                </button>
                <button 
                  className="text-[#333333] underline hover:text-[#000000]"
                  onClick={(e) => e.stopPropagation()}
                >
                  View full cover details
                </button>
              </div>
            </div>
          );
        })}

        {/* Toggle */}
        {terms.length > 1 && (
          <button
            onClick={() => setShowAllOptions(!showAllOptions)}
            className="w-full py-3 text-sm font-medium text-[#000000] bg-white border border-[#000000] rounded-lg hover:bg-[#F2F2F2] flex items-center justify-center gap-2"
          >
            {showAllOptions ? (
              <>Hide options <ChevronUp className="w-4 h-4" /></>
            ) : (
              <>Show all {terms.length} options <ChevronDown className="w-4 h-4" /></>
            )}
          </button>
        )}
      </div>

      {/* Footer text */}
      <p className="text-center text-xs text-[#999999] mt-6">
        All plans are paid monthly for 12 months. Longer cover continues with no further payments.
      </p>
    </div>
  );
};

export default TermSelector;
