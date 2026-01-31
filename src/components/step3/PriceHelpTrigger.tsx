import React from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceHelpTriggerProps {
  onClick: () => void;
  className?: string;
}

const PriceHelpTrigger: React.FC<PriceHelpTriggerProps> = ({ onClick, className }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full group flex items-center justify-start gap-2 py-3.5 px-4",
        "bg-gradient-to-r from-gray-50 via-white to-gray-50",
        "border border-gray-200/80 rounded-xl",
        "hover:border-brand-green/40 hover:shadow-md hover:shadow-brand-green/5",
        "transition-all duration-300",
        className
      )}
      aria-label="Open pricing help panel to adjust your cover or request a callback"
    >
      <Sparkles className="w-4 h-4 text-brand-orange group-hover:text-brand-green transition-colors flex-shrink-0" />
      <span className="text-base text-gray-700 group-hover:text-gray-900 transition-colors text-left">
        Not the right price?{' '}
        <span className="font-semibold text-brand-green">
          Adjust your cover
        </span>
        , call us on{' '}
        <span className="font-semibold text-brand-green">
          0800 494 7477
        </span>
        , or{' '}
        <span className="font-semibold text-brand-green">
          request a call back
        </span>
      </span>
      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-brand-green group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-auto" />
    </button>
  );
};

export default PriceHelpTrigger;
