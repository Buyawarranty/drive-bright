import React, { useState } from 'react';
import { HelpCircle, Info } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const limits = [
  { value: 1000, label: '£1,000', tag: null },
  { value: 2000, label: '£2,000', tag: null },
  { value: 3000, label: '£3,000', tag: 'Recommended' },
];

const examples: Record<number, { repair: number; wePay: number; youPay: number }> = {
  1000: { repair: 2300, wePay: 1000, youPay: 1300 },
  2000: { repair: 2300, wePay: 2000, youPay: 300 },
  3000: { repair: 2300, wePay: 2300, youPay: 0 },
};

interface ClaimLimitSelectorProps {
  onHelpMeChoose: () => void;
}

const ClaimLimitSelector: React.FC<ClaimLimitSelectorProps> = ({ onHelpMeChoose }) => {
  const [selected, setSelected] = useState(3000);
  const isMobile = useIsMobile();
  const example = examples[selected];

  const explainerText =
    'Your plan pays up to your selected claim limit per approved claim. If a repair costs more, you only pay the difference.';

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Choose your claim limit per claim
          </h2>
        </div>

        {/* Limit buttons */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {limits.map((l) => (
            <button
              key={l.value}
              onClick={() => setSelected(l.value)}
              className={`relative rounded-xl border-2 text-center font-bold text-lg transition-all duration-200 ${
                l.tag ? 'pt-7 pb-4 px-3' : 'py-4 px-3'
              } ${
                selected === l.value
                  ? 'border-primary bg-primary/5 text-primary shadow-md'
                  : 'border-border bg-white text-foreground hover:border-primary/40'
              }`}
            >
              {l.tag && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                  {l.tag}
                </span>
              )}
              {l.label}
            </button>
          ))}
        </div>

        {/* Explainer */}
        {!isMobile ? (
          <p className="text-sm text-muted-foreground text-center mb-4 flex items-center justify-center gap-1.5">
            <Info className="w-4 h-4 flex-shrink-0" />
            {explainerText}
          </p>
        ) : (
          <div className="text-center mb-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-sm text-primary font-medium inline-flex items-center gap-1">
                    <HelpCircle className="w-4 h-4" />
                    How does the claim limit work?
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-sm">{explainerText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Dynamic contribution note */}
        <div className="bg-muted/50 border border-border rounded-xl p-4 text-center mb-6">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Example.</span> If your repair is
            £{example.repair.toLocaleString()} and your limit is{' '}
            {limits.find((l) => l.value === selected)?.label}, we contribute{' '}
            <span className="font-semibold text-green-600">
              £{example.wePay.toLocaleString()}
            </span>
            {example.youPay > 0 ? (
              <> and you pay £{example.youPay.toLocaleString()}.</>
            ) : (
              <> and you pay nothing — fully covered.</>
            )}
          </p>
        </div>

        {/* Need more cover? */}
        <div className="text-center">
          <button
            onClick={onHelpMeChoose}
            className="text-primary hover:underline text-sm font-semibold"
          >
            Need more cover? Get in touch →
          </button>
        </div>
      </div>
    </section>
  );
};

export default ClaimLimitSelector;
