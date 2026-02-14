import React from 'react';
import { Zap, Shield, Wrench } from 'lucide-react';

const benefits = [
  { icon: Zap, text: 'Instant online prices' },
  { icon: Shield, text: 'Cover designed around real repair costs' },
  { icon: Wrench, text: 'Fast claims and approved garages across the UK' },
];

const BenefitsStrip: React.FC = () => {
  return (
    <section className="bg-muted py-4 md:py-5 border-y border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} className="flex items-center gap-2.5">
                <Icon className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-sm font-medium text-foreground">{b.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default BenefitsStrip;
