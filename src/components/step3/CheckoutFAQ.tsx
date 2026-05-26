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
    q: 'What is covered?',
    a: 'Mechanical and electrical breakdowns across major vehicle systems — engine, gearbox, transmission, drivetrain, fuel and cooling systems, electrics, steering, brakes, suspension and more. See the "What\'s covered" section above for the full parts list.',
  },
  {
    q: 'Can I use my own garage?',
    a: 'Yes. You can take your vehicle to any VAT-registered garage in the UK, including independents, your trusted local mechanic, approved networks, or main dealers. Just make sure their labour rate is within your chosen plan limit.',
  },
  {
    q: 'Is diagnostics included?',
    a: 'Yes — diagnostic costs are covered when they lead to a valid claim on a listed covered component. If diagnostics confirm a non-covered fault (e.g. wear and tear), the diagnostic fee is not reimbursed.',
  },
  {
    q: 'Is wear and tear included?',
    a: 'No. Wear and tear (brake pads, clutch friction plates, wiper blades, tyres, bulbs, etc.) is a normal part of vehicle ownership and is not covered by any UK warranty. Sudden mechanical failure of a covered component is included.',
  },
  {
    q: 'How do claims work?',
    a: 'Call our UK claims team, describe the fault, and we authorise repair at your chosen garage. The garage sends the invoice to us — we settle directly with them where possible, so you don\'t pay out of pocket (minus your excess).',
  },
  {
    q: 'How quickly are claims paid?',
    a: 'Most claims are reviewed within 24 hours of receiving the diagnostic report. Once authorised, repairs can begin immediately and payment to the garage is typically settled within a few working days.',
  },
  {
    q: 'What is excess?',
    a: 'Excess is the amount you contribute toward each successful claim. A higher excess lowers your monthly premium; a lower excess means less to pay at claim time. You choose what works best for your budget.',
  },
  {
    q: 'What are labour rates?',
    a: 'The hourly rate (£/hour) we pay the garage for repair time. £50/hr suits local independents, £70/hr fits most trusted garages, £100/hr covers approved networks, and £200/hr is designed for main dealers and specialists.',
  },
  {
    q: 'Can I cancel?',
    a: 'Yes. You have a 14-day cooling-off period for a full refund (if no claim has been made). After that, you can cancel at any time and receive a pro-rata refund for unused cover, minus a small administration fee.',
  },
  {
    q: 'Are electrical faults covered?',
    a: 'Yes. Electrical components including the alternator, starter motor, ECUs, sensors, wiring looms, electric windows, central locking and more are covered when they fail mechanically. See the full parts list above.',
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
