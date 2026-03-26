import React, { useEffect, useRef } from 'react';

const TrustpilotMicroStarWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && (window as any).Trustpilot) {
      (window as any).Trustpilot.loadFromElement(ref.current, true);
    }
  }, []);

  return (
    <div
      ref={ref}
      className={`trustpilot-widget ${className}`}
      data-locale="en-US"
      data-template-id="5419b732fbfb950b10de65e5"
      data-businessunit-id="6586c764848940568d554a08"
      data-style-height="24px"
      data-style-width="100%"
      data-token="6fd1e186-8398-4079-b009-a2d6ea21d627"
    >
      <a href="https://www.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener">
        Trustpilot
      </a>
    </div>
  );
};

export default TrustpilotMicroStarWidget;
