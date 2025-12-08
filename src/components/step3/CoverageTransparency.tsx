import React from 'react';
import { ChevronDown, Check, FileText, ExternalLink, Shield } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CoverageTransparencyProps {
  platinumDocUrl: string;
  termsDocUrl: string;
}

const coverageItems = [
  'Engine & gearbox',
  'Clutch & cooling',
  'Electrics',
  'Braking & steering',
  'Drivetrain & transmission'
];

const CoverageTransparency: React.FC<CoverageTransparencyProps> = ({
  platinumDocUrl,
  termsDocUrl
}) => {
  return (
    <div className="px-4 py-6 border-t border-border">
      {/* What's Covered Preview */}
      <Collapsible>
        <CollapsibleTrigger className="w-full">
          <div className="bg-secondary rounded-xl p-4 text-left">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-success" />
                What's covered?
              </h3>
              <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180" />
            </div>
            
            <ul className="space-y-1.5">
              {coverageItems.map((item, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-success flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            
            <p className="text-sm text-primary font-medium mt-3">
              See full list →
            </p>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="mt-4 p-4 bg-card rounded-xl border border-border">
            <p className="text-sm text-muted-foreground mb-4">
              Your Platinum plan covers all mechanical and electrical components including engine, gearbox, transmission, braking, steering, suspension, electrical systems, and more.
            </p>
            
            <div className="flex flex-col gap-2">
              {platinumDocUrl && (
                <a
                  href={platinumDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:text-primary/80 text-sm font-medium"
                >
                  <FileText className="w-4 h-4" />
                  View full plan details (PDF)
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              
              {termsDocUrl && (
                <a
                  href={termsDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:text-primary/80 text-sm font-medium"
                >
                  <FileText className="w-4 h-4" />
                  Terms & Conditions (PDF)
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Claims Approved Fast */}
      <div className="mt-4 bg-success/10 rounded-xl p-4 border border-success/30">
        <h4 className="font-bold text-lg text-success mb-1">
          94% of claims approved fast
        </h4>
        <p className="text-sm text-muted-foreground">
          Clear, fair process with UK-based support
        </p>
      </div>

      {/* Your Cover Made Clear */}
      <div className="mt-4">
        <h4 className="font-semibold text-foreground mb-3">
          Your cover, made crystal clear
        </h4>
        <div className="flex flex-col gap-2">
          {platinumDocUrl && (
            <a
              href={platinumDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm"
            >
              Comprehensive Platinum Plan (PDF)
            </a>
          )}
          {termsDocUrl && (
            <a
              href={termsDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-success hover:underline text-sm"
            >
              Full Terms & Conditions (PDF)
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoverageTransparency;
