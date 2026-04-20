import React, { useState } from 'react';
import { CheckCircle, Check, ChevronDown, ChevronUp } from 'lucide-react';

const MoneyBackGuarantee: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-5 bg-[#F0FDF4] border border-[#C8F3D2] rounded-xl p-4 sm:p-5">
      {/* Header - clickable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2.5">
          <CheckCircle className="w-5 h-5 text-[#0BA360] flex-shrink-0" />
          <span className="text-sm font-bold text-[#1a1a1a]">Your 14-day peace of mind guarantee</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
        )}
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="mt-4">
          <p className="text-sm text-[#1a1a1a] mb-3">Enjoy full flexibility when you start your cover:</p>
          <div className="space-y-4 mb-4">
            <div className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#1a1a1a]">
                <span className="font-semibold">Cancel within 14 days</span> for a full refund if no claim has been made
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#1a1a1a]">
                If a claim is made within 14 days, a small <span className="font-semibold">£40 handling fee</span> plus any assessment costs
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#1a1a1a]">
                After 14 days, refunds are calculated <span className="font-semibold">pro-rata</span> based on time remaining, less any claims made
              </p>
            </div>
          </div>

          <div className="border-t border-[#C8F3D2] pt-3">
            <p className="text-sm text-gray-500">
              Designed to keep things fair for everyone.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoneyBackGuarantee;
