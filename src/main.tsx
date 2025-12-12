import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

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

// Remove initial loader - called after React mounts
const removeLoader = () => {
  const loader = document.getElementById('initial-loader');
  if (loader) {
    loader.style.display = 'none';
  }
};

const root = createRoot(document.getElementById("root")!);

// Wrap App to ensure loader is removed after mount
const AppWithLoaderRemoval = () => {
  // Remove loader immediately when this component renders
  removeLoader();
  return <App />;
};

root.render(<AppWithLoaderRemoval />);