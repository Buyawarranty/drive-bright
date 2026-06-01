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
    a: "Our comprehensive Platinum Warranty covers mechanical and electrical failures throughout your vehicle, including the engine, gearbox, turbo, ECU, sensors, infotainment system, and more. Unlike many warranty providers that limit cover, our Platinum Warranty is designed to provide extensive protection and greater peace of mind. See the Platinum Plan policy summary below for full coverage details.",
  },
  {
    q: 'Can I use my own garage?',
    a: "Yes, you can use any VAT-registered garage in the UK. If you don't already have a preferred garage, we're happy to help you find one.",
  },
  {
    q: 'Are labour costs included?',
    a: 'Yes, labour is covered up to the labour rate you select when purchasing your plan.',
  },
  {
    q: 'When can I make a claim?',
    a: 'Your warranty starts immediately after purchase, giving you peace of mind from day one. Claims can be made after a standard 14-day waiting period.',
  },
  {
    q: 'How do I make a claim?',
    a: "Simply ask your garage to contact our claims team before any repairs are carried out. We'll guide them through the process and aim to keep everything moving smoothly.",
  },
  {
    q: 'Can I pay monthly?',
    a: 'Yes, flexible monthly payment options are available. You can also choose to pay annually and save money compared to paying monthly.',
  },
  {
    q: 'Can I use a garage with a higher labour rate?',
    a: 'Yes, you can still use your chosen garage. If their labour rate is higher than the rate selected on your plan, you would simply pay the difference.',
  },
  {
    q: 'Can I cancel my cover?',
    a: 'Yes, if you change your mind within the first 14 days, you can cancel your warranty and receive a full refund, provided no claim has been made.',
  },
];

const CheckoutFAQ: React.FC<CheckoutFAQProps> = ({ variant = 'desktop' }) => {
  const isMobile = variant === 'mobile';

  return (
    <div>

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
