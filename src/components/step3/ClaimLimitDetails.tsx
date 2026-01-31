import React from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface ClaimLimitDetailsProps {
  className?: string;
}

const ClaimLimitDetails: React.FC<ClaimLimitDetailsProps> = ({ className }) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className={cn("text-sm text-foreground space-y-4", className)}>
        {/* Title */}
        <h4 className="font-bold text-base text-foreground">Your claim limit</h4>
        
        {/* Short body paragraphs */}
        <div className="space-y-2 text-muted-foreground leading-relaxed">
          <p>Your claim limit is the maximum we pay for each repair, covering parts and your chosen labour rate.</p>
          <p>Most repairs fall between £700 and £1,100, so most customers are fully covered.</p>
        </div>
        
        {/* Divider */}
        <div className="border-t border-border" />
        
        {/* How it works */}
        <div>
          <h5 className="font-semibold text-foreground mb-1.5">How it works</h5>
          <p className="text-muted-foreground leading-relaxed">
            If the repair is within your claim limit, you pay only your excess.
          </p>
        </div>
        
        {/* Examples */}
        <div>
          <h5 className="font-semibold text-foreground mb-2">Examples</h5>
          <div className="space-y-3">
            <div className="pl-3 border-l-2 border-brand-orange/40">
              <p className="font-medium text-foreground">Repair £950 with a £1,250 limit</p>
              <p className="text-muted-foreground text-xs mt-0.5">We pay the full amount. You only pay your excess.</p>
            </div>
            <div className="pl-3 border-l-2 border-brand-orange/40">
              <p className="font-medium text-foreground">Repair £1,400 with a £1,250 limit</p>
              <p className="text-muted-foreground text-xs mt-0.5">We pay £1,250. You pay £150 and your excess.</p>
            </div>
          </div>
        </div>
        
        {/* Reassurance box */}
        <div className="bg-brand-orange/5 border border-brand-orange/15 rounded-lg p-3">
          <p className="text-muted-foreground leading-relaxed text-xs">
            High repair bills above £3,000 are uncommon. Your cover is designed to protect you in the repairs most drivers experience.
          </p>
        </div>
        
        {/* Footer */}
        <p className="text-xs text-muted-foreground pt-1">
          No hidden fees. Your claim limit and excess are set when you buy your cover.
        </p>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className={cn("text-sm text-foreground", className)}>
      <div className="flex gap-5">
        {/* Left column - Main content */}
        <div className="flex-1 space-y-4">
          {/* Title */}
          <h4 className="font-bold text-lg text-foreground">Your claim limit</h4>
          
          {/* Intro section */}
          <div className="space-y-2 text-muted-foreground leading-relaxed">
            <p>Your claim limit is the maximum we pay for each repair. It covers parts and your chosen labour rate.</p>
            <p>Most repairs fall between £700 and £1,100, so most customers are fully covered.</p>
          </div>
          
          {/* How it works */}
          <div>
            <h5 className="font-semibold text-foreground mb-1.5">How it works</h5>
            <p className="text-muted-foreground leading-relaxed">
              If the repair cost falls within your claim limit, you pay only your excess.
            </p>
          </div>
          
          {/* Examples */}
          <div>
            <h5 className="font-semibold text-foreground mb-2">Examples</h5>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-brand-orange font-bold">•</span>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Repair £950 with a £1,250 limit.</span> We pay £950 and you only pay your excess.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-brand-orange font-bold">•</span>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Repair £1,400 with a £1,250 limit.</span> We pay £1,250 and you pay £150 plus your excess.
                </p>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Your excess and claim limit are set when you buy your cover. There are no hidden fees.
          </p>
        </div>
        
        {/* Right column - Reassurance box */}
        <div className="w-48 flex-shrink-0">
          <div className="bg-brand-orange/5 border border-brand-orange/15 rounded-lg p-4 h-full">
            <h5 className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wide">Reassurance</h5>
            <p className="text-muted-foreground leading-relaxed text-xs">
              Most repairs do not come close to £3,000. The vast majority of electrical and mechanical faults fall below typical claim limits, meaning you are protected in almost every situation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimLimitDetails;
