import React, { useEffect, useRef } from 'react';

const TrustpilotSliderWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
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
      data-template-id="54ad5defc6454f065c28af8b"
      data-businessunit-id="6586c764848940568d554a08"
      data-style-height="240px"
      data-style-width="100%"
      data-token="bc45050a-f777-4e97-99cd-8e7114e1269d"
      data-stars="4,5"
      data-review-languages="en"
    >
      <a href="https://www.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener">
        Trustpilot
      </a>
    </div>
  );
};

export default TrustpilotSliderWidget;
