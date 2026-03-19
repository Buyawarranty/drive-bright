import React, { useEffect, useRef } from 'react';

const TrustpilotMiniWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
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
      data-template-id="53aa8807dec7e10d38f59f32"
      data-businessunit-id="6586c764848940568d554a08"
      data-style-height="150px"
      data-style-width="100%"
      data-token="de0679f5-d668-496b-bc39-81cdf9b345a4"
    >
      <a href="https://www.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener">
        Trustpilot
      </a>
    </div>
  );
};

export default TrustpilotMiniWidget;
