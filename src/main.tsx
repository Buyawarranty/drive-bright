import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'
import { initPerformanceMonitoring } from '@/utils/performanceMonitor'
import { initThirdPartyScripts } from '@/utils/thirdPartyScripts'

// Initialize performance monitoring only in development
if (process.env.NODE_ENV === 'development') {
  initPerformanceMonitoring();
}

// Initialize deferred third-party scripts
if (typeof window !== 'undefined') {
  setTimeout(() => {
    initThirdPartyScripts();
  }, 0);
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
)