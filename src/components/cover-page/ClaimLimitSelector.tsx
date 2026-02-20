import React, { useState } from 'react';
import { Info } from 'lucide-react';

const limits = [
  { value: 1000, label: '£1,000', tag: null },
  { value: 2000, label: '£2,000', tag: 'Recommended' },
  { value: 3000, label: '£3,000', tag: null },
  { value: 5000, label: '£5,000', tag: null },
];

interface ClaimLimitSelectorProps {
  onHelpMeChoose: () => void;
}

const ClaimLimitSelector: React.FC<ClaimLimitSelectorProps> = ({ onHelpMeChoose }) => {
  const [selected, setSelected] = useState(2000);

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-3">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Choose your claim limit
          </h2>
          <p className="text-muted-foreground text-sm">
            Pick the level of protection that suits your vehicle and budget.
          </p>
        </div>

        {/* Limit buttons */}
        <div className="grid grid-cols-4 gap-3 my-8">
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

        {/* How it works */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
            <span>
              <span className="font-semibold text-foreground">How it works:</span> Your plan pays up to the claim limit you select. If a repair costs more, you only pay the difference.
            </span>
          </p>
        </div>

        {/* Quick example */}
        <div className="bg-muted/50 border border-border rounded-xl p-4 mb-6">
          <p className="text-sm text-muted-foreground text-center">
            <span className="font-semibold text-foreground">Quick example:</span> A £1,300 repair with a £2,000 limit ={' '}
            <span className="font-semibold text-green-600">fully covered</span>.
          </p>
        </div>

        {/* Need help */}
        <div className="text-center">
          <button
            onClick={onHelpMeChoose}
            className="text-primary hover:underline text-sm font-semibold"
          >
            Need help choosing? Talk to us →
          </button>
        </div>
      </div>
    </section>
  );
};

export default ClaimLimitSelector;
