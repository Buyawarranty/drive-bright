import React from 'react';
import { ChevronDown, Check, FileText, ExternalLink, ArrowUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CoverageTransparencyProps {
  platinumDocUrl: string;
  termsDocUrl: string;
}

const summaryBullets = [
  'No hidden catches',
  'Easy claims, Fast payouts',
  '14-day money-back guarantee'
];

const CoverageTransparency: React.FC<CoverageTransparencyProps> = ({
  platinumDocUrl,
  termsDocUrl
}) => {
  const scrollToPlans = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4 px-4 py-4">
      {/* First Card: 94% Claims Section */}
      <div className="bg-gradient-to-r from-green-50 to-white rounded-xl border-2 border-border p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-foreground mb-3">94% of claims approved fast</h3>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span>Clear cover – no hidden catches</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span>We look for reasons to say YES</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🛡️</span>
              <span className="font-bold text-foreground">Real protection. Real peace of mind. Guaranteed.</span>
            </div>

            {/* Trustpilot Badge */}
            <div className="bg-white rounded-lg border border-border p-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1 text-sm font-medium">
                  <span>⭐</span>
                  <span>Rated Excellent on Trustpilot</span>
                </div>
                <p className="text-sm text-muted-foreground">Don't just take our word for it – see what customers say.</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold">Trustpilot</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <div key={star} className="w-5 h-5 bg-green-500 flex items-center justify-center">
                      <span className="text-white text-xs">★</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 14 Day Guarantee Badge */}
          <div className="ml-4 hidden sm:flex flex-col items-center">
            <div className="w-24 h-24 rounded-full border-4 border-orange-200 bg-orange-50 flex flex-col items-center justify-center">
              <div className="text-orange-500">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <Check className="w-4 h-4 text-orange-500" />
            </div>
            <span className="text-sm text-orange-500 font-medium mt-1 text-center">14 day money<br />back guarantee</span>
          </div>
        </div>
      </div>

      {/* Second Card: Crystal Clear Cover Section */}
      <div className="bg-card rounded-xl border-2 border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
            <span>Your cover, made crystal clear</span>
            <span className="text-xl">💎</span>
          </h3>
          <button 
            onClick={scrollToPlans}
            className="flex items-center gap-1 text-sm font-medium text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-secondary transition-colors"
          >
            <ArrowUp className="w-4 h-4" />
            Back to Plans
          </button>
        </div>

        {/* Summary Bullets */}
        <div className="space-y-2 mb-4">
          {summaryBullets.map((bullet, index) => (
            <div key={index} className="flex items-center gap-2 text-foreground">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span>{bullet}</span>
            </div>
          ))}
        </div>

        {/* Microcopy */}
        <p className="text-sm text-muted-foreground mb-4 italic">
          Want the details? Expand below — no jargon, no surprises.
        </p>

        {/* Your Platinum Plan Collapsible */}
        <Collapsible className="mb-3">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-2 py-2 text-left hover:opacity-80 transition-opacity">
              <ChevronDown className="w-4 h-4 text-green-600 transition-transform duration-300 group-data-[state=open]:rotate-180" />
              <span className="font-medium text-green-600">Your Platinum Plan</span>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="ml-6 p-4 bg-green-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-2 text-sm text-foreground mb-4">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="font-medium">The most comprehensive warranty plan</span>
              </div>
              {platinumDocUrl && (
                <a
                  href={platinumDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  <FileText className="w-4 h-4" />
                  View full plan (PDF)
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Terms & Conditions Collapsible */}
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-2 py-2 text-left hover:opacity-80 transition-opacity">
              <ChevronDown className="w-4 h-4 text-green-600 transition-transform duration-300 group-data-[state=open]:rotate-180" />
              <span className="font-medium text-green-600">Terms & Conditions</span>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="ml-6 p-4 bg-green-50 rounded-lg border border-green-100">
              <p className="text-sm text-foreground mb-3">
                Our terms are written in plain English so you know exactly what you're getting.
              </p>
              {termsDocUrl && (
                <a
                  href={termsDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  <FileText className="w-4 h-4" />
                  View Terms & Conditions (PDF)
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};

export default CoverageTransparency;
