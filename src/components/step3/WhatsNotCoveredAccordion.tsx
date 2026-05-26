import React from 'react';
import { Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'desktop' | 'mobile';

interface Props {
  variant?: Variant;
  className?: string;
}

const NOT_INCLUDED = [
  'Pre-existing faults',
  'Routine servicing and maintenance',
  
  'Accidental damage or accident repairs',
  'Motor trader-owned or operated vehicles',
  'Hire and reward use (taxis, rentals, couriers)',
];

const WhatsNotCoveredAccordion: React.FC<Props> = ({ variant = 'desktop', className }) => {
  const isMobile = variant === 'mobile';

  return (
    <div className={cn(isMobile ? 'p-0' : 'p-6', className)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-lg md:text-xl font-bold text-foreground leading-tight flex items-center gap-2">
          <Info className="w-5 h-5 text-primary flex-shrink-0" />
          What's not covered?
        </h3>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
          Full transparency
        </span>
      </div>


      <h4 className="text-sm font-semibold text-foreground mb-2">What's Not Included:</h4>
      <ul className="space-y-2">
        {NOT_INCLUDED.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2.5 text-sm text-foreground/90 leading-snug"
          >
            <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default WhatsNotCoveredAccordion;
