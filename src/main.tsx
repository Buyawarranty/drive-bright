import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Defer third-party scripts for better TBT
const initDeferredScripts = () => {
  import('@/utils/thirdPartyScripts').then(({ initThirdPartyScripts }) => {
    initThirdPartyScripts();
  });
};

if ('requestIdleCallback' in window) {
  requestIdleCallback(initDeferredScripts, { timeout: 5000 });
} else {
  setTimeout(initDeferredScripts, 3000);
}

// Remove initial loader after React renders
const removeLoader = () => {
  const loader = document.getElementById('initial-loader');
  if (loader) {
    loader.style.display = 'none';
  }
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// Hide loader after render
removeLoader();