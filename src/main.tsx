import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'
import { initPerformanceMonitoring } from '@/utils/performanceMonitor'
import { initThirdPartyScripts } from '@/utils/thirdPartyScripts'
import { initChunkErrorHandler } from '@/utils/chunkErrorHandler'
import { primeLiveExclusions } from '@/lib/pricing/liveVehicleExclusions'
import { RootErrorBoundary } from '@/components/RootErrorBoundary'

// Recover from stale JS chunks after a new deploy (blank-page fix for returning users)
initChunkErrorHandler();

// Apply the published (pushed-live) vehicle exclusion extras as early as possible
primeLiveExclusions().catch(() => undefined);


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
  <RootErrorBoundary>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </RootErrorBoundary>
)