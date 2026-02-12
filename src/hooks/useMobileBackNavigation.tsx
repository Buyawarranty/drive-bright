import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { trackEvent } from '@/utils/analytics';

interface UseMobileBackNavigationProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  totalSteps: number;
  restoreStateFromStep?: (step: number) => void;
  journeyId?: string;
  isGuarded?: boolean;
  onShowConfirmDialog?: () => void;
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
  const currentStepRef = useRef(currentStep);
  const historyStackRef = useRef<number[]>([]);
  const isHandlingBackRef = useRef(false);
  const hasInitializedHistoryRef = useRef(false);
  const lastPushedStepRef = useRef<number | null>(null);
  const guardEntriesCountRef = useRef(0);
  const MAX_GUARD_ENTRIES = 4;
  // Debounce rapid back presses
  const lastBackPressTimeRef = useRef(0);
  const BACK_PRESS_DEBOUNCE_MS = 300;

  // Keep currentStepRef in sync - this prevents stale closures
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // Reset confirmation flag when step changes
  useEffect(() => {
    setHasShownConfirmOnThisStep(false);
    
    // Track step in our own history stack
    if (!historyStackRef.current.includes(currentStep)) {
      historyStackRef.current.push(currentStep);
    }
    
    // Reset guard entries count on step change
    guardEntriesCountRef.current = 0;
  }, [currentStep]);

  // Initialize our history stack on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = parseInt(urlParams.get('step') || '1');
    
    historyStackRef.current = [];
    for (let i = 1; i <= urlStep; i++) {
      historyStackRef.current.push(i);
    }
    
    console.log('📱 Initialized history stack:', historyStackRef.current);
  }, []);

  /**
   * Synchronously push guard entries to create a buffer.
   * These MUST be synchronous to prevent the browser exiting during the gap.
   */
  const pushGuardEntries = useCallback((step: number, count: number = 3) => {
    const url = window.location.href;
    for (let i = 0; i < count; i++) {
      window.history.pushState({ step, guard: true, ts: Date.now() }, '', url);
    }
    guardEntriesCountRef.current = count;
    lastPushedStepRef.current = step;
    console.log(`📱 Pushed ${count} guard entries for step ${step}`);
  }, []);

  const handleBackNavigation = useCallback((event: PopStateEvent) => {
    const now = Date.now();
    const step = currentStepRef.current;
    
    // Debounce rapid back presses to prevent race conditions
    if (now - lastBackPressTimeRef.current < BACK_PRESS_DEBOUNCE_MS) {
      console.log('📱 Debounced rapid back press');
      // Still push a guard entry synchronously to prevent exit
      window.history.pushState({ step, guard: true, ts: now }, '', window.location.href);
      return;
    }
    lastBackPressTimeRef.current = now;
    
    // Prevent re-entrancy
    if (isHandlingBackRef.current) {
      console.log('📱 Already handling back, pushing guard');
      window.history.pushState({ step, guard: true, ts: now }, '', window.location.href);
      return;
    }
    
    isHandlingBackRef.current = true;
    
    console.log('📱 Mobile back navigation triggered', { 
      currentStep: step, 
      isGuarded, 
      hasShownConfirmOnThisStep,
      isLeaving: isLeavingRef.current,
      historyStack: historyStackRef.current,
      historyState: event.state
    });
    
    // CRITICAL: Synchronously push guard entry FIRST to prevent browser exit
    window.history.pushState({ step, guard: true, immediate: true, ts: now }, '', window.location.href);
    
    // If we're in the process of leaving (user confirmed), go to step 1
    if (isLeavingRef.current) {
      console.log('📱 User confirmed leave, going to step 1');
      isLeavingRef.current = false;
      
      const step1Url = `${window.location.pathname}?step=1`;
      window.history.replaceState({ step: 1 }, '', step1Url);
      onStepChange(1);
      historyStackRef.current = [1];
      guardEntriesCountRef.current = 0;
      
      trackEvent('back_intercept_leave', {
        journey_id: journeyId,
        step,
        step_name: `step_${step}`
      });
      
      // Push guard entries synchronously
      pushGuardEntries(1, 3);
      
      isHandlingBackRef.current = false;
      return;
    }
    
    // Calculate the previous step
    const previousStep = step - 1;
    
    console.log('📱 Current step:', step, 'Previous step would be:', previousStep);
    
    // CRITICAL: If we're on step 1, ALWAYS prevent leaving
    if (step <= 1) {
      console.log('📱 On step 1, preventing site exit');
      
      const step1Url = `${window.location.pathname}?step=1`;
      window.history.replaceState({ step: 1 }, '', step1Url);
      
      // Push guard entries synchronously
      pushGuardEntries(1, 3);
      
      isHandlingBackRef.current = false;
      return;
    }
    
    // Navigate to previous step
    if (previousStep >= 1) {
      console.log('📱 Navigating to previous step:', previousStep);
      
      trackEvent('journey_step_changed', {
        journey_id: journeyId,
        from_step: step,
        to_step: previousStep,
        direction: 'back',
        trigger: 'mobile_back_button'
      });
      
      // LANDING PAGE REDIRECT: If going from step 2 back to step 1,
      // check if user came from a landing page and redirect there instead
      if (step === 2 && previousStep === 1) {
        const landingReferrer = sessionStorage.getItem('buyawarranty_landing_referrer');
        if (landingReferrer) {
          console.log('📱 Redirecting back to landing page:', landingReferrer);
          sessionStorage.removeItem('buyawarranty_landing_referrer');
          isHandlingBackRef.current = false;
          window.location.href = landingReferrer;
          return;
        }
      }
      
      // Restore state for previous step if handler provided
      if (restoreStateFromStep) {
        restoreStateFromStep(previousStep);
      }
      
      // Update URL and state
      const stepUrl = `${window.location.pathname}?step=${previousStep}`;
      window.history.replaceState({ step: previousStep }, '', stepUrl);
      
      // Update current step
      onStepChange(previousStep);
      currentStepRef.current = previousStep;
      
      // Update our history stack
      historyStackRef.current = historyStackRef.current.filter(s => s <= previousStep);
      
      // Push guard entries synchronously
      guardEntriesCountRef.current = 0;
      pushGuardEntries(previousStep, 3);
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      isHandlingBackRef.current = false;
      return;
    }
    
    // Fallback: stay on current step
    console.log('📱 Fallback: staying on current step');
    const currentUrl = `${window.location.pathname}?step=${step}`;
    window.history.replaceState({ step }, '', currentUrl);
    
    pushGuardEntries(step, 3);
    
    isHandlingBackRef.current = false;
    
  }, [onStepChange, restoreStateFromStep, isGuarded, onShowConfirmDialog, hasShownConfirmOnThisStep, journeyId, pushGuardEntries]);

  // Method to allow leaving (called when user confirms from dialog)
  const allowLeave = useCallback(() => {
    console.log('📱 Setting allow leave flag');
    isLeavingRef.current = true;
    setHasShownConfirmOnThisStep(false);
    
    const step = currentStepRef.current;
    
    trackEvent('back_intercept_leave', {
      journey_id: journeyId,
      step,
      step_name: `step_${step}`
    });
    
    // Navigate to step 1
    const step1Url = `${window.location.pathname}?step=1`;
    window.history.replaceState({ step: 1 }, '', step1Url);
    onStepChange(1);
    historyStackRef.current = [1];
    guardEntriesCountRef.current = 0;
    
    pushGuardEntries(1, 3);
    
    isLeavingRef.current = false;
  }, [journeyId, onStepChange, pushGuardEntries]);

  // Method to stay (called when user cancels)
  const stay = useCallback(() => {
    console.log('📱 User chose to stay');
    isLeavingRef.current = false;
    
    const step = currentStepRef.current;
    
    trackEvent('back_intercept_stay', {
      journey_id: journeyId,
      step,
      step_name: `step_${step}`
    });
    
    const currentUrl = `${window.location.pathname}?step=${step}`;
    window.history.replaceState({ step }, '', currentUrl);
    
    pushGuardEntries(step, 3);
  }, [journeyId, pushGuardEntries]);

  useEffect(() => {
    console.log('📱 Setting up mobile navigation listeners for step', currentStep);
    
    // Set scroll restoration to manual
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    
    // Ensure history state matches current step
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = parseInt(urlParams.get('step') || '1');
    
    if (!window.history.state || window.history.state.step !== urlStep) {
      window.history.replaceState({ step: urlStep }, '', window.location.href);
      console.log('📱 Set history state for step', urlStep);
    }
    
    // Push initial guard entries synchronously (not via setTimeout)
    if (!hasInitializedHistoryRef.current || lastPushedStepRef.current !== urlStep) {
      pushGuardEntries(urlStep, 3);
      hasInitializedHistoryRef.current = true;
    }
    
    // Listen for popstate events
    window.addEventListener('popstate', handleBackNavigation);
    
    // iOS Safari: handle bfcache
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📱 Page restored from bfcache');
        isLeavingRef.current = false;
        isHandlingBackRef.current = false;
        setHasShownConfirmOnThisStep(false);
        guardEntriesCountRef.current = 0;
        lastBackPressTimeRef.current = 0;
        
        const urlParams = new URLSearchParams(window.location.search);
        const urlStep = parseInt(urlParams.get('step') || '1');
        
        window.history.replaceState({ step: urlStep }, '', window.location.href);
        
        // Push guard entries synchronously on bfcache restore
        pushGuardEntries(urlStep, 3);
      }
    };
    
    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📱 Page going into bfcache');
      }
    };
    
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
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
  }, [handleBackNavigation, currentStep, isGuarded, pushGuardEntries]);

  return {
    allowLeave,
    stay
  };
};
