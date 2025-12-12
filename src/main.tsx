import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Remove initial loader once React hydrates
const removeLoader = () => {
  const loader = document.getElementById('initial-loader');
  if (loader) {
    loader.style.display = 'none';
  }
};

// Defer third-party scripts for better TBT
const initDeferredScripts = () => {
  // Use dynamic import for third-party scripts to reduce main bundle
  import('@/utils/thirdPartyScripts').then(({ initThirdPartyScripts }) => {
    initThirdPartyScripts();
  });
};

// Initialize after user interaction or idle time
if ('requestIdleCallback' in window) {
  requestIdleCallback(initDeferredScripts, { timeout: 5000 });
} else {
  setTimeout(initDeferredScripts, 3000);
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// Remove loader after initial render
removeLoader();