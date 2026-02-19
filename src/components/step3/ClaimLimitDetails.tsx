import React from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Shield, Lightbulb } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface ClaimLimitDetailsProps {
  className?: string;
}

const ClaimLimitDetails: React.FC<ClaimLimitDetailsProps> = ({ className }) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className={cn("text-sm text-foreground space-y-4", className)}>
        {/* Headline */}
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary flex-shrink-0" />
          <h4 className="font-bold text-base text-foreground">Claim Limit – What You're Covered For</h4>
        </div>
        
        {/* Benefit-led explanation */}
        <p className="text-muted-foreground leading-relaxed">
          Your claim limit is the maximum we'll pay per repair — including <span className="font-semibold text-foreground">parts and labour</span>.
        </p>

        <p className="text-muted-foreground leading-relaxed">
          Most repairs fall between <span className="font-semibold text-foreground">£700 and £1,100</span>, so many customers are fully covered with our standard limits.
        </p>

        {/* Limit options */}
        <div className="space-y-1.5">
          <p className="font-semibold text-foreground text-sm">You can choose a claim limit of:</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: '£1,000', note: 'May not cover major engine repairs' },
              { value: '£2,000', note: null },
              { value: '£3,000', note: 'Most Popular', highlight: true },
              { value: '£5,000', note: 'Best for high-value vehicles', highlight: false },
            ].map((item) => (
              <div
                key={item.value}
                className={cn(
                  "rounded-lg border p-2.5 text-center relative",
                  item.highlight
                    ? "border-success bg-success/5 shadow-sm"
                    : "border-border bg-muted/30"
                )}
              >
                <span className="font-bold text-foreground text-sm">{item.value}</span>
                {item.note && (
                  <p className={cn(
                    "text-[10px] mt-0.5 leading-tight",
                    item.highlight ? "text-success font-semibold" : "text-muted-foreground"
                  )}>
                    {item.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="text-muted-foreground leading-relaxed text-xs">
          Higher limits provide extra protection against major repairs like <span className="font-medium text-foreground">engines, gearboxes and hybrid systems</span>.
        </p>

        {/* Collapsible Example */}
        <Accordion type="single" collapsible className="border-none">
          <AccordionItem value="example" className="border border-border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-3 py-2.5 text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-primary" />
                See a simple example
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-sm text-foreground font-medium">
                  If you choose a <span className="font-bold">£2,000</span> claim limit:
                </p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>If your repair costs <span className="font-semibold text-foreground">£2,400</span>,</p>
                  <p>we pay <span className="font-semibold text-success">£2,000</span> (including parts & labour)</p>
                  <p>and you pay the remaining <span className="font-semibold text-foreground">£400</span> + your excess.</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Reassurance strip */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-1">
          <span>✓ No hidden fees</span>
          <span>✓ Includes parts & labour</span>
          <span>✓ Fixed when you buy</span>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className={cn("text-sm text-foreground", className)}>
      {/* Headline */}
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-primary flex-shrink-0" />
        <h4 className="font-bold text-lg text-foreground">Claim Limit – What You're Covered For</h4>
      </div>

      <div className="flex gap-5">
        {/* Left column */}
        <div className="flex-1 space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Your claim limit is the maximum we'll pay per repair — including <span className="font-semibold text-foreground">parts and labour</span>.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Most repairs fall between <span className="font-semibold text-foreground">£700 and £1,100</span>, so many customers are fully covered with our standard limits.
          </p>

          {/* Limit cards */}
          <div>
            <p className="font-semibold text-foreground text-sm mb-2">You can choose a claim limit of:</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: '£1,000', note: 'May not cover major engine repairs' },
                { value: '£2,000', note: null },
                { value: '£3,000', note: 'Most Popular', highlight: true },
                { value: '£5,000', note: 'Maximum Protection', highlight: false },
              ].map((item) => (
                <div
                  key={item.value}
                  className={cn(
                    "rounded-lg border p-3 text-center relative",
                    item.highlight
                      ? "border-success bg-success/5 shadow-sm scale-105"
                      : "border-border bg-muted/30"
                  )}
                >
                  <span className="font-bold text-foreground">{item.value}</span>
                  {item.note && (
                    <p className={cn(
                      "text-[10px] mt-1 leading-tight",
                      item.highlight ? "text-success font-semibold" : "text-muted-foreground"
                    )}>
                      {item.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Higher limits provide extra protection against major repairs like <span className="font-medium text-foreground">engines, gearboxes and hybrid systems</span>.
            </p>
          </div>
        </div>

        {/* Right column - Example */}
        <div className="w-52 flex-shrink-0">
          <div className="bg-muted/50 border border-border rounded-lg p-4 h-full">
            <div className="flex items-center gap-1.5 mb-3">
              <Lightbulb className="w-4 h-4 text-primary" />
              <h5 className="font-semibold text-foreground text-xs uppercase tracking-wide">Simple Example</h5>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-foreground font-medium">
                If you choose a <span className="font-bold">£2,000</span> limit:
              </p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Repair costs <span className="font-semibold text-foreground">£2,400</span></p>
                <p>We pay <span className="font-semibold text-success">£2,000</span></p>
                <p>You pay <span className="font-semibold text-foreground">£400</span> + excess</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reassurance strip */}
      <div className="flex gap-4 text-xs text-muted-foreground pt-3 mt-3 border-t border-border">
        <span>✓ No hidden fees</span>
        <span>✓ Includes parts & labour</span>
        <span>✓ Fixed when you buy</span>
      </div>
    </div>
  );
};

export default ClaimLimitDetails;
