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
        // Layout - slimmer height with tighter padding
        "w-full group flex items-center justify-between gap-2 py-2.5 px-4",
        // Background - pale cream/white with thin yellow border
        "bg-amber-50/30 border border-amber-300/60 rounded-xl",
        // Subtle hover state (desktop only)
        "hover:bg-amber-50/50 hover:border-amber-400/70",
        "cursor-pointer",
        className
      )}
      aria-label="Looking for a better price? Call us or request a callback"
    >
      {/* Left side - Smaller phone icon + Message */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Smaller, subtle phone icon */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-green/5 flex items-center justify-center">
          <Phone className="w-4 h-4 text-brand-green/70" strokeWidth={1.5} />
        </div>
        
        {/* Desktop: Single line with price beat message on right */}
        {/* Mobile: Two-line layout */}
        <div className="text-left leading-tight flex-1">
          {/* Main line */}
          <span className="block text-sm">
            <span className="font-semibold text-gray-800">
              Looking for a better price?
            </span>
            <span className="text-gray-600">
              {' '}Call{' '}
              <a
                href="tel:08004947477"
                onClick={handlePhoneClick}
                className="font-medium text-brand-green hover:text-brand-orange underline underline-offset-2 decoration-1"
              >
                0800 494 7477
              </a>
              {' '}or{' '}
              <span className="font-medium text-brand-green group-hover:text-brand-orange underline underline-offset-2 decoration-1">
                request a call back
              </span>
              {' '}💬
            </span>
          </span>
          
          {/* Mobile only: Secondary line below */}
          <span className="flex md:hidden items-center gap-1 text-xs text-gray-900 mt-1">
            <Trophy className="w-3 h-3 text-brand-orange flex-shrink-0" strokeWidth={1.5} />
            <span>We will beat any price you already have</span>
          </span>
        </div>
      </div>
      
      {/* Desktop: Price beat message on right side */}
      <div className="hidden md:flex items-center gap-2 flex-shrink-0 mr-2">
        <Trophy className="w-4 h-4 text-brand-orange flex-shrink-0" strokeWidth={2} />
        <span className="text-sm font-medium text-gray-800">
          We will beat any price you already have 🏆
        </span>
      </div>
      
      {/* Right side - Subtle arrow, highlights on hover */}
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-brand-orange/10">
        <ChevronRight 
          className="w-4 h-4 text-gray-400 group-hover:text-brand-orange" 
          strokeWidth={2}
        />
      </div>
    </button>
  );
};

export default PriceHelpTrigger;
