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
      text: 'UK-based claims team',
    },
  ];

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-[#1a1a1a] mb-3 flex items-center gap-2">
        <span className="text-[#0BA360]">✓</span>
        Key Cover Highlights
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {highlights.map((highlight, index) => (
          <div key={index} className="flex items-start gap-2.5">
            <highlight.icon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-[#1a1a1a]">{highlight.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CoverHighlights;
