import React from 'react';
import { Phone, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceHelpTriggerProps {
  onClick: () => void;
  className?: string;
}

const PriceHelpTrigger: React.FC<PriceHelpTriggerProps> = ({ onClick, className }) => {
  // Handle phone link click without triggering the panel
  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        // Layout
        "w-full group flex items-center justify-between gap-3 py-4 px-5",
        // Background - subtle highlight that stands out
        "bg-gradient-to-r from-amber-50/80 via-orange-50/60 to-amber-50/80",
        // Border - warm accent
        "border-2 border-amber-200/70 rounded-2xl",
        // Hover state - noticeable but elegant
        "hover:bg-gradient-to-r hover:from-amber-100/90 hover:via-orange-100/70 hover:to-amber-100/90",
        "hover:border-brand-orange/50 hover:shadow-lg hover:shadow-orange-100/50",
        // Smooth transitions
        "transition-all duration-300 ease-out",
        // Cursor
        "cursor-pointer",
        className
      )}
      aria-label="Not the right price? Call us or request a callback"
    >
      {/* Left side - Icon + Message */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Attention-grabbing icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center group-hover:bg-brand-orange/20 group-hover:scale-110 transition-all duration-300">
          <Phone className="w-5 h-5 text-brand-orange" strokeWidth={2.5} />
        </div>
        
        {/* Message with visual hierarchy */}
        <span className="text-left leading-snug">
          <span className="text-base sm:text-lg font-bold text-gray-900 block sm:inline">
            💬 Not the right price?
          </span>
          <span className="text-sm sm:text-base text-gray-700 block sm:inline sm:ml-1.5">
            Call{' '}
            <a
              href="tel:08004947477"
              onClick={handlePhoneClick}
              className="font-bold text-brand-green hover:text-brand-orange underline underline-offset-2 decoration-1 transition-colors"
            >
              0800 494 7477
            </a>
            {' '}or{' '}
            <span className="font-semibold text-brand-green group-hover:text-brand-orange transition-colors">
              request a call back
            </span>
          </span>
        </span>
      </div>
      
      {/* Right side - Interactive arrow */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-orange/10 flex items-center justify-center group-hover:bg-brand-orange group-hover:scale-110 transition-all duration-300">
        <ChevronRight 
          className="w-5 h-5 text-brand-orange group-hover:text-white group-hover:translate-x-0.5 transition-all duration-300" 
          strokeWidth={2.5}
        />
      </div>
    </button>
  );
};

export default PriceHelpTrigger;
