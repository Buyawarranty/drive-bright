import React, { useEffect, useRef } from 'react';

const TrustpilotMicroWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
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
      data-template-id="5419b637fa0340045cd0c936"
      data-businessunit-id="6586c764848940568d554a08"
      data-style-height="20px"
      data-style-width="100%"
      data-token="0cd737ae-78a3-4876-bacd-b7bc5c9aa076"
    >
      <a href="https://www.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener">
        Trustpilot
      </a>
    </div>
  );
};

export default TrustpilotMicroWidget;
