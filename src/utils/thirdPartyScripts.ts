/**
 * Deferred third-party script loading
 * Loads tracking scripts after user interaction or idle time to keep the main
 * thread free during initial render (huge FCP/TBT win on mobile).
 *
 * The gtag() stub + dataLayer + consent defaults + config calls are queued
 * synchronously in index.html, so any early gtag('event', ...) calls are safe.
 * When the real gtag.js and GTM scripts arrive, they drain the queue.
 */

let gtagLoaded = false;
let gtmLoaded = false;
let fbLoaded = false;
let ttLoaded = false;

const loadGtag = () => {
  if (gtagLoaded) return;
  gtagLoaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-T5P06P67GM';
  document.head.appendChild(s);
};

const loadGTM = () => {
  if (gtmLoaded) return;
  gtmLoaded = true;
  (function (w: any, d: Document, s: string, l: string, i: string) {
    w[l] = w[l] || [];
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    const f = d.getElementsByTagName(s)[0];
    const j = d.createElement(s) as HTMLScriptElement;
    const dl = l !== 'dataLayer' ? '&l=' + l : '';
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
    f.parentNode?.insertBefore(j, f);
  })(window, document, 'script', 'dataLayer', 'GTM-PJNTC6DX');
};

const loadFacebookPixel = () => {
  if (typeof window === 'undefined' || fbLoaded) return;
  fbLoaded = true;

  if (!window.fbq) {
    const fbqStub: any = function () {
      if (fbqStub.callMethod) fbqStub.callMethod.apply(fbqStub, arguments);
      else fbqStub.queue.push(arguments);
    };
    fbqStub.push = fbqStub;
    fbqStub.loaded = true;
    fbqStub.version = '2.0';
    fbqStub.queue = [];
    window.fbq = fbqStub;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  script.onload = () => {
    if (window.fbq) {
      window.fbq('init', '4105451209698810');
      window.fbq('track', 'PageView');
    }
  };
  document.head.appendChild(script);
};

const loadTikTokPixel = () => {
  if (ttLoaded || window.ttq) return;
  ttLoaded = true;

  try {
    window.TiktokAnalyticsObject = 'ttq';
    const ttq = (window.ttq = window.ttq || []);
    ttq.methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
    ttq.setAndDefer = function (t: any, e: string) {
      t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); };
    };
    for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=D38LC5JC77UB9GL651GG&lib=ttq';
    script.onload = () => {
      let attempts = 0;
      const init = () => {
        if (window.ttq && typeof window.ttq.load === 'function') {
          try {
            window.ttq.load('D38LC5JC77UB9GL651GG');
            window.ttq.page();
          } catch (e) { console.error('TikTok init failed:', e); }
        } else if (attempts++ < 50) {
          setTimeout(init, 100);
        }
      };
      init();
    };
    const first = document.getElementsByTagName('script')[0];
    first.parentNode?.insertBefore(script, first);
  } catch (e) {
    console.error('Error loading TikTok Pixel:', e);
  }
};

const loadAll = () => {
  loadGtag();
  loadGTM();
  loadFacebookPixel();
  loadTikTokPixel();
};

/**
 * Defer every marketing pixel until the first user interaction OR ~2.5s,
 * whichever comes first. This lets main content render and become interactive
 * before ~2.8MB of tracker JS parses.
 */
export const initThirdPartyScripts = () => {
  if (typeof window === 'undefined') return;

  let fired = false;
  const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'pointermove'];

  const fire = () => {
    if (fired) return;
    fired = true;
    events.forEach((ev) => window.removeEventListener(ev, fire));
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(loadAll, { timeout: 2000 });
    } else {
      loadAll();
    }
  };

  events.forEach((ev) => window.addEventListener(ev, fire, { passive: true, once: true }));

  // Fallback: fire after 2.5s so bots and non-interacting users still get tracked.
  setTimeout(fire, 2500);
};

// Backward compatibility
export const loadThirdPartyScripts = loadAll;
