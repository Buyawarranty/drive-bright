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

  return (
    <Collapsible className="group/cover">
      <div className={variant === 'desktop' ? 'flex items-start justify-between gap-4' : 'flex items-start justify-between gap-3'}>
        <div className="flex-1 min-w-0">
          <CollapsibleTrigger className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity">
            <Shield className="w-5 h-5 text-foreground flex-shrink-0" />
            <span className={variant === 'desktop' ? 'text-lg font-bold text-foreground' : 'text-base font-bold text-foreground'}>
              Comprehensive Cover
            </span>
            <ChevronDown className="w-4 h-4 text-foreground transition-transform group-data-[state=open]/cover:rotate-180" />
          </CollapsibleTrigger>
          <div className="mt-3 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-foreground leading-snug">
                Labour, Electrical &amp; Mechanical Parts – Everything Covered.
              </p>
              <a
                href={policyPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-primary underline underline-offset-2 hover:text-primary/80 text-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                See full policy details
              </a>
            </div>
          </div>
        </div>

        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 bg-black text-white hover:bg-gray-800 font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap flex-shrink-0"
          >
            <Wrench className="w-4 h-4" />
            <span>View parts list</span>
            <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]/cover:rotate-180" />
          </button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="mt-4">
          <PartsListContent />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ComprehensiveCoverCard;
