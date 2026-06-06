import React, { useState } from 'react';
import { Lightbulb, ChevronDown, GraduationCap, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type HelperTopic = 'claim-limit' | 'labour-rate' | 'excess';

interface Content {
  title: string;
  subtitle?: string;
  short: string;
  example?: string;
  bullets?: string[];
  takeaway?: string;
}

const CONTENT: Record<HelperTopic, Content> = {
  'claim-limit': {
    title: 'How your claim limit works',
    subtitle: 'Plain-English explanation with a real example.',
    short:
      'Your claim limit is the maximum we pay towards any single repair. Pick the amount that matches the kind of repair bills you’d want fully covered.',
    example:
      'Example: a turbo failure costs around £1,800 in parts and labour. With a £2,000 claim limit, the full bill is covered (minus your voluntary excess).',
    bullets: [
      'Higher claim limit = stronger protection on the priciest repairs.',
      'Each claim is assessed individually — the limit resets per claim.',
      'You can make multiple claims throughout your policy.',
      'Most modern petrol/diesel cars are best matched with £2,000+.',
    ],
    takeaway: 'Pick the limit that matches the most expensive repair you’d ever want fully covered.',
  },
  'labour-rate': {
    title: 'How labour cover works',
    subtitle: 'A quick, plain-English summary.',
    short: 'Your selected labour rate is the maximum we contribute per repair hour.',
    takeaway: 'Use any VAT-registered garage — you only pay the difference if they charge more.',
  },
  excess: {
    title: 'How excess works',
    short: 'We cover the approved repair cost minus your excess.',
    example: 'Example:\n£600 approved repair\n− £150 excess\n= £450 claim contribution',
    bullets: [
      'Lower excess = higher monthly price.',
      'Higher excess = lower monthly price.',
    ],
  },
};

interface Props {
  topic: HelperTopic;
  className?: string;
  defaultOpen?: boolean;
}

const HelperCallout: React.FC<Props> = ({ topic, className, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const c = CONTENT[topic];

  return (
    <div
      className={cn(
        'mt-3 rounded-xl border border-border bg-background overflow-hidden',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
      >
        <GraduationCap className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] md:text-sm font-semibold text-foreground leading-tight">
            {c.title}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-2 border-t border-border space-y-2">
          <p className="text-[13px] text-foreground/90 leading-snug">{c.short}</p>

          {c.example && (
            <pre className="text-[12.5px] text-foreground/85 leading-snug whitespace-pre-wrap font-sans bg-muted/40 rounded-md p-2">
{c.example}
            </pre>
          )}


          {c.bullets && c.bullets.length > 0 && (
            <ul className="space-y-1.5">
              {c.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] text-foreground/85">
                  <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-100 flex-shrink-0">
                    <Check className="h-3 w-3 text-green-600" strokeWidth={3} />
                  </span>
                  <span className="leading-snug">{b}</span>
                </li>
              ))}
            </ul>
          )}

          {c.takeaway && (
            <p className="text-[12.5px] leading-snug text-foreground/80">
              {c.takeaway}
            </p>
          )}
        </div>
      )}
    </div>
  );

};

export default HelperCallout;
