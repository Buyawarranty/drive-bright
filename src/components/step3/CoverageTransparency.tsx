import React from 'react';
import { ChevronDown, Check, FileText, ExternalLink, Shield, CheckCircle, Sparkles } from 'lucide-react';
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

const trustPoints = [
  'Fast claims process',
  'Nationwide coverage',
  'No hidden fees'
];

const CoverageTransparency: React.FC<CoverageTransparencyProps> = ({
  platinumDocUrl,
  termsDocUrl
}) => {
  return (
    <div className="px-4 py-4 border-t border-border bg-gradient-to-b from-muted/30 to-transparent">
      {/* Desktop: Two-column layout */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-4">
        {/* Left Column: Header + Trust Points */}
        <div className="mb-4 lg:mb-0">
          {/* Header with Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">💎</span>
            <h3 className="font-bold text-lg text-foreground">Crystal clear cover</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            See what's included — clear terms, no jargon.
          </p>
          
          {/* Trust Points */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 lg:mb-0">
            {trustPoints.map((point, index) => (
              <span key={index} className="flex items-center gap-1.5 text-sm text-foreground">
                <CheckCircle className="w-4 h-4 text-success" />
                {point}
              </span>
            ))}
          </div>

          {/* Claims Badge - Desktop */}
          <div className="hidden lg:flex items-center gap-2 mt-4 bg-success/10 rounded-lg px-3 py-2 border border-success/30 w-fit">
            <Sparkles className="w-4 h-4 text-success" />
            <span className="font-semibold text-success text-sm">94% of claims approved fast</span>
          </div>
        </div>

        {/* Right Column: Document Links */}
        <div className="flex flex-col gap-2">
          {/* Platinum Plan Card */}
          <Collapsible>
            <CollapsibleTrigger className="w-full">
              <div className="bg-secondary rounded-lg p-3 text-left hover:bg-secondary/80 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-success" />
                    <span className="font-medium text-sm text-foreground">What's covered?</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180" />
                </div>
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="mt-2 p-3 bg-card rounded-lg border border-border">
                <ul className="space-y-1 mb-3">
                  {coverageItems.map((item, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-3 h-3 text-success flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                {platinumDocUrl && (
                  <a
                    href={platinumDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:text-primary/80 text-sm font-medium"
                  >
                    <FileText className="w-3 h-3" />
                    View full plan (PDF)
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Terms Link */}
          {termsDocUrl && (
            <a
              href={termsDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-secondary rounded-lg p-3 hover:bg-secondary/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-success" />
                <span className="font-medium text-sm text-foreground">Terms & Conditions</span>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </a>
          )}
        </div>
      </div>

      {/* Claims Badge - Mobile Only */}
      <div className="lg:hidden mt-3 bg-success/10 rounded-lg px-3 py-2 border border-success/30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-success" />
          <span className="font-semibold text-success text-sm">94% of claims approved fast</span>
          <span className="text-xs text-muted-foreground">• UK-based support</span>
        </div>
      </div>
    </div>
  );
};

export default CoverageTransparency;
