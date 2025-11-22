import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Track page views in Google Ads/Analytics on route changes
export const PageViewTracker = () => {
  const location = useLocation();

  useEffect(() => {
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
