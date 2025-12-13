import React from 'react';
import { OptimizedImage } from '@/components/OptimizedImage';
import trustpilotLogo from '/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png';
import buyAWarrantyLogo from '/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png';

interface TrustpilotHeaderProps {
  className?: string;
}

const TrustpilotHeader: React.FC<TrustpilotHeaderProps> = ({ className = "" }) => {
  return (
    <div className={`flex justify-center items-center ${className}`}>
      <a 
        href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
        target="_blank" 
        rel="noopener noreferrer"
        className="transition-opacity hover:opacity-80"
      >
        <OptimizedImage 
          src={trustpilotLogo} 
          alt="Trustpilot 5 stars" 
          className="h-auto w-15 object-contain"
          priority={false}
          width={120}
          height={37}
        />
      </a>
    </div>
  );
};

export default TrustpilotHeader;