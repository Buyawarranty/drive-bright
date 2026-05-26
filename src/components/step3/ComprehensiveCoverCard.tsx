import React from 'react';
import { Shield, Wrench, ChevronDown, CheckCircle2, FileText } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import PartsListContent from './PartsListContent';

interface Props {
  variant?: 'desktop' | 'mobile';
}

/**
 * Original "Comprehensive Cover" card with "View parts list" toggle.
 * Header + button both expand the same Collapsible containing PartsListContent.
 */
const ComprehensiveCoverCard: React.FC<Props> = ({ variant = 'desktop' }) => {
  const policyPdfUrl = 'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/terms/terms-and-conditions-v3.3-2026-05.pdf';

  const isMobile = variant === 'mobile';

  return (
    <Collapsible className="group/cover">
      {/* Header row: title left, button right */}
      <div className="flex items-center justify-between gap-3">
        <CollapsibleTrigger className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity min-w-0">
          <Shield className={isMobile ? 'w-4 h-4 text-foreground flex-shrink-0' : 'w-5 h-5 text-foreground flex-shrink-0'} />
          <span className={isMobile ? 'text-sm font-bold text-foreground truncate' : 'text-lg font-bold text-foreground'}>
            Comprehensive Cover
          </span>
          <ChevronDown className="w-4 h-4 text-foreground transition-transform group-data-[state=open]/cover:rotate-180 flex-shrink-0" />
        </CollapsibleTrigger>

        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={
              isMobile
                ? 'flex items-center gap-1.5 bg-black text-white hover:bg-gray-800 font-semibold px-2.5 py-1.5 rounded-md transition-colors text-xs whitespace-nowrap flex-shrink-0'
                : 'flex items-center gap-2 bg-black text-white hover:bg-gray-800 font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap flex-shrink-0'
            }
          >
            <Wrench className={isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            <span>View parts list</span>
            <ChevronDown className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} transition-transform group-data-[state=open]/cover:rotate-180`} />
          </button>
        </CollapsibleTrigger>
      </div>

      {/* Description row */}
      <div className={isMobile ? 'mt-2 flex items-center gap-2 flex-wrap' : 'mt-3 flex items-start gap-2'}>
        <CheckCircle2 className={isMobile ? 'w-3.5 h-3.5 text-emerald-600 flex-shrink-0' : 'w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5'} />
        <p className={isMobile ? 'text-xs font-medium text-foreground leading-snug' : 'text-sm font-semibold text-foreground leading-snug'}>
          Labour, Electrical &amp; Mechanical Parts – Everything Covered.
        </p>
        <a
          href={policyPdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={
            isMobile
              ? 'inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80 text-xs'
              : 'inline-flex items-center gap-1 mt-1 text-primary underline underline-offset-2 hover:text-primary/80 text-sm'
          }
        >
          <FileText className={isMobile ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          See full policy details
        </a>
      </div>

      <CollapsibleContent>
        <div className={isMobile ? 'mt-3' : 'mt-4'}>
          <PartsListContent />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ComprehensiveCoverCard;
