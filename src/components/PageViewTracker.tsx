import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { captureGclid } from '@/utils/gclidCapture';
import { captureFbclid } from '@/utils/fbclidCapture';

// Track page views in Google Ads/Analytics on route changes
export const PageViewTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // Capture ad click IDs on EVERY route (handles deep-link landings, e.g. /tesla/, /quote, etc.)
    captureGclid();
    captureFbclid();

    // Check if gtag is available
    if (typeof window !== 'undefined' && window.gtag) {
      // Send page_view event to Google Ads
      window.gtag('config', 'AW-17325228149', {
        page_path: location.pathname + location.search,
      });

      // Also send to Google Analytics
      window.gtag('config', 'G-T5P06P67GM', {
        page_path: location.pathname + location.search,
      });

      console.log('Page view tracked:', location.pathname);
    }
  }, [location]);

  return null;
};
