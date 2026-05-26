import React, { useState } from 'react';
import { Lightbulb, ChevronDown, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

export type HelperTopic = 'claim-limit' | 'labour-rate' | 'excess';

interface Content {
  title: string;
  short: string;
  example: string;
  bullets: string[];
  takeaway: string;
}

const CONTENT: Record<HelperTopic, Content> = {
  'claim-limit': {
    title: 'How your claim limit works',
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
    title: 'How the labour rate works',
    short:
      'Garages charge by the hour. Your labour rate is the maximum £/hour we contribute towards the repair time on any claim.',
    example:
      'Example: a 3-hour repair at a £75/hr garage = £225 labour. If your selected rate is £75/hr, that’s fully covered within your claim limit.',
    bullets: [
      'Independent garages typically charge £55–£85/hour.',
      'Main dealers typically charge £100–£150+/hour.',
      'Higher labour rate = more freedom over where you repair.',
      'You can still use any VAT-registered garage at any rate — you just top up any difference.',
    ],
    takeaway: 'Choose the rate that matches the type of garage you’d normally use.',
  },
  excess: {
    title: 'How voluntary excess works',
    short:
      'Excess is the amount you pay towards a claim — we pay the rest, up to your claim limit. Lower excess = higher monthly cost, and vice versa.',
    example:
      'Example: a £900 repair with a £150 excess = you pay £150, we pay £750 (within your claim limit).',
    bullets: [
      '£0 excess = nothing to pay at claim time, highest monthly price.',
      '£150 is the most popular balance of monthly cost vs claim cost.',
      'Higher excess (£250+) keeps monthly payments lowest.',
      'You only ever pay the excess if you actually make a claim.',
    ],
    takeaway: 'Pick the excess you’d be comfortable paying once if something goes wrong.',
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
        'mt-3 rounded-xl border border-[#D8E9DD] bg-[#F6FBF8] overflow-hidden',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#F0F7F2] transition-colors"
      >
        <span className="w-8 h-8 rounded-lg bg-[#E4F0E8] text-[#4a7a5a] flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] md:text-sm font-semibold text-foreground leading-tight">
            {c.title}
          </span>
          <span className="block text-[11px] md:text-xs text-muted-foreground mt-0.5 truncate">
            Plain-English explanation with a real example.
          </span>
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-[#4a7a5a] flex-shrink-0 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-[#D8E9DD] bg-white/70 space-y-2.5">
          <p className="text-[13px] text-foreground/90 leading-snug">{c.short}</p>

          <div className="rounded-lg bg-[#F3FAF5] border border-[#DDEEE2] px-3 py-2 text-[12px] text-foreground leading-snug">
            <span className="font-semibold">💡 {c.example}</span>
          </div>

          <ul className="space-y-1.5">
            {c.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px] text-foreground/85">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#7BA88A] flex-shrink-0" />
                <span className="leading-snug">{b}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-start gap-2 rounded-lg bg-[#F3FAF5] border border-[#D8E9DD] px-3 py-2">
            <Lightbulb className="w-4 h-4 text-[#4a7a5a] flex-shrink-0 mt-0.5" />
            <p className="text-[12px] leading-snug text-foreground font-medium">{c.takeaway}</p>
          </div>
        </div>
      )}
    </div>
  );

};

export default HelperCallout;
