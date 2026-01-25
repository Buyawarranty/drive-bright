import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface LabourRateSelectorProps {
  selectedLabourRate: number;
  onLabourRateChange: (rate: number) => void;
  currentMonthlyPrice: number;
}

// Labour rate options matching original design
const labourRateOptions = [
  { rate: 50, label: '£50', sublabel: 'per hour', description: 'Local Garages', subtitle: 'Affordable option for smaller garages', isBestValue: true },
  { rate: 70, label: '£70', sublabel: 'per hour', description: 'Independent Garages', subtitle: 'Ideal for your trusted local garage', isPopular: true },
  { rate: 100, label: '£100', sublabel: 'per hour', description: 'Approved Garages', subtitle: 'Covers most garages nationwide' },
  { rate: 200, label: '£200', sublabel: 'per hour', description: 'Expert Garages', subtitle: 'Perfect for main dealers and specialists' }
];

const LabourRateSelector: React.FC<LabourRateSelectorProps> = ({
  selectedLabourRate,
  onLabourRateChange,
  currentMonthlyPrice
}) => {
  return (
    <div className="px-4 py-6 bg-white rounded-2xl border border-[#E8E8E8] mx-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-[#000000] text-white flex items-center justify-center text-sm font-bold">
          2
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">⚙️</span>
          <h3 className="font-semibold text-lg text-[#000000]">Choose your labour rate</h3>
        </div>
      </div>

      {/* Helper line */}
      <p className="text-sm text-[#666666] mb-4 ml-9">
        Pick the hourly rate that works best for your repair needs.
      </p>

      {/* Labour Rate Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {labourRateOptions.map((option) => {
          const isSelected = selectedLabourRate === option.rate;
          
          return (
            <button
              key={option.rate}
              onClick={() => onLabourRateChange(option.rate)}
              className={cn(
                "relative p-4 rounded-xl border-2 text-left transition-all",
                isSelected
                  ? "border-[#000000] bg-white"
                  : "border-[#E8E8E8] bg-white hover:border-[#000000]/30"
              )}
            >
              {option.isBestValue && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#000000] text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap uppercase">
                  BEST VALUE
                </span>
              )}
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

export default LabourRateSelector;