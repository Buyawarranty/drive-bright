import React, { useEffect, useRef } from 'react';

const BOOTSTRAP_SRC = 'https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js';

function ensureBootstrap(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).Trustpilot) return;
  if (document.querySelector(`script[src="${BOOTSTRAP_SRC}"]`)) return;
  const s = document.createElement('script');
  s.src = BOOTSTRAP_SRC;
  s.async = true;
  document.head.appendChild(s);
}

const TrustpilotSliderWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 100; // ~10s at 100ms

    ensureBootstrap();

    const tryLoad = () => {
      if (cancelled || !ref.current) return;
      const TP = (window as any).Trustpilot;
      if (TP && typeof TP.loadFromElement === 'function') {
        try {
          TP.loadFromElement(ref.current, true);
        } catch (e) {
          console.warn('[Trustpilot] loadFromElement failed', e);
        }
        return;
      }
      if (++attempts < maxAttempts) {
        setTimeout(tryLoad, 100);
      } else {
        console.warn('[Trustpilot] bootstrap script never became available');
      }
    };

    tryLoad();
    return () => {
      cancelled = true;
    };
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
