/**
 * Preload critical routes for instant navigation
 * Call this after initial page load to improve perceived performance
 */
export const preloadCriticalRoutes = () => {
  // Preload most commonly accessed routes
  const criticalRoutes = [
    '/faq/',
    '/contact-us/',
    '/what-is-covered/',
  ];

  // Use requestIdleCallback to avoid blocking main thread
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      criticalRoutes.forEach((route) => {
        // Prefetch hint for the browser
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = route;
        document.head.appendChild(link);
      });
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      criticalRoutes.forEach((route) => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = route;
        document.head.appendChild(link);
      });
    }, 2000);
  }
};

/**
 * Prefetch a route on hover for instant navigation
 */
export const prefetchRouteOnHover = (route: string) => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = route;
  document.head.appendChild(link);
};
