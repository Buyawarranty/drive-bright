import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
  const [showAllOptions, setShowAllOptions] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

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
      id: '12months',
      label: '1-year cover',
      years: 1,
      monthlyPrice: getPriceForTerm('12months')
    },
    {
      id: '24months',
      label: '2-year cover',
      years: 2,
      monthlyPrice: getPriceForTerm('24months'),
      isPopular: true
    },
    {
      id: '36months',
      label: '3-year cover',
      years: 3,
      monthlyPrice: getPriceForTerm('36months'),
      isBestValue: true
    }
  ];

  const terms = allTerms.filter(t => availableDurations.includes(t.id));

  const toggleWhatsIncluded = (termId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCard(expandedCard === termId ? null : termId);
  };

  return (
    <div className="px-4 py-6">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-7 h-7 rounded-full bg-[#000000] text-white flex items-center justify-center text-sm font-bold">
          1
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <h3 className="font-semibold text-lg text-[#000000]">Choose your cover duration</h3>
        </div>
        <span className="text-sm text-[#666666] ml-auto">All parts included at no extra cost</span>
      </div>

      <p className="text-sm text-[#666666] mb-6 ml-10">
        Base cover prices shown below. Any Optional Add-Ons you choose are added to the total in the summary bar.
      </p>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {terms.map((term) => {
          const isSelected = selectedTerm === term.id;
          const totalCost = getTotalForTerm(term.id);
          const monthlyPayment = term.monthlyPrice;
          const payInFull = getPayInFullDiscount(term.id);
          
          return (
            <div
              key={term.id}
              className={cn(
                "relative rounded-2xl border-2 bg-white transition-all duration-200",
                isSelected 
                  ? "border-[#E65100] shadow-lg" 
                  : "border-[#E8E8E8] hover:border-[#E65100]/50 hover:shadow-md"
              )}
            >
              {/* Badge */}
              {(term.isPopular || term.isBestValue) && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className={cn(
                    "px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full",
                    term.isBestValue 
                      ? "bg-[#3A8F45] text-white"
                      : "bg-[#E65100] text-white"
                  )}>
                    {term.isBestValue ? 'Best Value' : 'Most Popular'}
                  </span>
                </div>
              )}

              {/* Selection Tick */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#3A8F45] flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                </div>
              )}

              {/* Main Content */}
              <div className="p-5 pt-6">
                {/* Plan Title */}
                <h4 className="text-lg font-bold text-[#000000] mb-1">{term.label}</h4>
                <p className="text-xs text-[#888888] mb-4">Platinum Complete Plan</p>

                {/* Primary Price */}
                <div className="mb-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-[#000000]">£{monthlyPayment}</span>
                    <span className="text-sm text-[#555555]">/month</span>
                  </div>
                  <p className="text-xs text-[#888888]">(12 payments only)</p>
                </div>

                {/* Total */}
                <p className="text-sm text-[#666666] mb-3">
                  Total: <span className="font-semibold text-[#000000]">£{totalCost}</span>
                </p>

                {/* Multi-year benefits */}
                {term.id === '24months' && (
                  <div className="space-y-1 mb-3">
                    <p className="text-sm text-[#3A8F45] font-medium flex items-center gap-1">
                      <Check className="w-4 h-4" /> Year 2 FREE cover
                    </p>
                    <p className="text-xs text-[#666666]">
                      Pay in full <span className="font-semibold text-[#3A8F45]">£{payInFull.nowPrice}</span>{' '}
                      <span className="line-through text-[#999999]">Was £{payInFull.wasPrice}</span>
                    </p>
                    <p className="text-xs text-[#3A8F45] font-medium">Save £{payInFull.savings} Today</p>
                    <p className="text-xs text-[#888888]">🎁 Includes extra benefits</p>
                  </div>
                )}

                {term.id === '36months' && (
                  <div className="space-y-1 mb-3">
                    <p className="text-sm text-[#3A8F45] font-medium flex items-center gap-1">
                      <Check className="w-4 h-4" /> Years 2 & 3 FREE cover
                    </p>
                    <p className="text-xs text-[#666666]">
                      Pay in full <span className="font-semibold text-[#3A8F45]">£{payInFull.nowPrice}</span>{' '}
                      <span className="line-through text-[#999999]">Was £{payInFull.wasPrice}</span>
                    </p>
                    <p className="text-xs text-[#3A8F45] font-medium">Save £{payInFull.savings} Today</p>
                    <p className="text-xs text-[#888888]">🎁 Includes extra benefits</p>
                  </div>
                )}

                {/* See What's Included Dropdown */}
                <button
                  onClick={(e) => toggleWhatsIncluded(term.id, e)}
                  className="w-full flex items-center justify-between py-2 px-3 text-sm text-[#555555] bg-[#F5F5F5] rounded-lg hover:bg-[#EEEEEE] transition-colors mb-3"
                >
                  <span>See What's Included</span>
                  {expandedCard === term.id ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {expandedCard === term.id && (
                  <div className="mb-3 p-3 bg-[#FAFAFA] rounded-lg text-xs text-[#666666] space-y-1">
                    <p>✓ Engine & Gearbox</p>
                    <p>✓ Electrical Components</p>
                    <p>✓ Air Conditioning</p>
                    <p>✓ Fuel System</p>
                    <p>✓ Steering & Suspension</p>
                    <p>✓ Brakes & Clutch</p>
                    <p>✓ 24/7 Recovery</p>
                  </div>
                )}

                {/* Select Button */}
                <Button
                  onClick={() => onTermChange(term.id)}
                  className={cn(
                    "w-full py-5 font-semibold rounded-lg transition-all",
                    isSelected
                      ? "bg-[#000000] hover:bg-[#333333] text-white"
                      : "bg-[#E65100] hover:bg-[#D84600] text-white"
                  )}
                >
                  {isSelected ? 'Selected' : 'Select this plan →'}
                </Button>

                {/* Links */}
                <div className="flex flex-col items-center gap-1 mt-3 text-xs">
                  <button 
                    className="text-[#E65100] hover:underline flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    📧 Email me this quote
                  </button>
                  <button 
                    className="text-[#888888] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    📄 See full cover details
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer text */}
      <p className="text-center text-xs text-[#888888] mt-6 leading-relaxed">
        All plans are paid monthly for 12 months only. Longer cover continues with no further payments.
      </p>
    </div>
  );
};

export default TermSelector;