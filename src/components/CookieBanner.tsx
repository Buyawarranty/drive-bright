import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
  const [isClosing, setIsClosing] = useState(false);
  const [searchParams] = useSearchParams();

  // Get current step from URL
  const currentStep = searchParams.get('step');
  const isCheckoutStep = currentStep === '3' || currentStep === '4' || currentStep === '5' || currentStep === '6';

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    
    // Never show on checkout steps or if already consented
    if (consent || isCheckoutStep) {
      setShowBanner(false);
      return;
    }

    // Show immediately on first visit (non-checkout pages only)
    setShowBanner(true);
  }, [isCheckoutStep]);

  // Hide banner when navigating to checkout
  useEffect(() => {
    if (isCheckoutStep) {
      setShowBanner(false);
    }
  }, [isCheckoutStep]);

  const handleAccept = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      performance: true,
      marketing: true,
      functional: true,
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(allAccepted));
    
    // Slide down animation
    setIsClosing(true);
    setTimeout(() => {
      setShowBanner(false);
      setIsClosing(false);
    }, 300);
  };

  const handleSavePreferences = (preferences: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(preferences));
    
    setIsClosing(true);
    setTimeout(() => {
      setShowBanner(false);
      setShowPreferences(false);
      setIsClosing(false);
    }, 300);
  };

  // Never render on checkout steps
  if (isCheckoutStep || !showBanner) {
    return (
      <CookiePreferencesDialog
        open={showPreferences}
        onOpenChange={setShowPreferences}
        onSave={handleSavePreferences}
      />
    );
  }

  return (
    <>
      {/* Slim bottom bar - 56-72px height */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] transition-transform duration-300 ease-out ${
          isClosing ? 'translate-y-full' : 'translate-y-0'
        }`}
        role="region"
        aria-label="Cookie consent banner"
      >
        <div 
          className="bg-[#F9F9F9] border-t border-[#E2E2E2] py-3 px-4 md:px-6"
          style={{ minHeight: '56px', maxHeight: '72px' }}
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Text */}
            <p className="text-sm text-[#444444] text-center sm:text-left">
              We use cookies to improve your experience.{' '}
              <button
                onClick={() => setShowPreferences(true)}
                className="text-[#666666] underline underline-offset-2 hover:text-[#333333] transition-colors"
              >
                Cookie settings
              </button>
            </p>
            
            {/* Accept button */}
            <button
              onClick={handleAccept}
              className="bg-[#18864B] hover:bg-[#146B3D] text-white font-medium py-2 px-5 rounded-md text-sm transition-colors whitespace-nowrap"
            >
              Accept
            </button>
          </div>
        </div>
      </div>

      <CookiePreferencesDialog
        open={showPreferences}
        onOpenChange={setShowPreferences}
        onSave={handleSavePreferences}
      />
    </>
  );
}
