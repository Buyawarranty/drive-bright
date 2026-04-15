import React, { useState } from 'react';
import { Shield, Check, Info, ChevronDown, ChevronUp } from 'lucide-react';

const MoneyBackGuarantee: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-5">
      {/* Collapsed summary bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between bg-[#F0FDF4] border border-[#C8F3D2] rounded-xl px-4 py-3 text-left transition-all hover:bg-[#E8FAF0]"
      >
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-[#0BA360] flex-shrink-0" />
          <span className="text-sm font-bold text-[#1a1a1a]">14-day money-back guarantee</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <>
              <span className="hidden sm:inline">Full refund if no claim is made. See details</span>
              <span className="sm:hidden">See details</span>
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5 animate-fade-in">
          <div className="flex items-center gap-2.5 mb-3">
            <Shield className="w-6 h-6 text-[#0BA360] flex-shrink-0" />
            <h4 className="text-sm font-bold text-[#1a1a1a]">Your 14-day peace of mind guarantee</h4>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Enjoy full flexibility when you start your cover:
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#1a1a1a]">
                Cancel within 14 days for a <span className="font-semibold">full refund</span> if no claim has been made
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

          <p className="text-xs text-gray-500 mt-4">
            Designed to keep things fair for everyone.
          </p>
        </div>
      )}
    </div>
  );
};

export default MoneyBackGuarantee;
