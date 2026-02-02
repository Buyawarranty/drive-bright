import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { trackEvent } from '@/utils/analytics';

interface UseMobileBackNavigationProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  totalSteps: number;
  restoreStateFromStep?: (step: number) => void;
  journeyId?: string;
  isGuarded?: boolean; // Whether this journey should show confirmation dialog
  onShowConfirmDialog?: () => void; // Callback to show confirmation dialog
}

export const useMobileBackNavigation = ({ 
  currentStep, 
  onStepChange, 
  totalSteps,
  restoreStateFromStep,
  journeyId = 'warranty-journey',
  isGuarded = true,
  onShowConfirmDialog
}: UseMobileBackNavigationProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasShownConfirmOnThisStep, setHasShownConfirmOnThisStep] = useState(false);
  const isLeavingRef = useRef(false);
  const lastStepRef = useRef(currentStep);
  const historyStackRef = useRef<number[]>([]);
  const isHandlingBackRef = useRef(false);
  const hasInitializedHistoryRef = useRef(false);
  const lastPushedStepRef = useRef<number | null>(null);
  // Track how many guard entries we've pushed to prevent infinite history growth
  const guardEntriesCountRef = useRef(0);
  const MAX_GUARD_ENTRIES = 3;

  // Reset confirmation flag when step changes
  useEffect(() => {
    if (currentStep !== lastStepRef.current) {
      setHasShownConfirmOnThisStep(false);
      
      // Track step in our own history stack
      if (!historyStackRef.current.includes(currentStep)) {
        historyStackRef.current.push(currentStep);
      }
      
      lastStepRef.current = currentStep;
      // Reset guard entries count on step change
      guardEntriesCountRef.current = 0;
    }
  }, [currentStep]);

  // Initialize our history stack on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = parseInt(urlParams.get('step') || '1');
    
    // Build initial history stack from step 1 to current step
    historyStackRef.current = [];
    for (let i = 1; i <= urlStep; i++) {
      historyStackRef.current.push(i);
    }
    
    console.log('📱 Initialized history stack:', historyStackRef.current);
  }, []);


  const handleBackNavigation = useCallback((event: PopStateEvent) => {
    // Prevent re-entrancy
    if (isHandlingBackRef.current) {
      console.log('📱 Already handling back, skipping');
      return;
    }
    
    isHandlingBackRef.current = true;
    
    console.log('📱 Mobile back navigation triggered', { 
      currentStep, 
      isGuarded, 
      hasShownConfirmOnThisStep,
      isLeaving: isLeavingRef.current,
      historyStack: historyStackRef.current,
      historyState: event.state
    });
    
    // CRITICAL FIX: Immediately push a guard entry to prevent browser from exiting
    // This creates a buffer before we process the navigation
    window.history.pushState({ step: currentStep, guard: true, immediate: true }, '', window.location.href);
    
    // If we're in the process of leaving (user confirmed), go to step 1
    if (isLeavingRef.current) {
      console.log('📱 User confirmed leave, going to step 1');
      isLeavingRef.current = false;
      isHandlingBackRef.current = false;
      
      // Go to step 1 instead of leaving
      const step1Url = `${window.location.pathname}?step=1`;
      window.history.replaceState({ step: 1 }, '', step1Url);
      onStepChange(1);
      historyStackRef.current = [1];
      guardEntriesCountRef.current = 0;
      
      trackEvent('back_intercept_leave', {
        journey_id: journeyId,
        step: currentStep,
        step_name: `step_${currentStep}`
      });
      
      // Push multiple guard entries for step 1
      setTimeout(() => {
        window.history.pushState({ step: 1, guard: true }, '', window.location.href);
        window.history.pushState({ step: 1, guard: true }, '', window.location.href);
        guardEntriesCountRef.current = 2;
      }, 50);
      return;
    }
    
    // Calculate the previous step
    const previousStep = currentStep - 1;
    
    console.log('📱 Current step:', currentStep, 'Previous step would be:', previousStep);
    
    // CRITICAL: If we're on step 1, ALWAYS push guard entries to prevent leaving
    if (currentStep <= 1) {
      console.log('📱 On step 1, preventing site exit');
      
      // Re-establish current state
      const step1Url = `${window.location.pathname}?step=1`;
      window.history.replaceState({ step: 1 }, '', step1Url);
      
      // Push multiple guard entries to maintain buffer
      setTimeout(() => {
        window.history.pushState({ step: 1, guard: true }, '', window.location.href);
        window.history.pushState({ step: 1, guard: true }, '', window.location.href);
        guardEntriesCountRef.current = 2;
      }, 50);
      
      isHandlingBackRef.current = false;
      return;
    }
    
    // If trying to go back from step 2+ to previous step
    if (previousStep >= 1) {
      console.log('📱 Navigating to previous step:', previousStep);
      
      // Track step change
      trackEvent('journey_step_changed', {
        journey_id: journeyId,
        from_step: currentStep,
        to_step: previousStep,
        direction: 'back',
        trigger: 'mobile_back_button'
      });
      
      // Restore state for previous step if handler provided
      if (restoreStateFromStep) {
        restoreStateFromStep(previousStep);
      }
      
      // Update URL and state
      const stepUrl = `${window.location.pathname}?step=${previousStep}`;
      window.history.replaceState({ step: previousStep }, '', stepUrl);
      
      // Update current step
      onStepChange(previousStep);
      
      // Update our history stack
      historyStackRef.current = historyStackRef.current.filter(s => s <= previousStep);
      
      // Reset guard count and push multiple guard entries
      guardEntriesCountRef.current = 0;
      setTimeout(() => {
        window.history.pushState({ step: previousStep, guard: true }, '', window.location.href);
        window.history.pushState({ step: previousStep, guard: true }, '', window.location.href);
        guardEntriesCountRef.current = 2;
        lastPushedStepRef.current = previousStep;
      }, 50);
      
      // Scroll to top like internal back button
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      isHandlingBackRef.current = false;
      return;
    }
    
    // Fallback: stay on current step and ensure we have guard entries
    console.log('📱 Fallback: staying on current step');
    const currentUrl = `${window.location.pathname}?step=${currentStep}`;
    window.history.replaceState({ step: currentStep }, '', currentUrl);
    
    setTimeout(() => {
      window.history.pushState({ step: currentStep, guard: true }, '', window.location.href);
      window.history.pushState({ step: currentStep, guard: true }, '', window.location.href);
      guardEntriesCountRef.current = 2;
    }, 50);
    
    isHandlingBackRef.current = false;
    
  }, [currentStep, onStepChange, restoreStateFromStep, totalSteps, isGuarded, onShowConfirmDialog, hasShownConfirmOnThisStep, journeyId]);

  // Method to allow leaving (called when user confirms from dialog)
  const allowLeave = useCallback(() => {
    console.log('📱 Setting allow leave flag');
    isLeavingRef.current = true;
    setHasShownConfirmOnThisStep(false);
    
    // Track user decision to leave
    trackEvent('back_intercept_leave', {
      journey_id: journeyId,
      step: currentStep,
      step_name: `step_${currentStep}`
    });
    
    // Navigate to step 1 instead of leaving the site entirely
    const step1Url = `${window.location.pathname}?step=1`;
    window.history.replaceState({ step: 1 }, '', step1Url);
    onStepChange(1);
    historyStackRef.current = [1];
    guardEntriesCountRef.current = 0;
    
    // Push multiple guard entries for step 1
    setTimeout(() => {
      window.history.pushState({ step: 1, guard: true }, '', window.location.href);
      window.history.pushState({ step: 1, guard: true }, '', window.location.href);
      guardEntriesCountRef.current = 2;
    }, 50);
    
    // Reset the leaving flag
    isLeavingRef.current = false;
  }, [currentStep, journeyId, onStepChange]);

  // Method to stay (called when user cancels)
  const stay = useCallback(() => {
    console.log('📱 User chose to stay');
    isLeavingRef.current = false;
    
    // Track user decision to stay
    trackEvent('back_intercept_stay', {
      journey_id: journeyId,
      step: currentStep,
      step_name: `step_${currentStep}`
    });
    
    // Re-establish current state and push multiple guard entries
    const currentUrl = `${window.location.pathname}?step=${currentStep}`;
    window.history.replaceState({ step: currentStep }, '', currentUrl);
    
    setTimeout(() => {
      window.history.pushState({ step: currentStep, guard: true }, '', window.location.href);
      window.history.pushState({ step: currentStep, guard: true }, '', window.location.href);
      guardEntriesCountRef.current = 2;
    }, 50);
  }, [currentStep, journeyId]);

  useEffect(() => {
    console.log('📱 Setting up mobile navigation listeners for step', currentStep);
    
    // Set scroll restoration to manual for better control
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    
    // Ensure we have proper history state for current step
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = parseInt(urlParams.get('step') || '1');
    
    // Always ensure history state matches current step
    if (!window.history.state || window.history.state.step !== urlStep) {
      window.history.replaceState({ step: urlStep }, '', window.location.href);
      console.log('📱 Set history state for step', urlStep);
    }
    
    // Push initial guard entries to create a buffer that prevents leaving the site
    // Only do this once per step to prevent history pollution
    if (!hasInitializedHistoryRef.current || lastPushedStepRef.current !== urlStep) {
      // Push multiple guard entries to create a buffer
      window.history.pushState({ step: urlStep, guard: true }, '', window.location.href);
      window.history.pushState({ step: urlStep, guard: true }, '', window.location.href);
      guardEntriesCountRef.current = 2;
      console.log('📱 Pushed initial guard entries for step', urlStep);
      hasInitializedHistoryRef.current = true;
      lastPushedStepRef.current = urlStep;
    }
    
    // Listen for popstate events (back/forward button presses)
    window.addEventListener('popstate', handleBackNavigation);
    
    // iOS Safari specific: handle bfcache - CRITICAL for Stripe back-navigation
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📱 Page restored from bfcache - fast path');
        // Reset ALL state flags when page comes back from bfcache
        isLeavingRef.current = false;
        isHandlingBackRef.current = false;
        setHasShownConfirmOnThisStep(false);
        guardEntriesCountRef.current = 0;
        
        // Re-establish proper history state
        const urlParams = new URLSearchParams(window.location.search);
        const urlStep = parseInt(urlParams.get('step') || '1');
        
        // Ensure history state is correct
        window.history.replaceState({ step: urlStep }, '', window.location.href);
        
        // Push fresh guard entries after a small delay to let page fully restore
        setTimeout(() => {
          if (lastPushedStepRef.current !== urlStep || guardEntriesCountRef.current < 2) {
            window.history.pushState({ step: urlStep, guard: true }, '', window.location.href);
            window.history.pushState({ step: urlStep, guard: true }, '', window.location.href);
            guardEntriesCountRef.current = 2;
            lastPushedStepRef.current = urlStep;
          }
        }, 100);
      }
    };
    
    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📱 Page going into bfcache');
      }
    };
    
    // Handle beforeunload - this is a last resort to catch navigation
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Note: Modern browsers don't show custom messages, but this can still help
      console.log('📱 beforeunload triggered on step', currentStep);
    };
    
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      console.log('📱 Cleaning up mobile navigation listeners');
      window.removeEventListener('popstate', handleBackNavigation);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleBackNavigation, currentStep, isGuarded]);

  return {
    allowLeave,
    stay
  };
};
