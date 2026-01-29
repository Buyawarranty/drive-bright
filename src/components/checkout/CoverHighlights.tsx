import React from 'react';
import { Shield, Zap, Wrench, Phone } from 'lucide-react';

interface CoverHighlightsProps {
  planName?: string;
}

const CoverHighlights: React.FC<CoverHighlightsProps> = ({ planName }) => {
  const highlights = [
    {
      icon: Shield,
      text: 'Complete mechanical & electrical cover',
    },
    {
      icon: Zap,
      text: 'Easy claims, fast payout',
    },
    {
      icon: Wrench,
      text: 'Use any VAT-registered garage',
    },
    {
      icon: Phone,
      text: 'UK-based claims team – no overseas call centres',
    },
  ];

  return (
    <div className="bg-white border border-border rounded-xl p-4 sm:p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <span className="text-green-600">✓</span>
        Key Cover Highlights
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {highlights.map((highlight, index) => (
          <div key={index} className="flex items-start gap-2.5">
            <highlight.icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <span className="text-sm text-foreground/80">{highlight.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CoverHighlights;
