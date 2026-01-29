import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";
import { CookiePreferencesDialog } from "./CookiePreferencesDialog";

interface CookiePreferences {
  essential: boolean;
  performance: boolean;
  marketing: boolean;
  functional: boolean;
}

const COOKIE_CONSENT_KEY = "cookie_consent";
const COOKIE_PREFERENCES_KEY = "cookie_preferences";

export function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showIcon, setShowIcon] = useState(false);

  // Hide cookie banner/icon on Step 3 and Step 4 of checkout
  const isCheckoutStep = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const step = urlParams.get('step');
    return step === '3' || step === '4';
  };

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Delay showing banner - 30 seconds on mobile, 15 seconds on desktop
      // This prevents interrupting first-time visitors during their initial browsing
      const isMobile = window.innerWidth < 768;
      const showDelay = isMobile ? 30000 : 15000; // 30s mobile, 15s desktop
      
      const showTimer = setTimeout(() => {
        if (!isCheckoutStep()) {
          setShowBanner(true);
        }
      }, showDelay);
      
      // Auto-fade after additional 15 seconds if no action taken
      const fadeTimer = setTimeout(() => {
        setShowBanner(false);
        if (!isCheckoutStep()) {
          setShowIcon(true);
        }
      }, showDelay + 15000);

      return () => {
        clearTimeout(showTimer);
        clearTimeout(fadeTimer);
      };
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      performance: true,
      marketing: true,
      functional: true,
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(allAccepted));
    setShowBanner(false);
  };

  const handleSavePreferences = (preferences: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(preferences));
    setShowBanner(false);
    setShowIcon(false);
  };

  const handleReopenFromIcon = () => {
    setShowIcon(false);
    setShowPreferences(true);
  };

  // Don't render on checkout steps 3 and 4
  if (isCheckoutStep()) {
    return null;
  }

  if (!showBanner && !showIcon) {
    return null;
  }

  return (
    <>
      {showBanner && (
        <div
          className="fixed bottom-24 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[60] animate-fade-in"
          role="region"
          aria-label="Cookie consent banner"
        >
          <div className="bg-card border border-border rounded-lg shadow-md p-3">
            <div className="flex items-start gap-2">
              <Cookie className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div className="flex-1 space-y-2">
                <p className="text-xs text-foreground">
                  We use cookies to improve your experience.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleAcceptAll}
                    size="sm"
                    className="w-full sm:w-auto bg-black text-white hover:bg-gray-800 h-8 text-xs"
                  >
                    Accept
                  </Button>
                  <Button
                    onClick={() => setShowPreferences(true)}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto h-8 text-xs"
                  >
                    Manage
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showIcon && (
        <button
          onClick={handleReopenFromIcon}
          className="fixed bottom-24 md:bottom-4 right-4 z-[60] bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:scale-110 transition-transform animate-fade-in"
          aria-label="Open cookie preferences"
        >
          <Cookie className="w-5 h-5" aria-hidden="true" />
        </button>
      )}

      <CookiePreferencesDialog
        open={showPreferences}
        onOpenChange={setShowPreferences}
        onSave={handleSavePreferences}
      />
    </>
  );
}
