import React from 'react';
import { Shield, Lock, RefreshCw } from 'lucide-react';

interface TrustBarProps {
  variant?: 'default' | 'compact';
}

const TrustBar: React.FC<TrustBarProps> = ({ variant = 'default' }) => {
  const trustItems = [
    {
      icon: RefreshCw,
      text: '14-day money-back guarantee',
      shortText: '14-day refund',
    },
    {
      icon: Lock,
      text: 'Secure checkout',
      shortText: 'Secure',
    },
    {
      icon: Shield,
      text: 'No hidden fees',
      shortText: 'No hidden fees',
    },
  ];

  if (variant === 'compact') {
    return (
      <div className="flex items-center justify-center gap-3 py-2 text-xs text-gray-600">
        {trustItems.map((item, index) => (
          <React.Fragment key={index}>
            <span className="flex items-center gap-1">
              <item.icon className="w-3 h-3" />
              {item.shortText}
            </span>
            {index < trustItems.length - 1 && <span>•</span>}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-gray-600">
        {trustItems.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <item.icon className="w-4 h-4 text-[#0BA360]" />
            <span className="text-[#1a1a1a]">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrustBar;
