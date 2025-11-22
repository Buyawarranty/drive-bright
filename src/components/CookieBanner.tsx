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

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setShowBanner(true);
      
      // Auto-fade after 15 seconds if no action taken
      const timer = setTimeout(() => {
        setShowBanner(false);
        setShowIcon(true);
      }, 15000);

      return () => clearTimeout(timer);
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

  if (!showBanner && !showIcon) {
    return null;
  }

  return (
    <>
      {showBanner && (
        <div
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-fade-in"
          role="region"
          aria-label="Cookie consent banner"
        >
          <div className="bg-card border border-border rounded-lg shadow-lg p-4">
            <div className="flex items-start gap-3">
              <Cookie className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div className="flex-1 space-y-3">
                <p className="text-sm text-foreground">
                  We use cookies to improve your experience. You can manage your
                  preferences anytime.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleAcceptAll}
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    Accept All
                  </Button>
                  <Button
                    onClick={() => setShowPreferences(true)}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    Manage Preferences
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
          className="fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:scale-110 transition-transform animate-fade-in"
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
