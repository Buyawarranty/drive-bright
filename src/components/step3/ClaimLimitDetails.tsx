import React from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Shield } from 'lucide-react';

interface ClaimLimitDetailsProps {
  className?: string;
}

const TierCards = () => (
  <div className="space-y-2">
    {[
      { value: '£1,000', label: 'Essential Cover', desc: 'Good for smaller repairs and everyday mechanical faults.' },
      { value: '£2,000', label: 'Most Popular', desc: 'Great all round cover for common repairs and many higher value jobs.', highlight: true },
      { value: '£3,000', label: 'Strong Protection', desc: 'Ideal for customers who want extra reassurance for higher cost repairs.' },
      { value: '£5,000', label: 'Maximum Protection', desc: 'Perfect for hybrid, luxury or specialist vehicles where repair costs can be higher.' },
    ].map((item) => (
      <div
        key={item.value}
        className={cn(
          "rounded-lg border p-3",
          item.highlight ? "border-success bg-success/5" : "border-border bg-muted/30"
        )}
      >
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-foreground text-sm">{item.value}</span>
          <span className={cn("text-xs font-semibold", item.highlight ? "text-success" : "text-muted-foreground")}>
            ({item.label})
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
      </div>
    ))}
  </div>
);

const ExampleSection = () => (
  <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
    <h5 className="font-semibold text-foreground text-sm">How your claim is paid</h5>
    <p className="text-xs text-muted-foreground">
      If you choose a <span className="font-bold text-foreground">£2,000</span> claim limit:
    </p>
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium text-foreground">If the repair cost is under your limit (for example, £1,800):</p>
        <p className="text-xs text-muted-foreground">
          We pay the full <span className="font-semibold text-success">£1,800</span>, and you only pay your excess.
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-foreground">If the repair cost is over your limit (for example, £2,400):</p>
        <p className="text-xs text-muted-foreground">
          We pay <span className="font-semibold text-success">£2,000</span>, including parts and labour.
        </p>
        <p className="text-xs text-muted-foreground">
          You pay only <span className="font-semibold text-foreground">£400</span> plus your excess.
        </p>
      </div>
    </div>
  </div>
);

const ClaimLimitDetails: React.FC<ClaimLimitDetailsProps> = ({ className }) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className={cn("text-sm text-foreground space-y-4", className)}>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary flex-shrink-0" />
          <h4 className="font-bold text-base text-foreground">Claim limit – what you are covered for</h4>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Your claim limit is the maximum amount we pay towards each repair, including <span className="font-semibold text-foreground">parts and labour</span>.
        </p>

        <p className="text-muted-foreground leading-relaxed">
          Most repairs cost between <span className="font-semibold text-foreground">£700 and £1,100</span>, so many customers are fully covered with our standard limits.
        </p>

        <TierCards />

        <p className="text-muted-foreground leading-relaxed text-xs">
          Higher limits offer added peace of mind for larger repairs such as <span className="font-medium text-foreground">engines, gearboxes and hybrid systems</span>.
        </p>

        <ExampleSection />

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-1 font-medium">
          <span>✓ No hidden fees</span>
          <span>✓ Includes parts & labour</span>
          <span>✓ Protect from day one</span>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className={cn("text-sm text-foreground", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-primary flex-shrink-0" />
        <h4 className="font-bold text-lg text-foreground">Claim limit – what you are covered for</h4>
      </div>

      <div className="flex gap-5">
        <div className="flex-1 space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Your claim limit is the maximum amount we pay towards each repair, including <span className="font-semibold text-foreground">parts and labour</span>.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Most repairs cost between <span className="font-semibold text-foreground">£700 and £1,100</span>, so many customers are fully covered with our standard limits.
          </p>

          <TierCards />

          <p className="text-xs text-muted-foreground">
            Higher limits offer added peace of mind for larger repairs such as <span className="font-medium text-foreground">engines, gearboxes and hybrid systems</span>.
          </p>
        </div>

        <div className="w-56 flex-shrink-0">
          <ExampleSection />
        </div>
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground pt-3 mt-3 border-t border-border font-medium">
        <span>✓ No hidden fees</span>
        <span>✓ Includes parts & labour</span>
        <span>✓ Protect from day one</span>
      </div>
    </div>
  );
};

export default ClaimLimitDetails;
