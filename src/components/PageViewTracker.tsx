import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { captureGclid } from '@/utils/gclidCapture';
import { captureFbclid } from '@/utils/fbclidCapture';
import { captureUtms } from '@/utils/utmCapture';

// Track page views in Google Ads/Analytics on route changes
export const PageViewTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // Capture ad click IDs + UTMs on EVERY route so deep-link landings
    // (e.g. /tesla/, /quote) don't lose attribution.
    captureGclid();
    captureFbclid();
    captureUtms();

    // Check if gtag is available
    if (typeof window !== 'undefined' && window.gtag) {
      const page_path = location.pathname + location.search;
      const page_location = window.location.href;
      const page_title = document.title;

      // GA4 — send explicit page_view event (recommended for SPAs)
      window.gtag('event', 'page_view', {
        send_to: 'G-T5P06P67GM',
        page_path,
        page_location,
        page_title,
      });

      // Google Ads — re-config so remarketing/conversion context updates with the new URL
      window.gtag('config', 'AW-17325228149', {
        page_path,
      });

      console.log('Page view tracked:', page_path);
    }
  }, [location]);

  return null;
};
