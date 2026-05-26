import React from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

interface CheckoutFAQProps {
  variant?: 'desktop' | 'mobile';
}

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'What does the warranty cover?',
    a: 'Our plans cover mechanical and electrical components, including engine, gearbox, turbo, ECU and more.',
  },
  {
    q: 'Can I use my own garage?',
    a: 'Yes — you can use any VAT-registered garage in the UK.',
  },
  {
    q: 'Are labour costs included?',
    a: 'Yes — labour is covered up to the labour rate you select with your plan.',
  },
  {
    q: 'When can I make a claim?',
    a: 'Claims can be made after the initial waiting period of 14 days.',
  },
  {
    q: 'Are electrical faults covered?',
    a: 'Yes — electrical components are covered, including ECUs, sensors and control modules.',
  },
  {
    q: 'Can I pay monthly?',
    a: 'Yes — flexible monthly payment options are available.',
  },
  {
    q: 'How quickly are claims paid?',
    a: 'We aim to process claims quickly and keep repairs moving with minimal hassle.',
  },
  {
    q: 'What happens if my garage charges more?',
    a: 'You can still use the garage — you’d simply pay the difference above your selected labour rate.',
  },
  {
    q: 'Can I cancel my cover?',
    a: 'Yes — all plans include a 14-day cooling-off period for peace of mind.',
  },
];

const CheckoutFAQ: React.FC<CheckoutFAQProps> = ({ variant = 'desktop' }) => {
  const isMobile = variant === 'mobile';

  return (
    <div>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <HelpCircle className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3
            className={cn(
              'font-bold text-foreground leading-tight',
              isMobile ? 'text-base' : 'text-lg'
            )}
          >
            Frequently asked questions
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quick answers to the most common questions
          </p>
        </div>
      </div>

      <Accordion type="multiple" className="w-full">
        {FAQS.map((item, idx) => (
          <AccordionItem
            key={idx}
            value={`faq-${idx}`}
            className="border-b border-border last:border-b-0"
          >
            <AccordionTrigger className="text-left text-sm font-semibold text-foreground hover:no-underline py-3">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-3">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default CheckoutFAQ;
