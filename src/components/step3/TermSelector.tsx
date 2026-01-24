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
      id: '36months',
      label: '3-Year Cover',
      years: 3,
      monthlyPrice: getPriceForTerm('36months'),
      isBestValue: true
    },
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
    }
  ];

  const terms = allTerms.filter(t => availableDurations.includes(t.id));
  const defaultTerm = terms.find(t => t.isBestValue) || terms.find(t => t.isPopular) || terms[0];
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
          
          return (
            <div
              key={term.id}
              onClick={() => onTermChange(term.id)}
              className={cn(
                "relative w-full rounded-2xl border-2 bg-white cursor-pointer transition-all duration-200",
                isSelected 
                  ? "border-[#E65100] shadow-lg" 
                  : "border-[#E8E8E8] hover:border-[#E65100]/50 hover:shadow-md"
              )}
            >
              {/* Badge Row */}
              <div className="flex items-center justify-between px-5 pt-4">
                <div className="flex items-center gap-2">
                  {term.isBestValue && (
                    <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-[#3A8F45] text-white rounded-full">
                      Best Value
                    </span>
                  )}
                  {term.isPopular && (
                    <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-[#E65100] text-white rounded-full">
                      Most Popular
                    </span>
                  )}
                </div>
                
                {/* Selection Tick */}
                {isSelected && (
                  <div className="w-7 h-7 rounded-full bg-[#3A8F45] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" strokeWidth={3} />
                  </div>
                )}
              </div>

              {/* Main Content */}
              <div className="px-5 pt-3 pb-5">
                {/* Plan Title */}
                <h4 className="text-xl font-bold text-[#000000] mb-4">{term.label}</h4>

                {/* Primary Price: Monthly Payment - LARGEST */}
                <div className="mb-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[#000000]">£{monthlyPayment}</span>
                    <span className="text-lg text-[#555555]">/month</span>
                  </div>
                  <p className="text-sm text-[#666666] mt-1">for 12 months</p>
                </div>

                {/* No Payments Notice - for multi-year plans */}
                {term.id === '24months' && (
                  <p className="text-sm text-[#3A8F45] font-medium mb-3">
                    <Check className="w-4 h-4 inline mr-1" />
                    No payments in year 2
                  </p>
                )}
                {term.id === '36months' && (
                  <p className="text-sm text-[#3A8F45] font-medium mb-3">
                    <Check className="w-4 h-4 inline mr-1" />
                    No payments in years 2 or 3
                  </p>
                )}

                {/* Average Cost Badge - for multi-year plans */}
                {term.id !== '12months' && (
                  <div className="inline-block px-3 py-2 bg-[#F0FDF4] border border-[#3A8F45]/20 rounded-lg mb-4">
                    <p className="text-sm text-[#3A8F45] font-medium">
                      Avg. £{costPerMonth}/month over {term.years} years
                    </p>
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-[#EEEEEE] pt-4 mt-2">
                  {/* Total Cost */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#666666]">Total cost</span>
                    <span className="text-base font-bold text-[#000000]">£{totalCost}</span>
                  </div>

                  {/* Pay in Full Savings - for multi-year */}
                  {term.id !== '12months' && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-[#E5E5E5]">
                      <span className="text-sm text-[#666666]">Pay in full</span>
                      <div className="text-right">
                        <span className="text-sm text-[#999999] line-through mr-2">£{payInFull.wasPrice}</span>
                        <span className="text-base font-bold text-[#3A8F45]">£{payInFull.nowPrice}</span>
                        <span className="text-xs text-[#3A8F45] ml-1">(save £{payInFull.savings})</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Links */}
                <div className="flex gap-4 mt-5 text-xs">
                  <button 
                    className="text-[#555555] underline hover:text-[#E65100] transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    See what's included
                  </button>
                  <button 
                    className="text-[#555555] underline hover:text-[#E65100] transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View full cover details
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Toggle */}
        {terms.length > 1 && (
          <button
            onClick={() => setShowAllOptions(!showAllOptions)}
            className="w-full py-3.5 text-sm font-semibold text-[#E65100] bg-[#FFF3E0] border-2 border-[#E65100] rounded-xl hover:bg-[#FFE0B2] transition-colors flex items-center justify-center gap-2"
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
      <p className="text-center text-xs text-[#888888] mt-6 leading-relaxed">
        All plans are paid monthly for 12 months only. Longer cover continues with no further payments.
      </p>
    </div>
  );
};

export default TermSelector;
