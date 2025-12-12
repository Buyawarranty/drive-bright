/**
 * Deferred third-party script loading
 * Optimized to minimize Total Blocking Time (TBT)
 * Loads tracking scripts only after user interaction or idle time
 */

let fbLoaded = false;
let ttLoaded = false;

// Lightweight Facebook Pixel loader with stub
const loadFacebookPixel = () => {
  if (typeof window === 'undefined' || fbLoaded) return;
  fbLoaded = true;
  
  // Create minimal stub to queue calls
  if (!window.fbq) {
    const fbq: any = function() {
      (fbq.q = fbq.q || []).push(arguments);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
  }
  
  // Load script with low priority to not block main thread
  const script = document.createElement('script');
  script.async = true;
  script.defer = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  script.onload = () => {
    if (window.fbq) {
      window.fbq('init', '4105451209698810');
      window.fbq('track', 'PageView');
    }
  };
  document.head.appendChild(script);
};

// Lightweight TikTok Pixel loader
const loadTikTokPixel = () => {
  if (typeof window === 'undefined' || ttLoaded || window.ttq) return;
  ttLoaded = true;
  
  // Create minimal stub
  window.TiktokAnalyticsObject = 'ttq';
  const ttq = window.ttq = window.ttq || [];
  ttq.methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
  ttq.setAndDefer = function(t: any, e: string) {
    t[e] = function() {
      t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
    };
  };
  
  for (let i = 0; i < ttq.methods.length; i++) {
    ttq.setAndDefer(ttq, ttq.methods[i]);
  }
  
  const script = document.createElement('script');
  script.async = true;
  script.defer = true;
  script.src = 'https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=D38LC5JC77UB9GL651GG&lib=ttq';
  script.onload = () => {
    // Initialize after short delay to not block
    setTimeout(() => {
      if (window.ttq && typeof window.ttq.load === 'function') {
        window.ttq.load('D38LC5JC77UB9GL651GG');
        window.ttq.page();
      }
    }, 100);
  };
  document.head.appendChild(script);
};

// Export for manual loading after user interaction
export const loadThirdPartyScripts = () => {
  // Use requestIdleCallback for optimal timing
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      loadFacebookPixel();
      loadTikTokPixel();
    }, { timeout: 3000 });
  } else {
    setTimeout(() => {
      loadFacebookPixel();
      loadTikTokPixel();
    }, 2000);
  }
};

// Initialize with interaction-based loading for better TBT
export const initThirdPartyScripts = () => {
  // Only load Facebook stub immediately to catch early events
  if (!window.fbq) {
    const fbq: any = function() {
      (fbq.q = fbq.q || []).push(arguments);
    };
    fbq.push = fbq;
    fbq.loaded = false;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
  }
  
  // Load full scripts on first user interaction
  const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
  let loaded = false;
  
  const loadOnInteraction = () => {
    if (loaded) return;
    loaded = true;
    
    events.forEach(event => {
      window.removeEventListener(event, loadOnInteraction);
    });
    
    // Small delay to not compete with interaction handling
    setTimeout(loadThirdPartyScripts, 50);
  };
  
  events.forEach(event => {
    window.addEventListener(event, loadOnInteraction, { passive: true, once: true });
  });
  
  // Fallback: load after 5 seconds if no interaction (reduced from 3s)
  setTimeout(() => {
    if (!loaded) {
      loaded = true;
      loadThirdPartyScripts();
    }
  }, 5000);
};
