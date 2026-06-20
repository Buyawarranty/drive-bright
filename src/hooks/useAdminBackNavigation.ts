import { useEffect, useRef, useCallback } from 'react';

interface UseAdminBackNavigationOptions {
  activeTab: string;
  tabHistory: string[];
  onBackToTab: (tab: string, updatedHistory: string[]) => void;
  enabled?: boolean;
}

/**
 * Prevents the browser back button from leaving the admin dashboard.
 * When there is a previous tab in the session history, back navigates to it.
 * Otherwise it stays on the current tab instead of returning to the referrer.
 */
export const useAdminBackNavigation = ({
  activeTab,
  tabHistory,
  onBackToTab,
  enabled = true,
}: UseAdminBackNavigationOptions) => {
  const activeTabRef = useRef(activeTab);
  const tabHistoryRef = useRef(tabHistory);
  const enabledRef = useRef(enabled);
  const hasInitializedRef = useRef(false);
  const isHandlingRef = useRef(false);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    tabHistoryRef.current = tabHistory;
  }, [tabHistory]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const buildTabUrl = useCallback((tab: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    return url.toString();
  }, []);

  const pushGuardEntries = useCallback(
    (tab: string, count = 2) => {
      const url = buildTabUrl(tab);
      for (let i = 0; i < count; i++) {
        window.history.pushState({ adminGuard: true, tab }, '', url);
      }
    },
    [buildTabUrl]
  );

  const handlePopState = useCallback(
    (event: PopStateEvent) => {
      if (!enabledRef.current) return;

      // Avoid re-entrancy from rapid back presses.
      if (isHandlingRef.current) {
        pushGuardEntries(activeTabRef.current, 1);
        return;
      }
      isHandlingRef.current = true;

      const history = tabHistoryRef.current;

      if (history.length > 1) {
        const updatedHistory = history.slice(0, -1);
        const previousTab = updatedHistory[updatedHistory.length - 1];

        // Update refs immediately so rapid back presses see the new history.
        tabHistoryRef.current = updatedHistory;
        activeTabRef.current = previousTab;

        // Let the parent update its state and the URL.
        onBackToTab(previousTab, updatedHistory);

        // Re-establish the guard on the new tab's URL.
        pushGuardEntries(previousTab, 2);
      } else {
        // No previous tab to go back to; keep the user on the dashboard.
        pushGuardEntries(activeTabRef.current, 2);
      }

      isHandlingRef.current = false;
    },
    [onBackToTab, pushGuardEntries]
  );

  useEffect(() => {
    if (!enabled) return;

    if (!hasInitializedRef.current) {
      pushGuardEntries(activeTabRef.current, 2);
      hasInitializedRef.current = true;
    }

    window.addEventListener('popstate', handlePopState);

    const handlePageShow = (event: PageTransitionEvent) => {
      // Re-arm the guard when the page is restored from bfcache (iOS Safari).
      if (event.persisted) {
        hasInitializedRef.current = false;
        pushGuardEntries(activeTabRef.current, 2);
        hasInitializedRef.current = true;
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pageshow', handlePageShow);
      hasInitializedRef.current = false;
    };
  }, [enabled, handlePopState, pushGuardEntries]);

};
