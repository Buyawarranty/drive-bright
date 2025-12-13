/**
 * Deferred third-party script loading
 * Loads tracking scripts after user interaction or on idle to improve performance
 */

let scriptsLoaded = false;

const loadFacebookPixel = () => {
  if (typeof window === 'undefined') return;
  if (window.fbq) return;
  
  // Initialize stub function to queue calls before script loads
  const fbqStub: any = function() {
    if (fbqStub.callMethod) {
      fbqStub.callMethod.apply(fbqStub, arguments);
    } else {
      fbqStub.queue.push(arguments);
    }
  };
  fbqStub.push = fbqStub;
  fbqStub.loaded = true;
  fbqStub.version = '2.0';
  fbqStub.queue = [];
  window.fbq = fbqStub;
  
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  script.onload = () => {
    console.info('Facebook Pixel loaded successfully');
    if (window.fbq) {
      window.fbq('init', '4105451209698810');
      window.fbq('track', 'PageView');
    }
  };
  script.onerror = () => {
    console.error('Failed to load Facebook Pixel script');
  };
  document.head.appendChild(script);
};

const loadTikTokPixel = () => {
  if (window.ttq) return;
  
  try {
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
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=D38LC5JC77UB9GL651GG&lib=ttq';
    
    // Wait for script to fully load and initialize
    script.onload = () => {
      // Poll for ttq.load to be available (max 5 seconds)
      let attempts = 0;
      const maxAttempts = 50;
      
      const initializeTikTok = () => {
        if (window.ttq && typeof window.ttq.load === 'function') {
          try {
            window.ttq.load('D38LC5JC77UB9GL651GG');
            window.ttq.page({}, { test_event_code: 'TEST33403' });
            console.info('TikTok Pixel initialized successfully');
          } catch (error) {
            console.error('TikTok Pixel initialization failed:', error);
          }
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(initializeTikTok, 100);
        } else {
          console.warn('TikTok Pixel load function not available after timeout');
        }
      };
      
      initializeTikTok();
    };
    
    script.onerror = () => {
      console.error('Failed to load TikTok Pixel script');
    };
    
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode?.insertBefore(script, firstScript);
  } catch (error) {
    console.error('Error loading TikTok Pixel:', error);
  }
};

export const loadThirdPartyScripts = () => {
  if (scriptsLoaded) return;
  scriptsLoaded = true;
  
  console.info('Loading third-party scripts after user interaction');
  
  // Use requestIdleCallback for better performance
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      loadFacebookPixel();
      loadTikTokPixel();
    }, { timeout: 2000 });
  } else {
    setTimeout(() => {
      loadFacebookPixel();
      loadTikTokPixel();
    }, 1000);
  }
};

// Load scripts immediately to prevent "fbq is not defined" errors
export const initThirdPartyScripts = () => {
  // Load Facebook Pixel immediately with stub to queue early calls
  loadFacebookPixel();
  
  // Load TikTok after interaction to optimize performance
  const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
  
  const loadOnce = () => {
    loadTikTokPixel();
    events.forEach(event => {
      window.removeEventListener(event, loadOnce);
    });
  };
  
  events.forEach(event => {
    window.addEventListener(event, loadOnce, { passive: true, once: true });
  });
  
  // Fallback: load TikTok after 3 seconds if no interaction
  setTimeout(() => {
    if (!window.ttq || typeof window.ttq.load !== 'function') {
      loadTikTokPixel();
    }
  }, 3000);
};
