import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Info, X } from 'lucide-react';

interface ExcessSelectorProps {
  selectedExcess: number | null;
  onExcessChange: (excess: number) => void;
  currentMonthlyPrice: number;
}

// Original excess options matching the design - backend values
const excessOptions = [
  { value: 0, label: '£0', sublabel: 'excess', description: 'Zero Excess', subtitle: 'No upfront cost when you claim' },
  { value: 100, label: '£100', sublabel: 'excess', description: 'Best Value', subtitle: 'Best value overall for most drivers', isPopular: true },
  { value: 250, label: '£250', sublabel: 'excess', description: 'Saver Option', subtitle: 'Lower monthly price' },
  { value: 500, label: '£500', sublabel: 'excess', description: 'Budget Option', subtitle: 'Cheapest monthly price' }
];

const ExcessSelector: React.FC<ExcessSelectorProps> = ({
  selectedExcess,
  onExcessChange,
  currentMonthlyPrice
}) => {
  const [showExplainer, setShowExplainer] = useState(false);

  return (
    <div className="px-4 py-6 bg-white rounded-2xl border border-[#E8E8E8] mx-4 mt-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-full bg-[#000000] text-white flex items-center justify-center text-sm font-bold">
          3
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <h3 className="font-semibold text-lg text-[#000000]">Choose your excess amount</h3>
        </div>
      </div>

      {/* Excess Cards Grid - Matching original design */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {excessOptions.map((option) => {
          const isSelected = selectedExcess === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => onExcessChange(option.value)}
              className={cn(
                "relative p-4 rounded-xl border-2 text-left transition-all",
                isSelected
                  ? "border-[#000000] bg-white"
                  : "border-[#E8E8E8] bg-white hover:border-[#000000]/30"
              )}
            >
              {option.isPopular && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#E65100] text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap uppercase">
                  MOST POPULAR
                </span>
              )}
              
              <div className="mb-2">
                <span className="text-2xl font-bold text-[#000000]">{option.label}</span>
                <span className="text-sm text-[#888888] ml-1">{option.sublabel}</span>
              </div>
              
              <p className="text-sm font-semibold text-[#000000]">{option.description}</p>
              <p className="text-xs text-[#888888] mt-0.5">{option.subtitle}</p>
              
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-[#000000] rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ExcessSelector;