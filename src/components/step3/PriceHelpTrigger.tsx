import React from 'react';
import { ChevronRight, HelpCircle } from 'lucide-react';
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
        "w-full group flex items-center justify-center gap-2 py-3 px-4",
        "bg-gradient-to-r from-gray-50 to-white",
        "border border-gray-200 rounded-xl",
        "hover:border-brand-green/30 hover:shadow-sm",
        "transition-all duration-200",
        className
      )}
    >
      <HelpCircle className="w-4 h-4 text-gray-400 group-hover:text-brand-green transition-colors" />
      <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
        Not the right price?{' '}
        <span className="font-medium text-brand-green">
          Adjust your cover
        </span>{' '}
        or{' '}
        <span className="font-medium text-brand-green">
          request a price match
        </span>
      </span>
      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-brand-green group-hover:translate-x-0.5 transition-all" />
    </button>
  );
};

export default PriceHelpTrigger;
