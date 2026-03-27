import React, { useEffect, useRef } from 'react';

const TrustpilotMicroComboWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
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
      data-template-id="5419b6ffb0d04a076446a9af"
      data-businessunit-id="6586c764848940568d554a08"
      data-style-height="20px"
      data-style-width="100%"
      data-token="e64ec9bd-7fd7-450c-a0d0-dceef5f14b5e"
    >
      <a href="https://www.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener">
        Trustpilot
      </a>
    </div>
  );
};

export default TrustpilotMicroComboWidget;
