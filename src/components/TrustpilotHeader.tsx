import React, { useEffect, useRef } from 'react';

interface TrustpilotHeaderProps {
  className?: string;
}

const TrustpilotHeader: React.FC<TrustpilotHeaderProps> = ({ className = "" }) => {
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Trustpilot script if not already loaded
    if (!(window as any).Trustpilot) {
      const script = document.createElement('script');
      script.src = '//widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js';
      script.async = true;
      script.onload = () => {
        if (widgetRef.current && (window as any).Trustpilot) {
          (window as any).Trustpilot.loadFromElement(widgetRef.current, true);
        }
      };
      document.head.appendChild(script);
    } else {
      if (widgetRef.current) {
        (window as any).Trustpilot.loadFromElement(widgetRef.current, true);
      }
    }
  }, []);

  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div
        ref={widgetRef}
        className="trustpilot-widget"
        data-locale="en-US"
        data-template-id="5419b6ffb0d04a076446a9af"
        data-businessunit-id="6586c764848940568d554a08"
        data-style-height="20px"
        data-style-width="100%"
        data-token="e64ec9bd-7fd7-450c-a0d0-dceef5f14b5e"
      >
        <a
          href="https://www.trustpilot.com/review/buyawarranty.co.uk"
          target="_blank"
          rel="noopener noreferrer"
        >
          Trustpilot
        </a>
      </div>
    </div>
  );
};

export default TrustpilotHeader;