import React from 'react';
import { Shield, Clock, Wrench, Phone } from 'lucide-react';

interface CoverHighlightsProps {
  planName?: string;
}

const CoverHighlights: React.FC<CoverHighlightsProps> = ({ planName }) => {
  const highlights = [
    {
      icon: Shield,
      text: 'Comprehensive mechanical & electrical cover',
      color: 'text-primary',
    },
    {
      icon: Clock,
      text: '94% of claims approved within 24 hours',
      color: 'text-green-600',
    },
    {
      icon: Wrench,
      text: 'Use any VAT-registered garage',
      color: 'text-blue-600',
    },
    {
      icon: Phone,
      text: 'UK-based claims team – no overseas call centres',
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <span className="text-green-600">✓</span>
        Key Cover Highlights
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {highlights.map((highlight, index) => (
          <div key={index} className="flex items-start gap-2.5">
            <highlight.icon className={`w-4 h-4 ${highlight.color} flex-shrink-0 mt-0.5`} />
            <span className="text-sm text-foreground/80">{highlight.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CoverHighlights;
