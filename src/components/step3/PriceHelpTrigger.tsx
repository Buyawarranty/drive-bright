import React from 'react';
import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceHelpTriggerProps {
  onClick: () => void;
  className?: string;
}

const PriceHelpTrigger: React.FC<PriceHelpTriggerProps> = ({ onClick, className }) => {
  return (
    <div
      className={cn(
        "w-full rounded-xl border border-amber-300/60 bg-amber-50/50 p-4 md:p-5",
        className
      )}
    >
      {/* Desktop: single row with text left, CTA right */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        {/* Icon + Text */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <Shield className="w-6 h-6 md:w-7 md:h-7 text-brand-orange" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-bold text-gray-900 leading-tight">
              Price Beat Guarantee
            </h3>
            <p className="text-sm md:text-base text-gray-700 mt-0.5">
              Got a cheaper quote? We'll beat it - <span className="font-semibold">guaranteed.</span>
            </p>
          </div>
        </div>

        {/* CTA row */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pl-9 md:pl-0 flex-shrink-0 text-sm md:text-base">
          <button
            onClick={onClick}
            className="font-bold text-brand-orange hover:text-brand-orange/80 underline underline-offset-2 decoration-1 transition-colors whitespace-nowrap bg-transparent border-none cursor-pointer p-0"
          >
            Beat My Quote
          </button>
          <span className="text-gray-700 whitespace-nowrap">
            or call{' '}
            <a
              href="tel:03302295040"
              className="font-bold text-gray-900 hover:text-brand-orange underline underline-offset-2 decoration-1 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              0330 229 5040
            </a>
          </span>
        </div>
      </div>
    </div>
  );
};

export default PriceHelpTrigger;
