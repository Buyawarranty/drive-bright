import React from 'react';
import { Phone, ChevronRight, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceHelpTriggerProps {
  onClick: () => void;
  className?: string;
}

const PriceHelpTrigger: React.FC<PriceHelpTriggerProps> = ({ onClick, className }) => {
  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        // Layout
        "w-full group flex items-center justify-between gap-3 py-4 px-5",
        // Background - increased opacity for more pop
        "bg-gradient-to-r from-amber-100/90 via-orange-50/80 to-amber-100/90",
        // Border - warm accent
        "border-2 border-amber-300/80 rounded-2xl",
        // Hover state with glow
        "hover:bg-gradient-to-r hover:from-amber-100 hover:via-orange-100/90 hover:to-amber-100",
        "hover:border-brand-orange/60 hover:shadow-xl hover:shadow-orange-200/60",
        // Smooth transitions
        "transition-all duration-300 ease-out",
        "cursor-pointer",
        className
      )}
      aria-label="Not the right price? Call us or request a callback"
    >
      {/* Left side - Small phone icon + Message */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Subtle small phone icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-green/10 flex items-center justify-center group-hover:bg-brand-green/20 transition-all duration-300">
          <Phone className="w-4 h-4 text-brand-green" strokeWidth={2} />
        </div>
        
        {/* Message with visual hierarchy */}
        <div className="text-left leading-snug">
          {/* Main line */}
          <span className="block sm:flex sm:items-center sm:flex-wrap sm:gap-x-1">
            <span className="font-bold text-gray-900">
              Not the right price?
            </span>
            <span className="text-gray-700">
              {' '}Call{' '}
              <a
                href="tel:08004947477"
                onClick={handlePhoneClick}
                className="font-semibold text-brand-green hover:text-brand-orange underline underline-offset-2 decoration-1 transition-colors"
              >
                0800 494 7477
              </a>
              {' '}or{' '}
              <span className="font-semibold text-brand-green group-hover:text-brand-orange underline underline-offset-2 decoration-1 transition-colors">
                request a call back
              </span>
              {' '}💬
            </span>
          </span>
          
          {/* Secondary line with trophy icon */}
          <span className="flex items-center gap-1.5 text-sm text-gray-600 mt-0.5">
            <Trophy className="w-3.5 h-3.5 text-brand-orange flex-shrink-0" strokeWidth={2} />
            <span>We will beat any price you already have</span>
          </span>
        </div>
      </div>
      
      {/* Right side - High contrast orange arrow */}
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-orange/20 flex items-center justify-center group-hover:bg-brand-orange group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-orange-300/50 transition-all duration-300">
        <ChevronRight 
          className="w-5 h-5 text-brand-orange group-hover:text-white group-hover:translate-x-0.5 transition-all duration-300" 
          strokeWidth={2.5}
        />
      </div>
    </button>
  );
};

export default PriceHelpTrigger;
